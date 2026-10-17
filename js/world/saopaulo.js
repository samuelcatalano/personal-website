import { LANDMARKS, stopIndex, RIVER_Z, copan } from './layout.js';
import { PALETTE as P } from './palette.js';
const FAR = RIVER_Z - 18;
function masp(add, { x }) {
  const z = FAR;
  for (const ex of [-17, 17]) {
    add(x + ex, 0, z - 5.5, 1.6, 13.98, 1.6, P.masp);
    add(x + ex, 0, z + 5.5, 1.6, 13.98, 1.6, P.masp);
    add(x + ex, 14, z, 2, 1.6, 13, P.masp);
  }
  add(x, 14, z, 40, 1.2, 3, P.masp);
  add(x, 8, z, 34, 6, 10, P.concrete);
  add(x, 8.8, z + 5.05, 34, 4.4, 0.12, P.glass);
  add(x, 8.8, z - 5.05, 34, 4.4, 0.12, P.glass);
  add(x, 0, z, 36, 0.3, 12, P.stone);
}
function se(add, { x }) {
  const z = FAR;
  add(x, 0, z, 30, 14, 14, P.stone);
  add(x, 14, z, 30.6, 0.8, 14.6, P.roof);
  for (const dx of [-8, 0, 8]) add(x + dx, 3, z + 7.05, 2, 6, 0.12, P.glass);
  for (const sx of [-1, 1]) {
    const tx = x + sx * 11;
    add(tx, 0, z + 4, 6, 26, 6, P.stone);
    add(tx, 26, z + 4, 5, 2, 5, P.roof);
    add(tx, 28, z + 4, 3.5, 4, 3.5, P.stone);
    add(tx, 32, z + 4, 2, 4, 2, P.stone);
    add(tx, 36, z + 4, 0.6, 3, 0.6, P.gilt);
    add(tx, 12, z + 7.05, 1.4, 3, 0.12, P.glass);
  }
  [[9, 4], [7, 4], [5, 4], [3, 4]].forEach(([w, h], i) => add(x, 14.8 + i * 4, z, w, h, w, P.leaf));
  add(x, 31, z, 0.6, 3, 0.6, P.gilt);
}
function estaiada(add, { x }) {
  const z = RIVER_Z;
  add(x, 3.6, z, 8, 1.2, 56, P.concrete);
  for (let y = 0; y < 46; y += 2) {
    const o = Math.abs(y - 20) * 0.27;
    for (const s of [-1, 1]) add(x + s * o, y, z, 2.2, 2, 2.2, P.concrete);
  }
  for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
    const top = 44 - k * 3, run = 6 + k * 5;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      for (const dx of [-1.8, 1.8]) add(x + dx, 4.8 + (top - 4.8) * (1 - t), z + side * run * t, 0.22, 0.22, 0.22, P.steel);
    }
  }
}
// Edifício Copan: ~46 m S-curve of slab segments; mid-grey core shows between projecting concrete floor bands
function copanTower(add, { x, z, len, amp, depth }) {
  const N = 10, step = len / N, H = 48;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, cx = x - len / 2 + t * len, cz = z + amp * Math.sin(2 * Math.PI * t);
    // neighbours overlap (same colours, depth staggered 0.04 on odd segments) so no gap shows between segments
    const w = step * 1.35, dd = depth - (i % 2) * 0.04;
    add(cx, 0.25, cz, w - 0.1, H - 0.25, depth - 0.8 - (i % 2) * 0.04, P.stone);
    for (let k = 0; k < 16; k++) add(cx, 0.5 + k * 3, cz, w, 1.9, dd, P.concrete);
    add(cx, H, cz, w, 0.4, dd, P.concrete);
    if (i === 2) add(cx, H + 0.4, cz, 3, 2, 3, P.steel);
    if (i === 6) add(cx, H + 0.4, cz, 2, 1.4, 4, P.roof);
  }
}
function paulista(add, x, i) {
  const z = RIVER_Z - 22;
  [[-8, 30 + (i % 3) * 8], [9, 44 - (i % 2) * 10]].forEach(([dx, h], j) => {
    const tx = x + dx, w = 9, t = j ? 4.4 : 4.5;
    add(tx, 0, z, w, h, w, P.glass);
    for (const [cx, cz] of [[-t, -t], [-t, t], [t, -t], [t, t]]) add(tx + cx, 0, z + cz, 1.06, h + 0.5, 1.06, P.concrete);
    for (let y = 6; y < h; y += 6) add(tx, y, z, w + 0.4, 0.8, w + 0.4, P.concrete);
    add(tx, h, z, w + 0.6, 1, w + 0.6, P.steel);
    add(tx, h + 1, z, 0.4, 5, 0.4, P.steel);
  });
}
export function buildSaoPaulo(add, stops, pts) {
  copanTower(add, copan(stops, pts));
  const at = (key) => pts[stopIndex(stops, LANDMARKS[key])];
  masp(add, at('masp'));
  se(add, at('se'));
  estaiada(add, at('estaiada'));
  const lm = new Set(Object.values(LANDMARKS));
  stops.forEach((s, i) => { if (s.country === 'BR' && !lm.has(s.id) && i < 6) paulista(add, pts[i].x, i); });
}
