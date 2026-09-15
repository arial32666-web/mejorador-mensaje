/*
 * Message Enhancer — capa de compatibilidad "tavo" para SillyTavern
 * ====================================================================
 *
 * Igual que en el puerto de Crossroads: ni entry.js ni ui/panel-me.html se
 * tocaron. Este archivo solo crea un `window.tavo` que por dentro habla con
 * SillyTavern. Esta extensión es completamente independiente de Crossroads
 * — no comparte estado, no depende de que la otra esté instalada — aunque
 * ambas vengan de la misma familia de plugins "CCC" en Tavo.
 *
 * SUPUESTOS SOBRE LA API DE SILLYTAVERN
 * --------------------------------------
 * Igual que con Crossroads, esto está escrito contra `SillyTavern.getContext()`
 * sin poder probarlo en vivo. Busca "ADAPTA AQUÍ" si algo no coincide con tu
 * versión — ver también el README-SILLYTAVERN.md de esta carpeta.
 *
 * Diferencia notable con el shim de Crossroads: este plugin espera que los
 * mensajes tengan un campo `.content` (no `.text`), y necesita además poder
 * REEMPLAZAR el texto de un mensaje ya existente (`tavo.message.update`),
 * y leer los ajustes configurables del plugin (`tavo.plugin.config.all()`).
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 0. Acceso al contexto de SillyTavern
  // ---------------------------------------------------------------------

  function getCtx() {
    // ADAPTA AQUÍ si tu SillyTavern no expone esto.
    if (window.SillyTavern && typeof window.SillyTavern.getContext === "function") {
      return window.SillyTavern.getContext();
    }
    if (typeof window.getContext === "function") return window.getContext();
    throw new Error("Message Enhancer: no se encontró SillyTavern.getContext().");
  }

  function safeCtx() {
    try { return getCtx(); } catch (_) { return null; }
  }

  // ---------------------------------------------------------------------
  // 1. Variables: tavo.get / tavo.set (mismo diseño que en Crossroads, pero
  //    con su propio prefijo — extensiones separadas, almacenamiento separado)
  // ---------------------------------------------------------------------

  var GLOBAL_PREFIX = "ime_global::";

  function readVar(key, scope) {
    try {
      var g = localStorage.getItem(GLOBAL_PREFIX + key);
      return g == null ? null : JSON.parse(g);
    } catch (_) { return null; }
  }

  function writeVar(key, value, scope) {
    try {
      localStorage.setItem(GLOBAL_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  // ---------------------------------------------------------------------
  // 2. Avisos (toast)
  // ---------------------------------------------------------------------

  function toast(message) {
    try {
      if (window.toastr && typeof window.toastr.info === "function") {
        window.toastr.info(String(message || ""), "Message Enhancer");
      } else {
        console.log("[Message Enhancer] " + message);
      }
    } catch (_) {}
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------
  // 3. Mensajes: find + update
  // ---------------------------------------------------------------------

  function toTavoMessage(stMsg, index) {
    if (!stMsg) return null;
    return {
      id: index,
      role: stMsg.is_user ? "user" : (stMsg.is_system ? "system" : "assistant"),
      content: typeof stMsg.mes === "string" ? stMsg.mes : ""
    };
  }

  function allTavoMessages() {
    var ctx = safeCtx();
    var chat = (ctx && Array.isArray(ctx.chat)) ? ctx.chat : [];
    return chat.map(toTavoMessage).filter(Boolean);
  }

  var tavoMessage = {
    find: function (index, filter) {
      var list = allTavoMessages();
      if (filter && filter.role) {
        list = list.filter(function (m) { return m.role === filter.role; });
      }
      if (index === -1) return Promise.resolve(list.length ? [list[list.length - 1]] : []);
      if (typeof index === "number") return Promise.resolve(list[index] ? [list[index]] : []);
      return Promise.resolve(list);
    },

    update: function (updated) {
      // updated = { id, content } — id es el índice dentro de ctx.chat.
      var ctx = safeCtx();
      if (!ctx || !Array.isArray(ctx.chat) || !updated || typeof updated.id !== "number") {
        return Promise.resolve(null);
      }
      var entry = ctx.chat[updated.id];
      if (!entry) return Promise.resolve(null);
      entry.mes = String(updated.content == null ? "" : updated.content);

      // ADAPTA AQUÍ: refrescar el mensaje ya renderizado en pantalla. Se intenta
      // primero la función interna de SillyTavern si getContext() la expone; si
      // no, se edita a mano el bloque de texto visible del mensaje.
      try {
        if (typeof ctx.updateMessageBlock === "function") {
          ctx.updateMessageBlock(updated.id, entry);
        } else {
          var block = document.querySelector('.mes[mesid="' + updated.id + '"] .mes_text');
          if (block) block.innerText = entry.mes;
        }
      } catch (_) {}

      try {
        if (typeof ctx.saveChatConditional === "function") ctx.saveChatConditional();
        else if (typeof ctx.saveChat === "function") ctx.saveChat();
      } catch (_) {}

      return Promise.resolve(entry);
    }
  };

  // ---------------------------------------------------------------------
  // 4. Generación de texto (idéntico enfoque que en Crossroads)
  // ---------------------------------------------------------------------

  async function tavoGenerate(prompt, options) {
    var ctx = getCtx();
    // Nota: la opción `options.preset` (id de preset de Tavo) no tiene
    // equivalente directo aquí — se ignora. La generación usa siempre la
    // API/preset que ya tengas activa en SillyTavern. Ver README.
    if (typeof ctx.generateRaw === "function") {
      try { return await ctx.generateRaw({ prompt: prompt }); }
      catch (_) { try { return await ctx.generateRaw(prompt); } catch (_) {} }
    }
    if (typeof ctx.generateQuietPrompt === "function") {
      return await ctx.generateQuietPrompt(prompt, false, true);
    }
    throw new Error("Message Enhancer: no se encontró generateRaw ni generateQuietPrompt.");
  }

  // ---------------------------------------------------------------------
  // 5. Caja de texto (input)
  // ---------------------------------------------------------------------

  function setInputText(text) {
    var ta = document.getElementById("send_textarea");
    if (!ta) return false;
    ta.value = String(text || "");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  var tavoInput = {
    set: function (text) { return Promise.resolve(setInputText(text)); }
  };

  // ---------------------------------------------------------------------
  // 6. Ajustes del plugin (tavo.plugin.config.all())
  // ---------------------------------------------------------------------
  //
  // Tavo genera automáticamente una pantalla de ajustes a partir del
  // "contributes.settings.schema" del manifest. SillyTavern no hace eso para
  // extensiones de terceros, así que index.js arma una versión simple de esa
  // pantalla dentro del cajón de ajustes de Extensions y la guarda aquí.

  var SETTINGS_KEY = "ime_settings::v1";

  function readSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function writeSettings(values) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(values || {})); } catch (_) {}
  }

  var DEFAULT_SETTINGS = {
    iphoneMode: false,
    showFab: true,
    showEnhancerFab: true,
    defaultOoc: "Expand the following scene description into vivid, well-written prose suitable for a roleplay chat message. Keep continuity with established characters and tone. Do not add meta commentary, only output the final prose.",
    length: "medium",
    presetId: ""
  };

  var pluginConfig = {
    all: function () {
      return Object.assign({}, DEFAULT_SETTINGS, readSettings());
    },
    // Usada por el panel de ajustes que arma index.js — no la llama panel-me.html.
    set: function (partial) {
      writeSettings(Object.assign({}, pluginConfig.all(), partial));
    }
  };

  // ---------------------------------------------------------------------
  // 7. Acciones de sidebar / "+" del input -> tavo.plugin.onSidebarAction /
  //    tavo.plugin.onInputAction
  // ---------------------------------------------------------------------

  var sidebarActions = Object.create(null);
  var inputActions = Object.create(null);

  function onSidebarAction(id, handler) { sidebarActions[id] = handler; }
  function onInputAction(id, handler) { inputActions[id] = handler; }

  function wireOpenActions() {
    // SillyTavern no tiene un menú "+" genérico para acciones de plugins de
    // terceros como el de Tavo, así que ambos caminos (sidebar e input action)
    // se exponen igual, por comandos de barra diagonal y por un ítem en el
    // menú de Extensions. Cualquiera de los dos abre el mismo panel.
    try {
      var ctx = safeCtx();
      if (ctx && typeof ctx.registerSlashCommand === "function") {
        ctx.registerSlashCommand("enhance", function () {
          var h = sidebarActions["open-enhancer"] || inputActions["open-enhancer"];
          if (h) h();
          return "";
        }, [], "Abre Message Enhancer (pestaña Usuario)", true, true);

        ctx.registerSlashCommand("enhancechar", function () {
          var h = sidebarActions["open-enhancer-char"] || inputActions["open-enhancer-char"];
          if (h) h();
          return "";
        }, [], "Abre Message Enhancer (pestaña Personaje / Reintento Guiado)", true, true);
      }
    } catch (_) {}

    try {
      var menu = document.getElementById("extensionsMenu");
      if (!menu) return;
      [
        ["open-enhancer", "Mejorar Mensaje"],
        ["open-enhancer-char", "Reintento Guiado"]
      ].forEach(function (pair) {
        var id = pair[0], label = pair[1];
        var item = document.createElement("div");
        item.className = "list-group-item flex-container flexGap5 interactable";
        item.tabIndex = 0;
        item.textContent = label;
        item.addEventListener("click", function () {
          var h = sidebarActions[id] || inputActions[id];
          if (h) h();
        });
        menu.appendChild(item);
      });
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // 8. Ensamblado del objeto global `tavo`
  // ---------------------------------------------------------------------

  window.tavo = {
    get: readVar,
    set: writeVar,
    generate: tavoGenerate,
    message: tavoMessage,
    input: tavoInput,
    utils: { toast: toast },
    plugin: {
      onSidebarAction: onSidebarAction,
      onInputAction: onInputAction,
      config: pluginConfig
    }
  };

  // Se expone para que index.js pueda construir el panel de ajustes sin
  // duplicar la lógica de lectura/escritura.
  window.__imeSettingsBridge = { read: pluginConfig.all, write: pluginConfig.set, defaults: DEFAULT_SETTINGS };

  wireOpenActions();
})();
