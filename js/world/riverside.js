import { PALETTE as P } from './palette.js';

const SILVER = '#c9ccd0', GLASS = '#27394a', ZINC = '#6e7378', T = 0.65; // T = band thickness
// Roof knots (offset from west end, height): peaks at 3, 9, 14 (spike), 21, 28; boxy gable shoulders at the east end.
const KNOTS = [[0, 8.5], [3, 10.5], [6, 6.5], [9, 11], [11.5, 7.5], [14, 16.6], [16.5, 7], [18, 6.5], [21, 10], [24.5, 6.5], [28, 12], [30.5, 11.5], [32, 10.5]];
const hAt = (u) => { for (let i = 1; i < KNOTS.length; i++) if (u <= KNOTS[i][0]) { const [a, ha] = KNOTS[i - 1], [b, hb] = KNOTS[i]; return ha + ((hb - ha) * (u - a)) / (b - a); } return KNOTS.at(-1)[1]; };
const N = 64, CW = 0.5;
export const RIVERSIDE_PROFILE = Array.from({ length: N }, (_, i) => Math.round(hAt((i + 0.5) * CW) * 10) / 10);

// Riverside Museum (Zaha Hadid): thin silver zigzag band (0.5 m steps), dark glass beneath, framed end walls.
export function buildRiverside(add, { x, z }) {
  const h = RIVERSIDE_PROFILE, west = x - 16, fz = z + 7.5, bz = z - 7.5;
  const y0 = h.map((v, i) => Math.min(h[i - 1] ?? v, v, h[i + 1] ?? v) - T);
  const edge = (i) => i < 2 || i > N - 3;
  add(x, 0, z, 32, 0.3, 16, P.pave); // plinth
  for (let i = 0; i < N; i++) add(west + (i + 0.5) * CW, edge(i) ? 0 : y0[i], fz, CW, h[i] - (edge(i) ? 0 : y0[i]), 0.8, SILVER); // front band; ends drop as 1 m frame posts
  for (let i = 2; i < N - 2; i += 2) { // glass under the band follows the zigzag; mullion every 2 steps
    const top = Math.max(y0[i], y0[i + 1]) + 0.3; // tucks behind the band
    add(west + (i + 1) * CW, 0.3, z + 7.2, 2 * CW, top - 0.3, 0.3, GLASS);
    if (i % 4 === 2) add(west + i * CW, 0.3, z + 7.4, 0.12, y0[i] - 0.3, 0.12, SILVER);
  }
  for (let i = 0; i < N; i += 4) { // coarse back band (topped at the lowest step so it hides behind the front line)
    const lo = edge(i) ? 0 : Math.min(...y0.slice(i, i + 4));
    add(west + (i + 2) * CW, lo, bz, 4 * CW, Math.min(...h.slice(i, i + 4)) - lo, 0.8, SILVER);
  }
  for (let i = 4; i < N - 4; i += 8) { // zinc roof mass behind
    const lo = Math.min(...y0.slice(i, i + 8)), top = Math.min(...h.slice(i, i + 8)) - 0.4;
    add(west + (i + 4) * CW, lo, z, 8 * CW, top - lo, 14, ZINC);
  }
  for (const s of [-1, 1]) { // end facades: dark glass inside the frame, vertical mullions
    const ex = x + s * 15.4;
    add(ex, 0.3, z, 0.4, 7.7, 14, GLASS);
    add(ex, 8, z, 0.4, 3.5, 12, GLASS);
    for (const dz of [-4, 0, 4]) add(ex + s * 0.2, 0.3, z + dz, 0.2, 11, 0.25, SILVER);
  }
  for (const u of [4, 9, 14, 20, 25, 29]) add(west + u, 1.2, z + 7.0, 1.2, 0.18, 0.15, P.lit); // lit interior lines
}
