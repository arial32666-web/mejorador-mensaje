// Mejorador de Mensaje — extensión para SillyTavern / TauriTavern
//
// Usa la API pública SillyTavern.getContext() (documentada en
// docs.sillytavern.app/for-contributors/writing-extensions) en vez de
// imports internos, para que sea más resistente a cambios de versión.

(function () {
  const MODULE_NAME = 'mejorador_mensaje';

  const DEFAULT_SETTINGS = {
    instruction:
      'Reescribe el siguiente mensaje de rol expandiéndolo con más detalle narrativo y sensorial, sin cambiar la intención ni añadir diálogo nuevo, manteniendo las acciones entre asteriscos. Responde solo con el texto reescrito, sin explicaciones ni comillas.',
    length: 'medium',
    useContext: true,
  };

  function getCtx() {
    return SillyTavern.getContext();
  }

  function loadSettings() {
    const ctx = getCtx();
    if (!ctx.extensionSettings[MODULE_NAME]) {
      ctx.extensionSettings[MODULE_NAME] = { ...DEFAULT_SETTINGS };
    }
    for (const key in DEFAULT_SETTINGS) {
      if (ctx.extensionSettings[MODULE_NAME][key] === undefined) {
        ctx.extensionSettings[MODULE_NAME][key] = DEFAULT_SETTINGS[key];
      }
    }
    return ctx.extensionSettings[MODULE_NAME];
  }

  function saveSettings() {
    getCtx().saveSettingsDebounced();
  }

  function buildPrompt(scene, extraOoc, settings) {
    const lengthMap = { short: 'Corto.', medium: 'Longitud media.', long: 'Largo y detallado.' };
    const lengthHint = lengthMap[settings.length] || '';
    const extra = extraOoc && extraOoc.trim() ? ` ${extraOoc.trim()}` : '';
    return (
      `Mensaje a mejorar:\n${scene.trim()}\n\n` +
      `[OOC: ${settings.instruction} ${lengthHint}${extra} No agregues comentarios fuera de personaje, responde solo con el texto final.]`
    );
  }

  function injectPanelHtml() {
    const html = `
      <div id="mje-fab" title="Mejorar mensaje">✨</div>
      <div id="mje-overlay" class="mje-hidden">
        <div id="mje-panel">
          <div class="mje-header">
            <span class="mje-title">Mejorar mensaje</span>
            <span id="mje-close">✕</span>
          </div>

          <label class="mje-label">Tu mensaje tosco</label>
          <textarea id="mje-scene" rows="4" placeholder="Ej: hola *sacude la mano con felicidad sonriendo*"></textarea>

          <label class="mje-label">Instrucción extra (opcional)</label>
          <input id="mje-ooc" type="text" placeholder="Ej: en primera persona, tono serio..." />

          <button id="mje-run" class="mje-primary"><span id="mje-run-label">Mejorar</span></button>

          <div id="mje-error" class="mje-error mje-hidden"></div>

          <div id="mje-result-wrap" class="mje-hidden">
            <label class="mje-label">Resultado (puedes editarlo)</label>
            <textarea id="mje-result" rows="8"></textarea>
            <div id="mje-hist-nav" class="mje-nav mje-hidden">
              <button id="mje-prev">‹</button>
              <span id="mje-hist-count"></span>
              <button id="mje-next">›</button>
            </div>
            <div class="mje-actions">
              <button id="mje-retry">Reintentar</button>
              <button id="mje-use" class="mje-primary">Usar este</button>
            </div>
          </div>
        </div>
      </div>`;
    $('body').append(html);
  }

  function injectSettingsHtml() {
    const settings = loadSettings();
    const html = `
      <div class="mje-settings-block">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b>Mejorador de Mensaje</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
          </div>
          <div class="inline-drawer-content">
            <label class="mje-label">Instrucción de mejora</label>
            <textarea id="mje-cfg-instruction" rows="3">${settings.instruction}</textarea>

            <label class="mje-label">Longitud del resultado</label>
            <select id="mje-cfg-length">
              <option value="short">Corta</option>
              <option value="medium">Media</option>
              <option value="long">Larga</option>
            </select>

            <label class="mje-label" style="display:flex; align-items:center; gap:6px;">
              <input id="mje-cfg-context" type="checkbox" style="width:auto;" />
              Usar el contexto del chat (recomendado)
            </label>
          </div>
        </div>
      </div>`;
    $('#extensions_settings2').append(html);
    $('#mje-cfg-instruction').val(settings.instruction);
    $('#mje-cfg-length').val(settings.length);
    $('#mje-cfg-context').prop('checked', settings.useContext);

    $('#mje-cfg-instruction').on('input', function () {
      settings.instruction = $(this).val();
      saveSettings();
    });
    $('#mje-cfg-length').on('change', function () {
      settings.length = $(this).val();
      saveSettings();
    });
    $('#mje-cfg-context').on('change', function () {
      settings.useContext = $(this).is(':checked');
      saveSettings();
    });
  }

  function wireUp() {
    let history = [];
    let historyIndex = -1;
    let busy = false;

    const $fab = $('#mje-fab');
    const $overlay = $('#mje-overlay');
    const $scene = $('#mje-scene');
    const $ooc = $('#mje-ooc');
    const $run = $('#mje-run');
    const $runLabel = $('#mje-run-label');
    const $error = $('#mje-error');
    const $resultWrap = $('#mje-result-wrap');
    const $result = $('#mje-result');
    const $histNav = $('#mje-hist-nav');
    const $histCount = $('#mje-hist-count');
    const $prev = $('#mje-prev');
    const $next = $('#mje-next');

    function openPanel() { $overlay.removeClass('mje-hidden'); }
    function closePanel() { $overlay.addClass('mje-hidden'); }

    $fab.on('click', openPanel);
    $('#mje-close').on('click', closePanel);

    function showError(msg) { $error.text(msg).removeClass('mje-hidden'); }
    function clearError() { $error.text('').addClass('mje-hidden'); }
    function setBusy(state, label) {
      busy = state;
      $run.prop('disabled', state);
      $runLabel.text(label || 'Mejorar');
    }

    function renderResult() {
      const entry = history[historyIndex];
      $result.val(entry ? entry.text : '');
      const total = history.length;
      $histNav.toggleClass('mje-hidden', total <= 1);
      $histCount.text(total ? `${historyIndex + 1}/${total}` : '');
      $prev.prop('disabled', historyIndex <= 0);
      $next.prop('disabled', historyIndex >= total - 1);
    }

    async function runGenerate(label) {
      const scene = $scene.val().trim();
      if (!scene) { showError('Escribe primero tu mensaje.'); return; }
      clearError();
      setBusy(true, label);
      try {
        const settings = loadSettings();
        const ctx = getCtx();
        const prompt = buildPrompt(scene, $ooc.val(), settings);
        const text = await ctx.generateQuietPrompt({ quietPrompt: prompt });
        history = history.slice(0, historyIndex + 1);
        history.push({ text: (text || '').trim() });
        historyIndex = history.length - 1;
        $resultWrap.removeClass('mje-hidden');
        renderResult();
        setBusy(false, 'Reintentar mejora');
      } catch (e) {
        setBusy(false, 'Mejorar');
        showError('Falló la generación: ' + (e && e.message ? e.message : String(e)));
      }
    }

    $run.on('click', () => runGenerate('Mejorando...'));
    $('#mje-retry').on('click', () => runGenerate('Mejorando...'));
    $prev.on('click', () => { if (historyIndex > 0) { historyIndex--; renderResult(); } });
    $next.on('click', () => { if (historyIndex < history.length - 1) { historyIndex++; renderResult(); } });

    $('#mje-use').on('click', () => {
      const text = $result.val().trim();
      if (!text) return;
      $('#send_textarea').val(text).trigger('input');
      history = [];
      historyIndex = -1;
      $scene.val('');
      $ooc.val('');
      $resultWrap.addClass('mje-hidden');
      $runLabel.text('Mejorar');
      clearError();
      closePanel();
    });
  }

  $(document).ready(function () {
    const check = setInterval(() => {
      if ($('#send_textarea').length && $('#extensions_settings2').length) {
        clearInterval(check);
        loadSettings();
        injectPanelHtml();
        injectSettingsHtml();
        wireUp();
      }
    }, 500);
  });
})();
