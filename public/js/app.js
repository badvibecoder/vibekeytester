// vibekeytester — frontend: multi-layout keyboard key tester.
// Draws the selected board (see keyboards.js) as neon keycaps, watches the
// physical keyboard, flashes each cap on keydown and leaves a subtle
// theme-colored glow on verified keys. Includes the thock keyboard sound and
// persisted settings (server-side). Progress is tracked per board layout.

(function () {
  'use strict';

  // ---- DOM -------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const els = {
    kb: $('kb'),
    boardMeta: $('board-meta'),
    layoutSelect: $('layout-select'),
    themeSelect: $('theme-select'),
    soundToggle: $('sound-toggle'),
    soundIcon: $('sound-icon'),
    progress: $('progress'),
    progressFill: $('progress-fill'),
    covPct: $('cov-pct'),
    covCount: $('cov-count'),
    statPressed: $('stat-pressed'),
    statLast: $('stat-last'),
    statRemaining: $('stat-remaining'),
    resetBtn: $('reset-btn'),
    extras: $('extras'),
    extrasList: $('extras-list'),
    hint: $('hint'),
  };

  const THEMES = ['neondusk', 'outrun', 'vaporwave', 'cyberpunk', 'midnightgrid', 'chrome', 'toxicglow', 'retroarcade'];
  const SETTINGS_DEFAULTS = { theme: 'neondusk', sound: 'on' };
  const LS_TESTED = 'vibekeytester.tested';   // + '.' + layout id
  const LS_LAYOUT = 'vibekeytester.layout';
  const LS_THEME = 'vibekeytester.theme';

  let currentTheme = SETTINGS_DEFAULTS.theme;
  let soundOn = SETTINGS_DEFAULTS.sound === 'on';

  // ---- state (per layout) ----------------------------------------------
  let layout = null;            // active layout object from KEYBOARDS
  const state = {
    lit: new Set(),             // codes verified for the current layout
    extras: new Map(),          // code -> { key, count }
    presses: 0,
    last: null,
    complete: false,
  };
  let codeEls = new Map();      // code -> [DOM elements] (dups possible)
  const flashTimers = new Map();

  // ---- helpers ---------------------------------------------------------
  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) {
      let msg = res.statusText || 'request failed';
      try {
        const j = await res.json();
        if (j && j.error) msg = j.error;
      } catch (_) {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function layoutTotalKeys(l) {
    // every cap that can report a code counts toward progress
    return l.keys.filter((k) => k.code).length;
  }

  // ---- board -----------------------------------------------------------
  let u = 46;      // key unit (px) — both horizontal & vertical pitch

  function sizeBoard() {
    const panel = els.kb.parentElement;
    const avail = Math.max(320, panel.clientWidth - 48);
    // rough width estimate in units for the fit divisor
    let maxX = 0;
    for (const k of layout.keys) maxX = Math.max(maxX, k.x + (k.w || 1));
    u = Math.min(64, Math.max(12, Math.floor(avail / (maxX + 2.2))));
    els.kb.style.setProperty('--u', u + 'px');
  }

  function makeCap(def, leftPx, topPx, widthPx, heightPx) {
    const key = document.createElement('div');
    key.className = 'key';
    if ((def.w || 1) >= 1.4 || (def.label && def.label.length >= 3)) key.classList.add('key--wide');
    if (def.arrow) key.classList.add('key--arrow');
    if (def.code === 'Space') key.classList.add('key--space');
    if (def.noEvent) key.classList.add('key--noevent');

    const legs = document.createElement('div');
    legs.className = 'key__legends';
    if (def.sub) {
      const sub = document.createElement('span');
      sub.className = 'legend legend--sub';
      sub.textContent = def.sub;
      legs.appendChild(sub);
    }
    const main = document.createElement('span');
    main.className = 'legend legend--main';
    main.textContent = def.label;
    legs.appendChild(main);
    key.appendChild(legs);
    if (def.noEvent) {
      const tag = document.createElement('span');
      tag.className = 'key__tag';
      tag.textContent = def.tag || 'layer';
      legs.appendChild(tag);
    }

    key.style.left = leftPx + 'px';
    key.style.top = topPx + 'px';
    key.style.width = widthPx + 'px';
    key.style.height = heightPx + 'px';
    if (def.code) key.dataset.code = def.code;
    if (def.code) {
      if (!codeEls.has(def.code)) codeEls.set(def.code, []);
      codeEls.get(def.code).push(key);
    }
    return key;
  }

  function renderBoard() {
    els.kb.innerHTML = '';
    codeEls.clear();
    sizeBoard();

    const unit = u;
    const kw = (w) => Math.round(w * unit) - 3;          // width incl. seam
    const kh = (h) => Math.round((h || 1) * unit) - 3;   // height incl. seam
    const xAt = (xu) => Math.round(xu * unit);
    const yAt = (rowIdx) => Math.round(rowIdx * unit);

    let maxRight = 0;
    let maxBottom = 0;
    for (const def of layout.keys) {
      const w = def.w || 1;
      const h = def.h || 1;
      const el = makeCap(def, xAt(def.x), yAt(def.y), kw(w), kh(h));
      els.kb.appendChild(el);
      maxRight = Math.max(maxRight, xAt(def.x) + kw(w));
      maxBottom = Math.max(maxBottom, yAt(def.y) + kh(h));
    }

    els.kb.style.width = (maxRight + 8) + 'px';
    els.kb.style.height = (maxBottom + 10) + 'px';
    els.kb.style.position = 'relative';

    restoreLit();
  }

  function setLayout(id) {
    const next = (KEYBOARD_BY_ID || {})[id] || KEYBOARDS[0];
    layout = next;
    try { localStorage.setItem(LS_LAYOUT, layout.id); } catch (_) {}
    els.layoutSelect.value = layout.id;
    updateBoardMeta();
    // per-layout tested set
    state.lit.clear();
    renderBoard();          // restoreLit() populates from the per-layout key
  }

  function updateBoardMeta() {
    const total = layoutTotalKeys(layout);
    const noEvent = layout.keys.filter((k) => k.noEvent).length;
    els.boardMeta.innerHTML =
      '<span class="board-meta__name">' + layout.name + '</span>' +
      '<span class="board-meta__detail">' + total + ' reportable keys' +
      (noEvent ? ' · ' + noEvent + ' layer / mod caps' : '') +
      '</span>' +
      (layout.note ? '<span class="board-meta__note">' + layout.note + '</span>' : '');
  }

  // ---- flash / glow ----------------------------------------------------
  function flashKey(el) {
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    const prev = flashTimers.get(el);
    if (prev) clearTimeout(prev);
    flashTimers.set(el, setTimeout(() => el.classList.remove('is-flash'), 300));
  }

  function flashAll(code) {
    const els = codeEls.get(code);
    if (!els) return;
    els.forEach(flashKey);
  }

  function markLit(code) {
    const els = codeEls.get(code);
    if (!els) return;
    if (!state.lit.has(code)) {
      state.lit.add(code);
      persistLit();
    }
    els.forEach((el) => el.classList.add('is-lit'));
    updateProgress();
  }

  // ---- persistence -----------------------------------------------------
  function testedKey() {
    return LS_TESTED + '.' + layout.id;
  }

  function persistLit() {
    try { localStorage.setItem(testedKey(), JSON.stringify([...state.lit])); } catch (_) {}
  }

  function restoreLit() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(testedKey()) || '[]'); } catch (_) {}
    if (!Array.isArray(saved)) saved = [];
    for (const code of saved) {
      if (!codeEls.has(code)) continue;
      state.lit.add(code);
      codeEls.get(code).forEach((el) => el.classList.add('is-lit'));
    }
    updateProgress();
  }

  function clearTest() {
    state.lit.clear();
    for (const els of codeEls.values()) els.forEach((el) => el.classList.remove('is-lit'));
    try { localStorage.removeItem(testedKey()); } catch (_) {}
    updateProgress();
  }

  // ---- progress --------------------------------------------------------
  function updateProgress() {
    const total = layoutTotalKeys(layout);
    const n = layout.keys.filter((k) => k.code && state.lit.has(k.code)).length;
    const pct = total ? Math.round((n / total) * 100) : 0;
    els.covPct.textContent = pct + '%';
    els.covCount.textContent = n + ' / ' + total + ' keys tested';
    els.statRemaining.textContent = total - n;
    els.statPressed.textContent = state.presses;
    els.statLast.textContent = state.last || '—';
    els.progressFill.style.width = pct + '%';
    els.progress.setAttribute('aria-valuemax', String(total));
    els.progress.setAttribute('aria-valuenow', String(n));
    const done = total > 0 && n >= total;
    if (done !== state.complete) {
      state.complete = done;
      els.kb.classList.toggle('is-complete', done);
      if (done) {
        els.hint.innerHTML =
          '<span style="color:var(--yellow);text-shadow:0 0 8px color-mix(in srgb,var(--yellow) 60%,transparent);">all ' +
          total + ' keys verified</span> — every reportable key works';
      } else {
        els.hint.innerHTML =
          'press every key on your keyboard — each one <span class="hint-lit">flashes</span> then <span class="hint-glow">glows</span> once verified.';
      }
    }
  }

  // ---- extras ----------------------------------------------------------
  function addExtra(code) {
    let entry = state.extras.get(code);
    if (!entry) {
      entry = { key: code, count: 0 };
      state.extras.set(code, entry);
    }
    entry.count++;
    renderExtras();
  }

  function renderExtras() {
    if (!state.extras.size) {
      els.extras.classList.add('is-hidden');
      els.extrasList.innerHTML = '';
      return;
    }
    els.extras.classList.remove('is-hidden');
    els.extrasList.innerHTML = '';
    for (const entry of state.extras.values()) {
      const chip = document.createElement('span');
      chip.className = 'extras__chip';
      chip.textContent = entry.count > 1 ? entry.key + ' ×' + entry.count : entry.key;
      chip.title = entry.key;
      els.extrasList.appendChild(chip);
    }
  }

  // ---- key events ------------------------------------------------------
  function onKeyDown(e) {
    if (e.repeat) return;

    const target = e.target;
    if (target && (target.tagName === 'SELECT' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return;

    const code = e.code || '';
    const elList = codeEls.get(code);

    state.presses++;
    state.last = code || (e.key ? 'key ' + e.key : 'unknown');
    els.statPressed.textContent = state.presses;
    els.statLast.textContent = state.last;

    if (elList && elList.length) {
      if (!e.metaKey) e.preventDefault();
      elList.forEach((el) => el.classList.add('is-pressed'));
      flashAll(code);
      markLit(code);
      playThock();
    } else {
      // pressed code isn't drawn on the selected board
      addExtra(code || (e.key ? 'key:' + e.key : '?'));
      playThock();
    }
  }

  function onKeyUp(e) {
    const elsArr = codeEls.get(e.code || '');
    if (elsArr) elsArr.forEach((el) => el.classList.remove('is-pressed'));
  }

  function clearPressed() {
    for (const elsArr of codeEls.values()) elsArr.forEach((el) => el.classList.remove('is-pressed'));
  }

  // ---- keyboard sound --------------------------------------------------
  let audioCtx = null;
  let keySoundBuffer = null;
  let keySlices = [];

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  async function loadKeySound() {
    try {
      const cfg = await (await fetch('/thock/config.json')).json();
      const src = cfg.sound || 'sound.ogg';
      const defines = cfg.defines || {};
      keySlices = Object.values(defines)
        .filter((d) => Array.isArray(d) && d.length >= 2 && d[1] > 0)
        .map((d) => ({ start: d[0] / 1000, dur: d[1] / 1000 }));
      if (!keySlices.length) return;

      const ctx = ensureAudio();
      if (!ctx) return;
      const res = await fetch('/thock/' + src);
      const arrayBuf = await res.arrayBuffer();
      keySoundBuffer = await ctx.decodeAudioData(arrayBuf);
    } catch (_) {
      keySoundBuffer = null;
      keySlices = [];
    }
  }

  function playThock() {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx || !keySoundBuffer || !keySlices.length) return;
    const slice = keySlices[(Math.random() * keySlices.length) | 0];
    const src = ctx.createBufferSource();
    src.buffer = keySoundBuffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.75;
    src.connect(gain).connect(ctx.destination);
    src.start(0, slice.start, slice.dur + 0.02);
  }

  function updateSoundIcon() {
    els.soundIcon.textContent = soundOn ? '🔊' : '🔇';
    els.soundToggle.classList.toggle('is-muted', !soundOn);
    els.soundToggle.title = soundOn ? 'Keyboard sound on' : 'Keyboard sound off';
  }

  // ---- theme / settings ------------------------------------------------
  function setTheme(theme) {
    if (!THEMES.includes(theme)) theme = SETTINGS_DEFAULTS.theme;
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    els.themeSelect.value = theme;
    try { localStorage.setItem(LS_THEME, theme); } catch (_) {}
  }

  function currentSettings() {
    return { theme: currentTheme, sound: soundOn ? 'on' : 'off' };
  }

  function saveSettings() {
    api('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: currentSettings() }),
    }).catch(() => {});
  }

  function applySettings(s) {
    if (s.theme) setTheme(s.theme);
    if (s.sound === 'on' || s.sound === 'off') {
      soundOn = s.sound === 'on';
      updateSoundIcon();
    }
  }

  async function loadSettings() {
    try {
      const res = await api('/api/settings');
      applySettings(res.settings || {});
    } catch (_) {
      applySettings(SETTINGS_DEFAULTS);
    }
  }

  // ---- resize ----------------------------------------------------------
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderBoard, 160);
  }

  // ---- layout selector -------------------------------------------------
  function populateLayoutSelect() {
    els.layoutSelect.innerHTML = '';
    const groups = {};
    for (const kb of KEYBOARDS) (groups[kb.group] = groups[kb.group] || []).push(kb);
    for (const g of Object.keys(groups)) {
      const og = document.createElement('optgroup');
      og.label = g;
      for (const kb of groups[g]) {
        const opt = document.createElement('option');
        opt.value = kb.id;
        opt.textContent = kb.name;
        og.appendChild(opt);
      }
      els.layoutSelect.appendChild(og);
    }
  }

  // ---- events ----------------------------------------------------------
  function bindEvents() {
    els.layoutSelect.addEventListener('change', () => {
      state.extras.clear();
      renderExtras();
      setLayout(els.layoutSelect.value);
      els.layoutSelect.blur();
    });

    els.themeSelect.addEventListener('change', () => {
      setTheme(els.themeSelect.value);
      saveSettings();
      els.themeSelect.blur();
    });

    els.resetBtn.addEventListener('click', () => {
      clearTest();
      els.resetBtn.blur();
    });

    els.soundToggle.addEventListener('click', () => {
      soundOn = !soundOn;
      saveSettings();
      updateSoundIcon();
      els.soundToggle.blur();
    });

    // keep buttons from holding focus and capturing stray Enter/Space
    document.addEventListener('click', (e) => {
      const el = e.target instanceof Element ? e.target : null;
      const btn = el && el.closest('button');
      if (btn) btn.blur();
    });

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', clearPressed);
    window.addEventListener('resize', onResize);
  }

  // ---- init ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    els.themeSelect.value = document.documentElement.getAttribute('data-theme') || SETTINGS_DEFAULTS.theme;
    populateLayoutSelect();
    let savedLayout = null;
    try { savedLayout = localStorage.getItem(LS_LAYOUT); } catch (_) {}
    setLayout(savedLayout || KEYBOARDS[0].id);
    updateSoundIcon();
    updateProgress();
    await loadSettings();
    loadKeySound();
    renderExtras();
  });
})();
