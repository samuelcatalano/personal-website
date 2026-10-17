import { furnitureSpots, rng } from './layout.js';
import { PALETTE as P } from './palette.js';
import { tree, CLEAR } from './city.js'; // ponytail: import cycle is fine, both are function declarations used after load
// Parks on the big bare paving. Rects were found with an occupancy grid of city + landmarks (tests/parks.test.mjs re-checks the plaza loops);
// x/z are world metres. Axis u = longer side. uk: black railings + K6-free London look; pond/fountain: centre piece.
export const PARKS = [
  { x0: -220, x1: -150, z0: -27, z1: -15, fountain: 1, trees: 7 }, // Sé side
  { x0: -278, x1: -258, z0: -24, z1: 24, fountain: 1, trees: 7 }, // behind the start
  { x0: -182, x1: -150, z0: -57, z1: -47, trees: 5 },
  { x0: -73, x1: -47, z0: 13, z1: 23, trees: 4 }, // south of Paulista
  { x0: -73, x1: -47, z0: -23, z1: -15, trees: 3 }, // north, in front of the Copan: low trees only
  { x0: -88, x1: -47, z0: -69, z1: -63, trees: 4 }, // behind the Copan
  { x0: -12, x1: 12, z0: 21, z1: 27, trees: 3 },
  { x0: 20, x1: 72, z0: 21, z1: 27, uk: 1, rail: 1, trees: 5 },
  { x0: 186, x1: 222, z0: -29, z1: -21, uk: 1, rail: 1, trees: 4 },
  { x0: 186, x1: 266, z0: -69, z1: -61, uk: 1, rail: 1, trees: 6 },
  { x0: 236, x1: 312, z0: -43, z1: -35, uk: 1, rail: 1, trees: 6 }, // in front of Wembley: trees stay <= 4.4 m
  { x0: 322, x1: 346, z0: -12, z1: 24, uk: 1, rail: 1, pond: 1, trees: 7 },
];
const { patch: LAWN, gravel: GRAVEL, hedge: HEDGE, leaf: LEAF, stone: STONE, oak: OAK, iron: IRON, glass: WATER, dirt: SOIL, roof: POLE, lit: LIT } = P;
const BLOOM = [P.red, P.tulip, P.violet, P.red];
export function buildParks(add, stops, pts, curve, occ) {
  const spots = furnitureSpots(stops, curve).map((o) => o.xz), r = rng(9157), made = [];
  for (const park of PARKS) {
    const wide = park.x1 - park.x0 >= park.z1 - park.z0, L = wide ? park.x1 - park.x0 : park.z1 - park.z0, S = wide ? park.z1 - park.z0 : park.x1 - park.x0;
    const cx = (park.x0 + park.x1) / 2, cz = (park.z0 + park.z1) / 2;
    // box in park space: u along the long side, v across; lu/lv are its sizes
    const B = (u, v, y, lu, h, lv, c) => (wide ? add(cx + u, y, cz + v, lu, h, lv, c) : add(cx + v, y, cz + u, lv, h, lu, c));
    const world = (u, v) => (wide ? [cx + u, cz + v] : [cx + v, cz + u]);
    const clearOfSigns = (u, v) => { const [x, z] = world(u, v); return spots.every(([a, b]) => Math.hypot(a - x, b - z) > CLEAR); };
    const cross = S >= 10 && L >= 16, plaza = park.fountain || park.pond, taken = [];
    B(0, 0, 0.02, L, 0.05, S, LAWN);
    B(0, 0, 0.04, L + 0.6, 0.06, 1.6, GRAVEL); // paths overhang the lawn, so no coplanar end faces
    if (cross) B(0, 0, 0.045, 1.4, 0.06, S + 0.6, GRAVEL);
    const basin = (u, v, w, d, rim) => { // stone rim around a water box
      B(u, v - d / 2 + 0.25, 0.04, w, rim, 0.5, STONE); B(u, v + d / 2 - 0.25, 0.04, w, rim, 0.5, STONE);
      B(u - w / 2 + 0.25, v, 0.04, 0.5, rim, d - 1, STONE); B(u + w / 2 - 0.25, v, 0.04, 0.5, rim, d - 1, STONE);
      B(u, v, 0.04, w - 1, rim - 0.12, d - 1, WATER);
    };
    if (park.fountain) {
      B(0, 0, 0.05, 6.4, 0.06, 6.4, GRAVEL); taken.push([0, 0, 5]);
      basin(0, 0, 4.4, 4.4, 0.55);
      B(0, 0, 0.1, 0.6, 1.3, 0.6, STONE); B(0, 0, 0.9, 1.6, 0.14, 1.6, STONE); B(0, 0, 1.4, 0.18, 0.5, 0.18, WATER);
    }
    if (park.pond) { // off the crossing, in the first free quadrant
      const u = L * 0.22, v = S * -0.22; basin(u, v, 9, 6, 0.3); taken.push([u, v, 6]);
    }
    const spot = (clear, tries = 30) => { // random lawn spot off the paths, off other features and (for tall things) off the signs
      for (let i = 0; i < tries; i++) {
        const u = (r() - 0.5) * (L - 3), v = (r() - 0.5) * (S - 3);
        if (Math.abs(v) < 1.9 + clear || (cross && Math.abs(u) < 1.9 + clear) || taken.some(([a, b, d]) => Math.hypot(a - u, b - v) < d + clear) || !clearOfSigns(u, v)) continue;
        taken.push([u, v, clear + 0.6]); return [u, v];
      }
    };
    for (let i = 0; i < park.trees; i++) {
      const at = spot(1.9), h = 2.6 + r() * 0.6, crown = 1.8 + r() * 0.5; // always draw rng
      if (at) { const [x, z] = world(...at); tree(add, x, z, { h, crown }); }
    }
    const beds = cross ? 2 : 1;
    for (let i = 0; i < beds; i++) { // flower beds: soil strip with four colour blocks
      const at = spot(1.6, 40); if (!at) continue;
      const [u, v] = at;
      B(u, v, 0.05, 2.6, 0.12, 1.2, SOIL);
      BLOOM.forEach((c, k) => B(u - 0.825 + k * 0.55, v, 0.12, 0.5, 0.28, 0.95, c));
    }
    for (let i = 0; i < Math.max(2, Math.round(L / 9)); i++) { // bushes and low hedge runs
      const at = spot(0.9, 20); if (!at) continue;
      const [u, v] = at;
      if (i % 3 === 0) B(u, v, 0.05, 3 + r() * 2, 0.8, 0.7, HEDGE); else B(u, v, 0.05, 1 + r() * 0.5, 0.7 + r() * 0.3, 1 + r() * 0.4, i % 2 ? LEAF : HEDGE);
    }
    const nb = Math.max(1, Math.round(L / 22)); // benches beside the main path, backs to the lawn
    for (let i = 0; i < nb; i++) for (const f of [-1, 1]) {
      if (S < 7 && f > 0) continue;
      const u = (i + 0.5) / nb * (L - 8) - (L - 8) / 2 + (f > 0 ? 3 : 0), v = f * 1.9;
      if (cross && Math.abs(u) < 3.5 || (plaza && Math.abs(u) < 5)) continue;
      B(u, v, 0.45, 1.6, 0.1, 0.45, OAK); B(u, v + f * 0.2, 0.55, 1.6, 0.38, 0.08, OAK);
      for (const d of [-0.65, 0.65]) B(u + d, v, 0.09, 0.12, 0.36, 0.38, IRON);
    }
    for (let u = -L / 2 + 5; u < L / 2 - 3; u += 15) for (const f of [-1, 1]) { // lamps, head P.lit so it glows at night
      if (S < 7 && f > 0 || !clearOfSigns(u, f * 1.4)) continue;
      const [x, z] = world(u, f * 1.4); add(x, 0, z, 0.16, 3, 0.16, POLE); add(x, 3, z, 0.7, 0.2, 0.7, LIT);
    }
    if (park.rail) { // black railings round the park with gates where the paths enter
      const hu = L / 2 + 0.9, hv = S / 2 + 0.9;
      const run = (axis, fixed, a, b) => { // axis 'u' or 'v'
        for (let t = a; t <= b + 0.01; t += 3) axis === 'u' ? B(t, fixed, 0, 0.1, 0.95, 0.1, IRON) : B(fixed, t, 0, 0.1, 0.95, 0.1, IRON);
        axis === 'u' ? B((a + b) / 2, fixed, 0.7, b - a, 0.08, 0.08, IRON) : B(fixed, (a + b) / 2, 0.7, 0.08, 0.08, b - a, IRON);
      };
      for (const f of [-1, 1]) {
        run('v', f * hu, -hv, -1.3); run('v', f * hu, 1.3, hv); // gates for the main path
        if (cross) { run('u', f * hv, -hu, -1.3); run('u', f * hv, 1.3, hu); } else run('u', f * hv, -hu, hu);
      }
    }
    made.push(park);
  }
  return made;
}
