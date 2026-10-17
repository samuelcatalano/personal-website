import { PALETTE as P } from './palette.js';
// Red K6 telephone kiosk, ~1 x 2.9 x 1: plinth, glazed body with bars, TELEPHONE light strip, stepped crown.
export function phoneBox(add, x, z) {
  add(x, 0, z, 1.14, 0.25, 1.14, P.ink);
  add(x, 0.25, z, 1, 2.3, 1, P.red);
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const at = (y, w, h, fr, dep, c) => add(x + sx * (0.5 + fr), y, z + sz * (0.5 + fr), sx ? dep : w, h, sx ? w : dep, c);
    at(0.45, 0.62, 1.5, 0, 0.08, P.glass);
    at(0.47, 0.05, 1.46, 0.005, 0.13, P.red);
    at(1.0, 0.6, 0.05, 0.005, 0.13, P.red);
    at(1.5, 0.6, 0.05, 0.005, 0.13, P.red);
    at(2.05, 0.62, 0.3, 0, 0.08, P.white);
  }
  add(x, 2.55, z, 1.1, 0.12, 1.1, P.red);
  add(x, 2.67, z, 0.8, 0.12, 0.8, P.red);
  add(x, 2.79, z, 0.5, 0.1, 0.5, P.red);
  add(x, 2.89, z, 0.2, 0.06, 0.2, P.lit);
}
