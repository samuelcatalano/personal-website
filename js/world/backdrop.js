import { regions, glasgowSites, rng } from './layout.js';
import { PALETTE as P } from './palette.js';

export function buildBackdrop(add, stops, pts) {
  const r = rng(90817), [out, back] = regions(stops, pts), { museum } = glasgowSites(stops, pts);
  const x0 = pts[0].x - 230, x1 = pts.at(-1).x + 230, rows = [-130, -170, -220, -280, -350, -440];
  const colors = [P.cream, P.stone, P.taupe, P.roof, P.brick, P.redBrown, P.londonStock, P.pinkStucco, P.blueStucco, P.mintStucco, P.lemonStucco];
  const distantColors = [P.stone, P.concreteMid, P.taupe, P.steel];
  const museumL = museum.x - museum.w / 2 - 12, museumR = museum.x + museum.w / 2 + 12;
  const regionsCtry = [out.ctry, back.ctry], hill = (x, z, w, scale = 1) => {
    if (x - w / 2 < museumR && x + w / 2 > museumL) return;
    const h = (2 + r() * 3) * scale;
    add(x, 0, z, w, h, 22, P.hill);
    add(x + (r() - 0.5) * w * 0.12, h, z - 2, w * 0.62, 2 * scale, 14, P.field2);
  };
  // Continuous low ground lets the existing fog hide the finite world edge.
  add((pts[0].x + pts.at(-1).x) / 2, -1.3, 0, x1 - x0 + 2000, 0.2, 2200, P.field);

  for (let row = 0; row < rows.length; row++) {
    for (let x = x0; x < x1;) {
      const z = rows[row] + (r() - 0.5) * 10, w = 9 + r() * 4, gap = 2 + r() * 2, xc = x + w / 2;
      const distances = regionsCtry.map(([a, b]) => x < a ? a - (x + w) : x > b ? x - b : -1);
      const distance = Math.min(...distances), countryside = distance <= 0 ? 1 : Math.max(0, 1 - distance / 65);
      const museumClear = xc - w / 2 < museumR && xc + w / 2 > museumL;
      const countryBuffer = regionsCtry.some(([a, b]) => x + w > a - 20 && x < b + 20);
      if (!museumClear && (countryBuffer || countryside && r() < countryside || distance <= 0)) hill(xc, z - 8, w, 0.8 + 0.2 * countryside);
      else if (!museumClear) {
        const near = row === 0 ? -110 : (rows[row - 1] + rows[row]) / 2;
        const far = row === rows.length - 1 ? -475 : (rows[row] + rows[row + 1]) / 2;
        add(xc + gap / 2, -0.08, (near + far) / 2, w + gap, 0.08, near - far, P.pave);
        const floors = row < 2 ? 2 + (r() * 3 | 0) : 2 + (r() * 6 | 0);
        const depth = row === 0 ? 8 : 11;
        const wall = (row < 2 ? colors : distantColors)[r() * (row < 2 ? colors : distantColors).length | 0];
        const roof = row === 0 ? [P.roof, P.brick, P.ink][r() * 3 | 0] : wall, h = floors * 2.8;
        add(xc, 0, z, w, h, depth, wall);
        add(xc, h, z, w + 0.3, 0.35, depth + 0.4, roof);
        if (row === 0) {
          add(xc, h + 0.35, z, w * 0.62, 0.75, depth * 0.62, roof);
          for (let f = 0; f < floors; f += 2) add(xc + (r() - 0.5) * w * 0.45, f * 2.8 + 1.5, z + depth / 2 + 0.08, 1.1, 1.4, 0.12, r() < 0.07 ? P.lit : P.glass);
          add(xc - w * 0.28, 0.9, z + depth / 2 + 0.09, 0.9, 1.8, 0.14, P.maroon);
        }
      }
      x += w + gap;
    }
  }
  // Low stepped ridges sit beyond the neighborhoods without making a skyline wall.
  for (let x = x0; x < x1; x += 38) {
    if (regionsCtry.some(([a, b]) => x + 38 > a && x < b)) continue;
    const w = Math.min(38, x1 - x);
    hill(x + w / 2, -475, w, 1);
  }
}
