/* Converte uma foto numa página de colorir (linhas pretas sobre branco). */
'use strict';

function boxBlur(src, w, h, r) {
  // desfoque por imagem integral (rápido para qualquer raio)
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += src[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const sum = I[(y1 + 1) * (w + 1) + x1 + 1] - I[y0 * (w + 1) + x1 + 1] - I[(y1 + 1) * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return out;
}

/* detail: 1..10 (mais = mais linhas), thick: 1..5 */
function photoToLines(img, detail, thick) {
  const SIZE = window.PCGen.SIZE;
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE);
  const m = 70, avail = SIZE - m * 2;
  const sc = Math.min(avail / img.width, avail / img.height);
  const w = img.width * sc, h = img.height * sc;
  const ox = (SIZE - w) / 2, oy = (SIZE - h) / 2;
  ctx.drawImage(img, ox, oy, w, h);
  const id = ctx.getImageData(0, 0, SIZE, SIZE), d = id.data, N = SIZE * SIZE;
  const g = new Float32Array(N);
  for (let i = 0; i < N; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  // diferença de gaussianas (aproximada com desfoque de caixa) => contornos tipo esboço
  const b1 = boxBlur(boxBlur(g, SIZE, SIZE, 1), SIZE, SIZE, 1);
  const b2 = boxBlur(boxBlur(g, SIZE, SIZE, 4), SIZE, SIZE, 4);
  const thr = 2 + (11 - detail) * 1.6;
  let mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (b2[i] - b1[i] > thr) mask[i] = 1;
  // limpar fora da foto
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (x < ox + 3 || x > ox + w - 3 || y < oy + 3 || y > oy + h - 3) mask[y * SIZE + x] = 0;
  // remover pontinhos soltos
  mask = removeSpecks(mask, SIZE, SIZE, 30 + (10 - detail) * 12);
  // engrossar
  for (let t = 0; t < thick; t++) mask = dilate(mask, SIZE, SIZE);
  for (let i = 0; i < N; i++) { const v = mask[i] ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(id, 0, 0);
  // moldura da foto e da página
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = 8;
  ctx.strokeRect(ox, oy, w, h);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(40, 40, SIZE - 80, SIZE - 80, 40) : ctx.rect(40, 40, SIZE - 80, SIZE - 80); ctx.stroke();
  return c;
}

function dilate(m, w, h) {
  const o = new Uint8Array(m.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (m[i] || m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) o[i] = 1;
  }
  return o;
}

function removeSpecks(m, w, h, minSize) {
  const lab = new Int32Array(m.length); const out = new Uint8Array(m.length);
  const stack = new Int32Array(m.length); let next = 1;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    let sp = 0, count = 0; stack[sp++] = s; lab[s] = next;
    const members = [];
    while (sp) {
      const i = stack[--sp]; count++; members.push(i);
      const x = i % w;
      const nb = [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1];
      for (const j of nb) if (j >= 0 && j < m.length && m[j] && !lab[j]) { lab[j] = next; stack[sp++] = j; }
    }
    if (count >= minSize) for (const i of members) out[i] = 1;
    next++;
  }
  return out;
}

window.PCPhoto = { photoToLines };
