/* Pinta Comigo — app principal */
'use strict';
(() => {
const { SIZE, CATEGORIES, renderPage, toLineLayer } = window.PCGen;
const $ = (id) => document.getElementById(id);
const bridge = window.AndroidBridge || null;
const has = (fn) => !!(bridge && typeof bridge[fn] === 'function');
const VERSION = has('getVersion') ? bridge.getVersion() : 'web';

/* ---------------- preferências ---------------- */
const pref = {
  get(k, d) { try { const v = localStorage.getItem('pc.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pc.' + k, JSON.stringify(v)); } catch { /* sem espaço */ } },
};
const S = {
  level: pref.get('level', 1), sound: pref.get('sound', true), haptic: pref.get('haptic', true),
  awake: pref.get('awake', true), left: pref.get('left', false),
};
function setS(k, v) { S[k] = v; pref.set(k, v); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------------- som e vibração ---------------- */
let actx = null;
function beep(freq = 660, dur = 0.07, type = 'sine', vol = 0.06) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* sem áudio */ }
}
function buzz(ms = 8) { if (S.haptic && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* */ } }
const tick = () => { beep(700, 0.05); buzz(6); };
const pop = () => { beep(520, 0.06, 'triangle'); setTimeout(() => beep(880, 0.08, 'triangle'), 50); buzz(12); };

/* ---------------- navegação ---------------- */
const screens = ['home', 'catalog', 'gallery', 'photo', 'parents'];
let current = 'home';
function show(name) {
  closePop(); closeModal(false);
  if (name === 'paint') {
    $('paint').classList.remove('hidden');
    document.body.classList.toggle('left-handed', S.left);
    keepAwake(S.awake);
  } else {
    $('paint').classList.add('hidden'); keepAwake(false);
    for (const s of screens) $(s).classList.toggle('hidden', s !== name);
    const navKey = name === 'catalog' ? 'home' : name;
    document.querySelectorAll('.nav-btn').forEach(b => {
      const key = b.dataset.nav || 'parents';
      if (key === navKey) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  current = name;
}
function keepAwake(on) { if (has('keepAwake')) try { bridge.keepAwake(!!on); } catch { /* */ } }
document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
  tick(); const n = b.dataset.nav;
  if (n === 'home') goHome(); else if (n === 'gallery') openGallery(); else if (n === 'photo') openPhoto();
}));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { tick(); goHome(); }));
function goHome() { show('home'); renderHome(); }

/* Pais: manter carregado 1,2 s */
(() => {
  const b = $('navParents'); let t = 0;
  const start = (e) => { e.preventDefault(); t = setTimeout(() => { t = 0; buzz(20); openParents(); }, 1200); };
  const stop = (hint) => { if (t) { clearTimeout(t); t = 0; if (hint) toast('Para os pais: mantém o botão carregado'); } };
  b.addEventListener('pointerdown', start);
  b.addEventListener('pointerup', () => stop(true));
  b.addEventListener('pointerleave', () => stop(false)); b.addEventListener('pointercancel', () => stop(false));
  b.addEventListener('contextmenu', e => e.preventDefault());
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openParents(); });
})();

/* Botão "voltar" do Android */
window.__onBack = () => {
  if (!$('popLayer').classList.contains('hidden')) { closePop(); return true; }
  if (!$('modal').classList.contains('hidden')) { closeModal(false); return true; }
  if (!$('celebrate').classList.contains('hidden')) { $('celebrate').classList.add('hidden'); return true; }
  if (current === 'paint') { leavePaint(); return true; }
  if (current !== 'home') { goHome(); return true; }
  return false;
};

/* ---------------- avisos, menus e confirmações ---------------- */
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600); }
window.__toast = toast;

let modalCb = null;
function confirmBox({ icon = 'i-trash', title, sub = '', yes = 'Sim', danger = true }) {
  return new Promise(res => {
    $('modalIc').innerHTML = `<svg><use href="#${icon}"/></svg>`;
    $('modalText').textContent = title; $('modalSub').textContent = sub;
    $('modalYes').textContent = yes; $('modalYes').classList.toggle('danger', danger);
    $('modal').classList.remove('hidden'); modalCb = res; $('modalYes').focus();
  });
}
function closeModal(v) { if (!$('modal').classList.contains('hidden')) { $('modal').classList.add('hidden'); if (modalCb) { const cb = modalCb; modalCb = null; cb(v); } } }
$('modalYes').onclick = () => closeModal(true);
$('modalNo').onclick = () => closeModal(false);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(false); });

/* menu flutuante junto a um botão: items = [{icon,label,fn,danger}|'-'|{html}] */
function openPop(anchor, items) {
  const pop = $('pop'); pop.innerHTML = '';
  for (const it of items) {
    if (it === '-') { pop.append(document.createElement('hr')); continue; }
    if (it.el) { pop.append(it.el); continue; }
    const b = document.createElement('button'); b.setAttribute('role', 'menuitem');
    if (it.danger) b.className = 'danger';
    b.innerHTML = `<svg><use href="#${it.icon}"/></svg><span></span>`; b.lastChild.textContent = it.label;
    b.onclick = () => { closePop(); tick(); it.fn(); };
    pop.append(b);
  }
  $('popLayer').classList.remove('hidden');
  const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.right - pw, y = r.bottom + 6;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
  if (x < 8) x = Math.min(r.left, innerWidth - pw - 8);
  if (x + pw > innerWidth - 8) x = innerWidth - pw - 8;
  pop.style.left = Math.max(8, x) + 'px'; pop.style.top = y + 'px';
  const first = pop.querySelector('button'); if (first) first.focus({ preventScroll: true });
}
function closePop() { $('popLayer').classList.add('hidden'); }
$('popLayer').addEventListener('pointerdown', (e) => { if (e.target === $('popLayer')) closePop(); });

function levelSeg(container, onPick) {
  container.innerHTML = '';
  [[1, 'Fácil'], [2, 'Médio'], [3, 'Difícil']].forEach(([v, n]) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(S.level === v)); b.textContent = n;
    b.onclick = () => { setS('level', v); tick(); levelSeg(container, onPick); onPick && onPick(); };
    container.append(b);
  });
}
function relDate(t) {
  const d = new Date(t), now = new Date();
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (days === 0) return 'Hoje'; if (days === 1) return 'Ontem'; if (days < 7) return `Há ${days} dias`;
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

/* fila de miniaturas (desenha uma de cada vez para não prender o ecrã) */
const thumbQueue = []; let thumbBusy = false;
function queueThumb(job) { thumbQueue.push(job); pumpThumbs(); }
function pumpThumbs() {
  if (thumbBusy) return; thumbBusy = true;
  const step = () => {
    const job = thumbQueue.shift();
    if (!job) { thumbBusy = false; return; }
    if (job.canvas.isConnected) {
      const big = document.createElement('canvas'); big.width = big.height = SIZE;
      const title = renderPage(big.getContext('2d'), job.cat, job.n, job.L);
      const ctx = job.canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(big, 0, 0, job.canvas.width, job.canvas.height);
      if (job.onTitle) job.onTitle(title);
    }
    setTimeout(step, 0);
  };
  step();
}

/* ---------------- S01 início ---------------- */
const TINTS = ['#FFF1E0', '#E8F6EC', '#E6F0FD', '#F1EAFE', '#FDECEC', '#E3F6F4', '#FCEAF5', '#FFF6D6'];
function renderHome() {
  thumbQueue.length = 0;
  const cards = $('cards'); cards.innerHTML = '';
  CATEGORIES.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'card'; b.style.setProperty('--tint', TINTS[i % TINTS.length]);
    b.innerHTML = `<canvas class="art" width="320" height="320"></canvas><div class="meta"><b></b><span class="em" aria-hidden="true"></span></div>`;
    b.querySelector('b').textContent = c.name; b.querySelector('.em').textContent = c.emoji;
    b.onclick = () => { tick(); openCatalog(c); };
    cards.append(b);
    queueThumb({ canvas: b.querySelector('canvas'), cat: c.id, n: 0, L: S.level });
  });
  const st = $('startCards'); st.innerHTML = '';
  const start = (icon, title, sub, tint, fn) => {
    const b = document.createElement('button'); b.className = 'card'; b.style.setProperty('--tint', tint);
    b.innerHTML = `<div class="art ic"><svg><use href="#${icon}"/></svg></div><div class="meta"><div><b></b><br><small></small></div></div>`;
    b.querySelector('b').textContent = title; b.querySelector('small').textContent = sub;
    b.onclick = () => { tick(); fn(); }; st.append(b);
  };
  start('i-page', 'Folha em branco', 'Desenho livre', '#F3F1EE', openBlank);
  start('i-camera', 'Da minha foto', 'Foto → desenho', '#E6F0FD', openPhoto);
  start('i-dice', 'Surpresa', 'Um desenho ao calhas', '#FFF6D6', () => {
    const c = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    openNewPage(c.id, 1000 + Math.floor(Math.random() * 1e6), S.level);
  });
  const box = $('continueBox'); box.innerHTML = ''; $('recentBox').innerHTML = '';
  PCDB.all().then(list => {
    if (current !== 'home') return;
    const last = list.find(r => !r.done) || null;
    if (last) {
      const b = document.createElement('button'); b.className = 'continue';
      b.innerHTML = `<img alt=""><div class="txt"><small>Continuar a pintar</small><b></b><span></span></div><span class="play"><svg><use href="#i-play"/></svg></span>`;
      b.querySelector('img').src = last.thumb || ''; b.querySelector('b').textContent = last.title || 'Desenho';
      b.querySelector('.txt span').textContent = relDate(last.updated);
      b.onclick = () => { tick(); openDrawing(last.id); };
      box.append(b);
    }
    if (list.length) {
      const h = document.createElement('h2'); h.className = 'section'; h.textContent = 'Recentes';
      const strip = document.createElement('div'); strip.className = 'strip';
      for (const r of list.slice(0, 10)) {
        const t = document.createElement('button'); t.className = 'thumb'; t.setAttribute('aria-label', r.title || 'Desenho');
        t.innerHTML = '<img alt="">'; t.querySelector('img').src = r.thumb || '';
        t.onclick = () => { tick(); openDrawing(r.id); }; strip.append(t);
      }
      $('recentBox').append(h, strip);
    }
  }).catch(() => {});
}

/* ---------------- S02 catálogo (infinito) ---------------- */
let catState = null;
function openCatalog(cat) {
  catState = { cat, next: 0 };
  $('catTitle').textContent = cat.name;
  levelSeg($('levels'), () => openCatalog(cat));
  $('catGrid').innerHTML = ''; thumbQueue.length = 0;
  show('catalog'); $('catScroll').scrollTop = 0;
  moreThumbs(18);
}
function moreThumbs(count) {
  const st = catState; if (!st) return;
  for (let i = 0; i < count; i++) {
    const n = st.next++;
    const b = document.createElement('button'); b.className = 'thumb';
    b.innerHTML = '<canvas width="360" height="360"></canvas>';
    b.onclick = () => { tick(); openNewPage(st.cat.id, n, S.level); };
    $('catGrid').append(b);
    queueThumb({ canvas: b.querySelector('canvas'), cat: st.cat.id, n, L: S.level, onTitle: (t) => b.setAttribute('aria-label', t) });
  }
}
$('catScroll').addEventListener('scroll', () => {
  const g = $('catScroll'); if (g.scrollTop + g.clientHeight > g.scrollHeight - 700) moreThumbs(12);
}, { passive: true });
$('btnRandom').onclick = () => { pop(); openNewPage(catState.cat.id, 1000 + Math.floor(Math.random() * 1e6), S.level); };

/* ---------------- S03 pintar ---------------- */
const cvPaint = $('cvPaint'), cvStroke = $('cvStroke'), cvLines = $('cvLines');
for (const c of [cvPaint, cvStroke, cvLines]) { c.width = c.height = SIZE; }
const pctx = cvPaint.getContext('2d', { willReadFrequently: true });
const sctx = cvStroke.getContext('2d');
const lctx = cvLines.getContext('2d', { willReadFrequently: true });
let barrier = null, doc = null, undoStack = [], redoStack = [], dirty = false, saveTimer = 0;

const COLORS = ['#E5484D', '#F76B15', '#FFC53D', '#FFE629', '#8BC34A', '#2E9E5B', '#0E8A7E', '#4CC3F1', '#2F7BEA', '#3E3BB8',
  '#8E4EC6', '#D6409F', '#F7A8C8', '#FFD9B3', '#E8B48A', '#B07A4F', '#7A4B2E', '#4A2E1F', '#FFFFFF', '#BDB8C4', '#6F6A7B', '#1F1B2D', '#C2E8A6', '#C9B8F5'];
const STAMPS = ['⭐', '❤️', '🌸', '🦋', '🐞', '🌈', '☀️', '🍎', '🎈', '✨', '🐟', '🍀', '🐾', '👑', '🎀', '🌙', '🐶', '🐱', '🦄', '🍓'];
const INK = '#1F1B2D';
const TOOL_SVG = {
  fill: `<path d="M12 18h22l-3 22a3 3 0 0 1-3 2.6H18a3 3 0 0 1-3-2.6z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="23" cy="18" rx="11" ry="3.6" fill="var(--c)" stroke="${INK}" stroke-width="2.2"/><path d="M15 17c0-8.5 16-8.5 16 0" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M39 23s-4.5 5.6-4.5 8.4a4.5 4.5 0 0 0 9 0C43.5 28.6 39 23 39 23z" fill="var(--c)" stroke="${INK}" stroke-width="2"/>`,
  pen: `<g transform="rotate(40 24 24)"><path d="M24 2.5 19.5 13h9z" fill="var(--c)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="19" y="12" width="10" height="20" rx="2" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="19" y="30" width="10" height="14" rx="3" fill="var(--c)" stroke="${INK}" stroke-width="2"/></g>`,
  pencil: `<g transform="rotate(40 24 24)"><path d="M19 15 24 2.5 29 15z" fill="#F2D2A9" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M22.1 7.3 24 2.5l1.9 4.8z" fill="var(--c)"/><rect x="19" y="15" width="10" height="23" fill="var(--c)" stroke="${INK}" stroke-width="2"/><rect x="19" y="38" width="10" height="7" rx="2" fill="#F4A6B7" stroke="${INK}" stroke-width="2"/></g>`,
  crayon: `<g transform="rotate(40 24 24)"><path d="M20 14 22 4.5h4L28 14z" fill="var(--c)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="19" y="14" width="10" height="30" rx="2" fill="var(--c)" stroke="${INK}" stroke-width="2"/><rect x="19" y="20" width="10" height="17" fill="#fff" fill-opacity=".86" stroke="${INK}" stroke-width="2"/><path d="M21.5 24.5h5M21.5 28.5h5M21.5 32.5h5" stroke="var(--c)" stroke-width="1.8"/></g>`,
  brush: `<g transform="rotate(40 24 24)"><path d="M20.5 15C20.5 9 24 2.5 24 2.5S27.5 9 27.5 15z" fill="var(--c)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="20" y="15" width="8" height="7" fill="#C9CED6" stroke="${INK}" stroke-width="2"/><rect x="21" y="22" width="6" height="23" rx="3" fill="#B07A4F" stroke="${INK}" stroke-width="2"/></g>`,
  rainbow: `<g fill="none" stroke-width="4.4" stroke-linecap="round"><path d="M6 37a18 18 0 0 1 36 0" stroke="#E5484D"/><path d="M11 37a13 13 0 0 1 26 0" stroke="#FFC53D"/><path d="M16 37a8 8 0 0 1 16 0" stroke="#2E9E5B"/><path d="M21 37a3 3 0 0 1 6 0" stroke="#2F7BEA"/></g>`,
  eraser: `<g transform="rotate(40 24 24)"><rect x="17" y="7" width="14" height="33" rx="4" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M17 11a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v9H17z" fill="#F4A6B7" stroke="${INK}" stroke-width="2"/></g>`,
  picker: `<g transform="rotate(45 24 24)"><path d="M24 46v-5" stroke="var(--c)" stroke-width="3.2" stroke-linecap="round"/><path d="M21.5 41h5l-1-15h-3z" fill="var(--c)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="18.5" y="20" width="11" height="6" rx="1.5" fill="#C9CED6" stroke="${INK}" stroke-width="2"/><rect x="20.5" y="4" width="7" height="16" rx="3.5" fill="${INK}"/></g>`,
};
const TOOLS = [
  { id: 'fill', n: 'Balde' }, { id: 'pen', n: 'Caneta' }, { id: 'pencil', n: 'Lápis' }, { id: 'crayon', n: 'Cera' },
  { id: 'brush', n: 'Pincel' }, { id: 'rainbow', n: 'Arco-íris' }, { id: 'stamp', n: 'Carimbos' }, { id: 'eraser', n: 'Borracha' },
  { id: 'picker', n: 'Conta-gotas' },
];
const SIZES = [6, 12, 20, 32, 50];
let tool = pref.get('tool', 'fill'), color = pref.get('color', '#E5484D'), sizeIx = pref.get('size2', 2), stamp = pref.get('stamp', '⭐');
let prevTool = 'fill';
let recent = pref.get('recent', []);
if (!TOOLS.some(t => t.id === tool) || tool === 'picker') tool = 'fill';

function useColor() { // regista a cor como recente
  recent = [color, ...recent.filter(c => c !== color)].slice(0, 8); pref.set('recent', recent);
}
function selectTool(id) {
  if (id !== 'picker') { tool = id; pref.set('tool', id); } else { prevTool = tool === 'picker' ? prevTool : tool; tool = 'picker'; }
  tick(); buildTools(); buildColors();
  if (id === 'picker') toast('Toca numa cor do desenho para a apanhar');
}
function buildTools() {
  const t = $('tools'); t.innerHTML = '';
  for (const d of TOOLS) {
    const b = document.createElement('button'); b.className = 'tool'; b.title = d.n; b.setAttribute('aria-label', d.n);
    b.setAttribute('aria-pressed', String(tool === d.id)); b.style.setProperty('--c', color);
    b.innerHTML = d.id === 'stamp' ? `<span class="emo">${stamp}</span>` : `<svg viewBox="0 0 48 48">${TOOL_SVG[d.id]}</svg>`;
    b.onclick = () => selectTool(d.id);
    t.append(b);
  }
  const sep = document.createElement('div'); sep.className = 'tool-sep'; t.append(sep);
  const sb = document.createElement('button'); sb.className = 'tool'; sb.setAttribute('aria-label', 'Grossura'); sb.title = 'Grossura';
  const px = 8 + sizeIx * 6;
  sb.innerHTML = `<span class="size-dot" style="width:${px}px;height:${px}px;--c:${color}"></span>`;
  sb.onclick = () => openSizePop(sb);
  t.append(sb);
}
function openSizePop(anchor) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="ttl">Grossura</div><div class="sizes"></div>`;
  const row = wrap.querySelector('.sizes');
  SIZES.forEach((s, i) => {
    const b = document.createElement('button'); b.setAttribute('aria-pressed', String(i === sizeIx)); b.setAttribute('aria-label', 'Grossura ' + (i + 1));
    const px = 8 + i * 6; b.innerHTML = `<span class="size-dot" style="width:${px}px;height:${px}px;--c:${color}"></span>`;
    b.onclick = () => { sizeIx = i; pref.set('size2', i); tick(); closePop(); buildTools(); };
    row.append(b);
  });
  openPop(anchor, [{ el: wrap }]);
}
function swatch(col) {
  const b = document.createElement('button'); b.className = 'sw'; b.style.background = col; b.setAttribute('aria-label', 'Cor');
  b.setAttribute('aria-pressed', String(color.toUpperCase() === col.toUpperCase()));
  b.onclick = () => {
    color = col.toUpperCase(); pref.set('color', color); tick();
    if (tool === 'eraser' || tool === 'rainbow' || tool === 'picker' || tool === 'stamp') { tool = tool === 'picker' ? prevTool : 'fill'; if (tool === 'stamp' || tool === 'eraser' || tool === 'rainbow') tool = 'fill'; pref.set('tool', tool); }
    buildTools(); buildColors();
  };
  return b;
}
function buildColors() {
  const c = $('colors'); c.innerHTML = '';
  const label = (t) => { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = t; c.append(l); };
  if (tool === 'stamp') {
    label('Carimbos');
    const g = document.createElement('div'); g.className = 'swatches';
    for (const s of STAMPS) {
      const b = document.createElement('button'); b.className = 'stamp'; b.textContent = s; b.setAttribute('aria-pressed', String(stamp === s));
      b.onclick = () => { stamp = s; pref.set('stamp', s); tick(); buildColors(); buildTools(); }; g.append(b);
    }
    c.append(g); return;
  }
  if (recent.length) {
    label('Recentes');
    const g = document.createElement('div'); g.className = 'swatches';
    for (const col of recent.slice(0, 6)) g.append(swatch(col));
    c.append(g);
  }
  label('Cores');
  const g = document.createElement('div'); g.className = 'swatches';
  for (const col of COLORS) g.append(swatch(col));
  const cu = document.createElement('label'); cu.className = 'sw custom'; cu.setAttribute('aria-label', 'Outra cor');
  const inp = document.createElement('input'); inp.type = 'color'; inp.value = color.length === 7 ? color : '#E5484D';
  inp.oninput = () => { color = inp.value.toUpperCase(); pref.set('color', color); };
  inp.onchange = () => { buildColors(); buildTools(); };
  cu.append(inp); g.append(cu);
  c.append(g);
}

/* ---------- papel, zoom e posição ---------- */
const stage = $('stage');
let view = { s: 1, x: 0, y: 0, base: 300 };
function layoutPaper() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  const m = Math.max(10, Math.min(w, h) * 0.03);
  const side = Math.max(120, Math.min(w, h) - m * 2);
  $('paper').style.width = $('paper').style.height = side + 'px';
  const ratio = view.base ? side / view.base : 1;
  view.base = side;
  if (view.s <= 1.001) fitView(); else { view.x *= ratio; view.y *= ratio; clampView(); applyView(); }
}
function fitView() { view.s = 1; view.x = (stage.clientWidth - view.base) / 2; view.y = (stage.clientHeight - view.base) / 2; applyView(); }
function clampView() {
  const w = stage.clientWidth, h = stage.clientHeight, sz = view.base * view.s;
  const minX = Math.min(0, w - sz) - sz * 0.25, maxX = Math.max(w - sz, 0) + sz * 0.25;
  const minY = Math.min(0, h - sz) - sz * 0.25, maxY = Math.max(h - sz, 0) + sz * 0.25;
  view.x = Math.min(maxX, Math.max(minX, view.x)); view.y = Math.min(maxY, Math.max(minY, view.y));
}
let pillT = 0;
function applyView() {
  $('paper').style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  const zoomed = view.s > 1.01;
  $('pFit').disabled = !zoomed; $('pZoomOut').disabled = !zoomed; $('pZoomIn').disabled = view.s >= 4.99;
  const p = $('zoomPill'); p.textContent = Math.round(view.s * 100) + '%';
  p.classList.toggle('hidden', !zoomed); clearTimeout(pillT); if (zoomed) pillT = setTimeout(() => p.classList.add('hidden'), 1200);
}
function zoomAt(ns, cx, cy) {
  ns = Math.min(5, Math.max(1, ns));
  if (ns <= 1.001) { fitView(); return; }
  const px = (cx - view.x) / view.s, py = (cy - view.y) / view.s;
  view.s = ns; view.x = cx - px * ns; view.y = cy - py * ns; clampView(); applyView();
}
const zoomBy = (f) => { tick(); zoomAt(view.s * f, stage.clientWidth / 2, stage.clientHeight / 2); };
$('pZoomIn').onclick = () => zoomBy(1.5);
$('pZoomOut').onclick = () => zoomBy(1 / 1.5);
$('pFit').onclick = () => { tick(); fitView(); };
new ResizeObserver(() => { if (current === 'paint') layoutPaper(); }).observe(stage);

function toCanvas(e) {
  const r = cvPaint.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * SIZE, (e.clientY - r.top) / r.height * SIZE];
}

/* texturas: grão binário fixo (aplicar duas vezes dá o mesmo resultado) */
function makeGrain(density, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const img = x.createImageData(128, 128);
  let a = 12345 + seed; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  for (let i = 0; i < 128 * 128; i++) {
    const px = i % 128, py = (i / 128) | 0;
    const v = rnd() * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(px * 0.9 + Math.sin(py * 0.35) * 3) * Math.sin(py * 0.7));
    img.data[i * 4 + 3] = v < density ? 255 : 0;
  }
  x.putImageData(img, 0, 0);
  return sctx.createPattern(c, 'repeat');
}
const grainPencil = makeGrain(0.78, 1), grainCrayon = makeGrain(0.6, 7);

/* ---------- pintar com o dedo ---------- */
const pointers = new Map();
let stroke = null, pinch = null, hue = 0;
function snapshot() { return pctx.getImageData(0, 0, SIZE, SIZE); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 15) undoStack.shift(); redoStack = []; updateUndoBtns(); }
function updateUndoBtns() { $('pUndo').disabled = !undoStack.length; $('pRedo').disabled = !redoStack.length; }
function strokeWidth() {
  const base = SIZES[sizeIx];
  return { pen: base, pencil: base * 0.6, crayon: base * 1.4, brush: base * 2.2, rainbow: base * 1.4, eraser: base * 2.2 }[tool] || base;
}
function beginStroke(e) {
  const [x, y] = toCanvas(e);
  if (tool === 'fill' || tool === 'stamp' || tool === 'picker') { stroke = { tap: true, x, y }; return; }
  pushUndo();
  stroke = { x, y, lx: x, ly: y, w: strokeWidth() };
  if (tool === 'eraser') { pctx.save(); pctx.globalCompositeOperation = 'destination-out'; }
  drawSeg(x, y, x + 0.01, y + 0.01);
}
function drawSeg(x0, y0, x1, y1) {
  const w = stroke.w, ctx = tool === 'eraser' ? pctx : sctx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w;
  if (tool === 'eraser') ctx.strokeStyle = '#000';
  else if (tool === 'rainbow') { hue = (hue + 4) % 360; ctx.strokeStyle = `hsl(${hue} 90% 55%)`; }
  else ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (tool === 'pencil' || tool === 'crayon') {
    const pad = w, bx = Math.min(x0, x1) - pad, by = Math.min(y0, y1) - pad, bw = Math.abs(x1 - x0) + pad * 2, bh = Math.abs(y1 - y0) + pad * 2;
    sctx.save(); sctx.beginPath(); sctx.rect(bx, by, bw, bh); sctx.clip();
    sctx.globalCompositeOperation = 'destination-in'; sctx.fillStyle = tool === 'pencil' ? grainPencil : grainCrayon;
    sctx.fillRect(bx, by, bw, bh); sctx.restore();
  }
}
function moveStroke(e) {
  if (!stroke || stroke.tap) return;
  const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
  for (const ev of (evs.length ? evs : [e])) {
    const [x, y] = toCanvas(ev);
    if (Math.hypot(x - stroke.lx, y - stroke.ly) < 1.2) continue;
    drawSeg(stroke.lx, stroke.ly, x, y); stroke.lx = x; stroke.ly = y;
  }
}
/* discard = só quando um segundo dedo entra (zoom); um "cancel" do sistema guarda o traço */
function endStroke(discard) {
  if (!stroke) return;
  const s = stroke; stroke = null;
  if (s.tap) {
    if (discard) return;
    if (tool === 'fill') doFill(s.x, s.y); else if (tool === 'stamp') doStamp(s.x, s.y); else if (tool === 'picker') doPick(s.x, s.y);
    return;
  }
  if (tool === 'eraser') pctx.restore();
  else if (!discard) { pctx.save(); pctx.globalAlpha = tool === 'pencil' ? 0.92 : 1; pctx.drawImage(cvStroke, 0, 0); pctx.restore(); if (tool !== 'rainbow') useColor(); }
  sctx.clearRect(0, 0, SIZE, SIZE);
  if (discard) { const u = undoStack.pop(); if (u) pctx.putImageData(u, 0, 0); updateUndoBtns(); return; }
  changed();
}
stage.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) beginStroke(e);
  else if (pointers.size === 2) {
    endStroke(true);
    const [a, b] = [...pointers.values()], r = stage.getBoundingClientRect();
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, s: view.s, x: view.x, y: view.y };
  }
});
stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()], r = stage.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
    const ns = Math.min(5, Math.max(1, pinch.s * d / pinch.d));
    const px = (pinch.cx - pinch.x) / pinch.s, py = (pinch.cy - pinch.y) / pinch.s;
    view.s = ns; view.x = cx - px * ns; view.y = cy - py * ns;
    if (ns <= 1.001) fitView(); else { clampView(); applyView(); }
  } else moveStroke(e);
});
const endPointer = (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size === 0) pinch = null; return; }
  endStroke(false);
};
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('lostpointercapture', endPointer);
stage.addEventListener('contextmenu', e => e.preventDefault());
for (const ev of ['touchstart', 'touchmove']) stage.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
stage.addEventListener('wheel', (e) => { // rato / trackpad
  e.preventDefault(); const r = stage.getBoundingClientRect();
  zoomAt(view.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

/* ---------- balde ---------- */
function computeBarrier() {
  const d = lctx.getImageData(0, 0, SIZE, SIZE).data;
  barrier = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < barrier.length; i++) barrier[i] = d[i * 4 + 3] > 110 ? 1 : 0;
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function doFill(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !barrier) return;
  if (barrier[y * SIZE + x]) {
    let found = false;
    for (let r = 1; r < 16 && !found; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !barrier[ny * SIZE + nx]) { x = nx; y = ny; found = true; break; }
    }
    if (!found) return;
  }
  const region = new Uint8Array(SIZE * SIZE), stack = [x, y];
  while (stack.length) {
    const py = stack.pop(), px0 = stack.pop(), row = py * SIZE;
    if (region[row + px0]) continue;
    let lx = px0; while (lx > 0 && !barrier[row + lx - 1] && !region[row + lx - 1]) lx--;
    let rx = px0; while (rx < SIZE - 1 && !barrier[row + rx + 1] && !region[row + rx + 1]) rx++;
    let upOpen = false, dnOpen = false;
    for (let i = lx; i <= rx; i++) {
      region[row + i] = 1;
      if (py > 0) { const j = row - SIZE + i, ok = !barrier[j] && !region[j]; if (ok && !upOpen) { stack.push(i, py - 1); upOpen = true; } else if (!ok) upOpen = false; }
      if (py < SIZE - 1) { const j = row + SIZE + i, ok = !barrier[j] && !region[j]; if (ok && !dnOpen) { stack.push(i, py + 1); dnOpen = true; } else if (!ok) dnOpen = false; }
    }
  }
  for (let it = 0; it < 3; it++) {
    const add = [];
    for (let i = SIZE; i < region.length - SIZE; i++) {
      if (region[i] || !barrier[i]) continue;
      if (region[i - 1] === 1 || region[i + 1] === 1 || region[i - SIZE] === 1 || region[i + SIZE] === 1) add.push(i);
    }
    for (const i of add) region[i] = 1;
  }
  pushUndo();
  const img = pctx.getImageData(0, 0, SIZE, SIZE), d = img.data, [r, g, b] = hexToRgb(color);
  for (let i = 0; i < region.length; i++) if (region[i]) { const k = i * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; }
  pctx.putImageData(img, 0, 0);
  useColor(); pop(); changed();
}
function doStamp(x, y) {
  pushUndo();
  const s = [56, 80, 110, 150, 210][sizeIx];
  pctx.save(); pctx.font = `${s}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
  pctx.translate(x, y); pctx.rotate((Math.random() - 0.5) * 0.4); pctx.fillText(stamp, 0, 0); pctx.restore();
  beep(990, 0.06, 'square', 0.03); buzz(10); changed();
}
function doPick(x, y) {
  const d = pctx.getImageData(Math.max(0, Math.min(SIZE - 1, x | 0)), Math.max(0, Math.min(SIZE - 1, y | 0)), 1, 1).data;
  const hex = d[3] < 20 ? '#FFFFFF' : '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  color = hex; pref.set('color', color); useColor();
  tool = prevTool && prevTool !== 'picker' ? prevTool : 'fill'; pref.set('tool', tool);
  pop(); buildTools(); buildColors(); toast('Cor apanhada!');
}

$('pUndo').onclick = () => { const u = undoStack.pop(); if (!u) return; redoStack.push(snapshot()); pctx.putImageData(u, 0, 0); updateUndoBtns(); tick(); changed(); };
$('pRedo').onclick = () => { const r = redoStack.pop(); if (!r) return; undoStack.push(snapshot()); pctx.putImageData(r, 0, 0); updateUndoBtns(); tick(); changed(); };
async function clearAll() {
  if (await confirmBox({ title: 'Apagar as cores todas?', sub: 'As linhas do desenho ficam. Podes voltar atrás com ↩.', yes: 'Apagar' })) {
    pushUndo(); pctx.clearRect(0, 0, SIZE, SIZE); beep(300, 0.2, 'sawtooth', 0.04); buzz(20); changed();
  }
}
$('pMore').onclick = () => {
  const narrow = getComputedStyle($('pFit')).display === 'none';
  const items = [];
  if (narrow) items.push({ icon: 'i-zin', label: 'Aproximar', fn: () => zoomBy(1.5) }, { icon: 'i-fit', label: 'Ver a página toda', fn: fitView }, '-');
  items.push(
    { icon: 'i-download', label: 'Guardar na galeria do tablet', fn: () => exportImage(composite(SIZE), doc && doc.title) },
    { icon: 'i-share', label: 'Partilhar', fn: () => shareImage(composite(SIZE), doc && doc.title) },
    { icon: 'i-copy', label: 'Pintar outra vez (cópia em branco)', fn: async () => { await saveNow(); openCopyOfCurrent(); } },
    '-',
    { icon: 'i-trash', label: 'Apagar as cores', fn: clearAll, danger: true },
  );
  openPop($('pMore'), items);
};

/* ---------- guardar automaticamente ---------- */
function setSaveState(t) { $('saveState').textContent = t; }
function changed() { dirty = true; setSaveState('A guardar…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 800); }
const canvasBlob = (c, type = 'image/png', q) => new Promise(res => c.toBlob(res, type, q));
function composite(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.imageSmoothingQuality = 'high';
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
    const thumb = composite(280).toDataURL('image/jpeg', 0.84);
    await PCDB.put({ id: d.id, title: d.title, kind: d.kind, category: d.category, seed: d.seed, level: d.level, created: d.created,
      updated: now, done: !!d.done, fav: !!d.fav, line: d.lineBlob, paint, thumb });
    pref.set('cur', d.id);
    if (doc === d) setSaveState('Guardado ✓');
  }).catch(err => { dirty = true; setSaveState('Não foi possível guardar'); console.error(err); });
  return saving;
}
window.__saveNow = () => { saveNow(); return true; };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
window.addEventListener('pagehide', saveNow);

function resetCanvases() {
  pctx.clearRect(0, 0, SIZE, SIZE); sctx.clearRect(0, 0, SIZE, SIZE); lctx.clearRect(0, 0, SIZE, SIZE);
  undoStack = []; redoStack = []; updateUndoBtns(); dirty = false; setSaveState('');
}
function enterPaint() {
  $('pTitle').textContent = doc.title || 'Desenho';
  buildTools(); buildColors(); show('paint');
  view.base = 0; requestAnimationFrame(() => { layoutPaper(); fitView(); });
}
async function openNewPage(cat, n, L) {
  await saveNow(); resetCanvases();
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = SIZE;
  const title = renderPage(tmp.getContext('2d'), cat, n, L);
  lctx.drawImage(toLineLayer(tmp), 0, 0); computeBarrier();
  doc = { id: null, title, kind: 'gen', category: cat, seed: n, level: L, done: false, fav: false };
  pref.set('cur', null); enterPaint();
}
async function openBlank() {
  await saveNow(); resetCanvases(); computeBarrier();
  doc = { id: null, title: 'Desenho livre', kind: 'blank', category: 'livre', seed: 0, level: 0, done: false, fav: false };
  if (tool === 'fill') { tool = 'brush'; pref.set('tool', tool); }
  pref.set('cur', null); enterPaint();
}
async function openLineCanvas(whiteBg, title) {
  await saveNow(); resetCanvases();
  lctx.drawImage(toLineLayer(whiteBg), 0, 0); computeBarrier();
  doc = { id: null, title, kind: 'photo', category: 'foto', seed: 0, level: 0, done: false, fav: false };
  dirty = true; await saveNow();
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
  doc = { id: rec.id, title: rec.title, kind: rec.kind, category: rec.category, seed: rec.seed, level: rec.level, created: rec.created, done: rec.done, fav: rec.fav, lineBlob: rec.line };
  pref.set('cur', rec.id); enterPaint(); setSaveState('Guardado ✓');
}
async function openCopy(rec) {
  await saveNow(); resetCanvases();
  lctx.drawImage(await blobToImage(rec.line), 0, 0); computeBarrier();
  doc = { id: null, title: rec.title, kind: rec.kind, category: rec.category, seed: rec.seed, level: rec.level, done: false, fav: false };
  pref.set('cur', null); enterPaint(); toast('Nova cópia para pintar');
}
async function openCopyOfCurrent() { if (doc && doc.id) { const rec = await PCDB.get(doc.id); if (rec) openCopy(rec); } else toast('Pinta um bocadinho primeiro'); }
async function leavePaint() { await saveNow(); doc = null; pref.set('cur', null); goHome(); }
$('pBack').onclick = () => { tick(); leavePaint(); };

/* ---------- concluir + confetes ---------- */
$('pDone').onclick = async () => {
  if (!doc) return;
  doc.done = true; dirty = true; await saveNow();
  $('celImg').src = composite(440).toDataURL('image/jpeg', 0.9);
  $('celebrate').classList.remove('hidden'); confetti(); buzz(30);
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.06), i * 110));
};
$('celGallery').onclick = () => { $('celebrate').classList.add('hidden'); doc = null; pref.set('cur', null); openGallery(); };
$('celNew').onclick = () => { $('celebrate').classList.add('hidden'); doc = null; pref.set('cur', null); goHome(); };
function confetti() {
  const c = $('cvConfetti'); c.width = innerWidth; c.height = innerHeight; const x = c.getContext('2d');
  const ps = Array.from({ length: 150 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6, c: COLORS[(Math.random() * 14) | 0], a: Math.random() * 6 }));
  let t = 0;
  const step = () => {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.a += 0.1; x.fillStyle = p.c; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); }
    if (++t < 220 && !$('celebrate').classList.contains('hidden')) requestAnimationFrame(step); else x.clearRect(0, 0, c.width, c.height);
  };
  step();
}

/* ---------- exportar e partilhar ---------- */
async function recToCanvas(rec) {
  const c = document.createElement('canvas'); c.width = c.height = SIZE; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, SIZE, SIZE);
  if (rec.paint) x.drawImage(await blobToImage(rec.paint), 0, 0);
  x.drawImage(await blobToImage(rec.line), 0, 0);
  return c;
}
const fileName = (name, ext) => `PintaComigo-${(name || 'desenho').replace(/[^\wÀ-ú-]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.${ext}`;
function download(url, file) { const a = document.createElement('a'); a.href = url; a.download = file; document.body.append(a); a.click(); a.remove(); }
async function exportImage(canvas, name) {
  const file = fileName(name, 'png'), url = canvas.toDataURL('image/png');
  if (has('saveImage')) { const ok = bridge.saveImage(url.split(',')[1], file); toast(ok ? 'Guardado na galeria do tablet' : 'Não foi possível guardar'); }
  else { download(url, file); toast('Imagem descarregada'); }
}
async function shareImage(canvas, name) {
  const file = fileName(name, 'png'), url = canvas.toDataURL('image/png');
  if (has('shareImage')) { bridge.shareImage(url.split(',')[1], file); return; }
  try {
    const blob = await canvasBlob(canvas); const f = new File([blob], file, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Pinta Comigo' }); return; }
  } catch { /* cancelado */ return; }
  download(url, file); toast('Imagem descarregada');
}

/* ---------------- S04 galeria ---------------- */
let galFilter = 'all';
function filterSeg() {
  const c = $('galFilter'); c.innerHTML = '';
  [['all', 'Todos'], ['doing', 'A pintar'], ['done', 'Concluídos'], ['fav', 'Favoritos']].forEach(([v, n]) => {
    const b = document.createElement('button'); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(galFilter === v)); b.textContent = n;
    b.onclick = () => { galFilter = v; tick(); openGallery(); }; c.append(b);
  });
}
async function openGallery() {
  show('gallery'); filterSeg();
  const g = $('galGrid'); g.innerHTML = '';
  const all = await PCDB.all();
  const list = all.filter(r => galFilter === 'all' || (galFilter === 'done' && r.done) || (galFilter === 'doing' && !r.done) || (galFilter === 'fav' && r.fav));
  $('galCount').textContent = all.length ? String(all.length) : '';
  $('galEmpty').classList.toggle('hidden', list.length > 0);
  $('galEmpty').querySelector('h2').textContent = all.length ? 'Nada neste filtro' : 'Ainda não há desenhos aqui';
  for (const rec of list) {
    const card = document.createElement('div'); card.className = 'thumb'; card.tabIndex = 0; card.setAttribute('role', 'button');
    card.setAttribute('aria-label', rec.title || 'Desenho');
    card.innerHTML = `<img alt="">${rec.done ? '<span class="done"><svg><use href="#i-check"/></svg>Concluído</span>' : ''}
      <button class="fav" aria-label="Favorito" aria-pressed="${!!rec.fav}"><svg><use href="#i-heart"/></svg></button>
      <div class="meta"><b></b><small></small><button class="menu" aria-label="Opções"><svg><use href="#i-more"/></svg></button></div>`;
    card.querySelector('img').src = rec.thumb || '';
    card.querySelector('.meta b').textContent = rec.title || 'Desenho';
    card.querySelector('.meta small').textContent = relDate(rec.updated);
    card.onclick = () => { tick(); openDrawing(rec.id); };
    card.onkeydown = (e) => { if (e.key === 'Enter') openDrawing(rec.id); };
    const favB = card.querySelector('.fav');
    favB.onclick = async (e) => {
      e.stopPropagation(); rec.fav = !rec.fav; favB.setAttribute('aria-pressed', String(rec.fav)); tick();
      const r2 = await PCDB.get(rec.id); if (r2) { r2.fav = rec.fav; await PCDB.put(r2); }
      if (galFilter === 'fav' && !rec.fav) openGallery();
    };
    const menuB = card.querySelector('.menu');
    menuB.onclick = (e) => {
      e.stopPropagation();
      openPop(menuB, [
        { icon: 'i-play', label: 'Continuar a pintar', fn: () => openDrawing(rec.id) },
        { icon: 'i-copy', label: 'Pintar outra vez', fn: () => openCopy(rec) },
        { icon: 'i-download', label: 'Guardar na galeria do tablet', fn: async () => exportImage(await recToCanvas(rec), rec.title) },
        { icon: 'i-share', label: 'Partilhar', fn: async () => shareImage(await recToCanvas(rec), rec.title) },
        '-',
        { icon: 'i-trash', label: 'Apagar', danger: true, fn: async () => {
          if (await confirmBox({ title: 'Apagar este desenho?', sub: 'Não dá para desfazer.', yes: 'Apagar' })) {
            await PCDB.del(rec.id); if (pref.get('cur') === rec.id) pref.set('cur', null); openGallery();
          } } },
      ]);
    };
    g.append(card);
  }
}
$('galStart').onclick = () => { tick(); goHome(); };

/* ---------------- S05 foto ---------------- */
let photoImg = null, photoResult = null, photoTimer = 0;
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
  } catch { $('photoErr').textContent = 'Não foi possível abrir essa foto. Experimenta outra.'; }
}
$('inCamera').onchange = (e) => { loadPhoto(e.target.files[0]); e.target.value = ''; };
$('inGallery').onchange = (e) => { loadPhoto(e.target.files[0]); e.target.value = ''; };
function processPhoto() {
  if (!photoImg) return;
  $('photoSpin').classList.remove('hidden'); clearTimeout(photoTimer);
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
function bindSwitch(id, key, after) {
  const s = $(id); s.setAttribute('role', 'switch'); s.setAttribute('aria-checked', String(S[key]));
  s.onclick = () => { setS(key, !S[key]); s.setAttribute('aria-checked', String(S[key])); tick(); after && after(); };
}
function fmtBytes(b) { return b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB'; }
function openParents() {
  show('parents'); beep(800);
  levelSeg($('setLevels'));
  bindSwitch('setLeft', 'left'); bindSwitch('setSound', 'sound'); bindSwitch('setHaptic', 'haptic'); bindSwitch('setAwake', 'awake');
  PCDB.count().then(n => { $('setCount').textContent = String(n); });
  $('setStorage').textContent = 'Ficam só neste aparelho';
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { $('setStorage').textContent = `A ocupar ${fmtBytes(e.usage || 0)} neste aparelho`; }).catch(() => {});
  $('setVersion').textContent = VERSION;
  $('rowUpdate').classList.toggle('hidden', !has('checkUpdate'));
}
$('setUpdate').onclick = () => { if (has('checkUpdate')) { bridge.checkUpdate(true); toast('A procurar atualizações…'); } };

const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = async (u) => (await fetch(u)).blob();
$('setBackup').onclick = async () => {
  toast('A preparar a cópia…');
  const all = await PCDB.all(), out = [];
  for (const r of all) out.push({ ...r, line: await blobToDataURL(r.line), paint: r.paint ? await blobToDataURL(r.paint) : null });
  const json = JSON.stringify({ app: 'pintacomigo', version: 1, exported: Date.now(), drawings: out });
  const file = fileName('copia-seguranca', 'json');
  if (has('saveText')) toast(bridge.saveText(json, file) ? `Cópia guardada em Transferências (${all.length} desenhos)` : 'Não foi possível guardar a cópia');
  else { download(URL.createObjectURL(new Blob([json], { type: 'application/json' })), file); toast(`Cópia descarregada (${all.length} desenhos)`); }
};
$('inRestore').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'pintacomigo' || !Array.isArray(data.drawings)) throw new Error('formato');
    let n = 0;
    for (const r of data.drawings) {
      const old = await PCDB.get(r.id);
      if (old && old.updated >= r.updated) continue;
      await PCDB.put({ ...r, line: await dataURLToBlob(r.line), paint: r.paint ? await dataURLToBlob(r.paint) : null }); n++;
    }
    toast(`${n} desenho(s) restaurado(s)`); openParents();
  } catch { toast('Esse ficheiro não é uma cópia da Pinta Comigo'); }
};

/* ---------------- arranque: volta exatamente onde estava ---------------- */
renderHome(); show('home');
const cur = pref.get('cur', null);
if (cur) openDrawing(cur).catch(() => goHome());
})();
