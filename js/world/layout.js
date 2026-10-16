// Pure layout data: no three import, so node tests can load it.
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
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
