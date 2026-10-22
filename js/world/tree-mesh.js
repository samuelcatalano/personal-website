import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Low-poly tree family. Unit conventions (scaled per instance in trees.js):
//  canopy: horizontal radius <= 1, y in [-1, 1] (centre 0); trunk: y in [0, 1] (1 = canopy centre), radii in canopy-radius units.
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const flat = (g, color) => { // non-indexed, flat normals, constant colour attr, no uv
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color(g.attributes.position, i).toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
};

// Per type: lump layout [cx, cy, cz, r] (overlapping, leaves gaps between them). Shape variants come from per-instance aspect in trees.js.
const LUMPS = {
  small: [[0, 0.1, 0, 0.62], [0.42, -0.2, 0.15, 0.42], [-0.38, -0.1, -0.2, 0.44], [0.05, 0.55, -0.3, 0.38]],
  medium: [[0, 0.1, 0, 0.58], [0.5, -0.15, 0.2, 0.42], [-0.46, -0.05, 0.25, 0.44], [0.12, 0.5, -0.32, 0.4], [-0.1, -0.35, -0.5, 0.36]],
  large: [[0, 0.15, 0, 0.55], [0.55, -0.1, 0.2, 0.42], [-0.55, -0.05, 0.1, 0.44], [0.2, 0.5, 0.3, 0.38], [-0.25, 0.45, -0.3, 0.4], [0.1, -0.3, -0.55, 0.38], [0.35, -0.3, -0.35, 0.34]],
};

export function canopyGeometry(type) {
  const tmp = new THREE.Color(), parts = LUMPS[type].map(([cx, cy, cz, r], k) => {
    const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { // noise-displace along the radial direction, squash the underside
      const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r, d = 1 + (hash(x + k, y, z) - 0.5) * 0.4;
      p.setXYZ(i, cx + x * r * d, cy + y * r * d * (y < 0 ? 0.8 : 1), cz + z * r * d);
    }
    return g;
  });
  const g = flat(mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q))), (p, i) => { // lighter top, darker underside + per-vertex grain
    const y = p.getY(i), t = THREE.MathUtils.clamp((y + 0.8) / 1.7, 0, 1), grain = 0.9 + hash(p.getX(i), y, p.getZ(i)) * 0.2;
    const k = (0.7 + 0.48 * t) * grain; return tmp.setRGB(k, k, k); // neutral shade (-30% under, +18% top); hue comes from instance tint
  });
  const p = g.attributes.position; let rad = 0, ymin = 1e9, ymax = -1e9; // normalise: radius 1, y in [-1, 1]
  for (let i = 0; i < p.count; i++) { rad = Math.max(rad, Math.hypot(p.getX(i), p.getZ(i))); ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
  const yc = (ymin + ymax) / 2, ys = 2 / (ymax - ymin);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / rad, (p.getY(i) - yc) * ys, p.getZ(i) / rad);
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
