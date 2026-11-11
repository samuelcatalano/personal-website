// Shared by foliage, awning hems and pavement; scene owns time (frozen for reduced motion).
export const streetEnvironment = { time: { value: 0 }, regions: { value: new Float32Array([0, 1e6, 1e6 + 1]) } };
export function setStreetRegions(uk, scotlandStart, scotlandEnd) {
  streetEnvironment.regions.value.set([uk, scotlandStart, scotlandEnd]);
}
export const STREET_WIND = `
float streetGust(float t, vec2 anchor) {
  float envelope = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * 0.27), 2.0);
  return envelope * (sin(t * 1.15 - dot(anchor, vec2(0.045, 0.018))) + 0.18 * sin(t * 2.7));
}`;

// A stable subset of existing commercial frontages; does not consume city RNG.
export function shopFrontages(plots) {
  return plots.filter(p => p.kind === 'shop' && p.width >= 5 && p.depth >= 5 && p.height >= 5.5)
    .filter(p => { let h = 2166136261; for (const c of p.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h % 3 === 0; })
    .map(p => ({ id: p.id, x: p.x, z: p.z + (p.depth - .4) / 2, width: Math.min(5, p.width * .65) }));
}
