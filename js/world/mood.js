import { swapAt, scotRange } from './layout.js';
// Per-region DAY look. Colours are sRGB hex; sun/hemi scale the light intensities, fogK scales fog near/far, cloudOp adds to cloud opacity.
// LON is the reference (== sky.js DAY), so London renders as before.
const M = {
  sp: { zen: 0x5aa8f0, hor: 0xd0e0ec, cloud: 0xfff4e6, light: 0xffd9a0, sun: 1.08, hemi: 1, fogK: 0.9, cloudOp: 0, rain: 0 }, // warm golden
  lon: { zen: 0x6fb1e8, hor: 0xb9dcf5, cloud: 0xf4f9ff, light: 0xfff0d0, sun: 1, hemi: 1, fogK: 1, cloudOp: 0, rain: 0 },
  gla: { zen: 0x9aa7b4, hor: 0xc4ccd4, cloud: 0xa9b2bc, light: 0xdbe6f4, sun: 0.6, hemi: 1.25, fogK: 0.5, cloudOp: 0.2, rain: 1 }, // overcast, drizzle
};
const rgb = (h) => [(h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const P = Object.fromEntries(Object.entries(M).map(([k, m]) => [k, { ...m, zen: rgb(m.zen), hor: rgb(m.hor), cloud: rgb(m.cloud), light: rgb(m.light) }]));
const ss = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const COLS = ['zen', 'hor', 'cloud', 'light'], NUM = ['sun', 'hemi', 'fogK', 'cloudOp', 'rain'];
// Factory: ranges are computed once; the returned (t) => mood reuses one output object (no per-frame allocation).
export function createMood(stops) {
  const h = 0.3 / (stops.length - 1), sw = swapAt(stops), [g0, g1] = scotRange(stops); // blend = 0.6 stop wide, centred on each boundary
  const out = Object.fromEntries([...COLS.map((k) => [k, [0, 0, 0]]), ...NUM.map((k) => [k, 0])]);
  return (t) => {
    const g = ss(g0 - h, g0 + h, t) * (1 - ss(g1 - h, g1 + h, t)), sp = (1 - ss(sw - h, sw + h, t)) * (1 - g), l = 1 - g - sp;
    for (const k of COLS) for (let i = 0; i < 3; i++) out[k][i] = P.sp[k][i] * sp + P.lon[k][i] * l + P.gla[k][i] * g;
    for (const k of NUM) out[k] = P.sp[k] * sp + P.lon[k] * l + P.gla[k] * g;
    return out;
  };
}
