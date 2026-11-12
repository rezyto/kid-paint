/* Pinta Comigo — app principal */
'use strict';
(() => {
const { SIZE, CATEGORIES, renderPage, toLineLayer } = window.PCGen;
const $ = (id) => document.getElementById(id);
const bridge = window.AndroidBridge || null;
const VERSION = bridge && bridge.getVersion ? bridge.getVersion() : 'web';

/* ---------------- preferências ---------------- */
const pref = {
  get(k, d) { try { const v = localStorage.getItem('pc.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pc.' + k, JSON.stringify(v)); } catch { /* sem espaço: ignora */ } },
};
let level = pref.get('level', 1);
let sound = pref.get('sound', true);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------------- sons pequenos ---------------- */
let actx = null;
function beep(freq = 660, dur = 0.08, type = 'sine', vol = 0.08) {
  if (!sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* sem áudio */ }
}
const pop = () => { beep(520, 0.06, 'triangle'); setTimeout(() => beep(880, 0.08, 'triangle'), 50); };

/* ---------------- navegação ---------------- */
const screens = ['home', 'catalog', 'paint', 'gallery', 'photo', 'parents'];
let current = 'home';
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
  current = name;
  if (name === 'paint') requestAnimationFrame(layoutPaper);
}
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', goHome));
function goHome() { closeModal(false); show('home'); renderHome(); }

/* Botão "voltar" do Android */
window.__onBack = () => {
  if (!$('modal').classList.contains('hidden')) { closeModal(false); return true; }
  if (!$('celebrate').classList.contains('hidden')) { $('celebrate').classList.add('hidden'); return true; }
  if (current === 'paint') { leavePaint(); return true; }
  if (current !== 'home') { goHome(); return true; }
  return false;
};

/* ---------------- avisos e confirmação ---------------- */
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600); }
let modalCb = null;
function confirmBox(emoji, text) {
  return new Promise(res => { $('modalEmoji').textContent = emoji; $('modalText').textContent = text; $('modal').classList.remove('hidden'); modalCb = res; $('modalYes').focus(); });
}
function closeModal(v) { if (!$('modal').classList.contains('hidden')) { $('modal').classList.add('hidden'); if (modalCb) { const cb = modalCb; modalCb = null; cb(v); } } }
$('modalYes').onclick = () => closeModal(true);
$('modalNo').onclick = () => closeModal(false);

/* ---------------- S01 início ---------------- */
function levelChips(container, onPick) {
  container.innerHTML = '';
  [[1, '🐣', 'Fácil'], [2, '🐥', 'Médio'], [3, '🦉', 'Difícil']].forEach(([v, e, n]) => {
    const b = document.createElement('button');
    b.className = 'lvl'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(level === v));
    b.textContent = `${e} ${n}`; b.setAttribute('aria-label', `Nível ${n}`);
    b.onclick = () => { level = v; pref.set('level', v); beep(700); levelChips(container, onPick); onPick && onPick(); };
    container.append(b);
  });
}

function renderHome() {
  const tiles = $('tiles'); tiles.innerHTML = '';
  const mk = (emoji, name, color, fn) => {
    const b = document.createElement('button'); b.className = 'tile'; b.style.background = color;
    b.innerHTML = `<span class="em">${emoji}</span><span></span>`; b.lastChild.textContent = name;
    b.onclick = () => { beep(600); fn(); }; tiles.append(b);
  };
  for (const c of CATEGORIES) mk(c.emoji, c.name, c.color, () => openCatalog(c));
  mk('📷', 'Da minha foto', '#FF9F68', openPhoto);
  mk('🖼️', 'Os meus desenhos', '#8C9EFF', openGallery);
  // continuar
  const box = $('continueBox'); box.innerHTML = '';
  PCDB.all().then(list => {
    const last = list[0];
    if (!last || current !== 'home') return;
    const b = document.createElement('button'); b.className = 'continue';
    b.innerHTML = `<img alt=""><div><b>Continuar a pintar</b><small></small></div><span class="go">▶️</span>`;
    b.querySelector('img').src = last.thumb || ''; b.querySelector('small').textContent = last.title || '';
    b.onclick = () => { beep(600); openDrawing(last.id); };
    box.append(b);
  }).catch(() => {});
}

/* Pais: manter carregado 1,5 s (para as crianças não entrarem sem querer) */
(() => {
  const b = $('btnParents'); let t = 0;
  const start = (e) => { e.preventDefault(); t = setTimeout(openParents, 1500); };
  const stop = () => { if (t) { clearTimeout(t); t = 0; } };
  b.addEventListener('pointerdown', start); b.addEventListener('pointerup', () => { if (t) toast('Mantém carregado para abrir 👆'); stop(); });
  b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openParents(); });
})();

/* ---------------- S02 catálogo (infinito) ---------------- */
let catState = null;
const thumbQueue = [];
let thumbBusy = false;
function pumpThumbs() {
  if (thumbBusy) return; thumbBusy = true;
  const step = () => {
    const job = thumbQueue.shift();
    if (!job) { thumbBusy = false; return; }
    if (job.token === catState?.token) {
      const big = document.createElement('canvas'); big.width = big.height = SIZE;
      const title = renderPage(big.getContext('2d'), job.cat, job.n, job.L);
      const ctx = job.canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(big, 0, 0, job.canvas.width, job.canvas.height);
      job.btn.setAttribute('aria-label', title);
    }
    setTimeout(step, 0);
  };
  step();
}
function openCatalog(cat) {
  catState = { cat, next: 0, token: Math.random() };
  $('catTitle').textContent = `${cat.emoji} ${cat.name}`;
  levelChips($('levels'), () => openCatalog(cat));
  $('catGrid').innerHTML = ''; thumbQueue.length = 0;
  show('catalog');
  moreThumbs(18);
}
function moreThumbs(count) {
  const st = catState; if (!st) return;
  for (let i = 0; i < count; i++) {
    const n = st.next++;
    const b = document.createElement('button'); b.className = 'thumb';
    const c = document.createElement('canvas'); c.width = c.height = 360; b.append(c);
    b.onclick = () => { beep(600); openNewPage(st.cat.id, n, level); };
    $('catGrid').append(b);
    thumbQueue.push({ token: st.token, cat: st.cat.id, n, L: level, canvas: c, btn: b });
  }
  pumpThumbs();
}
$('catGrid').addEventListener('scroll', () => {
  const g = $('catGrid'); if (g.scrollTop + g.clientHeight > g.scrollHeight - 500) moreThumbs(9);
});
$('btnRandom').onclick = () => { pop(); openNewPage(catState.cat.id, 1000 + Math.floor(Math.random() * 1e6), level); };

/* ---------------- S03 pintar ---------------- */
const cvPaint = $('cvPaint'), cvStroke = $('cvStroke'), cvLines = $('cvLines');
for (const c of [cvPaint, cvStroke, cvLines]) { c.width = c.height = SIZE; }
const pctx = cvPaint.getContext('2d', { willReadFrequently: true });
const sctx = cvStroke.getContext('2d');
const lctx = cvLines.getContext('2d', { willReadFrequently: true });
let barrier = null;            // Uint8Array: 1 = linha
let doc = null;                // { id|null, title, kind, category, seed, level, created, done }
let undoStack = [], redoStack = [];
let dirty = false, saveTimer = 0;

const COLORS = ['#E53935', '#FB8C00', '#FDD835', '#7CB342', '#2E7D32', '#00897B', '#29B6F6', '#1E88E5', '#283593', '#8E24AA',
  '#EC407A', '#F8BBD0', '#6D4C41', '#A1887F', '#FFE0BD', '#F1C27D', '#C68642', '#8D5524', '#212121', '#9E9E9E', '#FFFFFF',
  '#FFC107', '#A5D6A7', '#CE93D8'];
const STAMPS = ['⭐', '❤️', '🌸', '🦋', '🐞', '🌈', '☀️', '🍎', '🎈', '✨', '🐟', '🍀', '🐾', '👑', '🎀', '🌙'];
const TOOLS = [
  { id: 'fill', e: '🪣', n: 'Balde' },
  { id: 'pen', e: '🖊️', n: 'Caneta' },
  { id: 'pencil', e: '✏️', n: 'Lápis' },
  { id: 'crayon', e: '🖍️', n: 'Cera' },
  { id: 'brush', e: '🖌️', n: 'Pincel' },
  { id: 'rainbow', e: '🌈', n: 'Arco-íris' },
  { id: 'stamp', e: '⭐', n: 'Carimbo' },
  { id: 'eraser', e: '🧽', n: 'Borracha' },
];
const SIZES = [10, 20, 36];
let tool = pref.get('tool', 'fill'), color = pref.get('color', '#E53935'), sizeIx = pref.get('size', 1), stamp = '⭐';

function buildTools() {
  const t = $('tools'); t.innerHTML = '';
  for (const d of TOOLS) {
    const b = document.createElement('button'); b.className = 'tool';
    b.innerHTML = `<span>${d.e}</span><small>${d.n}</small>`; b.setAttribute('aria-label', d.n);
    b.setAttribute('aria-pressed', String(tool === d.id));
    b.onclick = () => { tool = d.id; pref.set('tool', tool); beep(740); buildTools(); buildColors(); };
    t.append(b);
  }
  const sz = $('sizes'); sz.innerHTML = '';
  SIZES.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'size'; b.setAttribute('aria-label', ['Fino', 'Médio', 'Grosso'][i]);
    b.setAttribute('aria-pressed', String(sizeIx === i)); b.innerHTML = `<i style="width:${8 + i * 9}px;height:${8 + i * 9}px"></i>`;
    b.onclick = () => { sizeIx = i; pref.set('size', i); beep(500 + i * 120); buildTools(); };
    sz.append(b);
  });
}
function buildColors() {
  const c = $('colors'); c.innerHTML = '';
  if (tool === 'stamp') {
    for (const s of STAMPS) {
      const b = document.createElement('button'); b.className = 'stamp'; b.textContent = s; b.setAttribute('aria-pressed', String(stamp === s));
      b.onclick = () => { stamp = s; beep(820); buildColors(); }; c.append(b);
    }
    return;
  }
  for (const col of COLORS) {
    const b = document.createElement('button'); b.className = 'sw'; b.style.background = col; b.setAttribute('aria-label', 'Cor ' + col);
    b.setAttribute('aria-pressed', String(color.toUpperCase() === col));
    b.onclick = () => { color = col; pref.set('color', col); beep(640); if (tool === 'eraser' || tool === 'rainbow') { tool = 'fill'; buildTools(); } buildColors(); };
    c.append(b);
  }
  const cu = document.createElement('label'); cu.className = 'sw custom'; cu.setAttribute('aria-label', 'Outra cor');
  const inp = document.createElement('input'); inp.type = 'color'; inp.value = color;
  inp.oninput = () => { color = inp.value.toUpperCase(); pref.set('color', color); };
  inp.onchange = () => buildColors();
  cu.append(inp); c.append(cu);
}

/* tamanho do papel e zoom */
let view = { s: 1, x: 0, y: 0, base: 1 };
function layoutPaper() {
  const st = $('stage').getBoundingClientRect();
  const side = Math.max(100, Math.min(st.width, st.height) - 20);
  const p = $('paper'); p.style.width = p.style.height = side + 'px';
  view.base = side; resetView();
}
function resetView() {
  const st = $('stage').getBoundingClientRect();
  view.s = 1; view.x = (st.width - view.base) / 2; view.y = (st.height - view.base) / 2; applyView();
}
function applyView() {
  $('paper').style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  $('pZoom').hidden = Math.abs(view.s - 1) < 0.02;
}
window.addEventListener('resize', () => { if (current === 'paint') layoutPaper(); });
$('pZoom').onclick = () => { resetView(); beep(500); };

function toCanvas(e) {
  const r = cvPaint.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * SIZE, (e.clientY - r.top) / r.height * SIZE];
}

/* texturas de lápis e cera: grão binário fixo (aplicar duas vezes dá o mesmo resultado) */
function makeGrain(density, blob) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const img = x.createImageData(128, 128);
  const rng = (() => { let a = 12345 + blob; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  for (let i = 0; i < 128 * 128; i++) {
    const px = i % 128, py = (i / 128) | 0;
    const v = rng() * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(px * 0.9 + Math.sin(py * 0.35) * 3) * Math.sin(py * 0.7));
    img.data[i * 4 + 3] = v < density ? 255 : 0;
  }
  x.putImageData(img, 0, 0);
  return sctx.createPattern(c, 'repeat');
}
const grainPencil = makeGrain(0.78, 1), grainCrayon = makeGrain(0.6, 7);

/* desenho com o dedo */
const pointers = new Map();
let stroke = null, pinch = null, hue = 0;

function snapshot() { return pctx.getImageData(0, 0, SIZE, SIZE); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 12) undoStack.shift(); redoStack = []; updateUndoBtns(); }
function updateUndoBtns() { $('pUndo').disabled = !undoStack.length; $('pRedo').disabled = !redoStack.length; }

function strokeWidth() {
  const base = SIZES[sizeIx];
  return { pen: base, pencil: base * 0.6, crayon: base * 1.5, brush: base * 2.6, rainbow: base * 1.4, eraser: base * 2.6 }[tool] || base;
}

function beginStroke(e) {
  const [x, y] = toCanvas(e);
  if (tool === 'fill') { stroke = { tap: true, x, y, sx: e.clientX, sy: e.clientY }; return; }
  if (tool === 'stamp') { stroke = { tap: true, x, y, sx: e.clientX, sy: e.clientY }; return; }
  pushUndo();
  stroke = { x, y, lx: x, ly: y, w: strokeWidth(), moved: false, bbox: [x, y, x, y] };
  if (tool === 'eraser') { pctx.save(); pctx.globalCompositeOperation = 'destination-out'; }
  drawSeg(x, y, x + 0.01, y + 0.01);
}
function drawSeg(x0, y0, x1, y1) {
  const w = stroke.w;
  const ctx = tool === 'eraser' ? pctx : sctx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w;
  if (tool === 'eraser') ctx.strokeStyle = '#000';
  else if (tool === 'rainbow') { hue = (hue + 4) % 360; ctx.strokeStyle = `hsl(${hue} 90% 55%)`; }
  else ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (tool === 'pencil' || tool === 'crayon') {
    const pad = w;
    const bx = Math.min(x0, x1) - pad, by = Math.min(y0, y1) - pad, bw = Math.abs(x1 - x0) + pad * 2, bh = Math.abs(y1 - y0) + pad * 2;
    sctx.save(); sctx.beginPath(); sctx.rect(bx, by, bw, bh); sctx.clip();
    sctx.globalCompositeOperation = 'destination-in'; sctx.fillStyle = tool === 'pencil' ? grainPencil : grainCrayon;
    sctx.fillRect(bx, by, bw, bh); sctx.restore();
  }
}
function moveStroke(e) {
  if (!stroke || stroke.tap) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) {
    const [x, y] = toCanvas(ev);
    if (Math.hypot(x - stroke.lx, y - stroke.ly) < 1.2) continue;
    drawSeg(stroke.lx, stroke.ly, x, y);
    stroke.lx = x; stroke.ly = y; stroke.moved = true;
  }
}
function endStroke(cancel) {
  if (!stroke) return;
  const s = stroke; stroke = null;
  if (s.tap) {
    if (cancel) return;
    if (tool === 'fill') doFill(s.x, s.y);
    else if (tool === 'stamp') doStamp(s.x, s.y);
    return;
  }
  if (tool === 'eraser') pctx.restore();
  else {
    pctx.save(); pctx.globalAlpha = tool === 'pencil' ? 0.9 : 1;
    if (!cancel) pctx.drawImage(cvStroke, 0, 0);
    pctx.restore();
  }
  sctx.clearRect(0, 0, SIZE, SIZE);
  if (cancel) { const u = undoStack.pop(); if (u) pctx.putImageData(u, 0, 0); updateUndoBtns(); return; }
  changed();
}

const stage = $('stage');
stage.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* ignora */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) beginStroke(e);
  else if (pointers.size === 2) {
    endStroke(true); // dois dedos = mexer/zoom, não pintar
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, s: view.s, x: view.x, y: view.y };
  }
});
stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const ns = Math.min(5, Math.max(1, pinch.s * d / pinch.d));
    const st = stage.getBoundingClientRect();
    const px = (pinch.cx - st.left - pinch.x) / pinch.s, py = (pinch.cy - st.top - pinch.y) / pinch.s;
    view.s = ns; view.x = cx - st.left - px * ns; view.y = cy - st.top - py * ns;
    if (ns <= 1.01) { resetView(); return; }
    applyView();
  } else moveStroke(e);
});
const up = (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size === 0) pinch = null; return; }
  endStroke(e.type === 'pointercancel');
};
stage.addEventListener('pointerup', up);
stage.addEventListener('pointercancel', up);
stage.addEventListener('contextmenu', e => e.preventDefault());

/* balde: enche o espaço fechado pelas linhas */
function computeBarrier() {
  const d = lctx.getImageData(0, 0, SIZE, SIZE).data;
  barrier = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < barrier.length; i++) barrier[i] = d[i * 4 + 3] > 110 ? 1 : 0;
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function doFill(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !barrier) return;
  if (barrier[y * SIZE + x]) { // tocou numa linha: procura o espaço mais perto
    let found = false;
    for (let r = 1; r < 14 && !found; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !barrier[ny * SIZE + nx]) { x = nx; y = ny; found = true; break; }
    }
    if (!found) return;
  }
  const region = new Uint8Array(SIZE * SIZE);
  const stack = [x, y];
  while (stack.length) {
    const py = stack.pop(), px0 = stack.pop();
    let lx = px0; const row = py * SIZE;
    while (lx > 0 && !barrier[row + lx - 1] && !region[row + lx - 1]) lx--;
    let rx = px0;
    while (rx < SIZE - 1 && !barrier[row + rx + 1] && !region[row + rx + 1]) rx++;
    let upOpen = false, dnOpen = false;
    for (let i = lx; i <= rx; i++) {
      region[row + i] = 1;
      if (py > 0) { const j = row - SIZE + i; const ok = !barrier[j] && !region[j]; if (ok && !upOpen) { stack.push(i, py - 1); upOpen = true; } else if (!ok) upOpen = false; }
      if (py < SIZE - 1) { const j = row + SIZE + i; const ok = !barrier[j] && !region[j]; if (ok && !dnOpen) { stack.push(i, py + 1); dnOpen = true; } else if (!ok) dnOpen = false; }
    }
  }
  // crescer 3 px por baixo das linhas para não ficar uma orla branca
  for (let it = 0; it < 3; it++) {
    const add = [];
    for (let i = SIZE; i < region.length - SIZE; i++) {
      if (region[i] || !barrier[i]) continue;
      if (region[i - 1] === 1 || region[i + 1] === 1 || region[i - SIZE] === 1 || region[i + SIZE] === 1) add.push(i);
    }
    for (const i of add) region[i] = 1;
  }
  pushUndo();
  const img = pctx.getImageData(0, 0, SIZE, SIZE), d = img.data;
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < region.length; i++) if (region[i]) { const k = i * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; }
  pctx.putImageData(img, 0, 0);
  pop(); changed();
}
function doStamp(x, y) {
  pushUndo();
  const s = [70, 110, 170][sizeIx];
  pctx.save(); pctx.font = `${s}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
  pctx.translate(x, y); pctx.rotate((Math.random() - 0.5) * 0.4); pctx.fillText(stamp, 0, 0); pctx.restore();
  beep(990, 0.07, 'square', 0.04); changed();
}

$('pUndo').onclick = () => { const u = undoStack.pop(); if (!u) return; redoStack.push(snapshot()); pctx.putImageData(u, 0, 0); updateUndoBtns(); beep(420); changed(); };
$('pRedo').onclick = () => { const r = redoStack.pop(); if (!r) return; undoStack.push(snapshot()); pctx.putImageData(r, 0, 0); updateUndoBtns(); beep(620); changed(); };
$('pClear').onclick = async () => {
  if (await confirmBox('🗑️', 'Apagar as cores todas?')) { pushUndo(); pctx.clearRect(0, 0, SIZE, SIZE); beep(300, 0.2, 'sawtooth', 0.05); changed(); toast('Apagado! Podes usar ↩️ para voltar atrás.'); }
};

/* ---------------- guardar automaticamente ---------------- */
function setSaveState(t) { $('saveState').textContent = t; }
function changed() { dirty = true; setSaveState('…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 900); }
const canvasBlob = (c, type = 'image/png', q) => new Promise(res => c.toBlob(res, type, q));
function composite(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
  x.imageSmoothingQuality = 'high';
  x.drawImage(cvPaint, 0, 0, size, size); x.drawImage(cvLines, 0, 0, size, size);
  return c;
}
let saving = Promise.resolve();
function saveNow() {
  clearTimeout(saveTimer);
  if (!doc || !dirty) return saving;
  dirty = false;
  const d = doc;
  saving = saving.then(async () => {
    const now = Date.now();
    if (!d.id) { d.id = 'd' + now.toString(36) + Math.random().toString(36).slice(2, 6); d.created = now; d.lineBlob = await canvasBlob(cvLines); }
    const paint = await canvasBlob(cvPaint);
    const thumb = composite(240).toDataURL('image/jpeg', 0.82);
    await PCDB.put({ id: d.id, title: d.title, kind: d.kind, category: d.category, seed: d.seed, level: d.level, created: d.created, updated: now, done: !!d.done, line: d.lineBlob, paint, thumb });
    pref.set('cur', d.id);
    if (doc === d) setSaveState('✓ guardado');
  }).catch(err => { dirty = true; setSaveState('⚠'); console.error(err); });
  return saving;
}
window.__saveNow = () => { saveNow(); return true; };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
window.addEventListener('pagehide', saveNow);

function resetCanvases() {
  pctx.clearRect(0, 0, SIZE, SIZE); sctx.clearRect(0, 0, SIZE, SIZE); lctx.clearRect(0, 0, SIZE, SIZE);
  undoStack = []; redoStack = []; updateUndoBtns(); dirty = false; setSaveState('');
}
function enterPaint() { buildTools(); buildColors(); show('paint'); }

async function openNewPage(cat, n, L) {
  await saveNow();
  resetCanvases();
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = SIZE;
  const title = renderPage(tmp.getContext('2d'), cat, n, L);
  lctx.drawImage(toLineLayer(tmp), 0, 0);
  computeBarrier();
  doc = { id: null, title, kind: 'gen', category: cat, seed: n, level: L, done: false };
  pref.set('cur', null);
  enterPaint();
}
async function openLineCanvas(lineCanvasWhiteBg, title) {
  await saveNow();
  resetCanvases();
  lctx.drawImage(toLineLayer(lineCanvasWhiteBg), 0, 0);
  computeBarrier();
  doc = { id: null, title, kind: 'photo', category: 'foto', seed: 0, level: 0, done: false };
  dirty = true; await saveNow(); // a foto fica logo guardada
  enterPaint();
}
const blobToImage = (b) => new Promise((res, rej) => { const u = URL.createObjectURL(b); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = rej; i.src = u; });
async function openDrawing(id) {
  await saveNow();
  const rec = await PCDB.get(id);
  if (!rec) { pref.set('cur', null); goHome(); return; }
  resetCanvases();
  lctx.drawImage(await blobToImage(rec.line), 0, 0);
  if (rec.paint) pctx.drawImage(await blobToImage(rec.paint), 0, 0);
  computeBarrier();
  doc = { id: rec.id, title: rec.title, kind: rec.kind, category: rec.category, seed: rec.seed, level: rec.level, created: rec.created, done: rec.done, lineBlob: rec.line };
  pref.set('cur', rec.id);
  setSaveState('✓ guardado');
  enterPaint();
}
async function leavePaint() { await saveNow(); doc = null; pref.set('cur', null); goHome(); }
$('pBack').onclick = () => { beep(500); leavePaint(); };

/* terminei + confetes */
$('pDone').onclick = async () => {
  if (!doc) return;
  doc.done = true; dirty = true; await saveNow();
  $('celebrate').classList.remove('hidden'); confetti();
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.07), i * 110));
};
$('celGallery').onclick = () => { $('celebrate').classList.add('hidden'); doc = null; pref.set('cur', null); openGallery(); };
$('celNew').onclick = () => { $('celebrate').classList.add('hidden'); doc = null; pref.set('cur', null); goHome(); };
function confetti() {
  const c = $('cvConfetti'); c.width = innerWidth; c.height = innerHeight; const x = c.getContext('2d');
  const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 5 + Math.random() * 7, c: COLORS[(Math.random() * 12) | 0], a: Math.random() * 6 }));
  let t = 0;
  const step = () => {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.a += 0.1; x.fillStyle = p.c; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); }
    if (++t < 200 && !$('celebrate').classList.contains('hidden')) requestAnimationFrame(step); else x.clearRect(0, 0, c.width, c.height);
  };
  step();
}

/* exportar para a galeria do tablet */
async function exportImage(canvasOrRec, name) {
  let c = canvasOrRec;
  if (!(c instanceof HTMLCanvasElement)) {
    c = document.createElement('canvas'); c.width = c.height = SIZE; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, SIZE, SIZE);
    if (canvasOrRec.paint) x.drawImage(await blobToImage(canvasOrRec.paint), 0, 0);
    x.drawImage(await blobToImage(canvasOrRec.line), 0, 0);
  }
  const file = `PintaComigo-${(name || 'desenho').replace(/[^\wÀ-ú-]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.png`;
  const url = c.toDataURL('image/png');
  if (bridge && bridge.saveImage) {
    const ok = bridge.saveImage(url.split(',')[1], file);
    toast(ok ? 'Guardado na galeria do tablet! 📸' : 'Não deu para guardar 😕');
  } else {
    const a = document.createElement('a'); a.href = url; a.download = file; document.body.append(a); a.click(); a.remove();
    toast('Imagem descarregada 📸');
  }
}
$('pExport').onclick = () => { beep(700); exportImage(composite(SIZE), doc && doc.title); };

/* ---------------- S04 galeria ---------------- */
async function openGallery() {
  show('gallery');
  const g = $('galGrid'); g.innerHTML = '';
  const list = await PCDB.all();
  $('galEmpty').classList.toggle('hidden', list.length > 0);
  for (const rec of list) {
    const card = document.createElement('div'); card.className = 'thumb'; card.tabIndex = 0; card.setAttribute('role', 'button');
    card.setAttribute('aria-label', rec.title || 'Desenho');
    card.innerHTML = `<img alt=""><span class="tag"></span>${rec.done ? '<span class="star">⭐</span>' : ''}<div class="acts"><button aria-label="Guardar no tablet">💾</button><button aria-label="Apagar">🗑️</button></div>`;
    card.querySelector('img').src = rec.thumb || ''; card.querySelector('.tag').textContent = rec.title || '';
    card.onclick = () => { beep(600); openDrawing(rec.id); };
    card.onkeydown = (e) => { if (e.key === 'Enter') openDrawing(rec.id); };
    const [bSave, bDel] = card.querySelectorAll('.acts button');
    bSave.onclick = (e) => { e.stopPropagation(); exportImage(rec, rec.title); };
    bDel.onclick = async (e) => {
      e.stopPropagation();
      if (await confirmBox('🗑️', 'Deitar este desenho fora?')) { await PCDB.del(rec.id); if (pref.get('cur') === rec.id) pref.set('cur', null); beep(300, 0.15, 'sawtooth', 0.04); openGallery(); }
    };
    g.append(card);
  }
}
$('galStart').onclick = goHome;

/* ---------------- S05 foto ---------------- */
let photoImg = null;
function openPhoto() {
  photoImg = null; $('photoErr').textContent = '';
  $('photoPick').classList.remove('hidden'); $('photoEdit').classList.add('hidden');
  show('photo');
}
async function loadPhoto(file) {
  if (!file) return;
  try {
    photoImg = await blobToImage(file);
    $('photoPick').classList.add('hidden'); $('photoEdit').classList.remove('hidden');
    processPhoto();
  } catch { $('photoErr').textContent = 'Não consegui abrir essa foto. Experimenta outra.'; }
}
$('inCamera').onchange = (e) => { loadPhoto(e.target.files[0]); e.target.value = ''; };
$('inGallery').onchange = (e) => { loadPhoto(e.target.files[0]); e.target.value = ''; };
let photoResult = null, photoTimer = 0;
function processPhoto() {
  if (!photoImg) return;
  $('photoSpin').classList.remove('hidden');
  clearTimeout(photoTimer);
  photoTimer = setTimeout(() => {
    photoResult = window.PCPhoto.photoToLines(photoImg, +$('rgDetail').value, +$('rgThick').value);
    $('cvPhoto').getContext('2d').drawImage(photoResult, 0, 0);
    $('photoSpin').classList.add('hidden');
  }, 60);
}
$('rgDetail').oninput = processPhoto; $('rgThick').oninput = processPhoto;
$('photoAgain').onclick = openPhoto;
$('photoUse').onclick = () => { if (photoResult) { pop(); openLineCanvas(photoResult, 'A minha foto'); } };

/* ---------------- S06 pais ---------------- */
function openParents() {
  show('parents'); beep(800);
  levelChips($('setLevels'));
  const s = $('setSound'); s.setAttribute('role', 'switch'); s.setAttribute('aria-checked', String(sound)); s.setAttribute('aria-label', 'Sons');
  s.onclick = () => { sound = !sound; pref.set('sound', sound); s.setAttribute('aria-checked', String(sound)); beep(700); };
  PCDB.count().then(n => { $('setCount').textContent = String(n); });
  $('setVersion').textContent = VERSION;
  $('rowUpdate').classList.toggle('hidden', !(bridge && bridge.checkUpdate));
}
$('setUpdate').onclick = () => { if (bridge && bridge.checkUpdate) { bridge.checkUpdate(true); toast('A procurar…'); } };
window.__toast = toast;

/* ---------------- arranque: volta exatamente onde estava ---------------- */
renderHome();
const cur = pref.get('cur', null);
if (cur) openDrawing(cur).catch(() => goHome());
})();
