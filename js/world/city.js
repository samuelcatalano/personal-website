import { RIVER_Z, LANDMARKS, rng } from './layout.js';

const GRASS = '#7b9470', PATCH = '#738968', ROAD = '#3b3f46', LINE = '#f4f4f4';
const BANK = '#b9a98a', PATH = '#d6c8aa', STONE = '#c9b79c', CREAM = '#f3ead2';
const UK_WALLS = [STONE, '#d9cdb8', '#9c7b65'];
const BR_WALLS = ['#f4d35e', '#ee964b', '#4ecdc4'];
const ROOF = '#5b4b49', GLASS = '#bfe3ff', WINDOW_LIT = '#ffd86b';
const TRUNK = '#7a5230', LEAF = '#3f8f3f', LEAF_SHADE = '#4b9d49', PHONE = '#d6211f';

function townhouse(add, x, z, side, br, r) {
  const w = 7.5, d = 7, floors = side === 1 ? 2 : br ? 2 + (r() < 0.25) : 2 + (r() < 0.6 ? 1 : 0);
  const h = floors * 2.8, wall = (br ? BR_WALLS : UK_WALLS)[Math.floor(r() * (br ? BR_WALLS.length : UK_WALLS.length))];
  const face = z - side * (d / 2 + 0.08);
  add(x, 0, z, w, h, d, wall);
  add(x, 0, z, w + 0.2, 0.38, d + 0.2, ROOF);             // stone plinth
  add(x, h - 0.25, z, w + 0.45, 0.3, d + 0.45, CREAM);    // cornice
  add(x, h, z, w + 0.7, 0.42, d + 0.7, ROOF);             // stepped roof edge
  add(x, h + 0.42, z, w * 0.74, 0.32, d * 0.72, wall);
  if (!br && r() < 0.5) add(x + (r() < 0.5 ? -2.4 : 2.4), h + 0.7, z, 0.65, 1.1, 0.7, ROOF);

  // Two aligned bays on each floor; a few warm panes give the street life after dark.
  for (let floor = 0; floor < floors; floor++) {
    for (const dx of [-1.9, 1.9]) {
      const y = 0.65 + floor * 2.8, lit = r() < 0.08;
      add(x + dx, y, face, 1.5, 1.9, 0.16, CREAM);          // inset surround and sill
      add(x + dx, y + 0.18, face - side * 0.1, 1.12, 1.48, 0.08, lit ? WINDOW_LIT : GLASS);
      if (br && floor > 0) add(x + dx, y - 0.18, face - side * 0.24, 1.65, 0.16, 0.5, PATH); // balcony
    }
  }
  add(x, 0.12, face, 1.55, 2.38, 0.2, CREAM);
  add(x, 0.25, face - side * 0.14, 1.12, 2.02, 0.1, ROOF);
  add(x, 1.7, face - side * 0.21, 0.18, 0.18, 0.08, WINDOW_LIT); // door glass
}

function broadleaf(add, x, z, r) {
  const h = 3.4 + r() * 1.3, crown = 2.8 + r() * 1.2;
  add(x, 0, z, 0.45, h, 0.45, TRUNK);
  add(x, h - 0.6, z, crown, 1.8, crown, LEAF);
  add(x - crown * 0.28, h + 0.35, z + crown * 0.2, crown * 0.62, 1.6, crown * 0.62, LEAF_SHADE);
  add(x + crown * 0.25, h + 0.15, z - crown * 0.24, crown * 0.58, 1.4, crown * 0.58, LEAF);
}

function palm(add, x, z) {
  add(x, 0, z, 0.45, 4.2, 0.45, TRUNK);
  for (const [dx, dz, w, d] of [[2, 0, 3.8, 0.65], [-2, 0, 3.8, 0.65], [0, 2, 0.65, 3.8], [0, -2, 0.65, 3.8]]) {
    add(x + dx * 0.35, 4.1, z + dz * 0.35, w, 0.35, d, LEAF);
  }
}

export function buildCity(add, stops, pts, curve) {
  const r = rng(2026), LM = new Set(Object.values(LANDMARKS));
  const span = pts.length * 30 + 120, N = pts.length * 20;
  add(0, -1, 0, span, 1, 200, GRASS);

  // Thames banks sit just outside the water span; short stone blocks and reeds break the long edge.
  for (const side of [-1, 1]) {
    const edge = RIVER_Z + side * 12;
    add(0, -0.08, edge, span, 0.18, 2.2, BANK);
    add(0, 0.02, edge + side * 2.1, span, 0.12, 3.2, PATH);
    for (let x = -span / 2 + 7; x < span / 2; x += 18) {
      add(x, 0.02, edge + side * 3.1, 1.2, 0.42, 0.7, PATCH);
      add(x + 1.3, 0.02, edge + side * 3.1, 0.55, 0.7, 0.55, LEAF);
    }
  }

  // Sidewalk and curb strips follow the same route samples as the road.
  for (let i = 0; i <= N; i += 2) {
    const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N);
    const nx = -t.z, nz = t.x;
    add(p.x, -0.18, p.z, 8.5, 0.25, 8.5, ROAD);
    if (i % 6 === 0) add(p.x, 0.05, p.z, 1.2, 0.03, 0.3, LINE);
    for (const side of [-1, 1]) {
      add(p.x + nx * side * 4.55, -0.01, p.z + nz * side * 4.55, 5.2, 0.18, 0.42, BANK);
      add(p.x + nx * side * 7.1, -0.02, p.z + nz * side * 7.1, 5.2, 0.12, 2.7, PATH);
    }
    if (i % 16 === 8) {
      for (const side of [-1, 1]) {
        const x = p.x + nx * side * 9.4, z = p.z + nz * side * 9.4;
        add(x, 0, z, 0.16, 3, 0.16, ROOF);
        add(x, 3, z, 0.7, 0.2, 0.7, WINDOW_LIT);
      }
    }
  }

  // Small planted courts sit between the sidewalk and the grouped street fronts.
  pts.forEach((p, i) => {
    const br = stops[i].country === 'BR';
    for (const side of [-1, 1]) {
      add(p.x, 0, p.z + side * 10.5, 25, 0.035, 3.2, i % 2 ? GRASS : PATCH);
      if (side === -1 && LM.has(stops[i].id)) continue; // keep the landmark-side view clear
      for (const dx of [-9, 0, 9]) {
        if (side === 1 && stops[i].id === 'contact' && dx === 0) continue; // keep the closing bus view clear
        townhouse(add, p.x + dx, p.z + side * (side === 1 ? 21 : 17), side, br, r);
      }
      for (const dx of [-8, 8]) {
        const x = p.x + dx + (r() - 0.5) * 2, z = p.z + side * 10.2;
        br ? palm(add, x, z) : broadleaf(add, x, z, r);
      }
      if (!br && i % 2 === 0) {
        add(p.x + 4, 0, p.z + side * 11.2, 1.2, 2.5, 1.2, PHONE);
        add(p.x + 4, 2.5, p.z + side * 11.2, 1.4, 0.3, 1.4, ROOF);
      }
    }
  });
}
