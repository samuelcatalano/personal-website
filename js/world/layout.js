export const STOP_SPACING = 30;
export const RIVER_Z = -45;
// Extra roads: after MASP (taqtile, stop 4) for the Copan, and the London -> Glasgow run after the Eye (olm, stop 10), and the return run after Glasgow (stop 11). Every later stop shifts east by `size`.
// ponytail: `after` are stop indices, asserted in tests/logic.test.mjs
export const LONG_GAP = 180; // olm -> glasgow and glasgow -> tribal = STOP_SPACING + LONG_GAP; the one knob for the trip length
export const GAPS = [{ after: 4, size: 60 }, { after: 10, size: LONG_GAP }, { after: 11, size: LONG_GAP }];
export const GAP_TOTAL = GAPS.reduce((a, g) => a + g.size, 0);
export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({
  x: (i - (n - 1) / 2) * STOP_SPACING + GAPS.reduce((a, g) => a + (i > g.after ? g.size : 0), 0),
  z: Math.round(12 * Math.sin(i * 0.7)),
}));
export const LANDMARKS = {
  heathrow: 'move',
  bigben: 'xdesign',
  eye: 'olm',
  glasgow: 'glasgow',
  towerbridge: 'tribal',
  masp: 'taqtile',
  se: 'puc',
  estaiada: 'reclame',
  wembley: 'contact',
};
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
// Regions (x ranges) of the two long runs, [out: Eye -> Glasgow, back: Glasgow -> Tower Bridge]: London terraces get lower in `sub`, open countryside `ctry`, Scottish sandstone edge `scot`.
export const regions = (stops, pts) => {
  const X = (id) => pts[stopIndex(stops, id)].x, [a, g, t] = [LANDMARKS.eye, LANDMARKS.glasgow, LANDMARKS.towerbridge].map(X);
  return [{ sub: [a + 25, a + 55], ctry: [a + 55, g - 55], scot: [g - 55, g - 25] }, { scot: [g + 25, g + 55], ctry: [g + 55, t - 55], sub: [t - 55, t - 25] }];
};
export const inRegion = (rgs, key, x, e = 0) => rgs.some((r) => x >= r[key][0] - e && x < r[key][1] + e);
export const riverEnd = (stops, pts) => pts[stopIndex(stops, LANDMARKS.towerbridge)].x + 24;
export const riverStart = (stops, pts) => pts[stopIndex(stops, LANDMARKS.estaiada)].x - 20;
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Mini->Routemaster swap: halfway before heathrow
export const swapAt = (stops) => (stopIndex(stops, LANDMARKS.heathrow) - 0.5) / (stops.length - 1);
// Glasgow livery between these route params: from mid-countryside on the way up (Eye + 0.6 of the run) to where the Scottish edge ends on the way back.
export const scotRange = (stops) => {
  const pts = routePoints(stops.length), g = stopIndex(stops, LANDMARKS.glasgow), [, back] = regions(stops, pts), seg = pts[g + 1].x - pts[g].x;
  return [(stopIndex(stops, LANDMARKS.eye) + 0.6) / (stops.length - 1), (g + (back.scot[1] - pts[g].x) / seg) / (stops.length - 1)];
};
// Plaque + year-sign anchors [x, z, kind]; shared by signs.js (placement) and city.js (clearance).
export function furnitureSpots(stops, curve) {
  const out = [], n = stops.length - 1;
  stops.forEach((s, i) => {
    const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), last = i === n;
    const at = (k, a) => [p.x - t.z * k + t.x * a, p.z + t.x * k + t.z * a];
    if (s.brand) out.push({ i, kind: 'plaque', xz: at(11.5, 7) });
    out.push({ i, kind: 'sign', xz: at(last ? 9 : 7.1, last ? 2 : -5) });
  });
  return out;
}
