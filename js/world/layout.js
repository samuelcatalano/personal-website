// Cross-section of the main road, metres from the route centre line (one side; mirrored). Two 3.5 m traffic lanes (centres at +-lane), a painted edge line at
// `edge`, then a parking bay up to the kerb. The pavement keeps its outer edge (8.9 m) so lots, trees and lamps stay put: the bays are taken from the pavement.
// ponytail: every road consumer (city.js, roadmarks.js, bays.js, crowd.js, signs) reads this, never a literal.
export const ROAD = Object.freeze({ lane: 1.75, edge: 3.85, half: 6.55, curb: 6.775, padIn: 7.0, padOut: 8.9, furniture: 8.75, bay: 2.7, bayMid: 5.2 });
export const STOP_SPACING = 30;
export const UNDERPASS = Object.freeze({ nudge: [-7, -4.25], end: 33, base: 6.5 }); // arch offset from each scotRange boundary (m), overpass road half length across the route, embankment half width
// Overpass frames on the route (centre, unit tangent), shared by underpass.js (geometry) and city.js (keeps houses off the embankment road).
export const underpassFrames = (curve, stops) => scotRange(stops).map((t, i) => {
  const e = 1e-4, a = curve.getPointAt(t), speed = Math.hypot(curve.getPointAt(t + e).x - a.x, curve.getPointAt(t + e).z - a.z) / e, tc = t + UNDERPASS.nudge[i] / speed, c = curve.getPointAt(tc), tan = curve.getTangentAt(tc);
  return { t, tc, x: c.x, z: c.z, tx: tan.x, tz: tan.z };
});
export const RIVER_Z = -45;
export const WEMBLEY_LEGACY = Object.freeze({ x0: 660, x1: 880, z0: -113, z1: -25 }); // legacy coordinates (see east()): parks.js, inside the city generator
const insideOf = (W) => ({ x, z, width = 0, depth = 0 }) =>
  x - width / 2 >= W.x0 && x + width / 2 <= W.x1 &&
  z - depth / 2 >= W.z0 && z + depth / 2 <= W.z1;
export const isWembleyLegacy = insideOf(WEMBLEY_LEGACY);
// Extra roads: after MASP (taqtile, stop 4) for the Copan, and the London -> Glasgow run after the Eye (olm, stop 10), and the return run after Glasgow (stop 11). Every later stop shifts east by `size`.
// ponytail: `after` are stop indices, asserted in tests/logic.test.mjs
export const OUT_GAP = 300, LONG_GAP = 180; // olm -> glasgow = STOP_SPACING + OUT_GAP (London tail with Tower Bridge, countryside, two Glasgow landmarks); glasgow -> tribal = STOP_SPACING + LONG_GAP (the return)
// SWAP_GAP: extra road between Reclame AQUI and the first London stop, room for the SP -> London tunnel (swap-tunnel.js; off while 0).
// The city generator's rows share one RNG stream and its ids are positions, so it never sees this gap: city.js builds on the legacy route (LEGACY_GAPS)
// and east() moves everything past the old region border (legacy x > 0, midway Reclame AQUI -> first UK stop) SWAP_GAP east. Literal legacy tables
// (parks, blocks lot lists, Wembley, the closing corner) therefore stay as they are. ponytail: border is the literal 0 of today's 18-stop route.
export const SWAP_GAP = 40;
export const LEGACY_GAPS = [{ after: 4, size: 60 }, { after: 10, size: OUT_GAP }, { after: 11, size: LONG_GAP }];
export const GAPS = SWAP_GAP ? [...LEGACY_GAPS, { after: 6, size: SWAP_GAP }] : LEGACY_GAPS; // appended: GAPS[0..2] keep their roles
export const GAP_TOTAL = GAPS.reduce((a, g) => a + g.size, 0);
export const east = (x) => x > 0 ? x + SWAP_GAP : x; // legacy -> real x
// Distant backdrop only: spreads the gap over +-SPREAD m instead of opening a 40 m corridor to the horizon (no ids or approvals out there).
const SPREAD = 200;
export const stretch = (x) => x <= -SPREAD ? x : x >= SPREAD ? x + SWAP_GAP : x + SWAP_GAP * (x + SPREAD) / (2 * SPREAD);
export const eastAdd = (add, move = east) => { // a box sink fed legacy x; voxel.js add(x, ...) and add.plant(kind, x, ...)
  const f = (x, ...a) => add(move(x), ...a);
  if (add.plant) f.plant = (kind, x, ...a) => add.plant(kind, move(x), ...a);
  return f;
};
export const WEMBLEY_BENCHMARK = Object.freeze({ ...WEMBLEY_LEGACY, x0: east(WEMBLEY_LEGACY.x0), x1: east(WEMBLEY_LEGACY.x1) });
export const isWembleyBenchmark = insideOf(WEMBLEY_BENCHMARK);
export const routePoints = (n, gaps = GAPS) => Array.from({ length: n }, (_, i) => ({
  x: (i - (n - 1) / 2) * STOP_SPACING + gaps.reduce((a, g) => a + (i > g.after ? g.size : 0), 0),
  z: Math.round(12 * Math.sin(i * 0.7)),
}));
export const LANDMARKS = {
  bigben: 'xdesign',
  eye: 'olm',
  glasgow: 'glasgow',
  masp: 'taqtile',
  se: 'puc',
  estaiada: 'reclame',
  wembley: 'contact',
};
// Tower Bridge hangs off the Eye, not a stop: TOWER_AT m east of it, inside the London tail before the trip
export const TOWER_AT = 60;
export const LONDON_EYE_X_OFFSET = -12; // clear the reversed Elizabeth Tower sightline without moving the route stop
export const towerX = (stops, pts) => pts[stopIndex(stops, LANDMARKS.eye)].x + TOWER_AT;
// Glasgow approach landmarks (footprints centred; hill = green terrace the university stands on), shared by landmarks.js and blocks.js
export const glasgowSites = (stops, pts) => { const g = pts[stopIndex(stops, LANDMARKS.glasgow)].x; return { museum: { x: g - 92, z: RIVER_Z - 23, w: 36, d: 18 }, uni: { x: g - 37, z: RIVER_Z - 43, w: 72, d: 18, lift: 2.5 } }; };
export const FRAME_LIFT = { mira: 1, xdesign: 1, olm: 0.6, tribal: 1 };
// Edifício Copan: S-shaped slab on the new stretch after MASP, behind the road row, ending before the Estaiada river (blocks.js reserves it)
// h = 36 so the whole tower, rooftop included, fits the lifted follow shot at mira (checked at 1440x900 and 375x812)
export const copan = (stops, pts) => ({ x: pts[stopIndex(stops, 'mira')].x - 12, z: -45, len: 34, amp: 5, depth: 9.2, h: 36 });
// Curve parameter = stop index / (n - 1), so stops sit exactly at i/(n-1) even with the uneven gap.
export const routeCurve = (THREE, pts) => {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  c.getUtoTmapping = (u) => u; // ponytail: bus speed follows segment length (3x in the gap); equal-speed would need a per-stop arc map
  return c;
};
export const stopIndex = (stops, id) => stops.findIndex((s) => s.id === id);
// Regions (x ranges) of the two long runs, [out: Eye -> Glasgow, back: Glasgow -> Tribal]: London terraces get lower in `sub` (after Tower Bridge), open countryside `ctry`, Scottish sandstone edge `scot` (out: room for the museum and the university).
export const regions = (stops, pts) => {
  const X = (id) => pts[stopIndex(stops, id)].x, [a, g, t] = [LANDMARKS.eye, LANDMARKS.glasgow, 'tribal'].map(X), w = a + TOWER_AT;
  return [{ sub: [w + 25, w + 55], ctry: [w + 55, g - 110], scot: [g - 110, g - 25] }, { scot: [g + 25, g + 55], ctry: [g + 55, t - 55], sub: [t - 55, t - 25] }];
};
export const inRegion = (rgs, key, x, e = 0) => rgs.some((r) => x >= r[key][0] - e && x < r[key][1] + e);
export const riverEnd = (stops, pts) => pts[stopIndex(stops, 'tribal')].x - 30; // runs on to Glasgow (the Clyde), stops before the London return terraces
export const riverStart = (stops, pts) => pts[stopIndex(stops, LANDMARKS.estaiada)].x - 20;
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// First UK stop (country field, not an airport): the hero vehicle swap sits half a stop before it.
export const ukStart = (stops) => stops.findIndex((s) => s.country === 'UK');
export const swapAt = (stops) => (ukStart(stops) - 0.5) / (stops.length - 1);
export const secondaryBusAssetAt = (t, swap) => t < swap ? 'sao-paulo' : 'bus';
// Sao Paulo -> London: the route runs through a short cut-and-cover tunnel between Reclame AQUI and the first London stop (SWAP_GAP of extra road), and
// the hero swaps Mini <-> bus out of sight inside it (swap-tunnel.js). Metres along the road from the cover's centre (`ahead` m past the region swap):
// ramps of `ramp` m either side of a cover of half length `half`; it starts just past Reclame AQUI's zebra and ends where the bus at the next stop is level.
export const SWAP_TUNNEL = Object.freeze({ ahead: 2.9, half: 8, ramp: 18.1, width: 6 }); // width: half width across, kerb to kerb less the bend's sagitta
export const swapTunnelFrame = (curve, stops) => {
  const sw = swapAt(stops), e = 1e-4, a = curve.getPointAt(sw), speed = curve.getPointAt(sw + e).distanceTo(a) / e, t = sw + SWAP_TUNNEL.ahead / speed;
  const c = curve.getPointAt(t), tan = curve.getTangentAt(t);
  return { t, speed, x: c.x, z: c.z, tx: tan.x, tz: tan.z, reach: SWAP_TUNNEL.half + SWAP_TUNNEL.ramp };
};
export function heroVehicleAt(t, swap, archIn, archOut, vehicles) {
  if (t < swap) return vehicles.mini;
  return t >= archIn && t < archOut ? vehicles.glasgow : vehicles.london;
}
// Glasgow livery between these route params: from mid-countryside on the way up to where the Scottish edge ends on the way back.
export const scotRange = (stops) => {
  const pts = routePoints(stops.length), e = stopIndex(stops, LANDMARKS.eye), g = stopIndex(stops, LANDMARKS.glasgow), [out, back] = regions(stops, pts);
  return [(e + ((out.ctry[0] + out.ctry[1]) / 2 - pts[e].x) / (pts[g].x - pts[e].x)) / (stops.length - 1), (g + (back.scot[1] - pts[g].x) / (pts[g + 1].x - pts[g].x)) / (stops.length - 1)];
};
// Furniture and former career-plaque anchors retained as placement clearances.
export function furnitureSpots(stops, curve) {
  const out = [], n = stops.length - 1;
  stops.forEach((s, i) => {
    const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), last = i === n;
    const at = (k, a) => [p.x - t.z * k + t.x * a, p.z + t.x * k + t.z * a];
    if (s.brand) out.push({ i, kind: 'clearance', xz: at(11.5, 7) });
    out.push({ i, kind: 'sign', xz: at(last ? 9 : ROAD.furniture, last ? 2 : -5) });
  });
  return out;
}
// Tree species region by x: Sao Paulo (before the UK swap), London (to the Eye tail), countryside, Glasgow (scot ranges), countryside, London return.
export const treeRegion = (stops, pts) => {
  const X = (id) => pts[stopIndex(stops, id)].x, u = ukStart(stops), swap = (pts[u - 1].x + pts[u].x) / 2, [a, g, t] = [LANDMARKS.eye, LANDMARKS.glasgow, 'tribal'].map(X), w = a + TOWER_AT;
  return (x) => (x < swap ? 'sp' : x < w + 55 ? 'london' : x < g - 110 ? 'country' : x < g + 55 ? 'glasgow' : x < t - 55 ? 'country' : 'london');
};
