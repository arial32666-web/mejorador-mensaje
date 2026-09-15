/*
 * Message Enhancer — arranque de la extensión para SillyTavern
 * =================================================================
 * Igual de "plomería" que el index.js de Crossroads:
 *   1. Carga tavo-shim.js, que expone `window.__imeBuildTavo()` — una fábrica
 *      que arma un objeto `tavo` nuevo cada vez que se llama (no toca
 *      `window.tavo`, así que no puede chocar con Crossroads u otra
 *      extensión CCC portada de la misma forma).
 *   2. Llama a esa fábrica UNA vez para obtener la copia de `tavo` de esta
 *      extensión.
 *   3. Inyecta ui/panel-me.html tal cual, sin editar una línea, y ejecuta su
 *      <script> pasándole esa copia de `tavo` como variable local.
 *   4. Ejecuta entry.js de la misma forma.
 *   5. Agrega un pequeño panel de ajustes dentro del cajón de Extensions de
 *      SillyTavern, porque Tavo genera esa pantalla solo a partir del
 *      manifest.json y SillyTavern no lo hace automáticamente para
 *      extensiones de terceros. Las etiquetas se toman de locales/es.json.
 */

import "./tavo-shim.js";

const BASE_URL = new URL(".", import.meta.url).href;

// Muestra el error directamente en la pantalla (no solo en la consola del
// navegador), porque en apps envolventes como TauriTavern en celular no
// siempre hay forma fácil de abrir las herramientas de desarrollador.
function showVisibleError(label, err) {
  const message = err && err.message ? err.message : String(err);
  console.error("[Message Enhancer] " + label + ":", err);
  try {
    const box = document.createElement("div");
    box.textContent = "[Message Enhancer] " + label + ": " + message;
    box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:999999;"
      + "background:#3a0d0d;color:#ffb3b3;border:1px solid #ff6b6b;border-radius:8px;"
      + "padding:10px 12px;font:12px/1.4 monospace;white-space:pre-wrap;max-height:40vh;"
      + "overflow:auto;box-shadow:0 2px 10px rgba(0,0,0,.5);";
    const closeBtn = document.createElement("div");
    closeBtn.textContent = "✕ cerrar";
    closeBtn.style.cssText = "float:right;cursor:pointer;opacity:.8;margin-left:8px;";
    closeBtn.addEventListener("click", () => box.remove());
    box.prepend(closeBtn);
    document.body.appendChild(box);
  } catch (_) {}
}

function runWithLocalTavo(code, tavo, label) {
  try {
    const fn = new Function("tavo", code);
    fn(tavo);
  } catch (err) {
    showVisibleError("error ejecutando " + label, err);
  }
}

async function fetchText(path) {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) throw new Error("No se pudo leer " + path + " (" + res.status + ")");
  return res.text();
}

async function mountPanelFragment(tavo) {
  const html = await fetchText("ui/panel-me.html");

  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const inlineScripts = Array.from(tmp.querySelectorAll("script"));
  inlineScripts.forEach((node) => node.remove());

  while (tmp.firstChild) {
    document.body.appendChild(tmp.firstChild);
  }

  inlineScripts.forEach((node) => {
    runWithLocalTavo(node.textContent, tavo, "ui/panel-me.html");
  });
}

// ---------------------------------------------------------------------
// Panel de ajustes (equivalente al "contributes.settings.schema" de Tavo)
// ---------------------------------------------------------------------

async function loadLabels() {
  try {
    const res = await fetch(BASE_URL + "locales/es.json");
    if (res.ok) return await res.json();
  } catch (_) {}
  return {};
}

function t(labels, key, fallback) {
  return (labels && labels[key]) || fallback || key;
}

async function mountSettingsPanel() {
  const host = document.getElementById("extensions_settings2") || document.getElementById("extensions_settings");
  if (!host) {
    console.warn("[Message Enhancer] no se encontró el cajón de ajustes de Extensions; se omite el panel de ajustes (el plugin sigue funcionando con los valores por defecto).");
    return;
  }
  const labels = await loadLabels();
  const bridge = window.__imeSettingsBridge;
  if (!bridge) return;
  const current = bridge.read();

  const box = document.createElement("div");
  box.className = "ime-settings inline-drawer";
  box.innerHTML = `
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>${t(labels, "plugin.name", "Mejorar Mensaje")}</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content" style="display:flex; flex-direction:column; gap:8px; padding:8px 2px;">
      <small>${t(labels, "settings.info", "Configura el comportamiento predeterminado de Mejorar Mensaje.")}</small>
      <label class="checkbox_label"><input type="checkbox" id="ime_iphoneMode"> ${t(labels, "settings.iphoneMode", "Modo iPhone")}</label>
      <label class="checkbox_label"><input type="checkbox" id="ime_showFab"> ${t(labels, "settings.showFab.label", "Mostrar botón flotante (FAB)")}</label>
      <label class="checkbox_label"><input type="checkbox" id="ime_showEnhancerFab"> ${t(labels, "settings.showEnhancerFab.label", "Mostrar botón flotante del Mejorador de Mensajes")}</label>
      <label>${t(labels, "settings.defaultOoc.label", "Instrucción OOC predeterminada")}
        <textarea id="ime_defaultOoc" rows="3" style="width:100%"></textarea>
      </label>
      <label>${t(labels, "settings.length.label", "Longitud objetivo")}
        <select id="ime_length">
          <option value="short">${t(labels, "settings.length.short", "Corto")}</option>
          <option value="medium">${t(labels, "settings.length.medium", "Medio")}</option>
          <option value="long">${t(labels, "settings.length.long", "Largo")}</option>
        </select>
      </label>
      <label>${t(labels, "settings.presetId.label", "ID de preset personalizado (opcional)")}
        <input type="text" id="ime_presetId" style="width:100%">
      </label>
    </div>
  `;
  host.appendChild(box);

  const $ = (id) => box.querySelector(id);
  $("#ime_iphoneMode").checked = !!current.iphoneMode;
  $("#ime_showFab").checked = !!current.showFab;
  $("#ime_showEnhancerFab").checked = !!current.showEnhancerFab;
  $("#ime_defaultOoc").value = current.defaultOoc || "";
  $("#ime_length").value = current.length || "medium";
  $("#ime_presetId").value = current.presetId || "";

  function save() {
    bridge.write({
      iphoneMode: $("#ime_iphoneMode").checked,
      showFab: $("#ime_showFab").checked,
      showEnhancerFab: $("#ime_showEnhancerFab").checked,
      defaultOoc: $("#ime_defaultOoc").value,
      length: $("#ime_length").value,
      presetId: $("#ime_presetId").value.trim()
    });
  }
  box.querySelectorAll("input, textarea, select").forEach((el) => {
    el.addEventListener("change", save);
  });

  const header = box.querySelector(".inline-drawer-toggle");
  const content = box.querySelector(".inline-drawer-content");
  header.addEventListener("click", () => {
    const icon = box.querySelector(".inline-drawer-icon");
    const hidden = content.style.display === "none";
    content.style.display = hidden ? "flex" : "none";
    if (icon) icon.classList.toggle("down", hidden);
  });
}

async function boot() {
  if (typeof window.__imeBuildTavo !== "function") {
    showVisibleError("arranque", new Error("tavo-shim.js no cargó correctamente."));
    return;
  }
  const tavo = window.__imeBuildTavo();

  try {
    await mountPanelFragment(tavo);
  } catch (err) {
    showVisibleError("no se pudo montar ui/panel-me.html", err);
    return;
  }

  try {
    const entryCode = await fetchText("entry.js");
    runWithLocalTavo(entryCode, tavo, "entry.js");
  } catch (err) {
    showVisibleError("no se pudo cargar entry.js", err);
  }

  try {
    await mountSettingsPanel();
  } catch (err) {
    showVisibleError("no se pudo montar el panel de ajustes", err);
  }

  console.log("[Message Enhancer] extensión cargada.");
}

if (document.body) {
  boot();
} else {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
}
