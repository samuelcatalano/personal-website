import { rng, RIVER_Z } from './layout.js';
import { PALETTE as P } from './palette.js';
const FIELDS = [P.field, P.field2, P.crop, P.patch], WALLS = [P.stone, P.cream, P.offWhite, P.sandstone], ROOFS = [P.roof, P.brick, P.ink], HEDGE = P.hedge;
function cottage(add, r, x, z, o, big) { // low stone cottage / barn, front faces o (+1: +z); <= 4.6 m tall
  const w = big ? 11 : 6.5 + r() * 2, d = big ? 7 : 5, h = big ? 3.4 : 2.7, wall = big ? P.oak : WALLS[r() * WALLS.length | 0], roof = ROOFS[r() * ROOFS.length | 0], f = z + o * d / 2;
  add(x, 0, z, w, h, d, wall);
  add(x, h, z, w + 0.7, 0.55, d + 0.7, roof);
  add(x, h + 0.55, z, w * 0.62, 0.55, d * 0.6, roof);
  if (big) { add(x, 0.1, f + o * 0.08, 3.4, 2.6, 0.16, P.roof); return; }
  add(x + w * 0.28, h + 0.5, z, 0.8, 1.3, 0.8, P.brick);
  add(x - w * 0.12, 0, f + o * 0.08, 1.1, 2, 0.16, P.maroon);
  for (const dx of [-w * 0.34, w * 0.3]) add(x + dx, 1, f + o * 0.08, 1.1, 1, 0.16, P.glass);
}
function turbine(add, x, z) {
  add(x, 0, z, 0.9, 22, 0.9, P.white);
  add(x, 21.4, z, 1.5, 1.4, 2.6, P.white);
  add(x, 17.4, z + 1.4, 0.5, 9, 0.3, P.white); add(x, 21.65, z + 1.4, 9, 0.5, 0.3, P.white);
}
// Open country between the Eye and Glasgow, and again Glasgow -> Tower Bridge (regions()[leg].ctry; leg 1 mirrors the farms/hills/turbines and reseeds): fields + hedgerows, scattered broadleaf, a few cottages, hills and wind turbines far behind.
// Camera side (+z) stays <= ~4.8 m (hedges 1 m, small trees). ~400 boxes.
export function buildCountry(add, curve, tree, [c0, c1], leg = 0) {
  const r = rng(4417 + leg * 977), path = Array.from({ length: 241 }, (_, i) => curve.getPointAt(i / 240));
  const zr = (x) => path.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a).z, cols = (a, b, lo, hi) => { const o = []; for (let x = a; x < b - 6;) { const w = Math.min(lo + r() * (hi - lo), b - x); o.push([x, x + w]); x += w; } return o; };
  const hedge = (x, z, w, d, h = 1.1) => add(x, 0, z, w, h, d, HEDGE);
  // rows: [z start fn, z end fn, hedge height]; every field alternates colour, shares its west hedge, and gets a far-edge hedge
  const row = (a, b, lo, hi, h) => cols(c0, c1, lo, hi).forEach(([x0, x1], k) => {
    const xc = (x0 + x1) / 2, [za, zb] = [a(xc), b(xc)], zc = (za + zb) / 2, dz = Math.abs(zb - za);
    add(xc, 0, zc, x1 - x0, 0.05, dz, FIELDS[((r() * 4 | 0) + k) % 4]);
    hedge(x0, zc, 0.9, dz, h); hedge(xc, zb, x1 - x0, 0.9, h);
    if (r() < 0.5) hedge(xc, zc, x1 - x0, 0.6, h * 0.8); // ponytail: decorative second hedge splits the plot, no gate gaps
  });
  const nearA = (x) => zr(x) + 3.5, farA = (x) => zr(x) - 3.5, edgeN = RIVER_Z + 15.5, edgeF = RIVER_Z - 17;
  row(nearA, (x) => nearA(x) + 34, 20, 30, 1);
  row(farA, () => edgeN, 20, 30, 1.3);
  row(() => edgeF, () => edgeF - 34, 28, 40, 1.4);
  // scattered broadleaf: field edges, a copse, never within 8 m of the tarmac
  const oak = (big) => ({ h: (big ? 3.4 : 2.6) + r() * (big ? 1.4 : 0.7), crown: (big ? 2.4 : 1.8) + r() * 0.6 });
  const span = c1 - c0, scatter = (n, z, jit, big) => { for (let i = 0; i < n; i++) { const x = c0 + 4 + r() * (span - 8); tree(add, x, z(x) + (r() - 0.5) * jit, oak(big)); } };
  scatter(12, (x) => zr(x) + 10.5, 3, 0); // roadside hedge trees, small
  scatter(16, () => RIVER_Z + 18, 9, 1);
  scatter(12, () => RIVER_Z - 24, 10, 1);
  for (let c = 0; c < 2; c++) { const cx = c0 + span * (0.3 + 0.4 * c), cz = RIVER_Z - 25 - c * 4; for (let k = 0; k < 6; k++) tree(add, cx + (r() - 0.5) * 12, cz + (r() - 0.5) * 9, oak(1)); }
  // farms: cottages + a barn on the far banks, one low cottage on the camera side
  const at = (t) => c0 + span * (leg ? 1 - t : t);
  cottage(add, r, at(0.24), RIVER_Z + 20, 1, 0); cottage(add, r, at(0.62), RIVER_Z + 18, 1, 0); cottage(add, r, at(0.7), RIVER_Z + 20, 1, 1);
  cottage(add, r, at(0.4), RIVER_Z - 22, 1, 0); cottage(add, r, at(0.85), RIVER_Z - 26, 1, 0);
  cottage(add, r, at(0.5), zr(at(0.5)) + 28, -1, 0);
  // far backdrop: stepped hills (green), three turbines
  add((c0 + c1) / 2, -1, -123, span + 20, 1, 46, P.field); // ponytail: the pave slab ends at z=-100, so the hills get their own green ground; hard edges at both ends
  [[0.1, -125, 60], [0.45, -128, 80], [0.8, -124, 66]].forEach(([t, z, w]) => {
    [[w, 5, 34], [w * 0.64, 5, 22], [w * 0.32, 4, 12]].reduce((y, [bw, bh, bd], k) => (add(at(t) + k * 3, y, z, bw, bh, bd, k ? P.field2 : P.hill), y + bh), 0);
  });
  [0.28, 0.5, 0.74].forEach((t) => turbine(add, at(t), -104));
}
