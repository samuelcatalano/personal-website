// Pure helpers for the river water (no three.js import, so node tests can load them).

// The bank reflection survives a quality drop. The full city is a high-tier diagnostic.
export const REFLECT_DEFAULT = 'landmarks';
export function reflectionMode(tier, flag, fallback = REFLECT_DEFAULT) {
  if (flag === '0') return 'off';
  if (tier === 'high' && flag === '1') return 'full';
  return fallback;
}

// Tileable procedural detail map: a sum of waves with integer wave vectors (so it wraps seamlessly), amplitude ~ 1/|k|.
// RGBA bytes: R,G = height slope (0.5 = flat), B = height (foam / bed noise), A = 255. Mipmaps average the slopes towards
// flat, which is what keeps the far water from shimmering.
export function detailWaves(waves = 28, seed = 7) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const out = [];
  while (out.length < waves) {
    const kx = Math.round(rnd() * 14 - 7), ky = Math.round(rnd() * 14 - 7), k = Math.hypot(kx, ky);
    if (k < 1.5) continue;
    out.push({ kx, ky, a: 1 / k, p: rnd() * Math.PI * 2 });
  }
  return out;
}
export function detailHeight(wv, u, v) { // u, v in tile units (period 1)
  let h = 0;
  for (const w of wv) h += w.a * Math.sin(2 * Math.PI * (w.kx * u + w.ky * v) + w.p);
  return h;
}
export function detailTexture(size = 128, waves = detailWaves()) {
  const data = new Uint8Array(size * size * 4), H = new Float32Array(size * size), GX = new Float32Array(size * size), GY = new Float32Array(size * size);
  let hMax = 1e-6, gMax = 1e-6;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = y * size + x;
    let h = 0, gx = 0, gy = 0;
    for (const w of waves) {
      const ph = 2 * Math.PI * (w.kx * u + w.ky * v) + w.p, c = Math.cos(ph) * w.a;
      h += w.a * Math.sin(ph); gx += c * w.kx; gy += c * w.ky;
    }
    H[i] = h; GX[i] = gx; GY[i] = gy;
    hMax = Math.max(hMax, Math.abs(h)); gMax = Math.max(gMax, Math.abs(gx), Math.abs(gy));
  }
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round(127.5 + 127.5 * GX[i] / gMax);
    data[i * 4 + 1] = Math.round(127.5 + 127.5 * GY[i] / gMax);
    data[i * 4 + 2] = Math.round(127.5 + 127.5 * H[i] / hMax);
    data[i * 4 + 3] = 255;
  }
  return data;
}
