import { swapAt, scotRange } from './layout.js';
// Per-region DAY look. Colours are sRGB hex; sun/hemi scale the light intensities, fogK scales fog near/far, cloudOp adds to cloud opacity.
// The regional palettes retain Glasgow overcast while warming the city daylight.
const M = {
  entry: { zen: 0x83b2d4, hor: 0xcbd8e2, cloud: 0xfff1df, light: 0xffd5a0, sun: 1.02, hemi: 1.18, fogK: .90, cloudOp: -.08, rain: 0 },
  sp: { zen: 0x78afcf, hor: 0xd0dce3, cloud: 0xfff4e6, light: 0xffd9a0, sun: 1.03, hemi: 1.14, fogK: 0.94, cloudOp: 0, rain: 0 }, // warm golden
  lon: { zen: 0x80accc, hor: 0xc7d5df, cloud: 0xfff0de, light: 0xffdeb5, sun: .96, hemi: 1.20, fogK: 1, cloudOp: 0, rain: 0 },
  gla: { zen: 0x9aa7b4, hor: 0xcdd0d1, cloud: 0xa9b2bc, light: 0xdbe6f4, sun: 0.6, hemi: 1.25, fogK: 0.5, cloudOp: 0.2, rain: 1 }, // overcast, drizzle
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
    const entry=1-ss(.5/(stops.length-1),1.5/(stops.length-1),t);
    for(const k of COLS)for(let i=0;i<3;i++)out[k][i]+=(P.entry[k][i]-out[k][i])*entry;
    for(const k of NUM)out[k]+=(P.entry[k]-out[k])*entry;
    return out;
  };
}
