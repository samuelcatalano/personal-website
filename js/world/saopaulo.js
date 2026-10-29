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
  for (const dx of [-8, 8]) add(x + dx, 3, z + 7.05, 2, 6, 0.12, P.glass);
  add(x, 0, z + 7.2, 14, 1.5, 0.4, P.stone);
  for (let i = 0; i < 6; i++) add(x, 0, z + 7.4 + (i + 0.5) * 0.8, 14, 1.5 - i * 0.25, 0.8, P.stone);
  add(x, 1.5, z + 7.1, 3.2, 5, 0.2, P.roof);
  for (const sx of [-1, 1]) {
    const tx = x + sx * 11;
    add(tx, 0, z + 4, 6, 26, 6, P.stone);
    for (let i = 0; i < 10; i++) {
      const w = 5.6 - i * 0.54;
      add(tx, 26 + i, z + 4, w, 1, w, P.verdigris);
    }
    add(tx, 36, z + 4, 0.6, 3, 0.6, P.gilt);
    add(tx, 12, z + 7.05, 1.4, 3, 0.12, P.glass);
  }
  // Elliptical dome in circular rows, sharing the existing instanced box batches.
  for (let i = 0; i < 10; i++) {
    const radius = 7 * Math.sqrt(1 - ((i + 0.5) / 10) ** 2);
    for (let dz = -6.5; dz <= 6.5; dz++) {
      if (Math.abs(dz) >= radius) continue;
      add(x, 14.8 + i * 0.9, z + dz, 2 * Math.sqrt(radius ** 2 - dz ** 2), 0.9, 1, P.verdigris);
    }
  }
  add(x, 23.8, z, 2.4, 2, 2.4, P.verdigris);
  add(x, 25.8, z, 1.8, 1, 1.8, P.verdigris);
  add(x, 26.8, z, 0.6, 3, 0.6, P.gilt);
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
// Edifício Copan: S-curve of slab segments; mid-grey core shows between projecting concrete floor bands
function copanTower(add, { x, z, len, amp, depth, h: H }) {
  const N = 10, step = len / N;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, cx = x - len / 2 + t * len, cz = z + amp * Math.sin(2 * Math.PI * t);
    // neighbours overlap (same colours, depth staggered 0.04 on odd segments) so no gap shows between segments
    const w = step * 1.35, dd = depth - (i % 2) * 0.04;
    add(cx, 0.25, cz, w - 0.1, H - 0.25, depth - 0.8 - (i % 2) * 0.04, P.stone);
    for (let k = 0; k < H / 3; k++) add(cx, 0.5 + k * 3, cz, w, 1.9, dd, P.concrete);
    add(cx, H, cz, w, 0.4, dd, P.concrete);
    if (i === 2) add(cx, H + 0.4, cz, 3, 2, 3, P.steel);
    if (i === 6) add(cx, H + 0.4, cz, 2, 1.4, 4, P.roof);
  }
}
function paulista(add, x, i, onArchitecturePlot, rollout, stopId) {
  const z = RIVER_Z - 22;
  [[-8, 30 + (i % 3) * 8], [9, 44 - (i % 2) * 10]].forEach(([dx, h], j) => {
    if (stopId === 'arizona' && j === 0) return; // flanked the Sé's right side (owner request)
    if (stopId === 'insane' && j === 1) return; // that tower stood right behind MASP's left column (owner request)
    const tx = x + dx, w = 9, t = j ? 4.4 : 4.5;
    if (onArchitecturePlot && (i === 0 || rollout)) {
      // Preserve the existing columns/crown/antenna envelope, replacing only hero decoration.
      onArchitecturePlot({ id: `paulista-${stopId}-${j}`, kind: h + 6 >= 40 ? 'tower' : 'office', x: tx, z, width: 2 * (t + .53), depth: 2 * (t + .53), height: h + 6 });
      return;
    }
    add(tx, 0, z, w, h, w, P.glass);
    for (const [cx, cz] of [[-t, -t], [-t, t], [t, -t], [t, t]]) add(tx + cx, 0, z + cz, 1.06, h + 0.5, 1.06, P.concrete);
    for (let y = 6; y < h; y += 6) add(tx, y, z, w + 0.4, 0.8, w + 0.4, P.concrete);
    add(tx, h, z, w + 0.6, 1, w + 0.6, P.steel);
    add(tx, h + 1, z, 0.4, 5, 0.4, P.steel);
  });
}
export function buildSaoPaulo(add, stops, pts, onArchitecturePlot, rollout = false, onMasp, onSe, onEstaiada, onCopan) {
  if (onCopan) onCopan(copan(stops, pts)); else copanTower(add, copan(stops, pts)); // ponytail: voxel fallback kept for headless tests
  const at = (key) => pts[stopIndex(stops, LANDMARKS[key])];
  if (onMasp) onMasp(at('masp'));
  else masp(add, at('masp'));
  if (onSe) onSe(at('se')); else se(add, at('se')); // ponytail: voxel fallbacks kept for headless tests that pass no geometry callbacks
  if (onEstaiada) onEstaiada(at('estaiada')); else estaiada(add, at('estaiada'));
  const lm = new Set(Object.values(LANDMARKS));
  stops.forEach((s, i) => { if (s.country === 'BR' && !lm.has(s.id) && i < 6) paulista(add, pts[i].x, i, onArchitecturePlot, rollout, s.id); });
}
