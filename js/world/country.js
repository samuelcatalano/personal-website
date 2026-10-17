import { rng, RIVER_Z } from './layout.js';
import { PALETTE as P } from './palette.js';
import { house } from './houses.js';
import { draw } from './blocks.js';
const FLATS = [P.cream, P.sandstone, P.stone, P.terracotta, P.ochre, P.offWhite, P.redBrown, P.londonStock];
const WALL = [P.cream, P.brick, P.redBrown, P.londonStock, P.pinkStucco, P.blueStucco, P.mintStucco, P.lemonStucco, P.offWhite], ROOF = [P.brick, P.ink, P.roof, P.slate];
// Cheap semi/terrace (~14 boxes): body, eaves, pitched roof block, chimney, door, windows. Front faces o (+1: +z); the plain stand-in for houses.js `house` on rows far from the camera.
function villa(add, r, x, z, o, w, d, n) {
  const h = n * 2.8, f = z + o * d / 2, wall = WALL[r() * WALL.length | 0], roof = ROOF[r() * ROOF.length | 0], nc = w > 7.4 ? 3 : 2;
  add(x, 0, z, w, h, d, wall); add(x, h, z, w + 0.3, 0.4, d + 0.8, roof); add(x, h + 0.4, z, w * 0.7, 0.9, d * 0.6, roof);
  add(x + (r() < 0.5 ? -1 : 1) * w * 0.3, h + 0.5, z, 0.7, 1.6, 0.7, P.brick);
  add(x + (r() < 0.5 ? -w * 0.25 : w * 0.25), 0.1, f + o * 0.07, 1.1, 2.1, 0.14, pickDoor(r));
  for (let k = 0; k < n; k++) for (let c = 0; c < nc; c++) if (k || c !== (nc === 2 ? 0 : 1)) add(x + (c - (nc - 1) / 2) * w / nc, 0.9 + k * 2.8, f + o * 0.07, 1.1, 1.3, 0.14, r() < 0.07 ? P.lit : P.glass);
}
const pickDoor = (r) => [P.red, P.maroon, P.navy, P.white][r() * 4 | 0];
export const HUB_Y = 21.9, HUB_DZ = 1.4; // rotor centre above the tower, in front of the nacelle
function turbine(add, x, z) {
  add(x, 0, z, 0.9, 22, 0.9, P.white);
  add(x, 21.4, z, 1.5, 1.4, 2.6, P.white);
  return [x, HUB_Y, z + HUB_DZ]; // blades are separate rotating meshes (scene.js)
}
// Outskirts between the Eye and Glasgow, and again Glasgow -> Tower Bridge (regions()[leg].ctry; leg 1 reseeds and mirrors hills/turbines): suburban streets of terraces and semis, a few 3-4 storey flats, front gardens, footpaths, side streets, greens with trees and benches; hills and wind turbines far behind.
// Rows: A camera side (<= 2 floors, lo roofs), B road far side, B2 riverside (faces the river), C far bank facing the river + D flats behind it. Sidewalks along the road are city.js's kerbs (no longer skipped here).
export function buildCountry(add, curve, tree, [c0, c1], leg = 0) {
  const r = rng(4417 + leg * 977), q = rng(6101 + leg * 31), path = Array.from({ length: 241 }, (_, i) => curve.getPointAt(i / 240));
  const zr = (x) => path.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a).z, a = c0 + 12, b = c1 - 12; // 12 m margins: neighbours (London sub terraces, Glasgow edge) own the ends
  const oak = () => ({ h: 2.6 + r() * 1.2, crown: 1.8 + r() * 0.8 }), pick = (arr) => arr[r() * arr.length | 0];
  const SX = []; for (let x = a + 14 + r() * 8; x < b - 8; x += 30 + r() * 12) SX.push(x); // side streets, shared by all rows
  for (let x = c0; x < c1 - 0.1; x += 10) { // lawns under the rows: near side, road far side to the near bank (river path starts at -29.3), far bank
    const w = Math.min(10, c1 - x), xc = x + w / 2, z = zr(xc);
    add(xc, 0, z + 24.1, w, 0.05, 31.8, P.field2);
    add(xc, 0, (z - 8.2 - 29.3) / 2, w, 0.05, z - 8.2 + 29.3, P.field2);
    add(xc, 0, -80.5, w, 0.05, 39, P.field);
  }
  for (const s of SX) { // side streets, from the road pavement (ends 8.75 out) to the lawn ends
    const z = zr(s);
    add(s, -0.01, z + 24.4, 4.6, 0.12, 31.3, P.concreteMid);
    add(s, -0.01, (z - 8.75 - 29.3) / 2, 4.6, 0.12, z - 8.75 + 29.3, P.concreteMid);
    add(s, -0.01, -80.5, 4.6, 0.12, 39, P.concreteMid);
  }
  // row: zf(x) house-centre z, o facing, floors [lo, hi], low roofs, flats probability, green-gap probability, depth
  const row = (zf, o, [f0, f1], lo, blk, gap, rich, path = 1.2) => {
    for (let x = a; x < b;) {
      const flats = r() < blk, w = flats ? 11 + r() * 5 : 6 + r() * 3.5, d = flats ? 10 : 7 + r() * 1.5, s = SX.find((v) => v + 3.5 > x && v - 3.5 < x + w);
      if (s != null) { x = s + 3.5; continue; }
      const xc = x + w / 2, z = zf(xc);
      if (!flats && r() < gap) { // green: two trees and a bench
        tree(add, xc - 3, z + (r() - 0.5) * 2, oak()); tree(add, xc + 3, z + (r() - 0.5) * 2, oak());
        add(xc, 0.45, z - o * d * 0.5, 1.6, 0.1, 0.45, P.oak); add(xc, 0.55, z - o * d * 0.5 - o * 0.2, 1.6, 0.38, 0.08, P.oak);
        x += 12; continue;
      }
      const n = f0 + (r() * (f1 - f0 + 1) | 0);
      if (flats) draw(add, xc, z, [w, d, n, 3.2, pick(FLATS), P.white, 0, 1], r, q, false, false);
      else if (r() < rich) house(add, q, xc, z, o, w, d, lo ? 2 : n, 3.1, lo);
      else villa(add, r, xc, z, o, w, d, n);
      add(xc, -0.02, z + o * (d / 2 + path / 2 + 0.6), w, 0.12, path, P.stone); // footpath along the front
      if (r() < 0.5) tree(add, xc + (r() < 0.5 ? -1 : 1) * w * 0.3, z - o * (d / 2 + 2.5), oak());
      x += w + (r() < 0.5 ? 0.3 : 1.6);
    }
  };
  row((x) => zr(x) + 21, -1, [2, 2], 1, 0, 0.1, 0.4, 1.6); // A: camera side, <= 2 floors
  row((x) => zr(x) - 16.5, 1, [2, 3], 0, 0.22, 0.08, 0.4); // B: road far side
  row(() => -24, -1, [2, 2], 0, 0, 0.1, 0); // B2: riverside, facing the river
  row(() => -70, 1, [2, 3], 0, 0.2, 0.1, 0); // C: far bank
  row(() => -86, 1, [3, 4], 0, 0.45, 0.05, 0); // D: flats behind C
  const span = c1 - c0, at = (t) => c0 + span * (leg ? 1 - t : t);
  // far backdrop: stepped hills (green), three turbines
  add((c0 + c1) / 2, -1, -123, span + 20, 1, 46, P.field); // ponytail: the pave slab ends at z=-100, so the hills get their own green ground; hard edges at both ends
  [[0.1, -125, 60], [0.45, -128, 80], [0.8, -124, 66]].forEach(([t, z, w]) => {
    [[w, 5, 34], [w * 0.64, 5, 22], [w * 0.32, 4, 12]].reduce((y, [bw, bh, bd], k) => (add(at(t) + k * 3, y, z, bw, bh, bd, k ? P.field2 : P.hill), y + bh), 0);
  });
  return [0.28, 0.5, 0.74].map((t) => turbine(add, at(t), -104)); // hub positions
}
