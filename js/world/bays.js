import { estaiadaRoute } from './landmark-geometry.js';
import { LANDMARKS, RIVER_Z, WEMBLEY_BENCHMARK, TOWER_AT, regions, ukStart, stopIndex } from './layout.js';
// Parking bays along both kerbs of the main road, one per SLOT m of route arc length, only on town frontage (London + Glasgow; not the countryside).
// Shared by parked.js (cars) and roadmarks.js (bay ticks) so a painted bay always has a car slot and vice versa.
// Skipped: bus stops + zebras, landmark plazas, the Estaiada ramp mouth, Tower Bridge, the Wembley benchmark.
export const SLOT = 6.4;
const CLEAR = { landmark: 22, ramp: 40, tower: 30 }, STOP_ZONE = [-2, 12.5]; // m kept clear of each feature; STOP_ZONE: along the route from a stop mark (bus stop + the zebra 9 m past it)
export function parkingBays(curve, pts, stops, pilotCrossings = []) {
  const fine = curve.getPoints(3000), cum = [0];
  for (let k = 1; k < fine.length; k++) cum.push(cum[k - 1] + fine[k].distanceTo(fine[k - 1]));
  const L = cum.at(-1), n = stops.length, rgs = regions(stops, pts), W = WEMBLEY_BENCHMARK;
  const at = (i) => curve.getPoint(i / (n - 1));
  const feature = (list, d) => list.map((q) => [q, d]);
  const J = estaiadaRoute(pts[stopIndex(stops, LANDMARKS.estaiada)].x, curve, RIVER_Z).stations.at(-1);
  const keepOut = [
    ...feature(Object.values(LANDMARKS).map((id) => pts[stopIndex(stops, id)]), CLEAR.landmark),
    ...feature([{ x: J.x, z: J.z }], CLEAR.ramp), ...feature([{ x: pts[stopIndex(stops, LANDMARKS.eye)].x + TOWER_AT, z: 0 }], CLEAR.tower),
  ];
  const stopS = stops.map((_, i) => { const q = at(i); let b = 0; for (let k = 1; k < fine.length; k++) if (fine[k].distanceToSquared(q) < fine[b].distanceToSquared(q)) b = k; return cum[b]; });
  const town = (x) => x < rgs[0].ctry[0] || x >= rgs[1].ctry[1] || (x >= rgs[0].scot[0] && x < rgs[0].scot[1]) || (x >= rgs[1].scot[0] && x < rgs[1].scot[1] - 15); // London, plus Glasgow's sandstone edge (not the countryside, nor the 15 m before the return railway underpass)
  // Every painted crossing as an arc-length band at the exact roadmarks.js position (curve.getPointAt(u), snapped to our arc table): stop zebras (9 m past a stop, 1.4 m half-length) and
  // pilot crossings (~1.85 m); a bay centre stays 1 m + a whole half bay clear of each, so no car or tick touches paint.
  const Lc = curve.getLength(), nearS = (q) => { let b = 0; for (let k = 1; k < fine.length; k++) if (fine[k].distanceToSquared(q) < fine[b].distanceToSquared(q)) b = k; return cum[b]; };
  const zebras = [...stops.map((_, i) => [Math.min(1, i / (n - 1) + 9 / Lc), 1.4]), ...pilotCrossings.map((u) => [u, 1.85])].map(([u, h]) => [nearS(curve.getPointAt(u)), h]);
  const sample = (s) => { // position + unit tangent at arc length s (binary search in the table)
    let lo = 0, hi = cum.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= s) lo = m; else hi = m - 1; }
    const f = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
    return { p: fine[lo].clone().lerp(fine[lo + 1], f), t: fine[lo + 1].clone().sub(fine[lo]).normalize() };
  };
  const ok = (s) => { // a bay centred at arc length s, kerb to kerb (both ends within the zone tests so ticks and cars agree)
    const { p } = sample(s);
    return town(p.x) && !(p.x > W.x0 - 6 && p.x < W.x1 + 6) && !zebras.some(([z, h]) => Math.abs(s - z) < h + 1 + SLOT / 2) && !stopS.some((o) => s - o > STOP_ZONE[0] && s - o < STOP_ZONE[1]) && !keepOut.some(([q, d]) => Math.hypot(p.x - q.x, p.z - q.z) < d);
  };
  const bays = [];
  for (let k = 0; (k + 1) * SLOT < L; k++) bays.push({ k, s: (k + 0.5) * SLOT, ok: ok((k + 0.5) * SLOT) });
  return { L, sample, bays };
}
