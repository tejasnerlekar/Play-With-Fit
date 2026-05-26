/* ================================================================
   Play With Fit — PWFControls Utility
   ----------------------------------------------------------------
   Add to any sketch:
     <script src="../shared/controls.js"></script>

   Exposes: window.PWFControls
   ================================================================ */

(function (global) {
  'use strict';

  /* --------------------------------------------------------------
     Theme definitions
     Each sketch can use these or define its own.
  -------------------------------------------------------------- */
  const THEMES = {
    /** Dark (default) */
    dark: {
      bg: '#0a0a0a', fg: '#ffffff',
      panelWrapBg: 'rgba(10,10,10,0.40)',
      panelBg:     'rgba(18,18,18,0.84)',
      panelText:   '#ffffff',
      inputBg:     'rgba(255,255,255,0.09)',
      inputBorder: 'rgba(255,255,255,0.13)',
      inputFocus:  'rgba(255,255,255,0.40)',
      toggleBg:    '#ffffff',
      toggleFg:    '#000000',
    },
    /** Fit yellow-green */
    green: {
      bg: '#e1ff4f', fg: '#000000',
      panelWrapBg: 'rgba(175,195,15,0.30)',
      panelBg:     'rgba(195,215,20,0.48)',
      panelText:   '#000000',
      inputBg:     'rgba(255,255,255,0.38)',
      inputBorder: 'rgba(0,0,0,0.14)',
      inputFocus:  'rgba(0,0,0,0.35)',
      toggleBg:    '#000000',
      toggleFg:    '#e1ff4f',
    },
    /** Deep blue */
    blue: {
      bg: '#00176a', fg: '#f05ae4',
      panelWrapBg: 'rgba(0,12,75,0.35)',
      panelBg:     'rgba(0,18,88,0.82)',
      panelText:   '#ffffff',
      inputBg:     'rgba(255,255,255,0.10)',
      inputBorder: 'rgba(255,255,255,0.13)',
      inputFocus:  'rgba(255,255,255,0.40)',
      toggleBg:    '#f05ae4',
      toggleFg:    '#00176a',
    },
    /** Pure black */
    black: {
      bg: '#000000', fg: '#ffffff',
      panelWrapBg: 'rgba(10,10,10,0.40)',
      panelBg:     'rgba(18,18,18,0.84)',
      panelText:   '#ffffff',
      inputBg:     'rgba(255,255,255,0.09)',
      inputBorder: 'rgba(255,255,255,0.13)',
      inputFocus:  'rgba(255,255,255,0.40)',
      toggleBg:    '#ffffff',
      toggleFg:    '#000000',
    },
  };

  /* --------------------------------------------------------------
     applyTheme(theme, options)
     ----------------------------------------------------------------
     theme   — a theme object from THEMES, or a custom object
     options — {
       panelWrapId : string  (default 'ctrlWrap')
       toggleId    : string  (default 'ctrl-toggle')
       sceneEl     : Element (default document.body)
     }
  -------------------------------------------------------------- */
  function applyTheme(theme, options) {
    const opts    = options || {};
    const wrapEl  = document.getElementById(opts.panelWrapId || 'ctrlWrap');
    const sceneEl = opts.sceneEl || document.body;

    // Scene background
    sceneEl.style.background = theme.bg;

    // CSS variable updates on :root
    const r = document.documentElement.style;
    r.setProperty('--bg',            theme.bg);
    r.setProperty('--fg',            theme.fg);
    r.setProperty('--panel-wrap-bg', theme.panelWrapBg);
    r.setProperty('--panel-bg',      theme.panelBg);
    r.setProperty('--panel-text',    theme.panelText);
    r.setProperty('--input-bg',      theme.inputBg);
    r.setProperty('--input-border',  theme.inputBorder);
    r.setProperty('--input-focus',   theme.inputFocus);

    // Directly patch arrow + panel (backdrop-filter may cache bg)
    const arrowEl = wrapEl && wrapEl.querySelector('.ctrl-arrow');
    if (arrowEl) arrowEl.style.background = theme.panelWrapBg;

    const panelEl = wrapEl && wrapEl.querySelector('.ctrl-panel');
    if (panelEl) {
      panelEl.style.background = theme.panelBg;
      panelEl.style.color      = theme.panelText;
    }
  }

  /* --------------------------------------------------------------
     initToggle(wrapId, arrowId)
     ----------------------------------------------------------------
     Wires the arrow tab inside the panel.
     On desktop (> 700px): arrow shows › (open) / ‹ (closed).
     On mobile  (≤ 700px): arrow shows ↑ (open) / ↓ (closed).

     wrapId  — id of .ctrl-wrap element   (default 'ctrlWrap')
     arrowId — id of .ctrl-arrow button   (default 'ctrl-arrow')
  -------------------------------------------------------------- */
  function initToggle(wrapId, arrowId) {
    const wrap  = document.getElementById(wrapId  || 'ctrlWrap');
    const arrow = document.getElementById(arrowId || 'ctrl-arrow');
    if (!wrap || !arrow) return;

    let visible = true;
    const mq = window.matchMedia('(max-width: 700px)');

    function updateArrow() {
      const mobile = mq.matches;
      arrow.textContent = visible ? (mobile ? '↓' : '›') : (mobile ? '↑' : '‹');
    }

    arrow.addEventListener('click', () => {
      visible = !visible;
      wrap.classList.toggle('hidden', !visible);
      updateArrow();
    });

    mq.addEventListener('change', updateArrow);
    updateArrow();
  }

  /* --------------------------------------------------------------
     initSwatches(selector, themeArray, onSelect)
     ----------------------------------------------------------------
     Wires colour swatch buttons (.sw elements).

     selector   — CSS selector that matches all swatches in this sketch
     themeArray — ordered array of theme objects, index matches data-i
     onSelect   — function(theme, index) called when a swatch is clicked

     Example:
       PWFControls.initSwatches('.sw', [THEMES.green, THEMES.blue, THEMES.dark],
         (t) => PWFControls.applyTheme(t));
  -------------------------------------------------------------- */
  function initSwatches(selector, themeArray, onSelect) {
    const swatches = document.querySelectorAll(selector);
    swatches.forEach(sw => {
      sw.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        const idx = parseInt(sw.dataset.i, 10) || 0;
        const theme = themeArray[idx] || themeArray[0];
        if (onSelect) onSelect(theme, idx);
      });
    });
  }

  /* --------------------------------------------------------------
     Public API
  -------------------------------------------------------------- */
  global.PWFControls = {
    THEMES,
    applyTheme,
    initToggle,
    initSwatches,
  };

})(window);
