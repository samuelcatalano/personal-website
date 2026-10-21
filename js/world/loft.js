import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
// Lofted solids for vehicle bodies. A loft is a stack of rounded cross-sections (superellipse rings) along +x, closed with flat end caps.
// Key = { x, y0, y1, ym, w, wu, n, nu, zc }: bottom, top, height of the widest point, half-width (lower / upper), lower and upper roundness
// exponents (2 = ellipse, 4+ = boxy) and a sideways offset. Keys are blended with monotone cubic interpolation (no overshoot).
// Output geometries are non-indexed, uv-less, with creased normals, ready for mergeGeometries.
const DEF = { n: 3, zc: 0 };
function pchip(xs, ys) { // Fritsch-Carlson monotone Hermite interpolant
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  if (n < 2) return () => ys[0];
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
export function profile(keys) {
  const ks = keys.map((k) => ({ ...DEF, ...k })).sort((a, b) => a.x - b.x).map((k) => ({ ...k, wu: k.wu ?? k.w, nu: k.nu ?? k.n, ym: k.ym ?? (k.y0 + k.y1) / 2 }));
  const xs = ks.map((k) => k.x), f = {};
  for (const p of ['y0', 'y1', 'ym', 'w', 'wu', 'n', 'nu', 'zc']) f[p] = pchip(xs, ks.map((k) => k[p]));
  const at = (x) => { const o = { x }; for (const p in f) o[p] = f[p](x); o.ym = Math.min(Math.max(o.ym, o.y0 + 0.02), o.y1 - 0.02); return o; };
  at.x0 = xs[0]; at.x1 = xs[xs.length - 1];
  return at;
}
const sp = (v, e) => Math.sign(v) * Math.abs(v) ** e;
const ringPt = (p, a) => {
  const c = Math.cos(a), s = Math.sin(a), up = s >= 0, n = up ? p.nu : p.n;
  return [p.zc + (up ? p.wu : p.w) * sp(c, 2 / n), p.ym + (up ? p.y1 - p.ym : p.ym - p.y0) * sp(s, 2 / n)]; // [z, y]
};
// half-width of the section at height y (0 outside it), and top surface height at lateral offset z (null outside)
export const halfW = (p, y) => { if (y <= p.y0 || y >= p.y1) return 0; const up = y >= p.ym, t = up ? (y - p.ym) / (p.y1 - p.ym) : (p.ym - y) / (p.ym - p.y0), n = up ? p.nu : p.n; return (up ? p.wu : p.w) * (1 - t ** n) ** (1 / n); };
export const topY = (p, z) => { const q = Math.abs(z - p.zc) / p.wu; return q >= 1 ? null : p.ym + (p.y1 - p.ym) * (1 - q ** p.nu) ** (1 / p.nu); };
export const botY = (p, z) => { const q = Math.abs(z - p.zc) / p.w; return q >= 1 ? null : p.ym - (p.ym - p.y0) * (1 - q ** p.n) ** (1 / p.n); };
// frontmost x on a profile where the surface at height y reaches lateral offset z (scan from the nose backwards)
export const surfX = (at, y, z) => { for (let x = at.x1; x > at.x0; x -= 0.01) if (halfW(at(x), y) >= Math.abs(z)) return x; return at.x0; };

export function loft(keys, { K = 32, N = 16, xs: extra = [], crease = 0.9 } = {}) {
  const at = profile(keys), a0 = at.x0, a1 = at.x1, set = new Set([...keys.map((k) => k.x), ...extra]);
  for (let i = 0; i <= N; i++) set.add(a0 + (a1 - a0) * i / N);
  const xs = [...set].filter((x) => x >= a0 - 1e-9 && x <= a1 + 1e-9).sort((a, b) => a - b), pos = [], idx = [];
  for (const x of xs) { const p = at(x); for (let j = 0; j < K; j++) { const [z, y] = ringPt(p, j * 2 * Math.PI / K); pos.push(x, y, z); } }
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = i * K + (j + 1) % K, c = (i + 1) * K + (j + 1) % K, d = (i + 1) * K + j;
    idx.push(a, b, c, a, c, d);
  }
  const caps = [[0, false], [xs.length - 1, true]];
  for (const [i, end] of caps) {
    const p = at(xs[i]), c = pos.length / 3; pos.push(xs[i], p.ym, p.zc);
    for (let j = 0; j < K; j++) { const a = i * K + j, b = i * K + (j + 1) % K; idx.push(...(end ? [c, a, b] : [c, b, a])); }
  }
  let vol = 0; // flip when the winding came out inside-out
  for (let t = 0; t < idx.length; t += 3) { const [A, B, C] = [0, 1, 2].map((k) => idx[t + k] * 3); vol += pos[A] * (pos[B + 1] * pos[C + 2] - pos[B + 2] * pos[C + 1]) - pos[A + 1] * (pos[B] * pos[C + 2] - pos[B + 2] * pos[C]) + pos[A + 2] * (pos[B] * pos[C + 1] - pos[B + 1] * pos[C]); }
  if (vol < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setIndex(idx);
  const out = toCreasedNormals(g.toNonIndexed(), crease);
  out.deleteAttribute('uv');
  out.userData.at = at;
  return out;
}
// Surface patch of a loft (windows, panels): the same rings as the loft, clipped to an angle range per station and pushed out by `off`, so it follows the body exactly and has crisp edges.
// angY / angZ give the ring angle where a section reaches height y (side s) / lateral offset z (top, +z half).
export const angY = (p, y, s = 1) => { const up = y >= p.ym, t = up ? (y - p.ym) / (p.y1 - p.ym) : (p.ym - y) / (p.ym - p.y0), a = Math.asin((up ? 1 : -1) * Math.min(1, Math.abs(t)) ** ((up ? p.nu : p.n) / 2)); return s > 0 ? a : Math.PI - a; };
export const angZ = (p, z) => Math.acos(Math.min(1, Math.abs(z - p.zc) / p.wu) ** (p.nu / 2));
export function patch(at, xs, range, off = 0.004, M = 6) {
  const pos = [], idx = [];
  for (const x of xs) {
    const p = at(x), [a0, a1] = range(p);
    for (let j = 0; j <= M; j++) { const [z, y] = ringPt(p, a0 + (a1 - a0) * j / M), dz = z - p.zc, dy = y - p.ym, l = Math.hypot(dz, dy) || 1; pos.push(x, y + dy / l * off, z + dz / l * off); }
  }
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c = a + M + 2, d = a + M + 1; idx.push(a, b, c, a, c, d); }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setIndex(idx);
  g.computeVertexNormals();
  const m = Math.floor(idx.length / 6) * 3, n = g.attributes.normal, p0 = g.attributes.position, p = at(xs[0]); // face outward? compare with the radial direction at this vertex
  if (n.getY(idx[m]) * (p0.getY(idx[m]) - p.ym) + n.getZ(idx[m]) * (p0.getZ(idx[m]) - p.zc) < 0) { for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]]; g.setIndex(idx); g.computeVertexNormals(); }
  const out = g.toNonIndexed(); out.deleteAttribute('uv');
  return out;
}
// Closed solid from explicit rings of 3D points (same count per ring, same winding); used for wings, fins, pylons. Flat end caps, flat shading.
export function tube(rings) {
  const K = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(...p);
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < K; j++) { const a = i * K + j, b = i * K + (j + 1) % K, c = (i + 1) * K + (j + 1) % K, d = (i + 1) * K + j; idx.push(a, b, c, a, c, d); }
  for (const [i, end] of [[0, false], [rings.length - 1, true]]) {
    const c = pos.length / 3, m = rings[i].reduce((s, p) => s.map((v, k) => v + p[k] / K), [0, 0, 0]); pos.push(...m);
    for (let j = 0; j < K; j++) { const a = i * K + j, b = i * K + (j + 1) % K; idx.push(...(end ? [c, a, b] : [c, b, a])); }
  }
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) { const [A, B, C] = [0, 1, 2].map((k) => idx[t + k] * 3); vol += pos[A] * (pos[B + 1] * pos[C + 2] - pos[B + 2] * pos[C + 1]) - pos[A + 1] * (pos[B] * pos[C + 2] - pos[B + 2] * pos[C]) + pos[A + 2] * (pos[B] * pos[C + 1] - pos[B + 1] * pos[C]); }
  if (vol < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setIndex(idx).toNonIndexed();
  g.computeVertexNormals(); g.deleteAttribute('uv');
  return g;
}
