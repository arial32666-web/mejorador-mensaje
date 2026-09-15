/*
 * Message Enhancer — arranque de la extensión para SillyTavern
 * =================================================================
 * Igual de "plomería" que el index.js de Crossroads:
 *   1. Carga tavo-shim.js (define window.tavo).
 *   2. Inyecta ui/panel-me.html tal cual, sin editar una línea.
 *   3. Carga entry.js tal cual.
 *   4. Agrega un pequeño panel de ajustes dentro del cajón de Extensions de
 *      SillyTavern, porque Tavo genera esa pantalla solo a partir del
 *      manifest.json y SillyTavern no lo hace automáticamente para
 *      extensiones de terceros. Las etiquetas se toman de locales/es.json.
 */

import "./tavo-shim.js";

const BASE_URL = new URL(".", import.meta.url).href;

function loadScriptTag(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar " + src));
    document.body.appendChild(s);
  });
}

async function mountPanelFragment() {
  const res = await fetch(BASE_URL + "ui/panel-me.html");
  if (!res.ok) throw new Error("No se pudo leer ui/panel-me.html (" + res.status + ")");
  const html = await res.text();

  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const inlineScripts = Array.from(tmp.querySelectorAll("script"));
  inlineScripts.forEach((node) => node.remove());

  while (tmp.firstChild) {
    document.body.appendChild(tmp.firstChild);
  }

  inlineScripts.forEach((oldScript) => {
    const s = document.createElement("script");
    s.textContent = oldScript.textContent;
    document.body.appendChild(s);
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

  // El toggle de inline-drawer de SillyTavern se activa solo si la clase CSS
  // ya está cargada por el core; si tu tema no la reconoce, el contenido
  // igual queda visible (solo no colapsa/expande con animación).
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
  try {
    await mountPanelFragment();
  } catch (err) {
    console.error("[Message Enhancer] no se pudo montar ui/panel-me.html:", err);
    return;
  }
  try {
    await loadScriptTag(BASE_URL + "entry.js");
  } catch (err) {
    console.error("[Message Enhancer] no se pudo cargar entry.js:", err);
  }
  try {
    await mountSettingsPanel();
  } catch (err) {
    console.error("[Message Enhancer] no se pudo montar el panel de ajustes:", err);
  }
  console.log("[Message Enhancer] extensión cargada.");
}

if (document.body) {
  boot();
} else {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
}
