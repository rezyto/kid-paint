/* Pinta Comigo — gerador infinito de páginas para colorir.
   Tudo é desenhado aqui, por código: não há imagens externas.
   Cada página é definida por (categoria, número, nível) -> semente -> desenho. */
'use strict';

const SIZE = 1200;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seed) {
  const f = mulberry32(seed);
  const r = {
    f,
    range: (a, b) => a + (b - a) * f(),
    int: (a, b) => Math.floor(a + (b - a + 1) * f()),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
  };
  return r;
}

const TAU = Math.PI * 2;

/* ---------- kit de desenho: formas fechadas brancas com contorno preto ---------- */
function kit(ctx, lw) {
  const k = {
    ctx, lw,
    done(fill = true) {
      if (fill) { ctx.fillStyle = '#fff'; ctx.fill(); }
      ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    },
    circle(x, y, r, fill = true) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); k.done(fill); },
    ellipse(x, y, rx, ry, rot = 0, fill = true) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); k.done(fill); },
    rrect(x, y, w, h, r, fill = true) { ctx.beginPath(); roundRectPath(ctx, x, y, w, h, r); k.done(fill); },
    poly(pts, fill = true) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); k.done(fill);
    },
    line(pts, w) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineWidth = w || k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    },
    curve(x0, y0, cx, cy, x1, y1, w) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.lineWidth = w || k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    },
    arc(x, y, r, a0, a1, w) {
      ctx.beginPath(); ctx.arc(x, y, r, a0, a1);
      ctx.lineWidth = w || k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    },
    dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#000'; ctx.fill(); },
    star(x, y, r1, r2, n = 5, rot = -Math.PI / 2, fill = true) {
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      k.poly(pts, fill);
    },
    heart(x, y, s, fill = true) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.bezierCurveTo(x - s * 0.1, y + s * 0.25, x - s * 0.55, y + s * 0.05, x - s * 0.5, y - s * 0.2);
      ctx.bezierCurveTo(x - s * 0.45, y - s * 0.5, x - s * 0.05, y - s * 0.5, x, y - s * 0.22);
      ctx.bezierCurveTo(x + s * 0.05, y - s * 0.5, x + s * 0.45, y - s * 0.5, x + s * 0.5, y - s * 0.2);
      ctx.bezierCurveTo(x + s * 0.55, y + s * 0.05, x + s * 0.1, y + s * 0.25, x, y + s * 0.35);
      ctx.closePath(); k.done(fill);
    },
    cloud(x, y, w, fill = true) {
      const h = w * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + h / 4);
      ctx.arc(x - w * 0.28, y, h * 0.42, Math.PI * 0.75, Math.PI * 1.65);
      ctx.arc(x + w * 0.02, y - h * 0.2, h * 0.55, Math.PI * 1.15, Math.PI * 1.9);
      ctx.arc(x + w * 0.3, y + h * 0.02, h * 0.4, Math.PI * 1.35, Math.PI * 0.35);
      ctx.lineTo(x - w / 2 + 5, y + h * 0.36);
      ctx.quadraticCurveTo(x - w * 0.56, y + h * 0.3, x - w / 2, y + h / 4);
      ctx.closePath(); k.done(fill);
    },
    flowerSmall(x, y, r, petals = 5, fill = true) {
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU;
        k.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, r * 0.35, a, fill);
      }
      k.circle(x, y, r * 0.4, fill);
    },
    eye(x, y, r) {
      k.circle(x, y, r);
      k.dot(x + r * 0.15, y + r * 0.1, r * 0.55);
      ctx.beginPath(); ctx.arc(x + r * 0.32, y - r * 0.12, r * 0.17, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    },
    smile(x, y, w) { k.arc(x, y - w * 0.3, w * 0.6, Math.PI * 0.2, Math.PI * 0.8, k.lw * 0.8); },
    text(str, x, y, size, fill = true) {
      ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Nunito", "Arial Black", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      if (fill) { ctx.fillStyle = '#fff'; ctx.fillText(str, x, y); }
      ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.strokeText(str, x, y);
    },
    label(str, x, y, size) {
      ctx.font = `800 ${size}px "Nunito", "Arial Rounded MT Bold", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
      ctx.fillText(str, x, y);
    },
  };
  return k;
}
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- fundos ---------- */
const BG = {
  land(k, r, L, opts = {}) {
    const gy = opts.ground || r.range(930, 1010);
    // sol
    if (!opts.noSun && r.chance(0.8)) {
      const sx = r.pick([150, SIZE - 150]), sy = 150, sr = r.range(55, 75);
      const rays = L >= 2 ? 12 : 8;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU;
        k.poly([
          [sx + Math.cos(a - 0.12) * (sr + 12), sy + Math.sin(a - 0.12) * (sr + 12)],
          [sx + Math.cos(a) * (sr + 50), sy + Math.sin(a) * (sr + 50)],
          [sx + Math.cos(a + 0.12) * (sr + 12), sy + Math.sin(a + 0.12) * (sr + 12)],
        ]);
      }
      k.circle(sx, sy, sr);
      if (L >= 2) { k.dot(sx - sr * 0.3, sy - sr * 0.1, 6); k.dot(sx + sr * 0.3, sy - sr * 0.1, 6); k.smile(sx, sy + sr * 0.15, sr * 0.45); }
    }
    const clouds = L === 1 ? r.int(0, 1) : r.int(1, 3);
    for (let i = 0; i < clouds; i++) k.cloud(r.range(330, 870), r.range(110, 260), r.range(170, 240));
    // colinas
    if (L >= 2 && r.chance(0.7)) {
      const ctx = k.ctx; ctx.beginPath();
      ctx.moveTo(30, gy - 40);
      ctx.quadraticCurveTo(300, gy - r.range(180, 260), 560, gy - 30);
      ctx.quadraticCurveTo(850, gy - r.range(160, 240), SIZE - 30, gy - 50);
      ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    }
    // chão
    const ctx = k.ctx; ctx.beginPath(); ctx.moveTo(30, gy);
    for (let x = 30; x < SIZE - 30; x += 142.5) ctx.quadraticCurveTo(x + 71, gy + r.range(-22, 22), x + 142.5, gy);
    ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    if (L >= 2) {
      const n = L === 2 ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const x = r.range(110, SIZE - 110), y = r.range(gy + 50, SIZE - 110);
        if (r.chance(0.5)) k.flowerSmall(x, y, r.range(26, 36), r.int(5, 7));
        else { for (let j = -1; j <= 1; j++) k.curve(x + j * 12, y + 20, x + j * 20, y - 10, x + j * 26, y - 30, k.lw * 0.7); }
      }
    }
    return gy;
  },
  sea(k, r, L) {
    const ctx = k.ctx;
    const wy = 170;
    ctx.beginPath(); ctx.moveTo(30, wy);
    for (let x = 30; x < SIZE - 30; x += 95) ctx.quadraticCurveTo(x + 47.5, wy - 35, x + 95, wy);
    ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    const sy = 1040;
    ctx.beginPath(); ctx.moveTo(30, sy);
    ctx.bezierCurveTo(350, sy - 60, 700, sy + 40, SIZE - 30, sy - 30);
    ctx.lineWidth = k.lw; ctx.stroke();
    // algas
    const weeds = L === 1 ? 2 : 4;
    for (let i = 0; i < weeds; i++) {
      const x = r.pick([r.range(100, 260), r.range(940, 1100)]), h = r.range(180, 300);
      ctx.beginPath(); ctx.moveTo(x - 18, sy);
      ctx.bezierCurveTo(x - 60, sy - h * 0.4, x + 40, sy - h * 0.6, x, sy - h);
      ctx.bezierCurveTo(x + 70, sy - h * 0.6, x - 20, sy - h * 0.4, x + 18, sy);
      ctx.closePath(); k.done();
    }
    const bubbles = L === 1 ? 3 : 8;
    for (let i = 0; i < bubbles; i++) k.circle(r.range(120, SIZE - 120), r.range(230, 420), r.range(12, 30));
    if (L >= 2) k.star(r.range(500, 900), sy + 70, 55, 25, 5, r.range(0, 1));
    if (L >= 3) { k.ellipse(r.range(250, 400), sy + 80, 60, 30); k.ellipse(r.range(800, 1000), sy + 85, 45, 22); }
  },
  space(k, r, L) {
    const n = L === 1 ? 4 : 10;
    for (let i = 0; i < n; i++) k.star(r.chance(0.5) ? r.range(100, 330) : r.range(870, 1100), r.range(400, 1100), r.range(25, 45), r.range(11, 18), 5, r.range(0, 1));
    const px = r.pick([220, 980]), py = r.range(200, 320);
    k.ellipse(px, py, 150, 34, -0.3, false);
    k.circle(px, py, 85);
    k.arc(px, py, 85, 0.25, 0.9, k.lw * 0.7);
    if (L >= 2) { k.circle(r.range(850, 1050), r.range(950, 1080), 60); k.circle(r.range(150, 330), r.range(900, 1050), 40); }
  },
  night(k, r, L) {
    S.moon(k, r.pick([190, 1010]), 190, 230);
    const n = L === 1 ? 3 : 7;
    for (let i = 0; i < n; i++) k.star(r.range(320, 880), r.range(90, 260), r.range(22, 34), 11, 5, r.range(0, 1));
  },
};

/* ---------- personagens e objetos: f(k, x, y, s, r, L) com s ≈ largura ---------- */
const S = {};

S.cat = (k, x, y, s, r, L) => {
  const tailSide = r.pick([-1, 1]);
  k.ellipse(x + tailSide * s * 0.38, y + s * 0.18, s * 0.08, s * 0.28, tailSide * 0.6);
  k.ellipse(x, y + s * 0.28, s * 0.3, s * 0.26);
  if (L >= 2) for (let i = -1; i <= 1; i++) k.arc(x + i * s * 0.12, y + s * 0.05, s * 0.2, Math.PI * 0.35, Math.PI * 0.65, k.lw * 0.8);
  k.ellipse(x - s * 0.13, y + s * 0.5, s * 0.1, s * 0.06); k.ellipse(x + s * 0.13, y + s * 0.5, s * 0.1, s * 0.06);
  const hy = y - s * 0.12, hr = s * 0.24;
  k.poly([[x - hr * 0.95, hy - hr * 0.2], [x - hr * 0.8, hy - hr * 1.25], [x - hr * 0.2, hy - hr * 0.85]]);
  k.poly([[x + hr * 0.95, hy - hr * 0.2], [x + hr * 0.8, hy - hr * 1.25], [x + hr * 0.2, hy - hr * 0.85]]);
  k.ellipse(x, hy, hr, hr * 0.88);
  k.poly([[x - hr * 0.72, hy - hr * 0.55], [x - hr * 0.68, hy - hr * 0.98], [x - hr * 0.38, hy - hr * 0.78]]);
  k.poly([[x + hr * 0.72, hy - hr * 0.55], [x + hr * 0.68, hy - hr * 0.98], [x + hr * 0.38, hy - hr * 0.78]]);
  k.eye(x - hr * 0.38, hy - hr * 0.08, hr * 0.2); k.eye(x + hr * 0.38, hy - hr * 0.08, hr * 0.2);
  k.poly([[x - hr * 0.1, hy + hr * 0.22], [x + hr * 0.1, hy + hr * 0.22], [x, hy + hr * 0.34]]);
  k.arc(x - hr * 0.1, hy + hr * 0.36, hr * 0.12, 0.1, Math.PI - 0.3, k.lw * 0.7);
  k.arc(x + hr * 0.1, hy + hr * 0.36, hr * 0.12, 0.3, Math.PI - 0.1, k.lw * 0.7);
  for (const sd of [-1, 1]) for (let j = -1; j <= 1; j++) k.line([[x + sd * hr * 0.35, hy + hr * 0.3 + j * 8], [x + sd * hr * 1.1, hy + hr * 0.2 + j * 22]], k.lw * 0.5);
  if (L >= 3) { k.rrect(x - hr * 0.6, hy + hr * 0.8, hr * 1.2, hr * 0.22, 10); k.circle(x, hy + hr * 1.12, hr * 0.14); }
};

S.dog = (k, x, y, s, r, L) => {
  k.ellipse(x + s * 0.34, y + s * 0.1, s * 0.05, s * 0.16, 0.7);
  k.ellipse(x, y + s * 0.28, s * 0.32, s * 0.24);
  if (L >= 2) { k.ellipse(x + s * 0.12, y + s * 0.2, s * 0.09, s * 0.07, 0.3); k.ellipse(x - s * 0.15, y + s * 0.35, s * 0.07, s * 0.05); }
  for (const dx of [-0.2, -0.07, 0.07, 0.2]) k.rrect(x + dx * s - s * 0.05, y + s * 0.38, s * 0.1, s * 0.16, 14);
  const hy = y - s * 0.12, hr = s * 0.22;
  k.ellipse(x - hr * 0.95, hy + hr * 0.15, hr * 0.32, hr * 0.7, 0.35);
  k.ellipse(x + hr * 0.95, hy + hr * 0.15, hr * 0.32, hr * 0.7, -0.35);
  k.circle(x, hy, hr);
  if (L >= 2) k.ellipse(x + hr * 0.45, hy - hr * 0.35, hr * 0.3, hr * 0.26);
  k.ellipse(x, hy + hr * 0.42, hr * 0.48, hr * 0.36);
  k.ellipse(x, hy + hr * 0.22, hr * 0.18, hr * 0.12);
  k.dot(x, hy + hr * 0.22, hr * 0.1);
  k.arc(x, hy + hr * 0.42, hr * 0.2, 0.3, Math.PI - 0.3, k.lw * 0.8);
  k.eye(x - hr * 0.38, hy - hr * 0.2, hr * 0.17); k.eye(x + hr * 0.38, hy - hr * 0.2, hr * 0.17);
  if (L >= 3) { k.rrect(x - hr * 0.7, hy + hr * 0.85, hr * 1.4, hr * 0.2, 10); k.circle(x, hy + hr * 1.15, hr * 0.16); }
};

S.fish = (k, x, y, s, r, L) => {
  const d = r.pick([-1, 1]);
  k.poly([[x - d * s * 0.3, y], [x - d * s * 0.52, y - s * 0.2], [x - d * s * 0.52, y + s * 0.2]]);
  k.poly([[x - d * s * 0.05, y - s * 0.18], [x + d * s * 0.05, y - s * 0.33], [x + d * s * 0.15, y - s * 0.16]]);
  k.ellipse(x, y, s * 0.36, s * 0.22);
  if (L >= 2) {
    for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) k.arc(x - d * s * (0.1 * i - 0.02), y + j * s * 0.09, s * 0.06, d > 0 ? -1.2 : Math.PI - 1.9, d > 0 ? 1.2 : Math.PI + 1.9, k.lw * 0.6);
  }
  k.arc(x + d * s * 0.16, y, s * 0.14, d > 0 ? Math.PI * 0.65 : -0.5, d > 0 ? Math.PI * 1.35 : 0.5);
  k.eye(x + d * s * 0.24, y - s * 0.06, s * 0.05);
  k.arc(x + d * s * 0.3, y + s * 0.07, s * 0.04, d > 0 ? Math.PI * 0.4 : 0.1, d > 0 ? Math.PI * 0.9 : Math.PI * 0.6, k.lw * 0.7);
  k.ellipse(x - d * s * 0.02, y + s * 0.12, s * 0.08, s * 0.04, d * 0.4);
};

S.bird = (k, x, y, s, r, L) => {
  k.line([[x - s * 0.06, y + s * 0.2], [x - s * 0.08, y + s * 0.34]]);
  k.line([[x + s * 0.06, y + s * 0.2], [x + s * 0.08, y + s * 0.34]]);
  k.poly([[x - s * 0.22, y + s * 0.05], [x - s * 0.45, y - s * 0.05], [x - s * 0.42, y + s * 0.12]]);
  k.ellipse(x, y + s * 0.03, s * 0.26, s * 0.2);
  k.circle(x + s * 0.18, y - s * 0.16, s * 0.14);
  k.poly([[x + s * 0.3, y - s * 0.2], [x + s * 0.42, y - s * 0.14], [x + s * 0.3, y - s * 0.1]]);
  k.eye(x + s * 0.22, y - s * 0.2, s * 0.04);
  k.ellipse(x - s * 0.05, y + s * 0.04, s * 0.15, s * 0.09, -0.3);
  if (L >= 2) for (let i = 0; i < 3; i++) k.arc(x - s * 0.1 + i * s * 0.06, y + s * 0.04, s * 0.05, 0.2, Math.PI - 0.2, k.lw * 0.6);
  if (L >= 3) { k.poly([[x + s * 0.12, y - s * 0.28], [x + s * 0.16, y - s * 0.38], [x + s * 0.2, y - s * 0.29]]); }
};

S.owl = (k, x, y, s, r, L) => {
  k.rrect(x - s * 0.5, y + s * 0.42, s, s * 0.08, 20);
  k.poly([[x - s * 0.24, y - s * 0.2], [x - s * 0.3, y - s * 0.44], [x - s * 0.08, y - s * 0.28]]);
  k.poly([[x + s * 0.24, y - s * 0.2], [x + s * 0.3, y - s * 0.44], [x + s * 0.08, y - s * 0.28]]);
  k.ellipse(x - s * 0.27, y + s * 0.12, s * 0.09, s * 0.22, 0.25);
  k.ellipse(x + s * 0.27, y + s * 0.12, s * 0.09, s * 0.22, -0.25);
  k.ellipse(x, y + s * 0.07, s * 0.28, s * 0.38);
  k.ellipse(x, y + s * 0.2, s * 0.17, s * 0.2);
  if (L >= 2) for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) k.arc(x + i * s * 0.08, y + s * (0.1 + j * 0.08), s * 0.04, 0.3, Math.PI - 0.3, k.lw * 0.6);
  k.circle(x - s * 0.12, y - s * 0.12, s * 0.11); k.circle(x + s * 0.12, y - s * 0.12, s * 0.11);
  k.eye(x - s * 0.12, y - s * 0.12, s * 0.055); k.eye(x + s * 0.12, y - s * 0.12, s * 0.055);
  k.poly([[x - s * 0.04, y - s * 0.03], [x + s * 0.04, y - s * 0.03], [x, y + s * 0.05]]);
  for (const dx of [-0.08, 0.08]) k.line([[x + dx * s - 10, y + s * 0.45], [x + dx * s, y + s * 0.41], [x + dx * s + 10, y + s * 0.45]]);
};

S.turtle = (k, x, y, s, r, L) => {
  for (const [dx, dy] of [[-0.25, 0.12], [0.25, 0.12], [-0.12, 0.17], [0.15, 0.17]]) k.ellipse(x + dx * s, y + dy * s, s * 0.08, s * 0.06);
  k.poly([[x - s * 0.36, y + s * 0.06], [x - s * 0.46, y + s * 0.09], [x - s * 0.36, y + s * 0.11]]);
  k.circle(x + s * 0.42, y - s * 0.02, s * 0.1);
  k.eye(x + s * 0.45, y - s * 0.05, s * 0.025);
  k.arc(x + s * 0.45, y + s * 0.0, s * 0.04, 0.3, Math.PI - 0.5, k.lw * 0.6);
  const ctx = k.ctx; ctx.beginPath(); ctx.moveTo(x - s * 0.38, y + s * 0.1);
  ctx.bezierCurveTo(x - s * 0.38, y - s * 0.38, x + s * 0.38, y - s * 0.38, x + s * 0.38, y + s * 0.1); ctx.closePath(); k.done();
  k.rrect(x - s * 0.4, y + s * 0.06, s * 0.8, s * 0.08, 18);
  if (L >= 2) {
    const hex = (cx, cy, rr) => { const p = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } k.poly(p); };
    hex(x, y - s * 0.1, s * 0.09);
    if (L >= 3) { hex(x - s * 0.19, y - s * 0.03, s * 0.07); hex(x + s * 0.19, y - s * 0.03, s * 0.07); }
  }
};

S.snail = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  ctx.beginPath(); ctx.moveTo(x - s * 0.42, y + s * 0.25);
  ctx.lineTo(x + s * 0.3, y + s * 0.25);
  ctx.quadraticCurveTo(x + s * 0.45, y + s * 0.25, x + s * 0.42, y + s * 0.05);
  ctx.quadraticCurveTo(x + s * 0.38, y - s * 0.12, x + s * 0.28, y - s * 0.05);
  ctx.lineTo(x + s * 0.25, y + s * 0.15); ctx.lineTo(x - s * 0.4, y + s * 0.15);
  ctx.quadraticCurveTo(x - s * 0.47, y + s * 0.2, x - s * 0.42, y + s * 0.25); ctx.closePath(); k.done();
  k.line([[x + s * 0.32, y - s * 0.04], [x + s * 0.28, y - s * 0.22]]); k.circle(x + s * 0.28, y - s * 0.24, s * 0.025);
  k.line([[x + s * 0.38, y - s * 0.04], [x + s * 0.42, y - s * 0.2]]); k.circle(x + s * 0.42, y - s * 0.22, s * 0.025);
  k.eye(x + s * 0.36, y + s * 0.04, s * 0.03);
  k.circle(x - s * 0.06, y - s * 0.04, s * 0.24);
  ctx.beginPath();
  const turns = L === 1 ? 2.2 : 3.2;
  for (let t = 0; t <= turns * TAU; t += 0.1) {
    const rr = s * 0.22 * (1 - t / (turns * TAU + 1));
    const px = x - s * 0.06 + Math.cos(t + Math.PI) * rr, py = y - s * 0.04 + Math.sin(t + Math.PI) * rr;
    t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
};

S.butterfly = (k, x, y, s, r, L) => {
  for (const d of [-1, 1]) {
    k.ellipse(x + d * s * 0.2, y - s * 0.12, s * 0.2, s * 0.15, d * -0.5);
    k.ellipse(x + d * s * 0.16, y + s * 0.14, s * 0.13, s * 0.11, d * 0.5);
    if (L >= 2) { k.circle(x + d * s * 0.24, y - s * 0.13, s * 0.06); k.circle(x + d * s * 0.17, y + s * 0.15, s * 0.04); }
    if (L >= 3) { k.circle(x + d * s * 0.32, y - s * 0.2, s * 0.025); k.circle(x + d * s * 0.12, y - s * 0.2, s * 0.03); }
  }
  k.ellipse(x, y + s * 0.02, s * 0.04, s * 0.22);
  k.circle(x, y - s * 0.22, s * 0.05);
  k.curve(x - 6, y - s * 0.26, x - s * 0.05, y - s * 0.38, x - s * 0.12, y - s * 0.4, k.lw * 0.7);
  k.curve(x + 6, y - s * 0.26, x + s * 0.05, y - s * 0.38, x + s * 0.12, y - s * 0.4, k.lw * 0.7);
  k.dot(x - s * 0.12, y - s * 0.4, 8); k.dot(x + s * 0.12, y - s * 0.4, 8);
};

S.ladybug = (k, x, y, s, r, L) => {
  for (const d of [-1, 1]) for (const j of [-0.1, 0.05, 0.2]) k.line([[x + d * s * 0.25, y + j * s], [x + d * s * 0.4, y + j * s + s * 0.04]]);
  k.circle(x, y - s * 0.28, s * 0.13);
  k.eye(x - s * 0.05, y - s * 0.32, s * 0.03); k.eye(x + s * 0.05, y - s * 0.32, s * 0.03);
  k.curve(x - s * 0.05, y - s * 0.38, x - s * 0.1, y - s * 0.48, x - s * 0.15, y - s * 0.48, k.lw * 0.7);
  k.curve(x + s * 0.05, y - s * 0.38, x + s * 0.1, y - s * 0.48, x + s * 0.15, y - s * 0.48, k.lw * 0.7);
  k.ellipse(x, y + s * 0.03, s * 0.3, s * 0.3);
  k.line([[x, y - s * 0.27], [x, y + s * 0.33]]);
  const spots = L === 1 ? 2 : L === 2 ? 3 : 4;
  for (const d of [-1, 1]) for (let i = 0; i < spots; i++) {
    const a = -0.9 + i * (1.8 / Math.max(1, spots - 1));
    k.circle(x + d * s * (0.13 + 0.04 * Math.cos(a)), y + s * 0.03 + Math.sin(a) * s * 0.18, s * (L === 1 ? 0.06 : 0.045));
  }
};

S.rabbit = (k, x, y, s, r, L) => {
  k.ellipse(x - s * 0.1, y - s * 0.38, s * 0.07, s * 0.2, -0.15); k.ellipse(x + s * 0.1, y - s * 0.38, s * 0.07, s * 0.2, 0.15);
  k.ellipse(x - s * 0.1, y - s * 0.38, s * 0.035, s * 0.14, -0.15); k.ellipse(x + s * 0.1, y - s * 0.38, s * 0.035, s * 0.14, 0.15);
  k.circle(x + s * 0.27, y + s * 0.3, s * 0.06);
  k.ellipse(x, y + s * 0.25, s * 0.26, s * 0.22);
  k.ellipse(x - s * 0.13, y + s * 0.44, s * 0.11, s * 0.05); k.ellipse(x + s * 0.13, y + s * 0.44, s * 0.11, s * 0.05);
  k.circle(x, y - s * 0.08, s * 0.19);
  k.eye(x - s * 0.08, y - s * 0.12, s * 0.035); k.eye(x + s * 0.08, y - s * 0.12, s * 0.035);
  k.ellipse(x, y - s * 0.03, s * 0.025, s * 0.018);
  k.rrect(x - s * 0.025, y + s * 0.01, s * 0.05, s * 0.05, 4);
  if (L >= 2) { k.circle(x - s * 0.13, y - s * 0.02, s * 0.03); k.circle(x + s * 0.13, y - s * 0.02, s * 0.03); k.ellipse(x, y + s * 0.27, s * 0.14, s * 0.13); }
  if (L >= 3) { k.poly([[x + s * 0.3, y + s * 0.15], [x + s * 0.42, y + s * 0.05], [x + s * 0.36, y + s * 0.2]]); }
};

S.bear = (k, x, y, s, r, L) => {
  k.circle(x - s * 0.16, y - s * 0.26, s * 0.08); k.circle(x + s * 0.16, y - s * 0.26, s * 0.08);
  if (L >= 2) { k.circle(x - s * 0.16, y - s * 0.26, s * 0.04); k.circle(x + s * 0.16, y - s * 0.26, s * 0.04); }
  k.ellipse(x - s * 0.27, y + s * 0.2, s * 0.07, s * 0.14, 0.4); k.ellipse(x + s * 0.27, y + s * 0.2, s * 0.07, s * 0.14, -0.4);
  k.ellipse(x, y + s * 0.25, s * 0.24, s * 0.26);
  k.ellipse(x, y + s * 0.28, s * 0.14, s * 0.16);
  k.ellipse(x - s * 0.13, y + s * 0.48, s * 0.09, s * 0.06); k.ellipse(x + s * 0.13, y + s * 0.48, s * 0.09, s * 0.06);
  k.circle(x, y - s * 0.12, s * 0.2);
  k.ellipse(x, y - s * 0.04, s * 0.09, s * 0.07);
  k.ellipse(x, y - s * 0.07, s * 0.03, s * 0.02); k.dot(x, y - s * 0.07, s * 0.022);
  k.arc(x, y - s * 0.04, s * 0.04, 0.3, Math.PI - 0.3, k.lw * 0.7);
  k.eye(x - s * 0.08, y - s * 0.16, s * 0.03); k.eye(x + s * 0.08, y - s * 0.16, s * 0.03);
  if (L >= 3) { k.poly([[x - s * 0.1, y + s * 0.07], [x, y + s * 0.11], [x - s * 0.1, y + s * 0.15]]); k.poly([[x + s * 0.1, y + s * 0.07], [x, y + s * 0.11], [x + s * 0.1, y + s * 0.15]]); k.circle(x, y + s * 0.11, s * 0.025); }
};

S.pig = (k, x, y, s, r, L) => {
  for (const dx of [-0.18, -0.06, 0.08, 0.2]) k.rrect(x + dx * s - s * 0.04, y + s * 0.3, s * 0.08, s * 0.15, 10);
  k.ellipse(x, y + s * 0.2, s * 0.33, s * 0.2);
  const ctx = k.ctx; ctx.beginPath(); ctx.moveTo(x - s * 0.33, y + s * 0.15);
  ctx.bezierCurveTo(x - s * 0.42, y + s * 0.05, x - s * 0.48, y + s * 0.2, x - s * 0.4, y + s * 0.22);
  ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
  const hx = x + s * 0.2, hy = y - s * 0.05;
  k.poly([[hx - s * 0.12, hy - s * 0.1], [hx - s * 0.1, hy - s * 0.26], [hx - s * 0.01, hy - s * 0.14]]);
  k.poly([[hx + s * 0.12, hy - s * 0.1], [hx + s * 0.1, hy - s * 0.26], [hx + s * 0.01, hy - s * 0.14]]);
  k.circle(hx, hy, s * 0.16);
  k.ellipse(hx, hy + s * 0.05, s * 0.07, s * 0.05);
  k.ellipse(hx - s * 0.025, hy + s * 0.05, s * 0.012, s * 0.02); k.ellipse(hx + s * 0.025, hy + s * 0.05, s * 0.012, s * 0.02);
  k.eye(hx - s * 0.06, hy - s * 0.05, s * 0.025); k.eye(hx + s * 0.06, hy - s * 0.05, s * 0.025);
  if (L >= 2) { k.ellipse(x - s * 0.1, y + s * 0.15, s * 0.08, s * 0.06); }
};

S.frog = (k, x, y, s, r, L) => {
  k.ellipse(x - s * 0.28, y + s * 0.28, s * 0.14, s * 0.07); k.ellipse(x + s * 0.28, y + s * 0.28, s * 0.14, s * 0.07);
  k.ellipse(x, y + s * 0.12, s * 0.32, s * 0.24);
  k.ellipse(x, y + s * 0.2, s * 0.18, s * 0.14);
  k.circle(x - s * 0.15, y - s * 0.12, s * 0.1); k.circle(x + s * 0.15, y - s * 0.12, s * 0.1);
  k.eye(x - s * 0.15, y - s * 0.12, s * 0.055); k.eye(x + s * 0.15, y - s * 0.12, s * 0.055);
  k.arc(x, y - s * 0.02, s * 0.18, 0.4, Math.PI - 0.4);
  if (L >= 2) { k.circle(x - s * 0.22, y + s * 0.06, s * 0.03); k.circle(x + s * 0.2, y + s * 0.02, s * 0.025); }
  if (L >= 3) { k.ellipse(x, y + s * 0.42, s * 0.42, s * 0.08); }
};

S.whale = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  k.curve(x + s * 0.05, y - s * 0.2, x - s * 0.02, y - s * 0.36, x - s * 0.1, y - s * 0.38);
  k.curve(x + s * 0.05, y - s * 0.2, x + s * 0.12, y - s * 0.36, x + s * 0.2, y - s * 0.38);
  k.poly([[x - s * 0.36, y + s * 0.02], [x - s * 0.52, y - s * 0.14], [x - s * 0.44, y + s * 0.03], [x - s * 0.52, y + s * 0.16]]);
  ctx.beginPath(); ctx.moveTo(x - s * 0.38, y + s * 0.03);
  ctx.bezierCurveTo(x - s * 0.25, y - s * 0.3, x + s * 0.4, y - s * 0.32, x + s * 0.4, y + s * 0.05);
  ctx.bezierCurveTo(x + s * 0.4, y + s * 0.22, x - s * 0.2, y + s * 0.22, x - s * 0.38, y + s * 0.03);
  ctx.closePath(); k.done();
  ctx.beginPath(); ctx.moveTo(x - s * 0.15, y + s * 0.15); ctx.quadraticCurveTo(x + s * 0.15, y + s * 0.05, x + s * 0.39, y + s * 0.08);
  ctx.lineWidth = k.lw; ctx.stroke();
  if (L >= 2) for (let i = 0; i < 4; i++) k.line([[x + s * (0.02 + i * 0.07), y + s * 0.1], [x + s * (0.0 + i * 0.07), y + s * 0.16]], k.lw * 0.6);
  k.eye(x + s * 0.24, y - s * 0.02, s * 0.035);
  k.arc(x + s * 0.3, y + s * 0.02, s * 0.06, 0.2, 1.4, k.lw * 0.7);
  k.ellipse(x + s * 0.05, y + s * 0.08, s * 0.08, s * 0.035, 0.4);
};

S.house = (k, x, y, s, r, L) => {
  const w = s * 0.62, h = s * 0.42, top = y - h * 0.1;
  if (r.chance(0.7)) k.rrect(x + w * 0.22, top - s * 0.32, s * 0.08, s * 0.2, 4);
  if (L >= 2 && r.chance(0.6)) { k.cloud(x + w * 0.3, top - s * 0.43, s * 0.12); }
  k.rrect(x - w / 2, top, w, h, 6);
  const roof = r.pick(['tri', 'tri', 'trap']);
  if (roof === 'tri') k.poly([[x - w * 0.62, top + 4], [x, top - s * 0.3], [x + w * 0.62, top + 4]]);
  else k.poly([[x - w * 0.62, top + 4], [x - w * 0.35, top - s * 0.24], [x + w * 0.35, top - s * 0.24], [x + w * 0.62, top + 4]]);
  if (L >= 3) for (let i = 1; i < 3; i++) k.line([[x - w * 0.62 * (1 - i / 3.4), top - i * s * 0.08], [x + w * 0.62 * (1 - i / 3.4), top - i * s * 0.08]], k.lw * 0.6);
  k.circle(x, top - s * 0.12, s * 0.045);
  const dw = w * 0.22, dh = h * 0.55;
  k.rrect(x - dw / 2, top + h - dh, dw, dh, 20); k.dot(x + dw * 0.28, top + h - dh / 2, 6);
  for (const d of [-1, 1]) {
    const wx = x + d * w * 0.3, wy = top + h * 0.38, ws = w * 0.18;
    k.rrect(wx - ws / 2, wy - ws / 2, ws, ws, 6);
    k.line([[wx, wy - ws / 2], [wx, wy + ws / 2]], k.lw * 0.7); k.line([[wx - ws / 2, wy], [wx + ws / 2, wy]], k.lw * 0.7);
    if (L >= 2) k.rrect(wx - ws * 0.6, wy + ws / 2, ws * 1.2, ws * 0.25, 4);
  }
  if (L >= 2) { k.rrect(x - dw * 0.9, top + h, dw * 1.8, s * 0.04, 4); }
};

S.car = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  ctx.beginPath(); ctx.moveTo(x - s * 0.18, y - s * 0.05);
  ctx.lineTo(x - s * 0.1, y - s * 0.22); ctx.lineTo(x + s * 0.14, y - s * 0.22); ctx.lineTo(x + s * 0.24, y - s * 0.05); ctx.closePath(); k.done();
  k.line([[x + s * 0.02, y - s * 0.22], [x + s * 0.02, y - s * 0.05]]);
  k.rrect(x - s * 0.42, y - s * 0.07, s * 0.84, s * 0.2, 30);
  if (L >= 2) { k.rrect(x + s * 0.32, y - s * 0.02, s * 0.08, s * 0.05, 8); k.rrect(x - s * 0.4, y - s * 0.02, s * 0.06, s * 0.05, 8); k.line([[x - s * 0.06, y + s * 0.0], [x + s * 0.02, y]], k.lw * 0.8); }
  for (const d of [-1, 1]) { k.circle(x + d * s * 0.24, y + s * 0.13, s * 0.09); k.circle(x + d * s * 0.24, y + s * 0.13, s * 0.04); }
  if (L >= 3) { k.ellipse(x - s * 0.5, y + s * 0.08, s * 0.04, s * 0.025); k.ellipse(x - s * 0.56, y + s * 0.04, s * 0.03, s * 0.02); }
};

S.boat = (k, x, y, s, r, L) => {
  k.line([[x, y - s * 0.12], [x, y - s * 0.48]]);
  k.poly([[x + 8, y - s * 0.46], [x + s * 0.3, y - s * 0.16], [x + 8, y - s * 0.16]]);
  k.poly([[x - 8, y - s * 0.4], [x - s * 0.24, y - s * 0.16], [x - 8, y - s * 0.16]]);
  if (L >= 2) k.poly([[x, y - s * 0.48], [x + s * 0.1, y - s * 0.45], [x, y - s * 0.42]]);
  k.poly([[x - s * 0.4, y - s * 0.12], [x + s * 0.4, y - s * 0.12], [x + s * 0.28, y + s * 0.08], [x - s * 0.28, y + s * 0.08]]);
  for (let i = -1; i <= 1; i++) k.circle(x + i * s * 0.15, y - s * 0.03, s * 0.035);
  if (L >= 3) k.line([[x - s * 0.36, y - s * 0.07], [x + s * 0.36, y - s * 0.07]], k.lw * 0.6);
};

S.rocket = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  k.poly([[x - s * 0.06, y + s * 0.25], [x, y + s * 0.45], [x + s * 0.06, y + s * 0.25]]);
  if (L >= 2) k.poly([[x - s * 0.03, y + s * 0.25], [x, y + s * 0.36], [x + s * 0.03, y + s * 0.25]]);
  k.poly([[x - s * 0.1, y + s * 0.05], [x - s * 0.22, y + s * 0.28], [x - s * 0.1, y + s * 0.22]]);
  k.poly([[x + s * 0.1, y + s * 0.05], [x + s * 0.22, y + s * 0.28], [x + s * 0.1, y + s * 0.22]]);
  ctx.beginPath(); ctx.moveTo(x - s * 0.12, y + s * 0.25);
  ctx.lineTo(x - s * 0.12, y - s * 0.15); ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.38, x, y - s * 0.45);
  ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.38, x + s * 0.12, y - s * 0.15); ctx.lineTo(x + s * 0.12, y + s * 0.25); ctx.closePath(); k.done();
  k.line([[x - s * 0.1, y - s * 0.28], [x + s * 0.1, y - s * 0.28]]);
  k.circle(x, y - s * 0.08, s * 0.065); k.circle(x, y - s * 0.08, s * 0.04);
  if (L >= 2) { k.line([[x - s * 0.12, y + s * 0.12], [x + s * 0.12, y + s * 0.12]]); for (const d of [-1, 1]) k.dot(x + d * s * 0.07, y + s * 0.19, 5); }
};

S.train = (k, x, y, s, r, L) => {
  k.poly([[x + s * 0.18, y - s * 0.12], [x + s * 0.14, y - s * 0.3], [x + s * 0.3, y - s * 0.3], [x + s * 0.26, y - s * 0.12]]);
  if (L >= 2) { k.circle(x + s * 0.28, y - s * 0.4, s * 0.05); k.circle(x + s * 0.36, y - s * 0.48, s * 0.07); }
  k.rrect(x - s * 0.42, y - s * 0.32, s * 0.3, s * 0.3, 10);
  k.rrect(x - s * 0.46, y - s * 0.38, s * 0.38, s * 0.07, 8);
  k.rrect(x - s * 0.36, y - s * 0.26, s * 0.18, s * 0.13, 8);
  k.rrect(x - s * 0.12, y - s * 0.12, s * 0.5, s * 0.24, 12);
  k.poly([[x + s * 0.38, y + s * 0.04], [x + s * 0.48, y + s * 0.12], [x + s * 0.38, y + s * 0.12]]);
  k.rrect(x - s * 0.44, y - s * 0.03, s * 0.34, s * 0.15, 8);
  for (const dx of [-0.32, -0.16, 0.1, 0.28]) { k.circle(x + dx * s, y + s * 0.15, s * 0.07); k.dot(x + dx * s, y + s * 0.15, 6); }
  if (L >= 3) { k.line([[x - s * 0.32, y + s * 0.15], [x - s * 0.16, y + s * 0.15]], k.lw * 1.2); k.line([[30, y + s * 0.23], [SIZE - 30, y + s * 0.23]]); }
};

S.plane = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  k.poly([[x - s * 0.05, y], [x - s * 0.18, y + s * 0.3], [x + s * 0.04, y + s * 0.3], [x + s * 0.12, y]]);
  k.poly([[x - s * 0.34, y - s * 0.02], [x - s * 0.42, y - s * 0.2], [x - s * 0.34, y - s * 0.2], [x - s * 0.24, y - s * 0.02]]);
  ctx.beginPath(); ctx.moveTo(x - s * 0.42, y - s * 0.04);
  ctx.lineTo(x + s * 0.3, y - s * 0.07); ctx.quadraticCurveTo(x + s * 0.46, y - s * 0.02, x + s * 0.3, y + s * 0.06);
  ctx.lineTo(x - s * 0.38, y + s * 0.04); ctx.closePath(); k.done();
  k.poly([[x - s * 0.02, y - s * 0.03], [x - s * 0.12, y - s * 0.28], [x + s * 0.02, y - s * 0.28], [x + s * 0.1, y - s * 0.04]]);
  for (let i = 0; i < (L >= 2 ? 4 : 3); i++) k.circle(x + s * (0.12 - i * 0.09), y - s * 0.005, s * 0.022);
  k.poly([[x + s * 0.31, y - s * 0.06], [x + s * 0.38, y - s * 0.03], [x + s * 0.31, y - s * 0.01]]);
};

S.flower = (k, x, y, s, r, L) => {
  const ctx = k.ctx; const n = r.int(5, L === 1 ? 6 : 9);
  ctx.beginPath(); ctx.moveTo(x - 8, y + s * 0.5); ctx.quadraticCurveTo(x - 30, y + s * 0.25, x - 8, y);
  ctx.lineTo(x + 8, y); ctx.quadraticCurveTo(x - 14, y + s * 0.25, x + 8, y + s * 0.5); ctx.closePath(); k.done();
  for (const d of [-1, 1]) {
    ctx.beginPath(); const lx = x - 4, ly = y + s * 0.32;
    ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + d * s * 0.16, ly - s * 0.16, lx + d * s * 0.26, ly - s * 0.06);
    ctx.quadraticCurveTo(lx + d * s * 0.12, ly + s * 0.06, lx, ly); ctx.closePath(); k.done();
    if (L >= 2) k.curve(lx, ly, lx + d * s * 0.12, ly - s * 0.06, lx + d * s * 0.22, ly - s * 0.06, k.lw * 0.6);
  }
  const pr = s * 0.17;
  const shape = r.pick(['ellipse', 'round', 'heart']);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const px = x + Math.cos(a) * pr * 1.15, py = y - s * 0.12 + Math.sin(a) * pr * 1.15;
    if (shape === 'round') k.circle(px, py, pr * 0.62);
    else k.ellipse(px, py, pr * 0.85, pr * 0.42, a);
    if (L >= 3 && shape !== 'round') k.line([[x + Math.cos(a) * pr * 0.6, y - s * 0.12 + Math.sin(a) * pr * 0.6], [x + Math.cos(a) * pr * 1.6, y - s * 0.12 + Math.sin(a) * pr * 1.6]], k.lw * 0.5);
  }
  k.circle(x, y - s * 0.12, pr * 0.75);
  if (L >= 2) { k.eye(x - pr * 0.28, y - s * 0.14, pr * 0.14); k.eye(x + pr * 0.28, y - s * 0.14, pr * 0.14); k.smile(x, y - s * 0.07, pr * 0.3); }
};

S.tree = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  ctx.beginPath(); ctx.moveTo(x - s * 0.08, y + s * 0.5);
  ctx.quadraticCurveTo(x - s * 0.05, y + s * 0.2, x - s * 0.07, y); ctx.lineTo(x + s * 0.07, y);
  ctx.quadraticCurveTo(x + s * 0.05, y + s * 0.2, x + s * 0.1, y + s * 0.5); ctx.closePath(); k.done();
  if (L >= 2) { k.arc(x, y + s * 0.25, s * 0.03, -1, 1, k.lw * 0.6); k.ellipse(x, y + s * 0.15, s * 0.025, s * 0.035); }
  const blobs = [[0, -0.2, 0.25], [-0.2, -0.05, 0.18], [0.2, -0.05, 0.18], [-0.12, -0.35, 0.16], [0.13, -0.33, 0.16]];
  for (const [dx, dy, rr] of blobs) k.circle(x + dx * s, y + dy * s, rr * s, false);
  ctx.save(); ctx.fillStyle = '#fff';
  for (const [dx, dy, rr] of blobs) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, rr * s - k.lw / 2, 0, TAU); ctx.fill(); }
  ctx.restore();
  const fruit = r.chance(0.6) || L >= 3;
  if (fruit) {
    const n = L === 1 ? 4 : 7;
    for (let i = 0; i < n; i++) { const a = r.range(0, TAU), d = r.range(0, 0.26); k.circle(x + Math.cos(a) * d * s, y - s * 0.2 + Math.sin(a) * d * s * 0.9, s * 0.04); }
  }
  if (L >= 3) { k.ellipse(x - s * 0.06, y + s * 0.05, s * 0.06, s * 0.05); k.dot(x - s * 0.06, y + s * 0.05, s * 0.025); }
};

S.mushroom = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  k.rrect(x - s * 0.12, y - s * 0.05, s * 0.24, s * 0.4, 30);
  ctx.beginPath(); ctx.moveTo(x - s * 0.38, y);
  ctx.bezierCurveTo(x - s * 0.4, y - s * 0.45, x + s * 0.4, y - s * 0.45, x + s * 0.38, y);
  ctx.quadraticCurveTo(x, y + s * 0.06, x - s * 0.38, y); ctx.closePath(); k.done();
  const spots = [[-0.2, -0.12, 0.06], [0.05, -0.22, 0.07], [0.22, -0.08, 0.05], [-0.04, -0.06, 0.04]];
  for (const [dx, dy, rr] of spots.slice(0, L === 1 ? 3 : 4)) k.circle(x + dx * s, y + dy * s, rr * s);
  if (L >= 2) { k.eye(x - s * 0.05, y + s * 0.12, s * 0.025); k.eye(x + s * 0.05, y + s * 0.12, s * 0.025); k.smile(x, y + s * 0.18, s * 0.06); }
  if (L >= 3) for (let i = -2; i <= 2; i++) k.curve(x + i * s * 0.08, y + s * 0.35, x + i * s * 0.1, y + s * 0.3, x + i * s * 0.12, y + s * 0.27, k.lw * 0.6);
};

S.rainbow = (k, x, y, s, r, L) => {
  const bands = L === 1 ? 4 : L === 2 ? 6 : 7;
  for (let i = 0; i <= bands; i++) k.arc(x, y + s * 0.15, s * (0.48 - i * 0.04), Math.PI, TAU);
  k.line([[x - s * 0.48, y + s * 0.15], [x - s * (0.48 - bands * 0.04), y + s * 0.15]]);
  k.line([[x + s * 0.48, y + s * 0.15], [x + s * (0.48 - bands * 0.04), y + s * 0.15]]);
  k.cloud(x - s * 0.4, y + s * 0.15, s * 0.32); k.cloud(x + s * 0.4, y + s * 0.15, s * 0.32);
};

S.apple = (k, x, y, s, r, L) => {
  const ctx = k.ctx;
  k.rrect(x - s * 0.02, y - s * 0.38, s * 0.04, s * 0.14, 8);
  ctx.beginPath(); ctx.moveTo(x + s * 0.02, y - s * 0.32); ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.45, x + s * 0.22, y - s * 0.35);
  ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.26, x + s * 0.02, y - s * 0.32); ctx.closePath(); k.done();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.25);
  ctx.bezierCurveTo(x - s * 0.15, y - s * 0.35, x - s * 0.38, y - s * 0.25, x - s * 0.35, y);
  ctx.bezierCurveTo(x - s * 0.32, y + s * 0.25, x - s * 0.12, y + s * 0.35, x, y + s * 0.28);
  ctx.bezierCurveTo(x + s * 0.12, y + s * 0.35, x + s * 0.32, y + s * 0.25, x + s * 0.35, y);
  ctx.bezierCurveTo(x + s * 0.38, y - s * 0.25, x + s * 0.15, y - s * 0.35, x, y - s * 0.25); ctx.closePath(); k.done();
  if (L >= 2) k.ellipse(x - s * 0.18, y - s * 0.08, s * 0.05, s * 0.09, 0.4);
  if (L >= 3) { k.eye(x - s * 0.08, y + s * 0.02, s * 0.03); k.eye(x + s * 0.08, y + s * 0.02, s * 0.03); k.smile(x, y + s * 0.09, s * 0.07); }
};

S.cactus = (k, x, y, s, r, L) => {
  k.poly([[x - s * 0.22, y + s * 0.3], [x + s * 0.22, y + s * 0.3], [x + s * 0.17, y + s * 0.5], [x - s * 0.17, y + s * 0.5]]);
  k.rrect(x - s * 0.25, y + s * 0.26, s * 0.5, s * 0.08, 8);
  k.rrect(x - s * 0.28, y - s * 0.2, s * 0.12, s * 0.28, 30);
  k.rrect(x + s * 0.16, y - s * 0.28, s * 0.12, s * 0.3, 30);
  k.rrect(x - s * 0.22, y - s * 0.02, s * 0.15, s * 0.1, 20);
  k.rrect(x + s * 0.07, y - s * 0.06, s * 0.15, s * 0.1, 20);
  k.rrect(x - s * 0.1, y - s * 0.4, s * 0.2, s * 0.68, 40);
  if (L >= 2) { k.line([[x, y - s * 0.32], [x, y + s * 0.22]], k.lw * 0.6); k.flowerSmall(x, y - s * 0.42, s * 0.06, 5); }
  k.eye(x - s * 0.04, y - s * 0.15, s * 0.022); k.eye(x + s * 0.04, y - s * 0.15, s * 0.022); k.smile(x, y - s * 0.1, s * 0.05);
};

S.star = (k, x, y, s, r, L) => { k.star(x, y, s * 0.45, s * 0.2, 5); if (L >= 2) { k.eye(x - s * 0.07, y - s * 0.02, s * 0.04); k.eye(x + s * 0.07, y - s * 0.02, s * 0.04); k.smile(x, y + s * 0.05, s * 0.07); } };
S.heart = (k, x, y, s, r, L) => { k.heart(x, y, s * 0.9); if (L >= 3) k.heart(x, y, s * 0.45); };
S.sun = (k, x, y, s, r, L) => {
  const rays = 12;
  for (let i = 0; i < rays; i++) { const a = i / rays * TAU; k.poly([[x + Math.cos(a - 0.15) * s * 0.3, y + Math.sin(a - 0.15) * s * 0.3], [x + Math.cos(a) * s * 0.48, y + Math.sin(a) * s * 0.48], [x + Math.cos(a + 0.15) * s * 0.3, y + Math.sin(a + 0.15) * s * 0.3]]); }
  k.circle(x, y, s * 0.3);
  k.eye(x - s * 0.1, y - s * 0.05, s * 0.04); k.eye(x + s * 0.1, y - s * 0.05, s * 0.04); k.smile(x, y + s * 0.08, s * 0.12);
  if (L >= 2) { k.circle(x - s * 0.17, y + s * 0.06, s * 0.04); k.circle(x + s * 0.17, y + s * 0.06, s * 0.04); }
};
S.ball = (k, x, y, s, r, L) => { k.circle(x, y, s * 0.4); k.arc(x - s * 0.55, y, s * 0.55, -0.75, 0.75); k.arc(x + s * 0.55, y, s * 0.55, Math.PI - 0.75, Math.PI + 0.75); };
S.moon = (k, x, y, s) => {
  const ctx = k.ctx; ctx.beginPath();
  ctx.arc(x, y, s * 0.4, Math.PI * 0.35, Math.PI * 1.65);
  ctx.quadraticCurveTo(x - s * 0.05, y, x + s * 0.4 * Math.cos(Math.PI * 0.35), y + s * 0.4 * Math.sin(Math.PI * 0.35));
  ctx.closePath(); k.done();
  k.dot(x - s * 0.15, y - s * 0.05, s * 0.025);
};
S.cheese = (k, x, y, s) => {
  k.poly([[x - s * 0.4, y + s * 0.2], [x + s * 0.4, y + s * 0.2], [x + s * 0.4, y - s * 0.05], [x - s * 0.4, y - s * 0.25]]);
  k.line([[x - s * 0.4, y - s * 0.25], [x + s * 0.4, y - s * 0.05]]);
  k.line([[x - s * 0.4, y - s * 0.05], [x + s * 0.4, y - s * 0.05]]);
  k.circle(x - s * 0.15, y + s * 0.08, s * 0.06); k.circle(x + s * 0.18, y + s * 0.1, s * 0.045); k.circle(x + s * 0.05, y - s * 0.12, s * 0.03);
};
S.dice = (k, x, y, s) => { k.rrect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6, 30); for (const [a, b] of [[-1, -1], [1, 1], [0, 0], [1, -1], [-1, 1]]) k.circle(x + a * s * 0.15, y + b * s * 0.15, s * 0.05); };
S.egg = (k, x, y, s, r, L) => { const ctx = k.ctx; ctx.beginPath(); ctx.moveTo(x, y - s * 0.4); ctx.bezierCurveTo(x + s * 0.35, y - s * 0.4, x + s * 0.32, y + s * 0.35, x, y + s * 0.35); ctx.bezierCurveTo(x - s * 0.32, y + s * 0.35, x - s * 0.35, y - s * 0.4, x, y - s * 0.4); k.done(); const z = []; for (let i = 0; i <= 8; i++) z.push([x - s * 0.3 + i * s * 0.075, y + (i % 2 ? -1 : 1) * s * 0.05]); k.line(z); };
S.balloon = (k, x, y, s) => { k.curve(x, y + s * 0.25, x - s * 0.1, y + s * 0.38, x + s * 0.02, y + s * 0.5); k.poly([[x - s * 0.04, y + s * 0.27], [x + s * 0.04, y + s * 0.27], [x, y + s * 0.22]]); k.ellipse(x, y - s * 0.05, s * 0.24, s * 0.28); k.ellipse(x - s * 0.1, y - s * 0.15, s * 0.04, s * 0.07, 0.4); };
S.icecream = (k, x, y, s) => { k.poly([[x - s * 0.18, y], [x + s * 0.18, y], [x, y + s * 0.45]]); k.line([[x - s * 0.1, y + s * 0.05], [x + s * 0.05, y + s * 0.3]], k.lw * 0.6); k.line([[x + s * 0.1, y + s * 0.05], [x - s * 0.05, y + s * 0.3]], k.lw * 0.6); k.circle(x - s * 0.1, y - s * 0.06, s * 0.13); k.circle(x + s * 0.1, y - s * 0.06, s * 0.13); k.circle(x, y - s * 0.22, s * 0.14); k.circle(x, y - s * 0.38, s * 0.04); };

/* ---------- categorias ---------- */
const ANIMALS = ['cat', 'dog', 'fish', 'bird', 'owl', 'turtle', 'snail', 'butterfly', 'ladybug', 'rabbit', 'bear', 'pig', 'frog', 'whale'];
const WATER = new Set(['fish', 'whale', 'turtle']);
const SKY = new Set(['bird', 'butterfly']);
const VEHICLES = ['house', 'car', 'boat', 'rocket', 'train', 'plane'];
const NATURE = ['flower', 'tree', 'mushroom', 'rainbow', 'apple', 'cactus', 'sun'];
const COUNTABLES = ['star', 'heart', 'ball', 'apple', 'fish', 'flower', 'balloon', 'ladybug', 'butterfly', 'icecream'];
const NAMES = {
  cat: 'Gato', dog: 'Cão', fish: 'Peixe', bird: 'Pássaro', owl: 'Coruja', turtle: 'Tartaruga', snail: 'Caracol', butterfly: 'Borboleta',
  ladybug: 'Joaninha', rabbit: 'Coelho', bear: 'Urso', pig: 'Porco', frog: 'Sapo', whale: 'Baleia', house: 'Casa', car: 'Carro', boat: 'Barco',
  rocket: 'Foguetão', train: 'Comboio', plane: 'Avião', flower: 'Flor', tree: 'Árvore', mushroom: 'Cogumelo', rainbow: 'Arco-íris',
  apple: 'Maçã', cactus: 'Cato', sun: 'Sol', star: 'Estrela', heart: 'Coração', ball: 'Bola', moon: 'Lua', cheese: 'Queijo', dice: 'Dado',
  egg: 'Ovo', balloon: 'Balão', icecream: 'Gelado',
};
const LETTERS = {
  A: ['plane', 'tree'], B: ['boat', 'whale', 'butterfly', 'ball', 'balloon'], C: ['house', 'car', 'dog', 'owl', 'snail', 'mushroom', 'rabbit', 'heart', 'cactus'],
  D: ['dice'], E: ['star'], F: ['flower', 'rocket'], G: ['cat', 'icecream'], H: [], I: [], J: ['ladybug'], K: [], L: ['moon'], M: ['apple'],
  N: [], O: ['egg'], P: ['fish', 'pig', 'bird'], Q: ['cheese'], R: [], S: ['sun', 'frog'], T: ['turtle', 'train'], U: ['bear'], V: [], W: [], X: [], Y: [], Z: [],
};
const NUMWORDS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'];

const CATEGORIES = [
  { id: 'animais', name: 'Animais', emoji: '🐱', color: '#FFB547' },
  { id: 'natureza', name: 'Natureza', emoji: '🌻', color: '#7BD389' },
  { id: 'veiculos', name: 'Casas e Veículos', emoji: '🚗', color: '#5DB7F5' },
  { id: 'mandalas', name: 'Mandalas', emoji: '🌀', color: '#C38BF5' },
  { id: 'letras', name: 'Letras', emoji: '🔤', color: '#FF8A8A' },
  { id: 'numeros', name: 'Números', emoji: '🔢', color: '#4FD1C5' },
  { id: 'padroes', name: 'Padrões', emoji: '💠', color: '#F5A3D7' },
  { id: 'surpresa', name: 'Surpresa', emoji: '🎁', color: '#FFD54F' },
];

function frame(k) { k.rrect(40, 40, SIZE - 80, SIZE - 80, 40, false); }

function sceneAnimal(k, r, L) {
  const a = r.pick(ANIMALS);
  let title = NAMES[a];
  if (WATER.has(a) && (a !== 'turtle' || r.chance(0.5))) BG.sea(k, r, L);
  else if (a === 'owl') { BG.night(k, r, L); k.line([[30, 1040], [SIZE - 30, 1040]]); }
  else if (SKY.has(a) && r.chance(0.5)) { if (L >= 2) for (let i = 0; i < 3; i++) k.cloud(r.range(200, 1000), r.range(150, 1000), r.range(150, 220)); else k.cloud(r.range(250, 950), 200, 200); }
  else BG.land(k, r, L);
  const s = L === 1 ? 820 : 720;
  S[a](k, 600, 600, s, r, L);
  if (L >= 3 && !WATER.has(a)) { const ex = r.pick(['butterfly', 'ladybug', 'bird']); if (ex !== a) S[ex](k, r.pick([190, 1010]), r.range(780, 900), 190, r, 1); }
  if (L >= 3 && WATER.has(a)) S.fish(k, r.pick([230, 970]), r.range(330, 420), 190, r, 1);
  return title;
}
function sceneVehicle(k, r, L) {
  const v = r.pick(VEHICLES);
  if (v === 'boat') {
    const ctx = k.ctx; ctx.beginPath(); ctx.moveTo(30, 720);
    for (let x = 30; x < SIZE - 30; x += 95) ctx.quadraticCurveTo(x + 47.5, 690, x + 95, 720);
    ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke();
    k.cloud(r.range(220, 360), 180, 220); if (L >= 2) { k.cloud(r.range(840, 980), 230, 200); S.fish(k, r.range(250, 400), 930, 200, r, 1); }
    if (L >= 3) { S.fish(k, r.range(800, 950), 1000, 170, r, 1); for (let i = 0; i < 4; i++) k.circle(r.range(500, 700), r.range(820, 1000), r.range(12, 24)); }
  }
  else if (v === 'rocket') BG.space(k, r, L);
  else if (v === 'plane') { const n = L === 1 ? 2 : 4; for (let i = 0; i < n; i++) k.cloud(r.range(200, 1000), r.pick([r.range(180, 330), r.range(850, 1050)]), r.range(150, 230)); }
  else BG.land(k, r, L, { ground: v === 'house' ? 960 : 900 });
  const s = L === 1 ? 900 : 800;
  if (v === 'boat') S.boat(k, 600, 640, s * 0.95, r, L);
  else if (v === 'house') { S.house(k, 600, 620, s * 1.05, r, L); if (L >= 3) S.tree(k, 1000, 700, 330, r, 1); }
  else if (v === 'car' || v === 'train') S[v](k, 600, 780, s, r, L);
  else S[v](k, 600, 600, s, r, L);
  return NAMES[v];
}
function sceneNature(k, r, L) {
  const n = r.pick(NATURE);
  if (n === 'flower' && L >= 2) {
    BG.land(k, r, L, { ground: 1000 });
    const c = L === 2 ? 2 : 3;
    const xs = c === 2 ? [400, 800] : [300, 600, 900];
    xs.forEach((fx, i) => S.flower(k, fx, 610 + (i % 2) * 40, c === 2 ? 640 : 520, r, L));
    return 'Flores';
  }
  if (n === 'rainbow') { BG.land(k, r, 1, { noSun: true }); S.rainbow(k, 600, 560, 1000, r, L); if (L >= 2) S.sun(k, 600, 820, 230, r, 1); return NAMES[n]; }
  if (n === 'sun') { S.sun(k, 600, 560, 900, r, L); if (L >= 2) { k.cloud(250, 1000, 260); k.cloud(950, 1020, 260); } return NAMES[n]; }
  if (n === 'apple' && L >= 2) {
    // cesto de fruta
    k.rrect(240, 720, 720, 300, 60);
    for (let i = 1; i < 4; i++) k.line([[240 + i * 180, 730], [240 + i * 180, 1010]], k.lw * 0.6);
    k.line([[250, 870], [950, 870]], k.lw * 0.6);
    S.apple(k, 420, 620, 300, r, 1); S.apple(k, 780, 620, 300, r, 1); S.apple(k, 600, 520, 330, r, L);
    k.cloud(300, 220, 220); if (L >= 3) k.cloud(900, 260, 200);
    return 'Cesto de maçãs';
  }
  BG.land(k, r, L, { ground: 1000 });
  S[n](k, 600, 580, L === 1 ? 860 : 760, r, L);
  return NAMES[n];
}
function sceneMandala(k, r, L) {
  const cx = 600, cy = 600;
  const rings = L === 1 ? r.int(2, 3) : L === 2 ? r.int(4, 5) : r.int(6, 8);
  const maxR = 520;
  let rad = 70 + (L === 1 ? 40 : 0);
  k.circle(cx, cy, rad * 0.6);
  if (L >= 2) k.star(cx, cy, rad * 0.5, rad * 0.25, r.int(5, 8));
  const step = (maxR - rad) / rings;
  for (let i = 0; i < rings; i++) {
    const n = r.pick(L === 1 ? [6, 8] : [8, 10, 12, 16]);
    const type = r.pick(['petal', 'circle', 'tri', 'heart', 'drop', 'ring']);
    const rr = rad + step * 0.55, size = step * 0.55;
    const off = r.f() * Math.PI;
    for (let j = 0; j < n; j++) {
      const a = off + (j / n) * TAU, px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      const w = Math.min(size, (TAU * rr / n) * 0.48);
      if (type === 'petal') k.ellipse(px, py, size, w * 0.8, a);
      else if (type === 'circle') k.circle(px, py, w * 0.9);
      else if (type === 'tri') k.poly([[cx + Math.cos(a - 0.5 * TAU / n) * (rr - size), cy + Math.sin(a - 0.5 * TAU / n) * (rr - size)], [cx + Math.cos(a) * (rr + size), cy + Math.sin(a) * (rr + size)], [cx + Math.cos(a + 0.5 * TAU / n) * (rr - size), cy + Math.sin(a + 0.5 * TAU / n) * (rr - size)]]);
      else if (type === 'heart') { k.ctx.save(); k.ctx.translate(px, py); k.ctx.rotate(a - Math.PI / 2); k.heart(0, 0, w * 1.8); k.ctx.restore(); }
      else if (type === 'drop') { k.ctx.save(); k.ctx.translate(px, py); k.ctx.rotate(a + Math.PI / 2); const c = k.ctx; c.beginPath(); c.moveTo(0, -size); c.quadraticCurveTo(w, 0, 0, size * 0.6); c.quadraticCurveTo(-w, 0, 0, -size); k.done(); k.ctx.restore(); }
      else { k.circle(px, py, w * 0.9); k.circle(px, py, w * 0.45); }
      if (L >= 3 && (type === 'petal' || type === 'drop')) k.dot(px, py, 5);
    }
    rad += step;
    if (L >= 2 && r.chance(0.5)) k.circle(cx, cy, rad - step * 0.02, false);
  }
  k.circle(cx, cy, maxR + 20, false);
  return 'Mandala';
}
function scenePattern(k, r, L) {
  const kind = r.pick(['scatter', 'stripes', 'grid']);
  const pickShape = () => r.pick(['star', 'heart', 'circle', 'flower', 'cloud']);
  const draw = (sh, x, y, sz) => {
    if (sh === 'star') k.star(x, y, sz * 0.5, sz * 0.22, 5, r.range(0, 1));
    else if (sh === 'heart') k.heart(x, y, sz);
    else if (sh === 'circle') { k.circle(x, y, sz * 0.45); if (L >= 2) k.circle(x, y, sz * 0.22); }
    else if (sh === 'flower') k.flowerSmall(x, y, sz * 0.4, 6);
    else k.cloud(x, y, sz);
  };
  if (kind === 'grid') {
    const n = L === 1 ? 3 : L === 2 ? 4 : 5, cell = (SIZE - 160) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = 80 + cell * (i + 0.5), y = 80 + cell * (j + 0.5);
      k.rrect(x - cell / 2 + 6, y - cell / 2 + 6, cell - 12, cell - 12, 24);
      draw(pickShape(), x, y, cell * 0.7);
    }
  } else if (kind === 'stripes') {
    const n = L === 1 ? 3 : L === 2 ? 5 : 7, h = (SIZE - 80) / n;
    const ctx = k.ctx;
    for (let i = 1; i < n; i++) { ctx.beginPath(); const y = 40 + i * h; ctx.moveTo(30, y); for (let x = 30; x < SIZE - 30; x += 120) ctx.quadraticCurveTo(x + 60, y + (i % 2 ? 40 : -40), x + 120, y); ctx.lineWidth = k.lw; ctx.strokeStyle = '#000'; ctx.stroke(); }
    for (let i = 0; i < n; i++) { const sh = pickShape(), per = L === 1 ? 2 : 3; for (let j = 0; j < per; j++) draw(sh, 160 + j * ((SIZE - 320) / Math.max(1, per - 1)), 40 + i * h + h / 2, Math.min(h * 0.62, 220)); }
  } else {
    const placed = []; const tries = 400; const want = L === 1 ? 6 : L === 2 ? 12 : 20;
    for (let t = 0; t < tries && placed.length < want; t++) {
      const sz = r.range(L === 1 ? 220 : 130, L === 1 ? 320 : 240), x = r.range(80 + sz / 2, SIZE - 80 - sz / 2), y = r.range(80 + sz / 2, SIZE - 80 - sz / 2);
      if (placed.every(p => Math.hypot(p[0] - x, p[1] - y) > (p[2] + sz) * 0.55)) { placed.push([x, y, sz]); draw(pickShape(), x, y, sz); }
    }
  }
  return 'Padrão';
}
function sceneLetter(k, r, L, n) {
  const keys = Object.keys(LETTERS);
  const letter = keys[n % keys.length];
  const objs = LETTERS[letter];
  k.text(letter, 330, 380, 520);
  k.text(letter.toLowerCase(), 760, 440, 380);
  if (objs.length) {
    const o = objs[Math.floor(n / keys.length + r.int(0, 99)) % objs.length];
    if (S[o]) S[o](k, 600, 830, 500, r, L);
    k.label(NAMES[o], 600, 1115, 66);
    return `${letter} de ${NAMES[o]}`;
  }
  { const c = L === 1 ? 3 : 5; for (let i = 0; i < c; i++) k.star(220 + i * (760 / (c - 1)), i % 2 ? 1000 : 820, L === 1 ? 110 : 85, L === 1 ? 50 : 38, 5, r.range(-0.3, 0.3)); }
  return `Letra ${letter}`;
}
function sceneNumber(k, r, L, n) {
  const maxN = L === 1 ? 5 : L === 2 ? 10 : 12;
  const num = (n % maxN) + 1;
  const obj = r.pick(COUNTABLES);
  k.text(String(num), 300, 300, num >= 10 ? 340 : 440);
  k.text(NUMWORDS[num], 820, 300, num >= 10 ? 140 : 160);
  const cols = num <= 3 ? num : num <= 6 ? 3 : 4;
  const rows = Math.ceil(num / cols);
  const cellW = 1000 / cols, cellH = Math.min(520, 560 / rows);
  const sz = Math.min(cellW, cellH) * 0.85;
  for (let i = 0; i < num; i++) {
    const c = i % cols, rr = Math.floor(i / cols);
    const inRow = Math.min(cols, num - rr * cols);
    const x = 600 + (c - (inRow - 1) / 2) * cellW, y = 540 + (560 - cellH * rows) / 2 + cellH * (rr + 0.5);
    S[obj](k, x, y, sz, r, 1);
  }
  k.label(`${num} ${NAMES[obj].toLowerCase()}${num > 1 ? (NAMES[obj].endsWith('r') || NAMES[obj].endsWith('l') ? 'es' : 's') : ''}`, 600, 490, 54);
  return `Número ${num}`;
}

function levelLineWidth(L) { return L === 1 ? 11 : L === 2 ? 8.5 : 6.5; }

/* Desenha a página em ctx (tamanho SIZE). Devolve o título. */
function renderPage(ctx, cat, n, L) {
  const seed = hashStr(`${cat}|${n}|${L}`);
  const r = makeRng(seed);
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const k = kit(ctx, levelLineWidth(L));
  ctx.save(); ctx.beginPath(); roundRectPath(ctx, 40, 40, SIZE - 80, SIZE - 80, 40); ctx.clip();
  let realCat = cat;
  if (cat === 'surpresa') realCat = r.pick(['animais', 'natureza', 'veiculos', 'mandalas', 'padroes', 'animais']);
  let title;
  switch (realCat) {
    case 'animais': title = sceneAnimal(k, r, L); break;
    case 'natureza': title = sceneNature(k, r, L); break;
    case 'veiculos': title = sceneVehicle(k, r, L); break;
    case 'mandalas': title = sceneMandala(k, r, L); break;
    case 'padroes': title = scenePattern(k, r, L); break;
    case 'letras': title = sceneLetter(k, r, L, n); break;
    case 'numeros': title = sceneNumber(k, r, L, n); break;
    default: title = sceneAnimal(k, r, L);
  }
  ctx.restore();
  frame(k);
  ctx.restore();
  return title;
}

/* Converte desenho preto-sobre-branco em camada de linhas (preto com transparência). */
function toLineLayer(srcCanvas) {
  const c = document.createElement('canvas'); c.width = srcCanvas.width; c.height = srcCanvas.height;
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const img = sctx.getImageData(0, 0, c.width, c.height); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
    const a = 255 - lum;
    d[i] = d[i + 1] = d[i + 2] = 20; d[i + 3] = a < 8 ? 0 : a;
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

window.PCGen = { SIZE, CATEGORIES, renderPage, toLineLayer, hashStr };
