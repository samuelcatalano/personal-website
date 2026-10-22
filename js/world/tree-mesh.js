import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Tree family. Unit conventions (scaled per instance in trees.js):
//  canopy: horizontal radius <= 1, y in [-1, 1] (centre 0); trunk: y in [0, 1] (1 = canopy centre), radii in canopy-radius units.
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const flat = (g, color) => { // non-indexed, flat normals, constant colour attr, no uv
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color(g.attributes.position, i).toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
};

// Per type: many small leaf clumps scattered inside an ellipsoid shell (count, seed). Shape variants come from per-instance aspect in trees.js.
const CLUMPS = { small: [9, 1], medium: [12, 2], large: [16, 3] }; // ponytail: capped by the 250k tree triangle budget (tests/trees.browser.py)

// Natural crown: lots of small noisy clumps instead of a few big faceted lumps. Normals point away from the crown centre
// ("foliage normals") so light wraps the whole crown softly; colour darkens towards the inside/underside (cheap AO).
export function canopyGeometry(type) {
  const [count, seed] = CLUMPS[type], tmp = new THREE.Color(), parts = [];
  for (let k = 0; k < count; k++) {
    const u = (k + hash(k, seed, 1) * 0.6) / count, v = hash(seed, k, 2), shell = 0.42 + 0.3 * Math.sqrt(hash(k, k, seed)); // even azimuths, outer-shell bias
    const th = u * Math.PI * 2, ph = Math.acos(1 - 2 * (0.08 + v * 0.8)), r = 0.4 + hash(k, 3, seed) * 0.16; // overlapping clumps: a full crown with a broken silhouette
    const cx = Math.sin(ph) * Math.cos(th) * shell, cy = Math.cos(ph) * shell * 0.85, cz = Math.sin(ph) * Math.sin(th) * shell;
    const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { // noise-displace along the radial direction, flatten the underside
      const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r, d = 1 + (hash(x + k, y + seed, z) - 0.5) * 0.5;
      p.setXYZ(i, cx + x * r * d, cy + y * r * d * (y < 0 ? 0.7 : 1), cz + z * r * d);
    }
    parts.push(g.toNonIndexed());
  }
  const g = mergeGeometries(parts); g.deleteAttribute('uv');
  const p = g.attributes.position; let rad = 0, ymin = 1e9, ymax = -1e9; // normalise: radius 1, y in [-1, 1]
  for (let i = 0; i < p.count; i++) { rad = Math.max(rad, Math.hypot(p.getX(i), p.getZ(i))); ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
  const yc = (ymin + ymax) / 2, ys = 2 / (ymax - ymin);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / rad, (p.getY(i) - yc) * ys, p.getZ(i) / rad);
  const n = new Float32Array(p.count * 3), c = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const out = v.length(), y = v.y;
    v.set(v.x, v.y * 0.8 + 0.25, v.z).normalize().toArray(n, i * 3); // foliage normal, tilted up so tops catch the sky
    const ao = THREE.MathUtils.clamp(0.62 + out * 0.4, 0.62, 1), top = THREE.MathUtils.clamp((y + 1) / 2, 0, 1), grain = 0.9 + hash(v.x * 9, y * 9, v.z * 9) * 0.2;
    const k = ao * (0.85 + 0.35 * top) * grain; tmp.setRGB(k * 0.97, k, k * 0.9).toArray(c, i * 3); // hue comes from instance tint
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

export function trunkGeometry(type) {
  const bark = new THREE.Color('#5d4a3a'), dark = new THREE.Color('#463a30'), tip = new THREE.Color();
  const limb = (r0, r1, from, to, seg) => { // tapered cylinder between two points
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    return g.translate(...a.add(b).multiplyScalar(0.5).toArray());
  };
  const R = { small: 0.075, medium: 0.09, large: 0.11 }[type], forks = type === 'small' ? 2 : 3, parts = [limb(R * 1.35, R * 0.8, [0, 0, 0], [0, 0.55, 0], 6)];
  for (let i = 0; i < forks; i++) { // 2-3 forks leaning outward into the canopy
    const a = i * Math.PI * 2 / forks + 0.6 + (type === 'large' ? 0.4 : 0);
    parts.push(limb(R * 0.8, R * 0.38, [0, 0.5, 0], [Math.cos(a) * 0.36, 1.0 + 0.1 * i, Math.sin(a) * 0.36], 5));
  }
  const g = flat(mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q))), (p, i) => tip.copy(bark).lerp(dark, THREE.MathUtils.clamp(1 - p.getY(i), 0, 1) * 0.5));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
