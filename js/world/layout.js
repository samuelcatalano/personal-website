// Pure layout data: no three import, so node tests can load it.
export const STOP_SPACING = 40;
export const RIVER_Z = -45;

// A straight road; dioramas sit on bases along it.
export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * STOP_SPACING, z: 0 }));

// dz < 0 is the far side (away from the camera). rotY in radians; tuned at the visual checkpoint.
export const CHAPTERS = [
  { id: 'saopaulo', river: false, stops: ['hero', 'puc', 'arizona', 'insane', 'taqtile', 'mira', 'reclame'], models: [
    { id: 'se', at: 'puc', dx: 0, dz: -38, rotY: 0 },
    { id: 'masp', at: 'taqtile', dx: 0, dz: -26, rotY: 0 },
    { id: 'estaiada', at: 'reclame', dx: 0, dz: -48, rotY: 0 },
  ] },
  { id: 'heathrow', river: false, stops: ['millimetric'], models: [{ id: 'heathrow', at: 'millimetric', dx: 0, dz: -40, rotY: 0 }] },
  { id: 'westminster', river: true, stops: ['xdesign', 'olm'], models: [
    { id: 'bigben', at: 'xdesign', dx: 0, dz: -24, rotY: 0 },
    { id: 'londoneye', at: 'olm', dx: 0, dz: -72, rotY: 0 },
  ] },
  { id: 'towerbridge', river: true, stops: ['tribal'], models: [{ id: 'towerbridge', at: 'tribal', dx: 0, dz: -45, rotY: Math.PI / 2 }] },
  { id: 'roadtowembley', river: false, stops: ['stack', 'articles', 'repos', 'recs'], models: [
    { id: 'phonebox', at: 'stack', dx: 4, dz: 9, rotY: 0 },
    { id: 'taxi', at: 'repos', dx: 0, dz: 7, rotY: 0 },
  ] },
  { id: 'wembley', river: false, stops: ['contact'], models: [{ id: 'wembley', at: 'contact', dx: 0, dz: -75, rotY: 0 }] },
];

export const chapterOf = (stopId) => CHAPTERS.find((c) => c.stops.includes(stopId))?.id;

// legacy: still imported by city.js / landmarks.js / ambient.js; removed in Task 6 with those modules.
export const LANDMARKS = { heathrow: 'millimetric', bigben: 'xdesign', eye: 'olm', towerbridge: 'tribal', wembley: 'contact' };
export const stopIndex = (stops, id) => stops.findIndex((s) => s.id === id);
export function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How much the follow camera rises at stops whose landmark would otherwise be cropped (0 = street shot).
export const FRAME_LIFT = { xdesign: 1, olm: 1, tribal: 0.8, puc: 0.6, reclame: 0.8 };
