import { swapAt, scotRange } from './layout.js';
// Per-region DAY look. Colours are sRGB hex; sun/hemi scale the light intensities, fogK scales fog near/far, cloudOp adds to cloud opacity.
// The regional palettes retain Glasgow overcast while warming the city daylight.
const M = { // golden-hour North Star: saturated zenith, warm horizon haze, warm key with a lower cool fill for contrast
  entry: { zen: 0x3d8ad6, hor: 0xe3e5df, cloud: 0xfff0dc, light: 0xffdcae, sun: 1.32, hemi: 1.0, fogK: 1.25, cloudOp: .1, rain: 0 },
  sp: { zen: 0x3a86d4, hor: 0xe7e3d8, cloud: 0xfff1de, light: 0xffd9a8, sun: 1.34, hemi: 0.98, fogK: 1.3, cloudOp: .1, rain: 0 }, // warm golden
  lon: { zen: 0x4a8fd2, hor: 0xdce3e7, cloud: 0xfff3e4, light: 0xffe0b8, sun: 1.28, hemi: 1.02, fogK: 1.3, cloudOp: .08, rain: 0 },
  gla: { zen: 0x8a9db2, hor: 0xc9ccce, cloud: 0xb3bcc6, light: 0xe2e6ee, sun: 0.7, hemi: 1.1, fogK: 0.6, cloudOp: 0.2, rain: 1 }, // overcast, drizzle
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
