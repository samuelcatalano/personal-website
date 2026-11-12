const clamp = n => Math.max(0, Math.min(1, n));
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

// Fixed artistic gibbous phase; keep the unlit limb dim instead of cutting a crescent out of the disc.
export function moonIllumination(x, y) {
  const r2 = x * x + y * y;
  if (r2 >= 1) return 0;
  const light = x * .72 + Math.sqrt(1 - r2) * .694;
  return .07 + .93 * smooth(-.04, .10, light) * (.45 + .55 * Math.max(0, light));
}

export function celestialFrame(width, height, headerBottom = 0) {
  const y = Math.min(height - 32, Math.max(height * .15, headerBottom + 38));
  return [.58, 1 - 2 * y / height];
}

export const celestialVisibility = (cover, rain = 0) => (1 - smooth(.70, .99, cover)) * (1 - clamp(rain) * .25);

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
