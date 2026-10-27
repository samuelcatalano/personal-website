import * as THREE from 'three';
import { loadFleetCatalog, regionalFleetModel, upgradeFleet } from './vehicle-assets.js';
import { estaiadaRoute } from './landmark-geometry.js';
import { LANDMARKS, RIVER_Z, WEMBLEY_BENCHMARK, TOWER_AT, regions, ukStart, stopIndex, rng } from './layout.js';
// Static kerbside cars on the oncoming-lane side (the bus drives the other side). Slots every SLOT m along the route arc length, kept only on town
// frontage (not the countryside / Glasgow gap), then thinned by a seeded rng. Same fleet GLBs as the moving traffic, unlit lamps, shared geometry and
// per-paint materials. Skipped: bus stops + zebras, landmark plazas, the Estaiada ramp mouth, Tower Bridge, the Wembley benchmark.
const SLOT = 6.4, OFFSET = 4.5, FILL = 0.4, SEED = 4242; // m between slots, m from the centre line (bus edge 3.03 + MARGIN + half car width; the kerb strip sits at 4.55), share of slots taken
// Moving traffic envelope: the widest/longest oncoming vehicle (the 11.3 x 2.55 m bus) on its lane (1.75 m from the centre line), swept along the actual
// route; a slot is dropped when its footprint comes within MARGIN of any pose. Lanes are fixed, so the parked car sits just past the bus's edge (3.03 m + margin), its outer wheels on the kerb apron.
const BUS = { hl: 5.65, hw: 1.275, lane: 1.75 }, CAR = { hl: 2.35, hw: 0.925 }, MARGIN = 0.4;
const obb = (x, z, tx, tz, hl, hw) => ({ x, z, ux: tx, uz: tz, nx: -tz, nz: tx, hl, hw });
const apart = (a, b) => [[a.ux, a.uz], [a.nx, a.nz], [b.ux, b.uz], [b.nx, b.nz]].some(([lx, lz]) => { // separating axis between two oriented boxes
  const r = (o) => o.hl * Math.abs(o.ux * lx + o.uz * lz) + o.hw * Math.abs(o.nx * lx + o.nz * lz);
  return Math.abs((b.x - a.x) * lx + (b.z - a.z) * lz) > r(a) + r(b);
});
const CLEAR = { landmark: 22, ramp: 40, tower: 30 }, STOP_ZONE = [5, 13]; // m kept clear of each feature; STOP_ZONE: along the route from a stop mark, covers the zebra 9 m past it (bus stops are on the bus's own side)
const PAINT = ['#f1f1ee', '#c4c8cc', '#6c7177', '#1b1d21', '#25324a', '#7a1620', '#2f6fcf', '#b3161f', '#e8c425', '#2e6b46', '#c4c8cc', '#f1f1ee']; // everyday mix, unlike the saturated moving cars
export function createParked(scene, { curve, pts, stops }) {
  const group = new THREE.Group(); group.name = 'parked-cars'; scene.add(group);
  let disposed = false;
  const fine = curve.getPoints(3000), cum = [0];
  for (let k = 1; k < fine.length; k++) cum.push(cum[k - 1] + fine[k].distanceTo(fine[k - 1]));
  const L = cum.at(-1), n = stops.length, rgs = regions(stops, pts), ukX = pts[ukStart(stops)].x - 15;
  const at = (i) => curve.getPoint(i / (n - 1));
  const feature = (list, d) => list.map((q) => [q, d]);
  const J = estaiadaRoute(pts[stopIndex(stops, LANDMARKS.estaiada)].x, curve, RIVER_Z).stations.at(-1);
  const keepOut = [
    ...feature(Object.values(LANDMARKS).map((id) => pts[stopIndex(stops, id)]), CLEAR.landmark),
    ...feature([{ x: J.x, z: J.z }], CLEAR.ramp), ...feature([{ x: pts[stopIndex(stops, LANDMARKS.eye)].x + TOWER_AT, z: 0 }], CLEAR.tower),
  ];
  const stopS = stops.map((_, i) => { const q = at(i); let b = 0; for (let k = 1; k < fine.length; k++) if (fine[k].distanceToSquared(q) < fine[b].distanceToSquared(q)) b = k; return cum[b]; });
  const town = (x) => x < rgs[0].ctry[0] || x >= rgs[1].ctry[1]; // before the out-leg countryside, after the return-leg one
  const W = WEMBLEY_BENCHMARK, rand = rng(SEED), spots = [];
  const sample = (s) => { // position + unit tangent at arc length s (binary search in the table)
    let lo = 0, hi = cum.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= s) lo = m; else hi = m - 1; }
    const f = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
    return { p: fine[lo].clone().lerp(fine[lo + 1], f), t: fine[lo + 1].clone().sub(fine[lo]).normalize() };
  };
  for (let s = SLOT; s < L - SLOT; s += SLOT) {
    const { p, t } = sample(s);
    const roll = rand(), box = obb(p.x - t.z * OFFSET, p.z + t.x * OFFSET, t.x, t.z, CAR.hl + MARGIN, CAR.hw + MARGIN); // drawn for every slot, eligible or not: editing a keep-out zone never reshuffles the other cars
    const swept = () => { for (let d = -(BUS.hl + CAR.hl + 2); d <= BUS.hl + CAR.hl + 2; d += 0.5) { const q = sample(s + d); if (!apart(box, obb(q.p.x - q.t.z * BUS.lane, q.p.z + q.t.x * BUS.lane, q.t.x, q.t.z, BUS.hl, BUS.hw))) return true; } return false; };
    if (roll > FILL || !town(p.x) || (p.x > W.x0 - 6 && p.x < W.x1 + 6) || stopS.some((o) => s - o > STOP_ZONE[0] && s - o < STOP_ZONE[1]) || keepOut.some(([q, d]) => Math.hypot(p.x - q.x, p.z - q.z) < d) || swept()) continue;
    spots.push({ x: box.x, z: box.z, yaw: Math.atan2(-t.z, t.x) + Math.PI, paint: PAINT[Math.floor(rand() * PAINT.length)], uk: p.x >= ukX });
  }
  const ready = loadFleetCatalog().then((catalog) => Promise.all(spots.map(async (c, i) => {
    const model = regionalFleetModel(catalog, c.uk ? 'uk' : 'br', spots.slice(0, i).filter((o) => o.uk === c.uk).length + (c.uk ? 1 : 0));
    if (!model || disposed) return;
    const car = new THREE.Group(); car.name = 'parked'; car.position.set(c.x, 0, c.z); car.rotation.y = c.yaw;
    await upgradeFleet(car, model, { body: c.paint, parked: true, isDisposed: () => disposed });
    if (!disposed && car.userData.fleetModel) group.add(car);
  })));
  return { ready, spots, update() {}, dispose() { disposed = true; scene.remove(group); } };
}
