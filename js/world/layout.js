export const STOP_SPACING = 30;
export const RIVER_Z = -45;
export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({
  x: (i - (n - 1) / 2) * STOP_SPACING,
  z: Math.round(12 * Math.sin(i * 0.7)),
}));
export const LANDMARKS = {
  heathrow: 'move',
  bigben: 'xdesign',
  eye: 'olm',
  towerbridge: 'tribal',
  masp: 'taqtile',
  se: 'puc',
  estaiada: 'reclame',
  wembley: 'contact',
};
export const FRAME_LIFT = { xdesign: 1, olm: 0.6, tribal: 1 };
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
