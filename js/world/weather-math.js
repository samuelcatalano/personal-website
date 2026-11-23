const clamp = n => Math.max(0, Math.min(1, n));
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

// Always full: symmetric limb shading keeps volume without a phase shadow.
export function moonIllumination(x, y) {
  const r2 = x * x + y * y;
  if (r2 >= 1) return 0;
  return .78 + .22 * Math.sqrt(1 - r2);
}

export function celestialFrame(width, height, headerBottom = 0) {
  const y = Math.min(height - 32, Math.max(height * .15, headerBottom + 38));
  return [.58, 1 - 2 * y / height];
}

// Tileable 3D cloud noise for the sky raymarch, n^3 voxels x 2 channels (RG8):
// R = Perlin-Worley shape (value-noise fbm floored by inverted Worley, 4..16 cells), G = Worley fbm detail (8..32 cells) for edge erosion.
// Both channels wrap at the volume edge (RepeatWrapping in the shader), each normalised to 0..255.
export function cloudNoise(n = 64) {
  const hash = (a, b, c, s) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + s * 19.19) * 43758.5453; return v - Math.floor(v); };
  const worleyPts = f => { const p = new Float32Array(f * f * f * 3); for (let i = 0; i < f * f * f; i++) for (let k = 0; k < 3; k++) p[i * 3 + k] = hash(i, k, f, 1); return p; };
  const pts = Object.fromEntries([4, 8, 16, 32].map(f => [f, worleyPts(f)]));
  const worley = (x, y, z, f) => { // inverted F1 distance, period f cells over the unit cube
    const px = x * f, py = y * f, pz = z * f, cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz), P = pts[f];
    let best = 9;
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const wx = (cx + i + f) % f, wy = (cy + j + f) % f, wz = (cz + k + f) % f, o = (wz * f * f + wy * f + wx) * 3;
      const dx = cx + i + P[o] - px, dy = cy + j + P[o + 1] - py, dz = cz + k + P[o + 2] - pz;
      best = Math.min(best, dx * dx + dy * dy + dz * dz);
    }
    return 1 - Math.min(1, Math.sqrt(best));
  };
  const value = (x, y, z, f) => { // periodic trilinear value noise with smoothstep fade
    const px = x * f, py = y * f, pz = z * f, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    const s = t => t * t * (3 - 2 * t), fx = s(px - ix), fy = s(py - iy), fz = s(pz - iz);
    const h = (a, b, c) => hash((a + f) % f, (b + f) % f, (c + f) % f, f);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(ix, iy, iz), h(ix + 1, iy, iz), fx), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), fx), fy),
      l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), fx), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), fx), fy), fz);
  };
  const r = new Float32Array(n * n * n), g = new Float32Array(n * n * n);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + .5) / n, v = (y + .5) / n, w = (z + .5) / n, i = (z * n + y) * n + x;
    const perlin = value(u, v, w, 4) * .5 + value(u, v, w, 8) * .3 + value(u, v, w, 16) * .2;
    const w8 = worley(u, v, w, 8), w16 = worley(u, v, w, 16), wl = worley(u, v, w, 4) * .625 + w8 * .25 + w16 * .125;
    r[i] = wl + perlin * (1 - wl) * .9 - .45 * (1 - wl); // Perlin-Worley: billows from Worley, fbm breaks the cell pattern
    g[i] = w8 * .625 + w16 * .25 + worley(u, v, w, 32) * .125;
  }
  const out = new Uint8Array(n * n * n * 2);
  for (const [ch, a] of [[0, r], [1, g]]) {
    let lo = Infinity, hi = -Infinity; for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < a.length; i++) out[i * 2 + ch] = Math.round((a[i] - lo) / (hi - lo) * 255);
  }
  return out;
}

export const celestialVisibility =(cover, rain = 0) => (1 - smooth(.70, .99, cover)) * (1 - clamp(rain) * .25);

// shortcut: roof heights quantized to 0.5m and pitched roofs approximated by envelopes; refine for visible close-up shelter gaps.
export function shelterField(footprints) {
  const width = 512, height = 256, data = new Uint8Array(width * height);
  const plots = footprints.filter(p => p.height > 0 && p.hx > 0 && p.hz > 0).map(p => {
    const length = Math.hypot(p.tx ?? 1, p.tz ?? 0) || 1, tx = (p.tx ?? 1) / length, tz = (p.tz ?? 0) / length;
    return { ...p, tx, tz, ex: Math.abs(tx) * p.hx + Math.abs(tz) * p.hz, ez: Math.abs(tz) * p.hx + Math.abs(tx) * p.hz };
  });
  if (!plots.length) return { width, height, data, bounds: [0, 0, 1, 1] };
  const x0 = Math.min(...plots.map(p => p.x - p.ex)) - 4, z0 = Math.min(...plots.map(p => p.z - p.ez)) - 4;
  const w = Math.max(...plots.map(p => p.x + p.ex)) + 4 - x0, d = Math.max(...plots.map(p => p.z + p.ez)) + 4 - z0;
  for (const p of plots) {
    const xa = Math.max(0, Math.floor((p.x - p.ex - x0) / w * width)), xb = Math.min(width - 1, Math.ceil((p.x + p.ex - x0) / w * width));
    const za = Math.max(0, Math.floor((p.z - p.ez - z0) / d * height)), zb = Math.min(height - 1, Math.ceil((p.z + p.ez - z0) / d * height));
    const roof = Math.min(255, Math.ceil(p.height * 2));
    for (let row = za; row <= zb; row++) for (let col = xa; col <= xb; col++) {
      const dx = x0 + (col + .5) / width * w - p.x, dz = z0 + (row + .5) / height * d - p.z;
      if (Math.abs(dx * p.tx + dz * p.tz) <= p.hx && Math.abs(-dx * p.tz + dz * p.tx) <= p.hz) {
        const i = row * width + col; data[i] = Math.max(data[i], roof);
      }
    }
  }
  return { width, height, data, bounds: [x0, z0, w, d] };
}
