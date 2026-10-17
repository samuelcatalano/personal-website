export const STOP_SPACING = 30;
export const RIVER_Z = -45;
// One-off extra road after MASP (stop `after`) for the Copan; every later stop shifts east by `size`.
// ponytail: `after` is the taqtile index, asserted in tests/logic.test.mjs
export const GAP = { after: 4, size: 60 };
export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({
  x: (i - (n - 1) / 2) * STOP_SPACING + (i > GAP.after ? GAP.size : 0),
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
