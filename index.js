// Mejorador de Mensaje — extensión para SillyTavern / TauriTavern
// Rediseñado al estilo "Enhancer" (paleta de colores, pestaña User,
// Scene Description, OOC Prompt - Scene, OOC Prompt - Main).
// Solo implementa la pestaña "User" — "Char" se deja fuera a propósito.

(function () {
  const MODULE_NAME = 'mejorador_mensaje';

  const ACCENTS = ['#e05d5d', '#e08a3d', '#c9a227', '#4caf6d', '#3bb3a6', '#4d8ce0'];

  const DEFAULT_SETTINGS = {
    mainInstruction:
      'Reescribe el siguiente mensaje de rol expandiéndolo con más detalle narrativo y sensorial, sin cambiar la intención ni añadir diálogo nuevo, manteniendo las acciones entre asteriscos. Responde solo con el texto reescrito, sin explicaciones ni comillas.',
    accent: ACCENTS[0],
    useContext: true,
    fabPos: null,
  };

  function getCtx() { return SillyTavern.getContext(); }

  function loadSettings() {
    const ctx = getCtx();
    if (!ctx.extensionSettings[MODULE_NAME]) {
      ctx.extensionSettings[MODULE_NAME] = { ...DEFAULT_SETTINGS };
    }
    const s = ctx.extensionSettings[MODULE_NAME];
    for (const key in DEFAULT_SETTINGS) {
      if (s[key] === undefined) s[key] = DEFAULT_SETTINGS[key];
    }
    return s;
  }

  function saveSettings() { getCtx().saveSettingsDebounced(); }

  function buildPrompt(scene, sceneOoc, mainOoc) {
    const extra = sceneOoc && sceneOoc.trim() ? ` ${sceneOoc.trim()}` : '';
    const main = mainOoc && mainOoc.trim() ? mainOoc.trim() : '';
    return (
      `Mensaje a mejorar:\n${scene.trim()}\n\n` +
      `[OOC: ${main} ${extra} No agregues comentarios fuera de personaje, responde solo con el texto final.]`
    );
  }

  function accentDotsHtml(current) {
    return ACCENTS.map((c) => `<span class="mje-dot${c === current ? ' is-on' : ''}" data-color="${c}" style="background:${c}"></span>`).join('');
  }

  function injectHtml() {
    const settings = loadSettings();
    const html = `
      <div id="mje-fab" title="Arrastra para mover">✨</div>

      <div id="mje-overlay" class="mje-hidden">
        <div id="mje-panel">
          <div class="mje-header">
            <span class="mje-title">Enhancer</span>
            <div class="mje-dots">${accentDotsHtml(settings.accent)}</div>
            <span id="mje-moon" title="Solo visual">☾</span>
            <span id="mje-close" title="Cerrar">✕</span>
          </div>

          <div class="mje-tabs">
            <span class="mje-tab is-on" id="mje-tab-user">👤 User</span>
            <span class="mje-tab is-off" id="mje-tab-char" title="No implementado en esta versión">🤖 Char</span>
          </div>

          <div class="mje-section">
            <div class="mje-section-label">🎬 SCENE DESCRIPTION</div>
            <textarea id="mje-scene" rows="4" placeholder="Describe qué pasa, en pocas palabras... ej: 'hola *sacude la mano con felicidad sonriendo*'"></textarea>
          </div>

          <div class="mje-section">
            <div class="mje-section-label">
              ⚙ OOC PROMPT - SCENE <span class="mje-badge">optional</span>
            </div>
            <div class="mje-hint">Temporal — se borra después de mejorar. Úsalo para instrucciones puntuales de esta escena.</div>
            <textarea id="mje-ooc-scene" rows="2" placeholder="Ej: 'enfócate en su reacción, mantenlo interno, sin diálogo.'"></textarea>
          </div>

          <div class="mje-section">
            <div class="mje-section-label">
              🔖 OOC PROMPT - MAIN <span class="mje-badge">optional</span>
            </div>
            <div class="mje-hint">Se guarda de forma permanente — aplica a cada mejora.</div>
            <textarea id="mje-ooc-main" rows="3"></textarea>
          </div>

          <button id="mje-run" class="mje-primary">✨ <span id="mje-run-label">Enhance</span></button>

          <div id="mje-error" class="mje-error mje-hidden"></div>

          <div id="mje-result-wrap" class="mje-hidden">
            <div class="mje-section-label">RESULTADO (editable)</div>
            <textarea id="mje-result" rows="7"></textarea>
            <div class="mje-actions">
              <button id="mje-retry">Reintentar</button>
              <button id="mje-use" class="mje-primary">Usar este</button>
            </div>
          </div>
        </div>
      </div>`;
    $('body').append(html);
    $('#mje-ooc-main').val(settings.mainInstruction);
  }

  function applyAccent(color) {
    document.documentElement.style.setProperty('--mje-accent', color);
  }

  function wireUp() {
    let busy = false;

    const $fab = $('#mje-fab');
    const $overlay = $('#mje-overlay');
    const $scene = $('#mje-scene');
    const $oocScene = $('#mje-ooc-scene');
    const $oocMain = $('#mje-ooc-main');
    const $run = $('#mje-run');
    const $runLabel = $('#mje-run-label');
    const $error = $('#mje-error');
    const $resultWrap = $('#mje-result-wrap');
    const $result = $('#mje-result');

    applyAccent(loadSettings().accent);

    function openPanel() { $overlay.removeClass('mje-hidden'); }
    function closePanel() { $overlay.addClass('mje-hidden'); }
    $('#mje-close').on('click', closePanel);

    $('#mje-tab-char').on('click', () => {
      showError('La pestaña "Char" no está disponible en esta versión.');
    });

    $('.mje-dots').on('click', '.mje-dot', function () {
      const color = $(this).data('color');
      const settings = loadSettings();
      settings.accent = color;
      saveSettings();
      applyAccent(color);
      $('.mje-dot').removeClass('is-on');
      $(this).addClass('is-on');
    });

    $oocMain.on('input', function () {
      const settings = loadSettings();
      settings.mainInstruction = $(this).val();
      saveSettings();
    });

    function showError(msg) { $error.text(msg).removeClass('mje-hidden'); }
    function clearError() { $error.text('').addClass('mje-hidden'); }
    function setBusy(state, label) {
      busy = state;
      $run.prop('disabled', state);
      $runLabel.text(label || 'Enhance');
    }

    async function runGenerate(label) {
      const scene = $scene.val().trim();
      if (!scene) { showError('Escribe primero la descripción de la escena.'); return; }
      clearError();
      setBusy(true, label);
      try {
        const settings = loadSettings();
        const ctx = getCtx();
        const prompt = buildPrompt(scene, $oocScene.val(), settings.mainInstruction);
        const text = await ctx.generateQuietPrompt({ quietPrompt: prompt });
        $result.val((text || '').trim());
        $resultWrap.removeClass('mje-hidden');
        $oocScene.val(''); // OOC - Scene es temporal: se borra tras mejorar
        setBusy(false, 'Reintentar mejora');
      } catch (e) {
        setBusy(false, 'Enhance');
        showError('Falló la generación: ' + (e && e.message ? e.message : String(e)));
      }
    }

    $run.on('click', () => runGenerate('Mejorando...'));
    $('#mje-retry').on('click', () => runGenerate('Mejorando...'));

    $('#mje-use').on('click', () => {
      const text = $result.val().trim();
      if (!text) return;
      $('#send_textarea').val(text).trigger('input');
      $scene.val('');
      $resultWrap.addClass('mje-hidden');
      $runLabel.text('Enhance');
      clearError();
      closePanel();
    });

    // ---------- burbuja arrastrable ----------
    let dragging = false;
    let moved = false;
    let startX, startY, startRight, startBottom;

    function applyFabPos(settings) {
      if (settings.fabPos) {
        $fab.css({ right: settings.fabPos.right + 'px', bottom: settings.fabPos.bottom + 'px' });
      } else {
        $fab.css({ right: '', bottom: '' });
      }
    }
    applyFabPos(loadSettings());

    function onPointerDown(e) {
      dragging = true;
      moved = false;
      const p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      const rect = $fab[0].getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      let right = startRight - dx;
      let bottom = startBottom - dy;
      right = Math.max(4, Math.min(window.innerWidth - 52, right));
      bottom = Math.max(4, Math.min(window.innerHeight - 52, bottom));
      $fab.css({ right: right + 'px', bottom: bottom + 'px' });
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        const settings = loadSettings();
        const rect = $fab[0].getBoundingClientRect();
        settings.fabPos = {
          right: Math.round(window.innerWidth - rect.right),
          bottom: Math.round(window.innerHeight - rect.bottom),
        };
        saveSettings();
      } else {
        openPanel();
      }
    }

    $fab.on('mousedown touchstart', onPointerDown);
    $(document).on('mousemove touchmove', onPointerMove);
    $(document).on('mouseup touchend', onPointerUp);
  }

  $(document).ready(function () {
    const check = setInterval(() => {
      if ($('#send_textarea').length) {
        clearInterval(check);
        loadSettings();
        injectHtml();
        wireUp();
      }
    }, 500);
  });
})();
