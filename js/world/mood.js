import { swapAt, scotRange } from './layout.js';
import { visitWeather } from './weather.js';
// Per-region DAY look. Colours are sRGB hex; sun/hemi scale the light intensities, fogK scales fog near/far, cloudOp adds to cloud opacity.
// The regional palettes retain Glasgow overcast while warming the city daylight.
const M = { // golden-hour North Star: saturated zenith, warm horizon haze, warm key with a lower cool fill for contrast
  entry: { zen: 0x3d8ad6, hor: 0xe3e5df, cloud: 0xfff0dc, light: 0xffdcae, sun: 1.32, hemi: 1.0, fogK: 1.25, cloudOp: .1, rain: 0 },
  sp: { zen: 0x3a86d4, hor: 0xe7e3d8, cloud: 0xfff1de, light: 0xffd9a8, sun: 1.34, hemi: 0.98, fogK: 1.3, cloudOp: .1, rain: 0 }, // warm golden
  lon: { zen: 0x4a8fd2, hor: 0xdce3e7, cloud: 0xfff3e4, light: 0xffe0b8, sun: 1.28, hemi: 1.02, fogK: 1.3, cloudOp: .08, rain: 0 },
  gla: { zen: 0x8a9db2, hor: 0xc9ccce, cloud: 0xb3bcc6, light: 0xe2e6ee, sun: 1.2, hemi: 1.02, fogK: 1.05, cloudOp: 0.2, rain: 0 }, // muted overcast, clear controls
};
const RAIN = {
  sp: { zen: 0x384d62, hor: 0x87949b, cloud: 0x8798a5, light: 0xc7c9bb },
  lon: { zen: 0x4b5d70, hor: 0x9aa8b3, cloud: 0xa3adb6, light: 0xc0cbd9 },
  gla: { zen: 0x43566b, hor: 0x91a0ad, cloud: 0x91a1b2, light: 0xbac9da },
};
const rgb = (h) => [(h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const P = Object.fromEntries(Object.entries(M).map(([k, m]) => [k, { ...m, zen: rgb(m.zen), hor: rgb(m.hor), cloud: rgb(m.cloud), light: rgb(m.light) }]));
const RP = Object.fromEntries(Object.entries(RAIN).map(([region, palette]) => [region, Object.fromEntries(Object.entries(palette).map(([k, hex]) => [k, rgb(hex)]))]));
const ss = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const COLS = ['zen', 'hor', 'cloud', 'light'], NUM = ['sun', 'hemi', 'fogK', 'cloudOp', 'rain', 'cover', 'wet', 'storm', 'fall', 'wind'];
// Factory: ranges are computed once; the returned (t) => mood reuses one output object (no per-frame allocation).
export function createMood(stops, { weather = visitWeather } = {}) {
  const h = 0.3 / (stops.length - 1), sw = swapAt(stops), [g0, g1] = scotRange(stops); // blend = 0.6 stop wide, centred on each boundary
  const prepare = (base, climate, region) => {
    const amount = climate.rain > 0 ? climate.cover : 0, palette = { ...base };
    for (const k of COLS) palette[k] = base[k].map((v, i) => v + (RP[region][k][i] - v) * amount);
    palette.sun = base.sun * (1 - 0.72 * amount);
    palette.hemi = base.hemi + 0.25 * amount;
    palette.fogK = base.fogK * (1 - 0.48 * amount);
    palette.cloudOp = base.cloudOp + climate.cover * 0.25;
    for (const k of ['rain', 'cover', 'wet', 'storm', 'fall', 'wind']) palette[k] = climate[k];
    return palette;
  };
  const weatherMood = {
    entry: prepare(P.entry, weather.sp, 'sp'),
    sp: prepare(P.sp, weather.sp, 'sp'),
    lon: prepare(P.lon, weather.lon, 'lon'),
    gla: prepare(P.gla, weather.gla, 'gla'),
  };
  const out = Object.fromEntries([...COLS.map((k) => [k, [0, 0, 0]]), ...NUM.map((k) => [k, 0])]);
  return (t) => {
    const g = ss(g0 - h, g0 + h, t) * (1 - ss(g1 - h, g1 + h, t)), sp = (1 - ss(sw - h, sw + h, t)) * (1 - g), l = 1 - g - sp;
    for (const k of COLS) for (let i = 0; i < 3; i++) out[k][i] = weatherMood.sp[k][i] * sp + weatherMood.lon[k][i] * l + weatherMood.gla[k][i] * g;
    for (const k of NUM) out[k] = weatherMood.sp[k] * sp + weatherMood.lon[k] * l + weatherMood.gla[k] * g;
    const entry=1-ss(.5/(stops.length-1),1.5/(stops.length-1),t);
    for(const k of COLS)for(let i=0;i<3;i++)out[k][i]+=(weatherMood.entry[k][i]-out[k][i])*entry;
    for(const k of NUM)out[k]+=(weatherMood.entry[k]-out[k])*entry;
    return out;
  };
}
