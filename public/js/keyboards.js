// vibekeytester — keyboard layout registry
// Each layout is a set of keycaps in absolute key-units:
//   { code, label, sub?, x, y, w, h?, arrow?, noEvent?, note? }
//   - x,y   : top-left position in key units (x = left edge, y = row index)
//   - w,h   : size in key units (defaults 1)
//   - code  : KeyboardEvent.code this cap is expected to report when pressed
//   - noEvent: pure layer/shift keys that never emit an OS key event
// Layouts can be row/column built via the helpers below; each returns a plain
// key list that the renderer (app.js) consumes the same way.

// ---- small label helpers ------------------------------------------------
const L = {};
// letters
'Q W E R T Y U I O P A S D F G H J K L Z X C V B N M'.split(' ').forEach((ch) => {
  L[ch] = { code: 'Key' + ch, label: ch };
});
// digits + shifted symbols
const SHIFT = { '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')' };
for (let i = 1; i <= 9; i++) L[String(i)] = { code: 'Digit' + i, label: String(i), sub: SHIFT[String(i)] };
L['0'] = { code: 'Digit0', label: '0', sub: ')' };

const FUNCS = { Escape: 'Esc' };
for (let i = 1; i <= 12; i++) FUNCS['F' + i] = 'F' + i;
const BACKQUOTE = { code: 'Backquote', label: '`', sub: '~' };

// ---- row builder -------------------------------------------------------
// Builds a horizontal row. `keys` entries: strings (letter/digit via L) or
// objects { code, label, w?, sub?, pad? }. Returns placed caps (x,y resolved).
function row(y, keys, gap = 0.06) {
  const out = [];
  let x = 0;
  for (const it of keys) {
    const def = typeof it === 'string' ? (L[it] || { code: it, label: it }) : { ...it };
    const w = def.w || 1;
    out.push({ code: def.code, label: def.label, sub: def.sub, x, y, w, h: def.h || 1, noEvent: def.noEvent, arrow: def.arrow });
    x += w + gap + (def.pad || 0);
  }
  return out;
}

// key-unit gap constant used between clusters
const CLUSTER_GAP = 0.6;

// ---- standard (row-stagger) helpers ------------------------------------
// Alphanumeric 60% core: five rows starting at y=0.
function coreRows() {
  return [].concat(
    row(0, [BACKQUOTE, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', { code: 'Minus', label: '-', sub: '_' }, { code: 'Equal', label: '=', sub: '+' }, { code: 'Backspace', label: 'BkSp', w: 2 }]),
    row(1, [{ code: 'Tab', label: 'Tab', w: 1.5 }, 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', { code: 'BracketLeft', label: '[', sub: '{' }, { code: 'BracketRight', label: ']', sub: '}' }, { code: 'Backslash', label: '\\', sub: '|', w: 1.5 }]),
    row(2, [{ code: 'CapsLock', label: 'Caps', w: 1.75 }, 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', { code: 'Semicolon', label: ';', sub: ':' }, { code: 'Quote', label: "'", sub: '"' }, { code: 'Enter', label: 'Ent', w: 2.25 }]),
    row(3, [{ code: 'ShiftLeft', label: 'Shift', w: 2.25 }, 'Z', 'X', 'C', 'V', 'B', 'N', 'M', { code: 'Comma', label: ',', sub: '<' }, { code: 'Period', label: '.', sub: '>' }, { code: 'Slash', label: '/', sub: '?' }, { code: 'ShiftRight', label: 'Shift', w: 2.75 }]),
    row(4, [{ code: 'ControlLeft', label: 'Ctrl', w: 1.25 }, { code: 'MetaLeft', label: 'Win', w: 1.25 }, { code: 'AltLeft', label: 'Alt', w: 1.25 }, { code: 'Space', label: 'space', w: 6.25 }, { code: 'AltRight', label: 'Alt', w: 1.25 }, { code: 'MetaRight', label: 'Win', w: 1.25 }, { code: 'ContextMenu', label: 'Menu', w: 1.25 }, { code: 'ControlRight', label: 'Ctrl', w: 1.25 }]),
  );
}

// Function row (Esc..F12..PrtSc/ScrLk/Pause) placed above the core.
function fnRow() {
  return row(0,
    [{ code: 'Escape', label: 'Esc' }].concat(
      Array.from({ length: 12 }, (_, i) => ({ code: 'F' + (i + 1), label: 'F' + (i + 1) })),
      [{ code: 'PrintScreen', label: 'PrtSc', pad: 0.55 }, { code: 'ScrollLock', label: 'ScrLk' }, { code: 'Pause', label: 'Pause' }],
    ),
    0.12);
}

// Nav cluster + arrows used by full-size / TKL layouts.
// `topY` aligns the cluster beside rows `topY..topY+2` of the main block.
function sideCluster(topY = 1.0, gap = CLUSTER_GAP) {
  const sideX = 16.25;
  const colPitch = 1.06;
  const nav = [
    { code: 'Insert', label: 'Ins' }, { code: 'Home', label: 'Home' }, { code: 'PageUp', label: 'PgUp' },
    { code: 'Delete', label: 'Del' }, { code: 'End', label: 'End' }, { code: 'PageDown', label: 'PgDn' },
  ];
  const arrows = [
    { code: 'ArrowUp', label: '↑', arrow: true, col: 1, r: 0 },
    { code: 'ArrowLeft', label: '←', arrow: true, col: 0, r: 1 },
    { code: 'ArrowDown', label: '↓', arrow: true, col: 1, r: 1 },
    { code: 'ArrowRight', label: '→', arrow: true, col: 2, r: 1 },
  ];
  const out = [];
  nav.forEach((def, i) => {
    const col = i % 2;
    const r = Math.floor(i / 2);
    out.push({ code: def.code, label: def.label, x: sideX + col * colPitch, y: topY + r, w: 1, h: 1 });
  });
  arrows.forEach((a) => {
    out.push({ code: a.code, label: a.label, arrow: true, x: sideX + a.col * colPitch, y: topY + 3.1 + a.r, w: 1, h: 1 });
  });
  return out;
}

// Numpad (17 keys) at the far right of full-size layouts.
function numpad(topY = 1.0, gap = CLUSTER_GAP) {
  const numX = 19.6;
  const colPitch = 1.06;
  const defs = [
    [{ c: 'NumLock', l: 'NumLk' }, { c: 'NumpadDivide', l: '/' }, { c: 'NumpadMultiply', l: '*' }, { c: 'NumpadSubtract', l: '-' }],
    [{ c: 'Numpad7', l: '7' }, { c: 'Numpad8', l: '8' }, { c: 'Numpad9', l: '9' }, null],
    [{ c: 'Numpad4', l: '4' }, { c: 'Numpad5', l: '5' }, { c: 'Numpad6', l: '6' }, null],
    [{ c: 'Numpad1', l: '1' }, { c: 'Numpad2', l: '2' }, { c: 'Numpad3', l: '3' }, null],
    [{ c: 'Numpad0', l: '0', w: 2 }, null, { c: 'NumpadDecimal', l: '.' }, null],
  ];
  const out = [];
  defs.forEach((rDefs, r) => {
    rDefs.forEach((d, c) => {
      if (!d) return;
      out.push({ code: d.c, label: d.l, x: numX + c * colPitch, y: topY + r, w: d.w || 1, h: 1 });
    });
  });
  // tall keys
  out.push({ code: 'NumpadAdd', label: '+', x: numX + 3 * colPitch, y: topY + 1, w: 1, h: 2 });
  out.push({ code: 'NumpadEnter', label: 'Ent', x: numX + 3 * colPitch, y: topY + 3, w: 1, h: 2 });
  return out;
}
function shiftKeys(keys, dx, dy) {
  return keys.map((k) => ({ ...k, x: k.x + dx, y: k.y + dy }));
}

// Columnar half builder for split/ergo boards. Each column is
//   { keys: [ {code,label, noEvent?, w?}, ... ] (top→bottom), offset? }
// and the half is laid flat with constant column pitch (like vendor layout
// editors). `xStart` is where the innermost column begins.
function colHalf(columns, xStart, colPitch = 1.12) {
  const out = [];
  columns.forEach((col, ci) => {
    const off = col.offset || 0;
    col.keys.forEach((d, ri) => {
      const def = typeof d === 'string' ? (L[d] || { code: d, label: d }) : d;
      out.push({
        code: def.code,
        label: def.label,
        sub: def.sub,
        noEvent: def.noEvent,
        x: xStart + ci * colPitch,
        y: off + ri,
        w: def.w || 1,
        h: 1,
      });
    });
  });
  return out;
}

// add a block of arbitrary keys (used for thumb clusters etc.)
function blockKeys(defs, xStart, yStart) {
  const out = [];
  defs.forEach((d) => {
    out.push({
      code: d.code,
      label: d.label,
      sub: d.sub,
      noEvent: d.noEvent,
      x: xStart + (d.dx || 0),
      y: yStart + (d.dy || 0),
      w: d.w || 1,
      h: d.h || 1,
      arrow: d.arrow,
    });
  });
  return out;
}

// mirror a key list for the right half of a split board. x is mirrored
// around `mirrorX`, and "left-handed" codes are swapped to their right-handed
// equivalents.
const MIRROR_CODE = {
  ShiftLeft: 'ShiftRight', ShiftRight: 'ShiftLeft',
  ControlLeft: 'ControlRight', ControlRight: 'ControlLeft',
  MetaLeft: 'MetaRight', MetaRight: 'MetaLeft',
  AltLeft: 'AltRight', AltRight: 'AltLeft',
};
function mirrorKeys(keys, mirrorX, dy = 0) {
  return keys.map((k) => ({
    ...k,
    code: MIRROR_CODE[k.code] || k.code,
    x: mirrorX - k.x - (k.w || 1),
    y: k.y + dy,
  }));
}

// 65%: 60% core (rows 0..4) + right column (Del/Home/PgUp/PgDn) + arrows,
// all to the right of the shortened bottom row.
function layout65() {
  const keys = [];
  keys.push.apply(keys, coreRows());
  // right-hand column beside the number..shift rows (x beyond core end)
  const colX = 16.0;
  [['Delete', 'Del'], ['Home', 'Home'], ['PageUp', 'PgUp'], ['PageDown', 'PgDn']].forEach((d, i) => {
    keys.push({ code: d[0], label: d[1], x: colX, y: 0 + i, w: 1, h: 1 });
  });
  // arrows: up above, base row below, centered under the column
  const arrP = 1.06;
  keys.push({ code: 'ArrowUp', label: '↑', arrow: true, x: colX + 1.0 * arrP, y: 4.35, w: 1, h: 1 });
  keys.push({ code: 'ArrowLeft', label: '←', arrow: true, x: colX, y: 5.35, w: 1, h: 1 });
  keys.push({ code: 'ArrowDown', label: '↓', arrow: true, x: colX + 1.0 * arrP, y: 5.35, w: 1, h: 1 });
  keys.push({ code: 'ArrowRight', label: '→', arrow: true, x: colX + 2.0 * arrP, y: 5.35, w: 1, h: 1 });
  return keys;
}

// 75%: compact F row + 60% core + right-hand nav column + arrows (TKL minus
// the PrintScreen/ScrollLock/Pause trio, with the right side made compact).
function fnRowCompact() {
  return row(0,
    [{ code: 'Escape', label: 'Esc' }].concat(
      Array.from({ length: 12 }, (_, i) => ({ code: 'F' + (i + 1), label: 'F' + (i + 1) })),
    ),
    0.12);
}

function layout75() {
  const keys = [];
  keys.push.apply(keys, fnRowCompact());
  keys.push.apply(keys, coreRows().map((k) => ({ ...k, y: k.y + 1 })));
  // nav column (Del/Home/PgUp/PgDn) beside rows 1..4
  const colX = 15.9;
  [['Delete', 'Del'], ['Home', 'Home'], ['PageUp', 'PgUp'], ['PageDown', 'PgDn']].forEach((d, i) => {
    keys.push({ code: d[0], label: d[1], x: colX, y: 1 + i, w: 1, h: 1 });
  });
  // arrows under the nav column
  const arrP = 1.06;
  keys.push({ code: 'ArrowUp', label: '↑', arrow: true, x: colX + 1.0 * arrP, y: 5.0, w: 1, h: 1 });
  keys.push({ code: 'ArrowLeft', label: '←', arrow: true, x: colX, y: 6.0, w: 1, h: 1 });
  keys.push({ code: 'ArrowDown', label: '↓', arrow: true, x: colX + 1.0 * arrP, y: 6.0, w: 1, h: 1 });
  keys.push({ code: 'ArrowRight', label: '→', arrow: true, x: colX + 2.0 * arrP, y: 6.0, w: 1, h: 1 });
  return keys;
}

// ortholinear 40%: 4 rows x 12 cols (Planck-style) — codes are the printable
// base layer equivalents (letters, digits, punctuation, modifiers).
function layout40() {
  const colPitch = 1.04;
  const gaps = 0.06;
  const rows40 = [
    [BACKQUOTE, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', { code: 'Minus', label: '-', sub: '_' }],
    [{ code: 'Tab', label: 'Tab' }, 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', { code: 'BracketLeft', label: '[', sub: '{' }],
    [{ code: 'CapsLock', label: 'Caps' }, 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', { code: 'Semicolon', label: ';', sub: ':' }, { code: 'Quote', label: "'", sub: '"' }],
    [{ code: 'ShiftLeft', label: 'Shift' }, 'Z', 'X', 'C', 'V', 'B', 'N', 'M', { code: 'Comma', label: ',', sub: '<' }, { code: 'Period', label: '.', sub: '>' }, { code: 'Slash', label: '/', sub: '?' }, { code: 'ShiftRight', label: 'Shift' }],
  ];
  const out = [];
  rows40.forEach((rDefs, r) => {
    rDefs.forEach((d, c) => {
      const def = typeof d === 'string' ? (L[d] || { code: d, label: d }) : d;
      out.push({ code: def.code, label: def.label, sub: def.sub, x: c * colPitch, y: r, w: 1, h: 1 });
    });
  });
  // wide space / raise / lower thumb row isn't in the matrix — add below
  out.push({ code: 'Space', label: 'space', x: 4 * colPitch, y: 4, w: 4 * colPitch, h: 1 });
  return out;
}

const MOONLANDER_KEYS = [{"code":"Equal","label":"=","x":0,"y":0.375,"w":1,"h":1},{"code":"Digit1","label":"1","x":1,"y":0.375,"w":1,"h":1},{"code":"Digit2","label":"2","x":2,"y":0.125,"w":1,"h":1},{"code":"Digit3","label":"3","x":3,"y":0,"w":1,"h":1},{"code":"Digit4","label":"4","x":4,"y":0.125,"w":1,"h":1},{"code":"Digit5","label":"5","x":5,"y":0.25,"w":1,"h":1},{"code":"ArrowLeft","label":"←","x":6,"y":0.25,"w":1,"h":1},{"code":"ArrowRight","label":"→","x":10,"y":0.25,"w":1,"h":1},{"code":"Digit6","label":"6","x":11,"y":0.25,"w":1,"h":1},{"code":"Digit7","label":"7","x":12,"y":0.125,"w":1,"h":1},{"code":"Digit8","label":"8","x":13,"y":0,"w":1,"h":1},{"code":"Digit9","label":"9","x":14,"y":0.125,"w":1,"h":1},{"code":"Digit0","label":"0","x":15,"y":0.375,"w":1,"h":1},{"code":"Minus","label":"-","x":16,"y":0.375,"w":1,"h":1},{"code":"Delete","label":"Del","x":0,"y":1.375,"w":1,"h":1},{"code":"KeyQ","label":"Q","x":1,"y":1.375,"w":1,"h":1},{"code":"KeyW","label":"W","x":2,"y":1.125,"w":1,"h":1},{"code":"KeyE","label":"E","x":3,"y":1,"w":1,"h":1},{"code":"KeyR","label":"R","x":4,"y":1.125,"w":1,"h":1},{"code":"KeyT","label":"T","x":5,"y":1.25,"w":1,"h":1},{"code":null,"label":"L1","noEvent":true,"tag":"layer","x":6,"y":1.25,"w":1,"h":1},{"code":null,"label":"L1","noEvent":true,"tag":"layer","x":10,"y":1.25,"w":1,"h":1},{"code":"KeyY","label":"Y","x":11,"y":1.25,"w":1,"h":1},{"code":"KeyU","label":"U","x":12,"y":1.125,"w":1,"h":1},{"code":"KeyI","label":"I","x":13,"y":1,"w":1,"h":1},{"code":"KeyO","label":"O","x":14,"y":1.125,"w":1,"h":1},{"code":"KeyP","label":"P","x":15,"y":1.375,"w":1,"h":1},{"code":"Backslash","label":"\\","x":16,"y":1.375,"w":1,"h":1},{"code":"Backspace","label":"BkSp","x":0,"y":2.375,"w":1,"h":1},{"code":"KeyA","label":"A","x":1,"y":2.375,"w":1,"h":1},{"code":"KeyS","label":"S","x":2,"y":2.125,"w":1,"h":1},{"code":"KeyD","label":"D","x":3,"y":2,"w":1,"h":1},{"code":"KeyF","label":"F","x":4,"y":2.125,"w":1,"h":1},{"code":"KeyG","label":"G","x":5,"y":2.25,"w":1,"h":1},{"code":null,"label":"Hyper","noEvent":true,"tag":"mods","x":6,"y":2.25,"w":1,"h":1},{"code":null,"label":"Meh","noEvent":true,"tag":"mods","x":10,"y":2.25,"w":1,"h":1},{"code":"KeyH","label":"H","x":11,"y":2.25,"w":1,"h":1},{"code":"KeyJ","label":"J","x":12,"y":2.125,"w":1,"h":1},{"code":"KeyK","label":"K","x":13,"y":2,"w":1,"h":1},{"code":"KeyL","label":"L","x":14,"y":2.125,"w":1,"h":1},{"code":"Semicolon","label":";/L2","x":15,"y":2.375,"w":1,"h":1},{"code":"Quote","label":"'/Win","x":16,"y":2.375,"w":1,"h":1},{"code":"ShiftLeft","label":"Shift","x":0,"y":3.375,"w":1,"h":1},{"code":"KeyZ","label":"Z/Ctrl","x":1,"y":3.375,"w":1,"h":1},{"code":"KeyX","label":"X","x":2,"y":3.125,"w":1,"h":1},{"code":"KeyC","label":"C","x":3,"y":3,"w":1,"h":1},{"code":"KeyV","label":"V","x":4,"y":3.125,"w":1,"h":1},{"code":"KeyB","label":"B","x":5,"y":3.25,"w":1,"h":1},{"code":"KeyN","label":"N","x":11,"y":3.25,"w":1,"h":1},{"code":"KeyM","label":"M","x":12,"y":3.125,"w":1,"h":1},{"code":"Comma","label":",","x":13,"y":3,"w":1,"h":1},{"code":"Period","label":".","x":14,"y":3.125,"w":1,"h":1},{"code":"Slash","label":"//Ctrl","x":15,"y":3.375,"w":1,"h":1},{"code":"ShiftRight","label":"Shift","x":16,"y":3.375,"w":1,"h":1},{"code":"Backquote","label":"`/L1","x":0,"y":4.375,"w":1,"h":1},{"code":null,"label":"Boot","noEvent":true,"tag":"util","x":1,"y":4.375,"w":1,"h":1},{"code":null,"label":"Alt+Shift","noEvent":true,"tag":"mods","x":2,"y":4.125,"w":1,"h":1},{"code":"ArrowLeft","label":"←","x":3,"y":4,"w":1,"h":1},{"code":"ArrowRight","label":"→","x":4,"y":4.125,"w":1,"h":1},{"code":"ContextMenu","label":"App/Alt","x":5,"y":4.5,"w":2,"h":1},{"code":"Escape","label":"Esc/Ctrl","x":10,"y":4.5,"w":2,"h":1},{"code":"ArrowUp","label":"↑","x":12,"y":4.125,"w":1,"h":1},{"code":"ArrowDown","label":"↓","x":13,"y":4,"w":1,"h":1},{"code":"BracketLeft","label":"[","x":14,"y":4.125,"w":1,"h":1},{"code":"BracketRight","label":"]","x":15,"y":4.375,"w":1,"h":1},{"code":null,"label":"L1","noEvent":true,"tag":"layer","x":16,"y":4.375,"w":1,"h":1},{"code":"Space","label":"space","x":5,"y":5.5,"w":1,"h":1.5},{"code":"Backspace","label":"BkSp","x":6,"y":5.5,"w":1,"h":1.5},{"code":"MetaLeft","label":"Win","x":7,"y":5.5,"w":1,"h":1.5},{"code":"AltLeft","label":"Alt","x":9,"y":5.5,"w":1,"h":1.5},{"code":"Tab","label":"Tab","x":10,"y":5.5,"w":1,"h":1.5},{"code":"Enter","label":"Ent","x":11,"y":5.5,"w":1,"h":1.5}];

const GLOVE80_KEYS = [{"code": "F1", "label": "F1", "noEvent": false, "x": 0, "y": 0.5, "w": 1, "h": 1}, {"code": "F2", "label": "F2", "noEvent": false, "x": 1, "y": 0.5, "w": 1, "h": 1}, {"code": "F3", "label": "F3", "noEvent": false, "x": 2, "y": 0, "w": 1, "h": 1}, {"code": "F4", "label": "F4", "noEvent": false, "x": 3, "y": 0, "w": 1, "h": 1}, {"code": "F5", "label": "F5", "noEvent": false, "x": 4, "y": 0, "w": 1, "h": 1}, {"code": "F6", "label": "F6", "noEvent": false, "x": 13, "y": 0, "w": 1, "h": 1}, {"code": "F7", "label": "F7", "noEvent": false, "x": 14, "y": 0, "w": 1, "h": 1}, {"code": "F8", "label": "F8", "noEvent": false, "x": 15, "y": 0, "w": 1, "h": 1}, {"code": "F9", "label": "F9", "noEvent": false, "x": 16, "y": 0.5, "w": 1, "h": 1}, {"code": "F10", "label": "F10", "noEvent": false, "x": 17, "y": 0.5, "w": 1, "h": 1}, {"code": "Equal", "label": "=", "noEvent": false, "x": 0, "y": 1.5, "w": 1, "h": 1}, {"code": "Digit1", "label": "1", "noEvent": false, "x": 1, "y": 1.5, "w": 1, "h": 1}, {"code": "Digit2", "label": "2", "noEvent": false, "x": 2, "y": 1, "w": 1, "h": 1}, {"code": "Digit3", "label": "3", "noEvent": false, "x": 3, "y": 1, "w": 1, "h": 1}, {"code": "Digit4", "label": "4", "noEvent": false, "x": 4, "y": 1, "w": 1, "h": 1}, {"code": "Digit5", "label": "5", "noEvent": false, "x": 5, "y": 1, "w": 1, "h": 1}, {"code": "Digit6", "label": "6", "noEvent": false, "x": 12, "y": 1, "w": 1, "h": 1}, {"code": "Digit7", "label": "7", "noEvent": false, "x": 13, "y": 1, "w": 1, "h": 1}, {"code": "Digit8", "label": "8", "noEvent": false, "x": 14, "y": 1, "w": 1, "h": 1}, {"code": "Digit9", "label": "9", "noEvent": false, "x": 15, "y": 1, "w": 1, "h": 1}, {"code": "Digit0", "label": "0", "noEvent": false, "x": 16, "y": 1.5, "w": 1, "h": 1}, {"code": "Minus", "label": "-", "noEvent": false, "x": 17, "y": 1.5, "w": 1, "h": 1}, {"code": "Tab", "label": "Tab", "noEvent": false, "x": 0, "y": 2.5, "w": 1, "h": 1}, {"code": "KeyQ", "label": "Q", "noEvent": false, "x": 1, "y": 2.5, "w": 1, "h": 1}, {"code": "KeyW", "label": "W", "noEvent": false, "x": 2, "y": 2, "w": 1, "h": 1}, {"code": "KeyE", "label": "E", "noEvent": false, "x": 3, "y": 2, "w": 1, "h": 1}, {"code": "KeyR", "label": "R", "noEvent": false, "x": 4, "y": 2, "w": 1, "h": 1}, {"code": "KeyT", "label": "T", "noEvent": false, "x": 5, "y": 2, "w": 1, "h": 1}, {"code": "KeyY", "label": "Y", "noEvent": false, "x": 12, "y": 2, "w": 1, "h": 1}, {"code": "KeyU", "label": "U", "noEvent": false, "x": 13, "y": 2, "w": 1, "h": 1}, {"code": "KeyI", "label": "I", "noEvent": false, "x": 14, "y": 2, "w": 1, "h": 1}, {"code": "KeyO", "label": "O", "noEvent": false, "x": 15, "y": 2, "w": 1, "h": 1}, {"code": "KeyP", "label": "P", "noEvent": false, "x": 16, "y": 2.5, "w": 1, "h": 1}, {"code": "Backslash", "label": "\\", "noEvent": false, "x": 17, "y": 2.5, "w": 1, "h": 1}, {"code": "Escape", "label": "Esc", "noEvent": false, "x": 0, "y": 3.5, "w": 1, "h": 1}, {"code": "KeyA", "label": "A", "noEvent": false, "x": 1, "y": 3.5, "w": 1, "h": 1}, {"code": "KeyS", "label": "S", "noEvent": false, "x": 2, "y": 3, "w": 1, "h": 1}, {"code": "KeyD", "label": "D", "noEvent": false, "x": 3, "y": 3, "w": 1, "h": 1}, {"code": "KeyF", "label": "F", "noEvent": false, "x": 4, "y": 3, "w": 1, "h": 1}, {"code": "KeyG", "label": "G", "noEvent": false, "x": 5, "y": 3, "w": 1, "h": 1}, {"code": "KeyH", "label": "H", "noEvent": false, "x": 12, "y": 3, "w": 1, "h": 1}, {"code": "KeyJ", "label": "J", "noEvent": false, "x": 13, "y": 3, "w": 1, "h": 1}, {"code": "KeyK", "label": "K", "noEvent": false, "x": 14, "y": 3, "w": 1, "h": 1}, {"code": "KeyL", "label": "L", "noEvent": false, "x": 15, "y": 3, "w": 1, "h": 1}, {"code": "Semicolon", "label": ";", "noEvent": false, "x": 16, "y": 3.5, "w": 1, "h": 1}, {"code": "Quote", "label": "'", "noEvent": false, "x": 17, "y": 3.5, "w": 1, "h": 1}, {"code": "Backquote", "label": "`", "noEvent": false, "x": 0, "y": 4.5, "w": 1, "h": 1}, {"code": "KeyZ", "label": "Z", "noEvent": false, "x": 1, "y": 4.5, "w": 1, "h": 1}, {"code": "KeyX", "label": "X", "noEvent": false, "x": 2, "y": 4, "w": 1, "h": 1}, {"code": "KeyC", "label": "C", "noEvent": false, "x": 3, "y": 4, "w": 1, "h": 1}, {"code": "KeyV", "label": "V", "noEvent": false, "x": 4, "y": 4, "w": 1, "h": 1}, {"code": "KeyB", "label": "B", "noEvent": false, "x": 5, "y": 4, "w": 1, "h": 1}, {"code": "ShiftLeft", "label": "Shift", "noEvent": false, "x": 3.6, "y": 6.3, "w": 1, "h": 1}, {"code": "ControlLeft", "label": "Ctrl", "noEvent": false, "x": 4.6, "y": 6.3, "w": 1, "h": 1}, {"code": null, "label": "Lower", "noEvent": true, "tag": "layer", "x": 5.6, "y": 6.3, "w": 1, "h": 1}, {"code": "MetaLeft", "label": "Win", "noEvent": false, "x": 12.4, "y": 6.3, "w": 1, "h": 1}, {"code": "ControlRight", "label": "Ctrl", "noEvent": false, "x": 11.4, "y": 6.3, "w": 1, "h": 1}, {"code": "ShiftRight", "label": "Shift", "noEvent": false, "x": 10.4, "y": 6.3, "w": 1, "h": 1}, {"code": "KeyN", "label": "N", "noEvent": false, "x": 12, "y": 4, "w": 1, "h": 1}, {"code": "KeyM", "label": "M", "noEvent": false, "x": 13, "y": 4, "w": 1, "h": 1}, {"code": "Comma", "label": ",", "noEvent": false, "x": 14, "y": 4, "w": 1, "h": 1}, {"code": "Period", "label": ".", "noEvent": false, "x": 15, "y": 4, "w": 1, "h": 1}, {"code": "Slash", "label": "/", "noEvent": false, "x": 16, "y": 4.5, "w": 1, "h": 1}, {"code": "PageUp", "label": "PgUp", "noEvent": false, "x": 17, "y": 4.5, "w": 1, "h": 1}, {"code": null, "label": "Magic", "noEvent": true, "tag": "layer", "x": 0, "y": 5.5, "w": 1, "h": 1}, {"code": "Home", "label": "Home", "noEvent": false, "x": 1, "y": 5.5, "w": 1, "h": 1}, {"code": "End", "label": "End", "noEvent": false, "x": 2, "y": 5, "w": 1, "h": 1}, {"code": "ArrowLeft", "label": "\u2190", "noEvent": false, "x": 3, "y": 5, "w": 1, "h": 1}, {"code": "ArrowRight", "label": "\u2192", "noEvent": false, "x": 4, "y": 5, "w": 1, "h": 1}, {"code": "Backspace", "label": "BkSp", "noEvent": false, "x": 3.6, "y": 7.3, "w": 1, "h": 1}, {"code": "Delete", "label": "Del", "noEvent": false, "x": 4.6, "y": 7.3, "w": 1, "h": 1}, {"code": "AltLeft", "label": "Alt", "noEvent": false, "x": 5.6, "y": 7.3, "w": 1, "h": 1}, {"code": "AltRight", "label": "Alt", "noEvent": false, "x": 12.4, "y": 7.3, "w": 1, "h": 1}, {"code": "Enter", "label": "Ent", "noEvent": false, "x": 11.4, "y": 7.3, "w": 1, "h": 1}, {"code": "Space", "label": "space", "noEvent": false, "x": 10.4, "y": 7.3, "w": 1, "h": 1}, {"code": "ArrowUp", "label": "\u2191", "noEvent": false, "x": 13, "y": 5, "w": 1, "h": 1}, {"code": "ArrowDown", "label": "\u2193", "noEvent": false, "x": 14, "y": 5, "w": 1, "h": 1}, {"code": "BracketLeft", "label": "[", "noEvent": false, "x": 15, "y": 5, "w": 1, "h": 1}, {"code": "BracketRight", "label": "]", "noEvent": false, "x": 16, "y": 5.5, "w": 1, "h": 1}, {"code": "PageDown", "label": "PgDn", "noEvent": false, "x": 17, "y": 5.5, "w": 1, "h": 1}];

const GO60_KEYS = [{"code": "Equal", "label": "=", "noEvent": false, "x": 0, "y": 0.5, "w": 1, "h": 1}, {"code": "Digit1", "label": "1", "noEvent": false, "x": 1, "y": 0.5, "w": 1, "h": 1}, {"code": "Digit2", "label": "2", "noEvent": false, "x": 2, "y": 0, "w": 1, "h": 1}, {"code": "Digit3", "label": "3", "noEvent": false, "x": 3, "y": 0, "w": 1, "h": 1}, {"code": "Digit4", "label": "4", "noEvent": false, "x": 4, "y": 0, "w": 1, "h": 1}, {"code": "Digit5", "label": "5", "noEvent": false, "x": 5, "y": 0, "w": 1, "h": 1}, {"code": "Digit6", "label": "6", "noEvent": false, "x": 11.5, "y": 0, "w": 1, "h": 1}, {"code": "Digit7", "label": "7", "noEvent": false, "x": 12.5, "y": 0, "w": 1, "h": 1}, {"code": "Digit8", "label": "8", "noEvent": false, "x": 13.5, "y": 0, "w": 1, "h": 1}, {"code": "Digit9", "label": "9", "noEvent": false, "x": 14.5, "y": 0, "w": 1, "h": 1}, {"code": "Digit0", "label": "0", "noEvent": false, "x": 15.5, "y": 0.5, "w": 1, "h": 1}, {"code": "Minus", "label": "-", "noEvent": false, "x": 16.5, "y": 0.5, "w": 1, "h": 1}, {"code": "Tab", "label": "Tab", "noEvent": false, "x": 0, "y": 1.5, "w": 1, "h": 1}, {"code": "KeyQ", "label": "Q", "noEvent": false, "x": 1, "y": 1.5, "w": 1, "h": 1}, {"code": "KeyW", "label": "W", "noEvent": false, "x": 2, "y": 1, "w": 1, "h": 1}, {"code": "KeyE", "label": "E", "noEvent": false, "x": 3, "y": 1, "w": 1, "h": 1}, {"code": "KeyR", "label": "R", "noEvent": false, "x": 4, "y": 1, "w": 1, "h": 1}, {"code": "KeyT", "label": "T", "noEvent": false, "x": 5, "y": 1, "w": 1, "h": 1}, {"code": "KeyY", "label": "Y", "noEvent": false, "x": 11.5, "y": 1, "w": 1, "h": 1}, {"code": "KeyU", "label": "U", "noEvent": false, "x": 12.5, "y": 1, "w": 1, "h": 1}, {"code": "KeyI", "label": "I", "noEvent": false, "x": 13.5, "y": 1, "w": 1, "h": 1}, {"code": "KeyO", "label": "O", "noEvent": false, "x": 14.5, "y": 1, "w": 1, "h": 1}, {"code": "KeyP", "label": "P", "noEvent": false, "x": 15.5, "y": 1.5, "w": 1, "h": 1}, {"code": "Backslash", "label": "\\", "noEvent": false, "x": 16.5, "y": 1.5, "w": 1, "h": 1}, {"code": "Escape", "label": "Esc", "noEvent": false, "x": 0, "y": 2.5, "w": 1, "h": 1}, {"code": "KeyA", "label": "A", "noEvent": false, "x": 1, "y": 2.5, "w": 1, "h": 1}, {"code": "KeyS", "label": "S", "noEvent": false, "x": 2, "y": 2, "w": 1, "h": 1}, {"code": "KeyD", "label": "D", "noEvent": false, "x": 3, "y": 2, "w": 1, "h": 1}, {"code": "KeyF", "label": "F", "noEvent": false, "x": 4, "y": 2, "w": 1, "h": 1}, {"code": "KeyG", "label": "G", "noEvent": false, "x": 5, "y": 2, "w": 1, "h": 1}, {"code": "KeyH", "label": "H", "noEvent": false, "x": 11.5, "y": 2, "w": 1, "h": 1}, {"code": "KeyJ", "label": "J", "noEvent": false, "x": 12.5, "y": 2, "w": 1, "h": 1}, {"code": "KeyK", "label": "K", "noEvent": false, "x": 13.5, "y": 2, "w": 1, "h": 1}, {"code": "KeyL", "label": "L", "noEvent": false, "x": 14.5, "y": 2, "w": 1, "h": 1}, {"code": "Semicolon", "label": ";", "noEvent": false, "x": 15.5, "y": 2.5, "w": 1, "h": 1}, {"code": "Quote", "label": "'", "noEvent": false, "x": 16.5, "y": 2.5, "w": 1, "h": 1}, {"code": null, "label": "Magic", "noEvent": true, "tag": "layer", "x": 0, "y": 3.5, "w": 1, "h": 1}, {"code": "KeyZ", "label": "Z", "noEvent": false, "x": 1, "y": 3.5, "w": 1, "h": 1}, {"code": "KeyX", "label": "X", "noEvent": false, "x": 2, "y": 3, "w": 1, "h": 1}, {"code": "KeyC", "label": "C", "noEvent": false, "x": 3, "y": 3, "w": 1, "h": 1}, {"code": "KeyV", "label": "V", "noEvent": false, "x": 4, "y": 3, "w": 1, "h": 1}, {"code": "KeyB", "label": "B", "noEvent": false, "x": 5, "y": 3, "w": 1, "h": 1}, {"code": "KeyN", "label": "N", "noEvent": false, "x": 11.5, "y": 3, "w": 1, "h": 1}, {"code": "KeyM", "label": "M", "noEvent": false, "x": 12.5, "y": 3, "w": 1, "h": 1}, {"code": "Comma", "label": ",", "noEvent": false, "x": 13.5, "y": 3, "w": 1, "h": 1}, {"code": "Period", "label": ".", "noEvent": false, "x": 14.5, "y": 3, "w": 1, "h": 1}, {"code": "Slash", "label": "/", "noEvent": false, "x": 15.5, "y": 3.5, "w": 1, "h": 1}, {"code": null, "label": "Keypad", "noEvent": true, "tag": "layer", "x": 16.5, "y": 3.5, "w": 1, "h": 1}, {"code": "Backquote", "label": "`", "noEvent": false, "x": 2, "y": 4, "w": 1, "h": 1}, {"code": "Delete", "label": "Del", "noEvent": false, "x": 3, "y": 4, "w": 1, "h": 1}, {"code": "Backspace", "label": "BkSp", "noEvent": false, "x": 4, "y": 4, "w": 1, "h": 1}, {"code": "MetaLeft", "label": "Win", "noEvent": false, "x": 12.5, "y": 4, "w": 1, "h": 1}, {"code": "BracketLeft", "label": "[", "noEvent": false, "x": 13.5, "y": 4, "w": 1, "h": 1}, {"code": "BracketRight", "label": "]", "noEvent": false, "x": 14.5, "y": 4, "w": 1, "h": 1}, {"code": null, "label": "SymNav", "noEvent": true, "tag": "layer", "x": 3.5, "y": 5, "w": 1, "h": 1}, {"code": "ShiftLeft", "label": "Shift", "noEvent": false, "x": 4.5, "y": 5, "w": 1, "h": 1}, {"code": "ControlLeft", "label": "Ctrl", "noEvent": false, "x": 5.5, "y": 5, "w": 1, "h": 1}, {"code": "AltLeft", "label": "Alt", "noEvent": false, "x": 12.6, "y": 5.2, "w": 1, "h": 1}, {"code": "Space", "label": "space", "noEvent": false, "x": 11.6, "y": 5.2, "w": 1, "h": 1}, {"code": "Enter", "label": "Ent", "noEvent": false, "x": 10.6, "y": 5.2, "w": 1, "h": 1}];

const RAISE2_KEYS = [{"code": "Escape", "label": "Esc", "noEvent": false, "x": 0, "y": 0, "w": 1, "h": 1}, {"code": "Digit1", "label": "1", "noEvent": false, "x": 1.02, "y": 0, "w": 1, "h": 1}, {"code": "Digit2", "label": "2", "noEvent": false, "x": 2.04, "y": 0, "w": 1, "h": 1}, {"code": "Digit3", "label": "3", "noEvent": false, "x": 3.06, "y": 0, "w": 1, "h": 1}, {"code": "Digit4", "label": "4", "noEvent": false, "x": 4.08, "y": 0, "w": 1, "h": 1}, {"code": "Digit5", "label": "5", "noEvent": false, "x": 5.1, "y": 0, "w": 1, "h": 1}, {"code": "Digit6", "label": "6", "noEvent": false, "x": 6.119999999999999, "y": 0, "w": 1, "h": 1}, {"code": "Tab", "label": "Tab", "noEvent": false, "x": 0, "y": 1, "w": 1, "h": 1}, {"code": "KeyQ", "label": "Q", "noEvent": false, "x": 1.02, "y": 1, "w": 1, "h": 1}, {"code": "KeyW", "label": "W", "noEvent": false, "x": 2.04, "y": 1, "w": 1, "h": 1}, {"code": "KeyE", "label": "E", "noEvent": false, "x": 3.06, "y": 1, "w": 1, "h": 1}, {"code": "KeyR", "label": "R", "noEvent": false, "x": 4.08, "y": 1, "w": 1, "h": 1}, {"code": "KeyT", "label": "T", "noEvent": false, "x": 5.1, "y": 1, "w": 1, "h": 1}, {"code": "CapsLock", "label": "Caps", "noEvent": false, "x": 0, "y": 2, "w": 1, "h": 1}, {"code": "KeyA", "label": "A", "noEvent": false, "x": 1.02, "y": 2, "w": 1, "h": 1}, {"code": "KeyS", "label": "S", "noEvent": false, "x": 2.04, "y": 2, "w": 1, "h": 1}, {"code": "KeyD", "label": "D", "noEvent": false, "x": 3.06, "y": 2, "w": 1, "h": 1}, {"code": "KeyF", "label": "F", "noEvent": false, "x": 4.08, "y": 2, "w": 1, "h": 1}, {"code": "KeyG", "label": "G", "noEvent": false, "x": 5.1, "y": 2, "w": 1, "h": 1}, {"code": "ShiftLeft", "label": "Shift", "noEvent": false, "x": 0, "y": 3, "w": 1, "h": 1}, {"code": "KeyZ", "label": "Z", "noEvent": false, "x": 1.02, "y": 3, "w": 1, "h": 1}, {"code": "KeyX", "label": "X", "noEvent": false, "x": 2.04, "y": 3, "w": 1, "h": 1}, {"code": "KeyC", "label": "C", "noEvent": false, "x": 3.06, "y": 3, "w": 1, "h": 1}, {"code": "KeyV", "label": "V", "noEvent": false, "x": 4.08, "y": 3, "w": 1, "h": 1}, {"code": "KeyB", "label": "B", "noEvent": false, "x": 5.1, "y": 3, "w": 1, "h": 1}, {"code": "ControlLeft", "label": "Ctrl", "noEvent": false, "x": 0, "y": 4, "w": 1, "h": 1}, {"code": "MetaLeft", "label": "Win", "noEvent": false, "x": 1.02, "y": 4, "w": 1, "h": 1}, {"code": "AltLeft", "label": "Alt", "noEvent": false, "x": 2.04, "y": 4, "w": 1, "h": 1}, {"code": "Space", "label": "space", "noEvent": false, "x": 3.06, "y": 4, "w": 1.5, "h": 1}, {"code": "Space", "label": "space", "noEvent": false, "x": 4.58, "y": 4, "w": 1.5, "h": 1}, {"code": "Digit7", "label": "7", "noEvent": false, "x": 8.25, "y": 0, "w": 1, "h": 1}, {"code": "Digit8", "label": "8", "noEvent": false, "x": 9.27, "y": 0, "w": 1, "h": 1}, {"code": "Digit9", "label": "9", "noEvent": false, "x": 10.29, "y": 0, "w": 1, "h": 1}, {"code": "Digit0", "label": "0", "noEvent": false, "x": 11.309999999999999, "y": 0, "w": 1, "h": 1}, {"code": "Minus", "label": "-", "noEvent": false, "x": 12.329999999999998, "y": 0, "w": 1, "h": 1}, {"code": "Equal", "label": "=", "noEvent": false, "x": 13.349999999999998, "y": 0, "w": 1, "h": 1}, {"code": "Backspace", "label": "BkSp", "noEvent": false, "x": 14.369999999999997, "y": 0, "w": 2, "h": 1}, {"code": "KeyY", "label": "Y", "noEvent": false, "x": 8.25, "y": 1, "w": 1, "h": 1}, {"code": "KeyU", "label": "U", "noEvent": false, "x": 9.27, "y": 1, "w": 1, "h": 1}, {"code": "KeyI", "label": "I", "noEvent": false, "x": 10.29, "y": 1, "w": 1, "h": 1}, {"code": "KeyO", "label": "O", "noEvent": false, "x": 11.309999999999999, "y": 1, "w": 1, "h": 1}, {"code": "KeyP", "label": "P", "noEvent": false, "x": 12.329999999999998, "y": 1, "w": 1, "h": 1}, {"code": "BracketLeft", "label": "[", "noEvent": false, "x": 13.349999999999998, "y": 1, "w": 1, "h": 1}, {"code": "BracketRight", "label": "]", "noEvent": false, "x": 14.369999999999997, "y": 1, "w": 1, "h": 1}, {"code": "Enter", "label": "Ent", "noEvent": false, "x": 15.389999999999997, "y": 1, "w": 2, "h": 1}, {"code": "KeyH", "label": "H", "noEvent": false, "x": 8.25, "y": 2, "w": 1, "h": 1}, {"code": "KeyJ", "label": "J", "noEvent": false, "x": 9.27, "y": 2, "w": 1, "h": 1}, {"code": "KeyK", "label": "K", "noEvent": false, "x": 10.29, "y": 2, "w": 1, "h": 1}, {"code": "KeyL", "label": "L", "noEvent": false, "x": 11.309999999999999, "y": 2, "w": 1, "h": 1}, {"code": "Semicolon", "label": ";", "noEvent": false, "x": 12.329999999999998, "y": 2, "w": 1, "h": 1}, {"code": "Quote", "label": "'", "noEvent": false, "x": 13.349999999999998, "y": 2, "w": 1, "h": 1}, {"code": "Backslash", "label": "\\", "noEvent": false, "x": 14.369999999999997, "y": 2, "w": 1, "h": 1}, {"code": "KeyN", "label": "N", "noEvent": false, "x": 8.25, "y": 3, "w": 1, "h": 1}, {"code": "KeyM", "label": "M", "noEvent": false, "x": 9.27, "y": 3, "w": 1, "h": 1}, {"code": "Comma", "label": ",", "noEvent": false, "x": 10.29, "y": 3, "w": 1, "h": 1}, {"code": "Period", "label": ".", "noEvent": false, "x": 11.309999999999999, "y": 3, "w": 1, "h": 1}, {"code": "Slash", "label": "/", "noEvent": false, "x": 12.329999999999998, "y": 3, "w": 1, "h": 1}, {"code": "ShiftRight", "label": "Shift", "noEvent": false, "x": 13.349999999999998, "y": 3, "w": 2.25, "h": 1}, {"code": "Space", "label": "space", "noEvent": false, "x": 8.25, "y": 4, "w": 1.5, "h": 1}, {"code": "Space", "label": "space", "noEvent": false, "x": 9.77, "y": 4, "w": 1.5, "h": 1}, {"code": "AltRight", "label": "Alt", "noEvent": false, "x": 11.29, "y": 4, "w": 1, "h": 1}, {"code": "MetaRight", "label": "Win", "noEvent": false, "x": 12.309999999999999, "y": 4, "w": 1, "h": 1}, {"code": null, "label": "LED", "tag": "fx", "noEvent": true, "x": 13.329999999999998, "y": 4, "w": 1, "h": 1}, {"code": "ControlRight", "label": "Ctrl", "noEvent": false, "x": 14.349999999999998, "y": 4, "w": 1, "h": 1}, {"code": "Backspace", "label": "BkSp", "x": 5, "y": 5.2, "w": 1.5}, {"code": "Enter", "label": "Ent", "x": 6.8, "y": 5.2, "w": 1.5}, {"code": null, "label": "layer", "tag": "layer", "noEvent": true, "x": 12.35, "y": 5.2, "w": 1.5}, {"code": "Delete", "label": "Del", "x": 14.149999999999999, "y": 5.2, "w": 1.5}];

const DEFY_KEYS = [{"code": "Escape", "label": "Esc", "noEvent": false, "x": 0, "y": 0, "w": 1, "h": 1}, {"code": "Digit1", "label": "1", "noEvent": false, "x": 1, "y": 0, "w": 1, "h": 1}, {"code": "Digit2", "label": "2", "noEvent": false, "x": 2, "y": 0, "w": 1, "h": 1}, {"code": "Digit3", "label": "3", "noEvent": false, "x": 3, "y": 0, "w": 1, "h": 1}, {"code": "Digit4", "label": "4", "noEvent": false, "x": 4, "y": 0, "w": 1, "h": 1}, {"code": "Digit5", "label": "5", "noEvent": false, "x": 5, "y": 0, "w": 1, "h": 1}, {"code": "Digit6", "label": "6", "noEvent": false, "x": 6, "y": 0, "w": 1, "h": 1}, {"code": "Tab", "label": "Tab", "noEvent": false, "x": 0, "y": 1, "w": 1, "h": 1}, {"code": "KeyQ", "label": "Q", "noEvent": false, "x": 1, "y": 1, "w": 1, "h": 1}, {"code": "KeyW", "label": "W", "noEvent": false, "x": 2, "y": 1, "w": 1, "h": 1}, {"code": "KeyE", "label": "E", "noEvent": false, "x": 3, "y": 1, "w": 1, "h": 1}, {"code": "KeyR", "label": "R", "noEvent": false, "x": 4, "y": 1, "w": 1, "h": 1}, {"code": "KeyT", "label": "T", "noEvent": false, "x": 5, "y": 1, "w": 1, "h": 1}, {"code": null, "label": "fn", "tag": "layer", "noEvent": true, "x": 6, "y": 1, "w": 1, "h": 1}, {"code": "CapsLock", "label": "Caps", "noEvent": false, "x": 0, "y": 2, "w": 1, "h": 1}, {"code": "KeyA", "label": "A", "noEvent": false, "x": 1, "y": 2, "w": 1, "h": 1}, {"code": "KeyS", "label": "S", "noEvent": false, "x": 2, "y": 2, "w": 1, "h": 1}, {"code": "KeyD", "label": "D", "noEvent": false, "x": 3, "y": 2, "w": 1, "h": 1}, {"code": "KeyF", "label": "F", "noEvent": false, "x": 4, "y": 2, "w": 1, "h": 1}, {"code": "KeyG", "label": "G", "noEvent": false, "x": 5, "y": 2, "w": 1, "h": 1}, {"code": null, "label": "fn", "tag": "layer", "noEvent": true, "x": 6, "y": 2, "w": 1, "h": 1}, {"code": "Backslash", "label": "\\", "noEvent": false, "x": 0, "y": 3, "w": 1, "h": 1}, {"code": "KeyZ", "label": "Z", "noEvent": false, "x": 1, "y": 3, "w": 1, "h": 1}, {"code": "KeyX", "label": "X", "noEvent": false, "x": 2, "y": 3, "w": 1, "h": 1}, {"code": "KeyC", "label": "C", "noEvent": false, "x": 3, "y": 3, "w": 1, "h": 1}, {"code": "KeyV", "label": "V", "noEvent": false, "x": 4, "y": 3, "w": 1, "h": 1}, {"code": "KeyB", "label": "B", "noEvent": false, "x": 5, "y": 3, "w": 1, "h": 1}, {"code": null, "label": "?", "tag": "layer", "noEvent": true, "x": 8, "y": 0, "w": 1, "h": 1}, {"code": "Digit8", "label": "8", "noEvent": false, "x": 9, "y": 0, "w": 1, "h": 1}, {"code": "Digit9", "label": "9", "noEvent": false, "x": 10, "y": 0, "w": 1, "h": 1}, {"code": "Digit0", "label": "0", "noEvent": false, "x": 11, "y": 0, "w": 1, "h": 1}, {"code": "Minus", "label": "-", "noEvent": false, "x": 12, "y": 0, "w": 1, "h": 1}, {"code": "Equal", "label": "=", "noEvent": false, "x": 13, "y": 0, "w": 1, "h": 1}, {"code": "Backspace", "label": "BkSp", "noEvent": false, "x": 14, "y": 0, "w": 1, "h": 1}, {"code": "KeyY", "label": "Y", "noEvent": false, "x": 8, "y": 1, "w": 1, "h": 1}, {"code": "KeyU", "label": "U", "noEvent": false, "x": 9, "y": 1, "w": 1, "h": 1}, {"code": "KeyI", "label": "I", "noEvent": false, "x": 10, "y": 1, "w": 1, "h": 1}, {"code": "KeyO", "label": "O", "noEvent": false, "x": 11, "y": 1, "w": 1, "h": 1}, {"code": "KeyP", "label": "P", "noEvent": false, "x": 12, "y": 1, "w": 1, "h": 1}, {"code": "BracketLeft", "label": "[", "noEvent": false, "x": 13, "y": 1, "w": 1, "h": 1}, {"code": "BracketRight", "label": "]", "noEvent": false, "x": 14, "y": 1, "w": 1, "h": 1}, {"code": "KeyH", "label": "H", "noEvent": false, "x": 8, "y": 2, "w": 1, "h": 1}, {"code": "KeyJ", "label": "J", "noEvent": false, "x": 9, "y": 2, "w": 1, "h": 1}, {"code": "KeyK", "label": "K", "noEvent": false, "x": 10, "y": 2, "w": 1, "h": 1}, {"code": "KeyL", "label": "L", "noEvent": false, "x": 11, "y": 2, "w": 1, "h": 1}, {"code": "Semicolon", "label": ";", "noEvent": false, "x": 12, "y": 2, "w": 1, "h": 1}, {"code": "Quote", "label": "'", "noEvent": false, "x": 13, "y": 2, "w": 1, "h": 1}, {"code": "ShiftRight", "label": "Shift", "noEvent": false, "x": 14, "y": 2, "w": 1, "h": 1}, {"code": "KeyN", "label": "N", "noEvent": false, "x": 8, "y": 3, "w": 1, "h": 1}, {"code": "KeyM", "label": "M", "noEvent": false, "x": 9, "y": 3, "w": 1, "h": 1}, {"code": "Comma", "label": ",", "noEvent": false, "x": 10, "y": 3, "w": 1, "h": 1}, {"code": "Period", "label": ".", "noEvent": false, "x": 11, "y": 3, "w": 1, "h": 1}, {"code": "Slash", "label": "/", "noEvent": false, "x": 12, "y": 3, "w": 1, "h": 1}, {"code": "ShiftRight", "label": "Shift", "noEvent": false, "x": 13, "y": 3, "w": 1, "h": 1}, {"code": "ControlLeft", "label": "Ctrl", "x": 2.9, "y": 4.3}, {"code": "MetaLeft", "label": "Win", "x": 3.9, "y": 4.3}, {"code": "Backspace", "label": "BkSp", "x": 4.9, "y": 4.3}, {"code": "Delete", "label": "Del", "x": 5.9, "y": 4.3}, {"code": "ShiftLeft", "label": "Shift", "x": 2.9, "y": 5.4}, {"code": "AltLeft", "label": "Alt", "x": 3.9, "y": 5.4}, {"code": "Enter", "label": "Ent", "x": 4.9, "y": 5.4}, {"code": "Space", "label": "space", "x": 5.9, "y": 5.4}, {"code": null, "label": "LED", "tag": "fx", "noEvent": true, "x": 9.2, "y": 4.3}, {"code": "Home", "label": "Home", "x": 10.2, "y": 4.3}, {"code": "ArrowUp", "label": "\u2191", "x": 11.2, "y": 4.3, "arrow": true}, {"code": "End", "label": "End", "x": 12.2, "y": 4.3}, {"code": "Enter", "label": "Ent", "x": 9.2, "y": 5.4}, {"code": "ArrowLeft", "label": "\u2190", "x": 10.2, "y": 5.4, "arrow": true}, {"code": "ArrowDown", "label": "\u2193", "x": 11.2, "y": 5.4, "arrow": true}, {"code": "ArrowRight", "label": "\u2192", "x": 12.2, "y": 5.4, "arrow": true}];

const ERGODOX_KEYS = [{"code":"Equal","label":"=","noEvent":false,"x":0,"y":0.375,"w":1.5,"h":1},{"code":"Digit1","label":"1","noEvent":false,"x":1.5,"y":0.375,"w":1,"h":1},{"code":"Digit2","label":"2","noEvent":false,"x":2.5,"y":0.125,"w":1,"h":1},{"code":"Digit3","label":"3","noEvent":false,"x":3.5,"y":0,"w":1,"h":1},{"code":"Digit4","label":"4","noEvent":false,"x":4.5,"y":0.125,"w":1,"h":1},{"code":"Digit5","label":"5","noEvent":false,"x":5.5,"y":0.25,"w":1,"h":1},{"code":"ArrowLeft","label":"←","noEvent":false,"x":6.5,"y":0.25,"w":1,"h":1},{"code":"ArrowRight","label":"→","noEvent":false,"x":9.5,"y":0.25,"w":1,"h":1},{"code":"Digit6","label":"6","noEvent":false,"x":10.5,"y":0.25,"w":1,"h":1},{"code":"Digit7","label":"7","noEvent":false,"x":11.5,"y":0.125,"w":1,"h":1},{"code":"Digit8","label":"8","noEvent":false,"x":12.5,"y":0,"w":1,"h":1},{"code":"Digit9","label":"9","noEvent":false,"x":13.5,"y":0.125,"w":1,"h":1},{"code":"Digit0","label":"0","noEvent":false,"x":14.5,"y":0.375,"w":1,"h":1},{"code":"Minus","label":"-","noEvent":false,"x":15.5,"y":0.375,"w":1.5,"h":1},{"code":"Delete","label":"Del","noEvent":false,"x":0,"y":1.375,"w":1.5,"h":1},{"code":"KeyQ","label":"Q","noEvent":false,"x":1.5,"y":1.375,"w":1,"h":1},{"code":"KeyW","label":"W","noEvent":false,"x":2.5,"y":1.125,"w":1,"h":1},{"code":"KeyE","label":"E","noEvent":false,"x":3.5,"y":1,"w":1,"h":1},{"code":"KeyR","label":"R","noEvent":false,"x":4.5,"y":1.125,"w":1,"h":1},{"code":"KeyT","label":"T","noEvent":false,"x":5.5,"y":1.25,"w":1,"h":1},{"code":null,"label":"L1","tag":"layer","noEvent":true,"x":6.5,"y":1.25,"w":1,"h":1.5},{"code":null,"label":"L1","tag":"layer","noEvent":true,"x":9.5,"y":1.25,"w":1,"h":1.5},{"code":"KeyY","label":"Y","noEvent":false,"x":10.5,"y":1.25,"w":1,"h":1},{"code":"KeyU","label":"U","noEvent":false,"x":11.5,"y":1.125,"w":1,"h":1},{"code":"KeyI","label":"I","noEvent":false,"x":12.5,"y":1,"w":1,"h":1},{"code":"KeyO","label":"O","noEvent":false,"x":13.5,"y":1.125,"w":1,"h":1},{"code":"KeyP","label":"P","noEvent":false,"x":14.5,"y":1.375,"w":1,"h":1},{"code":"Backslash","label":"\\","noEvent":false,"x":15.5,"y":1.375,"w":1.5,"h":1},{"code":"Backspace","label":"⌫BkSp","noEvent":false,"x":0,"y":2.375,"w":1.5,"h":1},{"code":"KeyA","label":"A","noEvent":false,"x":1.5,"y":2.375,"w":1,"h":1},{"code":"KeyS","label":"S","noEvent":false,"x":2.5,"y":2.125,"w":1,"h":1},{"code":"KeyD","label":"D","noEvent":false,"x":3.5,"y":2,"w":1,"h":1},{"code":"KeyF","label":"F","noEvent":false,"x":4.5,"y":2.125,"w":1,"h":1},{"code":"KeyG","label":"G","noEvent":false,"x":5.5,"y":2.25,"w":1,"h":1},{"code":"KeyH","label":"H","noEvent":false,"x":10.5,"y":2.25,"w":1,"h":1},{"code":"KeyJ","label":"J","noEvent":false,"x":11.5,"y":2.125,"w":1,"h":1},{"code":"KeyK","label":"K","noEvent":false,"x":12.5,"y":2,"w":1,"h":1},{"code":"KeyL","label":"L","noEvent":false,"x":13.5,"y":2.125,"w":1,"h":1},{"code":"Semicolon","label":";/L2","noEvent":false,"x":14.5,"y":2.375,"w":1,"h":1},{"code":"Quote","label":"'/Cmd","noEvent":false,"x":15.5,"y":2.375,"w":1.5,"h":1},{"code":"ShiftLeft","label":"Shift","noEvent":false,"x":0,"y":3.375,"w":1.5,"h":1},{"code":"KeyZ","label":"Z/Ctrl","noEvent":false,"x":1.5,"y":3.375,"w":1,"h":1},{"code":"KeyX","label":"X","noEvent":false,"x":2.5,"y":3.125,"w":1,"h":1},{"code":"KeyC","label":"C","noEvent":false,"x":3.5,"y":3,"w":1,"h":1},{"code":"KeyV","label":"V","noEvent":false,"x":4.5,"y":3.125,"w":1,"h":1},{"code":"KeyB","label":"B","noEvent":false,"x":5.5,"y":3.25,"w":1,"h":1},{"code":null,"label":"Hyper","tag":"mods","noEvent":true,"x":6.5,"y":2.75,"w":1,"h":1.5},{"code":null,"label":"Meh","tag":"mods","noEvent":true,"x":9.5,"y":2.75,"w":1,"h":1.5},{"code":"KeyN","label":"N","noEvent":false,"x":10.5,"y":3.25,"w":1,"h":1},{"code":"KeyM","label":"M","noEvent":false,"x":11.5,"y":3.125,"w":1,"h":1},{"code":"Comma","label":",","noEvent":false,"x":12.5,"y":3,"w":1,"h":1},{"code":"Period","label":".","noEvent":false,"x":13.5,"y":3.125,"w":1,"h":1},{"code":"Slash","label":"//Ctrl","noEvent":false,"x":14.5,"y":3.375,"w":1,"h":1},{"code":"ShiftRight","label":"Shift","noEvent":false,"x":15.5,"y":3.375,"w":1.5,"h":1},{"code":"Backquote","label":"`/L1","noEvent":false,"x":0.5,"y":4.375,"w":1,"h":1},{"code":"Quote","label":"'","noEvent":false,"x":1.5,"y":4.375,"w":1,"h":1},{"code":null,"label":"AltShf","tag":"mods","noEvent":true,"x":2.5,"y":4.125,"w":1,"h":1},{"code":"ArrowLeft","label":"←","noEvent":false,"x":3.5,"y":4,"w":1,"h":1},{"code":"ArrowRight","label":"→","noEvent":false,"x":4.5,"y":4.125,"w":1,"h":1},{"code":"ArrowUp","label":"↑","noEvent":false,"x":11.5,"y":4.125,"w":1,"h":1},{"code":"ArrowDown","label":"↓","noEvent":false,"x":12.5,"y":4,"w":1,"h":1},{"code":"BracketLeft","label":"[","noEvent":false,"x":13.5,"y":4.125,"w":1,"h":1},{"code":"BracketRight","label":"]","noEvent":false,"x":14.5,"y":4.375,"w":1,"h":1},{"code":null,"label":"~L1","tag":"layer","noEvent":true,"x":15.5,"y":4.375,"w":1,"h":1},{"code":"ContextMenu","label":"App","noEvent":false,"x":6,"y":5,"w":1,"h":1},{"code":"MetaLeft","label":"Win","noEvent":false,"x":7,"y":5,"w":1,"h":1},{"code":"AltLeft","label":"Alt","noEvent":false,"x":9,"y":5,"w":1,"h":1},{"code":"Escape","label":"Esc/Ctrl","noEvent":false,"x":10,"y":5,"w":1,"h":1},{"code":"Home","label":"Home","noEvent":false,"x":7,"y":6,"w":1,"h":1},{"code":"PageUp","label":"PgUp","noEvent":false,"x":9,"y":6,"w":1,"h":1},{"code":"Space","label":"space","noEvent":false,"x":5,"y":6,"w":1,"h":2},{"code":"Backspace","label":"⌫BkSp","noEvent":false,"x":6,"y":6,"w":1,"h":2},{"code":"End","label":"End","noEvent":false,"x":7,"y":7,"w":1,"h":1},{"code":"PageDown","label":"PgDn","noEvent":false,"x":9,"y":7,"w":1,"h":1},{"code":"Tab","label":"Tab","noEvent":false,"x":10,"y":6,"w":1,"h":2},{"code":"Enter","label":"⏎Ent","noEvent":false,"x":11,"y":6,"w":1,"h":2}];

// ---- keyboard layout definitions ---------------------------------------
// Each entry: { id, name, group, note?, keys }
const KEYBOARDS = [
  // ===================== STANDARD (row-stagger), largest → smallest ======
  {
    id: 'full104',
    name: 'Full-size · 104-key US',
    group: 'Standard',
    keys: [].concat(fnRow(), coreRows().map((k) => ({ ...k, y: k.y + 1 })), sideCluster(1.0), numpad(1.0)),
  },
  {
    id: 'tkl87',
    name: 'TKL · 80% · 87-key US',
    group: 'Standard',
    keys: [].concat(fnRow(), coreRows().map((k) => ({ ...k, y: k.y + 1 })), sideCluster(1.0)),
  },
  {
    id: 'size75',
    name: '75% · 82-key US',
    group: 'Standard',
    keys: layout75(),
    note: 'representative 75% — compact F row, arrows, nav column',
  },
  {
    id: 'size65',
    name: '65% · 69-key US',
    group: 'Standard',
    keys: layout65(),
    note: 'representative 65% — arrows + Del/Home/PgUp/PgDn column',
  },
  {
    id: 'size60',
    name: '60% · 61-key US',
    group: 'Standard',
    keys: coreRows(),
    note: 'representative 60% — no function row, no arrows/nav',
  },
  {
    id: 'size40',
    name: '40% · ortholinear (Planck-style)',
    group: 'Standard',
    keys: layout40(),
    note: 'representative 40% ortholinear grid',
  },
  {
    id: 'ergodox',
    name: 'ErgoDox EZ · 76-key',
    group: 'Split & ergonomic',
    keys: ERGODOX_KEYS,
    note: 'factory default (QMK LAYOUT_ergodox_pretty) — 6 caps are layer/mod keys that send no OS key on tap',
  },
  {
    id: 'moonlander',
    name: 'Moonlander Mark I · 72-key',
    group: 'Split & ergonomic',
    keys: MOONLANDER_KEYS,
    note: 'factory default (QMK LAYOUT) — 7 caps are layer/mod keys that send no OS key on tap',
  },
  {
    id: 'glove80',
    name: 'MoErgo Glove80 · 80-key',
    group: 'Split & ergonomic',
    keys: GLOVE80_KEYS,
    note: 'factory default — 2 caps are layer keys that send no OS key on tap',
  },
  {
    id: 'go60',
    name: 'MoErgo Go60 · 60-key',
    group: 'Split & ergonomic',
    keys: GO60_KEYS,
    note: 'factory default — 3 caps are layer keys that send no OS key on tap',
  },
  {
    id: 'raise2',
    name: 'Dygma Raise 2 · 68-key',
    group: 'Split & ergonomic',
    keys: RAISE2_KEYS,
    note: 'factory default (Raise 2 = Raise layout) — 2 caps are LED/layer keys that send no OS key',
  },
  {
    id: 'defy',
    name: 'Dygma Defy · 70-key',
    group: 'Split & ergonomic',
    keys: DEFY_KEYS,
    note: 'factory default per Bazecor — 4 caps are LED/layer keys that send no OS key; 3 fn-cell codes best-effort',
  },
];

const KEYBOARD_BY_ID = Object.fromEntries(KEYBOARDS.map((k) => [k.id, k]));

// expose for other classic scripts (app.js)
window.KEYBOARDS = KEYBOARDS;
window.KEYBOARD_BY_ID = KEYBOARD_BY_ID;
