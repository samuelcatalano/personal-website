import { PALETTE as P } from './palette.js';
const WALLS = [P.steel, P.oak, P.pearl, P.cream, P.brick, P.redBrown, P.londonStock, P.pinkStucco, P.blueStucco, P.mintStucco, P.lemonStucco], ROOFS = [P.brick, P.ink, P.roof], DOORS = [P.red, P.maroon, P.white, P.navy], W = P.white;
// Georgian townhouse. Front faces o (+1: +z, -1: -z); `q` is a seeded rng. Every detail sits proud of the wall by >= 0.03.
export function house(add, q, x, z, o, w, d, n, fh = 3.1, lo = false) {
  const h = n * fh, f = z + o * d / 2, nc = Math.max(2, Math.round(w / 3)), pick = (a) => a[q() * a.length | 0];
  const F = (cx, y, bw, bh, front, col, back = -front / 2) => add(cx, y, f + o * (front + back) / 2, bw, bh, front - back, col);
  const wall = pick(WALLS), roof = pick(ROOFS), door = pick(DOORS), dc = q() < 0.5 ? 0 : nc - 1, bal = n > 2 && q() < 0.4, bc = q() * nc | 0;
  add(x, 0, z, w, h, d, wall);
  add(x, 0, z, w + 0.2, 0.5, d + 0.2, P.taupe);
  add(x, h - 0.3, z, w + 0.2, 0.36, d + 0.4, W);
  add(x, h + 0.06, z, w, 1, d + 0.8, roof);
  const A = lo ? () => {} : add; // lo (camera-side rows): one low roof slab, no steps/chimney/dormers, so nothing rises into the frame
  A(x, h + 1.06, z, w * 0.8, 1, d * 0.8, roof);
  A(x, h + 2.06, z, w * 0.4, 0.8, d * 0.55, roof);
  const cx = x + (q() < 0.5 ? -1 : 1) * (w / 2 - 0.7), cz = z - o * d * 0.2;
  A(cx, h + 1.06, cz, 0.9, 1.5, 0.9, P.brick);
  const P0 = d * 0.4 + 0.45; // dormer front, behind the eave
  for (const dx of q() < 0.5 ? [0] : [-w * 0.28, w * 0.28]) {
    A(x + dx, h + 1.06, z + o * (d * 0.4 - 0.2), 1.5, 1.4, 1.3, W);
    A(x + dx, h + 1.36, z + o * (P0 + 0.02), 0.9, 0.8, 0.08, P.glass);
    A(x + dx, h + 2.46, z + o * (d * 0.4 - 0.2), 1.9, 0.25, 1.6, roof);
  }
  for (let k = 0; k < n; k++) {
    const y = k * fh;
    if (k) F(x, y, w + 0.1, 0.28, 0.2, W);
    for (let c = 0; c < nc; c++) {
      const wx = x + (c - (nc - 1) / 2) * 3;
      if (!k && c === dc) {
        F(wx, 0, 1.9, 0.3, 0.7, W);
        F(wx, 0.3, 1.5, 2.4, 0.16, W);
        F(wx, 0.3, 1.1, 2.1, 0.2, door);
        F(wx, 2.45, 0.9, 0.22, 0.24, P.glass);
        F(wx, 2.72, 2, 0.3, 0.4, W);
        F(wx, 3.02, 1.5, 0.22, 0.4, W);
        F(wx + 0.35, 1.3, 0.12, 0.12, 0.26, P.gilt);
        continue;
      }
      if (k === 1 && bal && c === bc) {
        F(wx, y + 0.3, 2.4, 0.14, 0.9, W);
        F(wx, y + 1.0, 2.4, 0.08, 0.9, W, 0.82);
        for (const j of [-1.1, -0.55, 0, 0.55, 1.1]) F(wx + j, y + 0.44, 0.07, 0.56, 0.9, W, 0.83);
      } else F(wx, y + 0.46, 1.8, 0.14, 0.4, W);
      F(wx, y + 0.6, 1.5, 2.2, 0.14, W);
      F(wx, y + 0.8, 1.1, 1.8, 0.18, q() < 0.08 ? P.lit : P.glass, 0.02);
      F(wx, y + 0.83, 0.08, 1.74, 0.24, W, 0.16);
      F(wx, y + 2.0, 1.16, 0.08, 0.24, W, 0.16);
    }
  }
}
