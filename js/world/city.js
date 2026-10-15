import { RIVER_Z, LANDMARKS, rng } from './layout.js';

const GRASS = '#7cb66b', ROAD = '#3b3f46', LINE = '#f4f4f4', WATER = '#4f86b8', BANK = '#b9a98a';
const UK_WALLS = ['#c9b79c', '#b8a48a', '#d9cdb8', '#9c7b65', '#e2d6c2', '#8d8f94'];
const BR_WALLS = ['#f4d35e', '#ee964b', '#4ecdc4', '#f95738', '#90be6d', '#f7f7f2'];
const ROOF = '#5b4b49', WINDOW = '#ffd86b', TRUNK = '#7a5230', LEAF = '#3f8f3f', PALM = '#2f9e44';

export function buildCity(add, stops, pts, curve) {
  const r = rng(2026);
  const LM = new Set(Object.values(LANDMARKS));
  const span = pts.length * 30 + 120;

  add(0, -1, 0, span, 1, 200, GRASS);                       // ground
  add(0, -0.9, RIVER_Z, span, 1, 22, WATER);                // Thames
  add(0, -0.95, RIVER_Z + 12, span, 1, 2, BANK);
  add(0, -0.95, RIVER_Z - 12, span, 1, 2, BANK);

  // Road: overlapping square tiles along the curve keep the blocky look.
  const N = pts.length * 20;
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    add(p.x, -0.2, p.z, 7, 0.25, 7, ROAD);
    if (i % 3 === 0) add(p.x, 0.04, p.z, 1.2, 0.03, 0.3, LINE);
  }

  // Buildings beside each stop. Brazil stops are low and colourful with palms; London is taller and stone-coloured.
  pts.forEach((p, i) => {
    const br = stops[i].country === 'BR';
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const x = p.x - 12 + k * 5 + r() * 2;
      const z = p.z + side * (12 + r() * 10);
      if (Math.abs(z - RIVER_Z) < 16) continue;
      if (side === -1 && LM.has(stops[i].id)) continue; // keep landmarks visible
      const w = 4 + Math.floor(r() * 3), d = 4 + Math.floor(r() * 3);
      const h = br ? 3 + Math.floor(r() * 4) : side === 1 ? 2 + Math.floor(r() * 3) : 6 + Math.floor(r() * 12);
      const walls = br ? BR_WALLS : UK_WALLS;
      add(x, 0, z, w, h, d, walls[Math.floor(r() * walls.length)]);
      add(x, h, z, w + 0.4, 0.6, d + 0.4, ROOF);
      for (let y = 1.5; y < h - 1; y += 2.5) {               // window strips facing the road
        add(x, y, z - side * (d / 2 + 0.02), w - 1, 1, 0.05, WINDOW);
      }
    }
    for (let k = 0; k < 3; k++) {                            // trees / palms
      const x = p.x - 10 + r() * 20, z = p.z + (r() > 0.5 ? 1 : -1) * (6 + r() * 3);
      if (br) { add(x, 0, z, 0.6, 5, 0.6, TRUNK); add(x, 5, z, 3.5, 0.6, 1, PALM); add(x, 5, z, 1, 0.6, 3.5, PALM); }
      else { add(x, 0, z, 0.6, 2, 0.6, TRUNK); add(x, 2, z, 2.4, 2.4, 2.4, LEAF); }
    }
    if (!br && i % 2 === 0) {                                // red phone box
      add(p.x + 4, 0, p.z + 5.5, 1.2, 2.6, 1.2, '#c8102e');
      add(p.x + 4, 2.6, p.z + 5.5, 1.4, 0.3, 1.4, '#a00d25');
    }
  });
}
