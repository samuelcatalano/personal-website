// Pure layout data: no three import, so node tests can load it.
export const STOP_SPACING = 30;
export const RIVER_Z = -45;

export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({
  x: (i - (n - 1) / 2) * STOP_SPACING,
  z: Math.round(12 * Math.sin(i * 0.7)),
}));

export const LANDMARKS = {
  heathrow: 'millimetric', // landing in London, 2020
  bigben: 'xdesign',
  eye: 'olm',
  towerbridge: 'tribal',
  wembley: 'contact',      // Samuel lives in Wembley: last stop
};

export const stopIndex = (stops, id) => stops.findIndex((s) => s.id === id);

export function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
