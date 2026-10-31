import { rng } from './layout.js';
import { PALETTE as P } from './palette.js';
import { house } from './houses.js';
import { draw } from './blocks.js';
const FLATS = [P.cream, P.sandstone, P.stone, P.terracotta, P.ochre, P.offWhite, P.redBrown, P.londonStock];
const WALL = [P.cream, P.brick, P.redBrown, P.londonStock, P.pinkStucco, P.blueStucco, P.mintStucco, P.lemonStucco, P.offWhite], ROOF = [P.brick, P.ink, P.roof, P.slate];
const gardenVariation = (x, z, slot = 0) => Math.abs(Math.sin(x * 12.9898 + z * 78.233 + slot * 37.719) * 43758.5453) % 1;
const GARDEN_TINTS = [P.white, P.offWhite, P.tileCream, P.gravel];
// Cheap semi/terrace (~14 boxes): body, eaves, pitched roof block, chimney, door, windows. Front faces o (+1: +z); the plain stand-in for houses.js `house` on rows far from the camera.
function villa(add, r, x, z, o, w, d, n) {
  const h = n * 2.8, f = z + o * d / 2, wall = WALL[r() * WALL.length | 0], roof = ROOF[r() * ROOF.length | 0], nc = w > 7.4 ? 3 : 2;
  add(x, 0, z, w, h, d, wall); add(x, h, z, w + 0.3, 0.4, d + 0.8, roof); add(x, h + 0.4, z, w * 0.7, 0.9, d * 0.6, roof);
  add(x + (r() < 0.5 ? -1 : 1) * w * 0.3, h + 0.5, z, 0.72, 1.6, 0.7, P.brick);
  add(x + (r() < 0.5 ? -w * 0.25 : w * 0.25), 0.1, f + o * 0.07, 1.1, 2.1, 0.14, pickDoor(r)); // windows below are 0.01 proud sideways/front and 0.01 lower than the door: no shared planes
  for (let k = 0; k < n; k++) for (let c = 0; c < nc; c++) if (k || c !== (nc === 2 ? 0 : 1)) add(x + (c - (nc - 1) / 2) * w / nc, 0.9 + k * 2.8, f + o * 0.07, 1.12, 1.29, 0.16, r() < 0.07 ? P.lit : P.glass);
}
const pickDoor = (r) => [P.red, P.maroon, P.navy, P.white][r() * 4 | 0];
// Residential streets between the Eye and Glasgow, and again Glasgow -> Tower Bridge (regions()[leg].ctry).
// Rows: A camera side (<= 2 floors, lo roofs), B road far side, B2 riverside (faces the river), C far bank facing the river + D flats behind it. Sidewalks along the road are city.js's kerbs (no longer skipped here).
export function buildCountry(add, curve, tree, [c0, c1], leg = 0, onArchitecturePlot) {
  const r = rng(4417 + leg * 977), q = rng(6101 + leg * 31), path = Array.from({ length: 241 }, (_, i) => curve.getPointAt(i / 240));
  const zr = (x) => path.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a).z, a = c0 + 12, b = c1 - 12; // 12 m margins: neighbours (London sub terraces, Glasgow edge) own the ends
  const countryFlatPlot = onArchitecturePlot && ((p) => onArchitecturePlot(p.id === 'country-flat-0-5-0' ? { ...p, archetype: 'country-garden-flat' } : p));
  const oak = () => ({ h: 2.6 + r() * 1.2, crown: 1.8 + r() * 0.8 }), pick = (arr) => arr[r() * arr.length | 0];
  const SX = []; for (let x = a + 14 + r() * 8; x < b - 8; x += 30 + r() * 12) SX.push(x); // side streets, shared by all rows
  for (let x = c0; x < c1 - 0.1; x += 10) { // paved urban ground: near side, road far side to the near bank (river path starts at -29.3), far bank
    const w = Math.min(10, c1 - x + 0.3), xc = x + w / 2, z = zr(xc);
    add(xc, 0, z + 24.1, w, 0.05, 31.8, P.pave);
    add(xc, 0, (z - 8.2 - 29.3) / 2, w, 0.05, z - 8.2 + 29.3, P.pave);
    add(xc, 0, -89.5, w, 0.05, 57, P.pave);
  }
  for (const s of SX) { // side streets, from the road pavement (ends 8.75 out) to the paved edge
    const z = zr(s);
    add(s, -0.01, z + 24.4, 4.6, 0.12, 31.3, P.concreteMid);
    add(s, -0.01, (z - 8.75 - 29.3) / 2 + 0.01, 4.6, 0.12, z - 8.75 + 29.28, P.concreteMid); // 0.02 short of the lawn ends: no shared end planes
    add(s, -0.01, -80.5, 4.6, 0.12, 38.96, P.concreteMid);
  }
  // row: zf(x) house-centre z, o facing, floors [lo, hi], low roofs, flats probability, green-gap probability, depth
  let rowId = 0;
  const row = (zf, o, [f0, f1], lo, blk, gap, rich, path = 1.2, start = a) => {
    const rowKey = rowId++; let lot = 0;
    for (let x = start; x < b;) {
      const flats = r() < blk, w = flats ? 11 + r() * 5 : 6 + r() * 3.5, d = flats ? 10 : 7 + r() * 1.5, s = SX.find((v) => v + 3.5 > x && v - 3.5 < x + w);
      if (s != null) { x = s + 3.5; continue; }
      const xc = x + w / 2, z = zf(xc);
      if (!flats && r() < gap) { // bounded pocket garden: two trees and a bench
        add(xc, 0.01, z, 8, 0.06, 6, P.grass);
        tree(add, xc - 3, z + (r() - 0.5) * 2, oak()); tree(add, xc + 3, z + (r() - 0.5) * 2, oak());
        add(xc, 0.45, z - o * d * 0.5, 1.6, 0.1, 0.45, P.oak); add(xc, 0.55, z - o * d * 0.5 - o * 0.2, 1.6, 0.38, 0.08, P.oak);
        if (add.plant) {
          const tint = slot => GARDEN_TINTS[gardenVariation(xc, z, slot) * GARDEN_TINTS.length | 0], yaw = slot => (gardenVariation(xc, z, slot + 6) - 0.5) * 0.12;
          let slot = 0;
          for (const dx of [-1.2, 1.2]) for (const dz of [-2.35, 2.35]) { add.plant('shrub', xc + dx, 0.05, z + dz, 0.9, 0.76, 0.56, tint(slot), yaw(slot)); slot++; }
          for (const dz of [-2.5, 2.5]) { add.plant('flower', xc, 0.05, z + dz, 0.72, 0.85, 0.62, tint(slot), yaw(slot)); slot++; }
        }
        x += 12; continue;
      }
      const n = f0 + (r() * (f1 - f0 + 1) | 0);
      if (flats) draw(add, xc, z, [w, d, n, 3.2, pick(FLATS), P.white, 0, 1], r, q, false, false, countryFlatPlot, `country-flat-${leg}-${rowKey}-${lot++}`);
      else if (r() < rich) {
        const floors = lo ? 2 : n;
        if (onArchitecturePlot) onArchitecturePlot({ id: `country-house-${leg}-${rowKey}-${lot++}`, kind: 'terrace', x: xc, z, width: w, depth: d, height: floors * 3.1 + (lo ? 0.6 : 2.7) });
        house(onArchitecturePlot ? () => {} : add, q, xc, z, o, w, d, floors, 3.1, lo);
      } else {
        if (onArchitecturePlot) onArchitecturePlot({ id: `country-villa-${leg}-${rowKey}-${lot++}`, kind: 'terrace', x: xc, z, width: w, depth: d, height: n * 2.8 + 1.3 });
        villa(onArchitecturePlot ? () => {} : add, r, xc, z, o, w, d, n);
      }
      add(xc, -0.02, z + o * (d / 2 + path / 2 + 0.6), w, 0.12, path, P.stone); // footpath along the front
      if (r() < 0.5) tree(add, xc + (r() < 0.5 ? -1 : 1) * w * 0.3, z - o * (d / 2 + 2.5), oak());
      x += w + (r() < 0.5 ? 0.3 : 1.6);
    }
  };
  row((x) => zr(x) + 21, -1, [2, 2], 1, 0, 0.1, 0.4, 1.6); // A: camera side, <= 2 floors
  row((x) => zr(x) - 16.5, 1, [2, 3], 0, 0.22, 0.08, 0.4, 1.2, a + (leg ? 24 : 0)); // B: road far side; clears Glasgow's existing exit housing
  row(() => -24, -1, [2, 2], 0, 0, 0.1, 0, 1.2, a + (leg ? 24 : 0)); // B2: riverside, facing the river
  row(() => -70, 1, [2, 3], 0, 0.2, 0.1, 0); // C: far bank
  row(() => -86, 1, [3, 4], 0, 0.45, 0.05, 0); // D: flats behind C
  row(() => -101, 1, [3, 5], 0, 0.6, 0.01, 0.35); // dense outer residential skyline
  row(() => -114, 1, [3, 5], 0, 0.6, 0.01, 0.35); // back row ends before the distant horizon at z=-121
  // The cross streets end at z=-100; their rear-row gaps fit low cottages without crossing paths or existing lots.
  const infillR = rng(73193 + leg * 997), infillGeometryR = rng(83219 + leg * 1009);
  let infillId = 0;
  const addInfill = (x, z, depth, archetype) => {
    const width = 5.1 + infillR() * 0.35, height = 2 * 2.8 + 1.3;
    if (onArchitecturePlot) onArchitecturePlot({ id: `country-infill-${leg}-${infillId++}`, kind: 'terrace', archetype, x, z, width, depth, height });
    else villa(add, infillGeometryR, x, z, 1, width, depth, 2);
    add(x, -0.02, z + depth / 2 + 1.2, width, 0.12, 1.2, P.stone);
  };
  for (const s of SX) {
    addInfill(s, -105, 6.2, 'country-garden-pair');
    addInfill(s, -114.2, 7.4, 'country-slate-cottage');
  }
  return [];
}
