import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Tree family. Unit conventions (scaled per instance in trees.js):
//  canopy: horizontal radius <= 1, y in [-1, 1] (centre 0); trunk: y in [0, 1] (1 = canopy centre), radii in canopy-radius units.
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// Leaf atlas (procedural, no external asset): left 3/4 = a cluster of small leaves with alpha cut-outs, right 1/4 = solid
// (the inner foliage masses sample it). Grey values are shade only; hue comes from the instance tint.
export function leafTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(192, 0, 64, 128);
  for (let i = 0; i < 80; i++) { // back leaves first (darker), front leaves last (lighter): depth inside each card
    const x = 10 + hash(i, 1, 2) * 172, y = 8 + hash(i, 3, 4) * 112, a = hash(i, 5, 6) * Math.PI * 2, l = 9 + hash(i, 7, 8) * 6, k = 180 + i / 80 * 50 + hash(i, 9, 1) * 25;
    const w = hash(i, 2, 9) - 0.5; // slight warm/cool shift per leaf
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgb(${k + w * 18 | 0},${k | 0},${k - w * 22 | 0})`; g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * 0.62, l, 0); g.quadraticCurveTo(0, l * 0.62, -l, 0); g.fill(); // pointed leaf
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.8; g.stroke(); // edge: leaves read separately
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(-l * 0.8, 0); g.lineTo(l * 0.8, 0); g.stroke(); // midrib catches the light
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Per type: inner masses [count, seed] + leaf cards per tree. Shape variants come from per-instance aspect in trees.js.
const CROWN = { small: [5, 1, 110], medium: [6, 2, 150], large: [8, 3, 200] }; // ponytail: card counts capped by the 250k tree triangle budget (tests/trees.browser.py)

// Crown = a few solid inner masses (shade + volume) covered with alpha-tested leaf cards (fringed silhouette, small-leaf detail).
// Normals point out of the crown ("foliage normals") so light wraps it softly; colour darkens towards the inside/underside.
export function canopyGeometry(type) {
  const [count, seed, cards] = CROWN[type], masses = [], pos = [], uv = [], jit = [], ctr = [];
  for (let k = 0; k < count; k++) {
    const th = (k + hash(k, seed, 1) * 0.6) / count * Math.PI * 2, ph = Math.acos(1 - 2 * (0.15 + hash(seed, k, 2) * 0.7)), shell = k ? 0.42 + 0.2 * hash(k, k, seed) : 0;
    masses.push([Math.sin(ph) * Math.cos(th) * shell, Math.cos(ph) * shell * 0.8 + (k ? 0 : 0.05), Math.sin(ph) * Math.sin(th) * shell, k ? 0.42 + hash(k, 3, seed) * 0.14 : 0.58]);
  }
  for (const [cx, cy, cz, r] of masses) { // inner masses: low-poly, solid texel
    const g = new THREE.IcosahedronGeometry(r * 0.92, 1).toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { pos.push(cx + p.getX(i), cy + p.getY(i) * (p.getY(i) < 0 ? 0.75 : 1), cz + p.getZ(i)); uv.push(0.88, 0.5); jit.push(0.8 + 0.2 * (p.getY(i) / r * 0.5 + 0.5)); ctr.push(cx, cy, cz); }
    g.dispose();
  }
  const d = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let c = 0; c < cards; c++) { // leaf cards on the mass surfaces, biased upward and outward, random roll and tilt
    const [cx, cy, cz, r] = masses[Math.floor(hash(c, seed, 11) * masses.length)], th = hash(c, 12, seed) * Math.PI * 2, y = -0.55 + hash(seed, c, 13) * 1.5;
    d.set(Math.cos(th) * Math.sqrt(1 - Math.min(1, y * y)), Math.min(1, y), Math.sin(th) * Math.sqrt(1 - Math.min(1, y * y))).normalize();
    const o = new THREE.Vector3(cx, cy, cz).addScaledVector(d, r * (0.8 + hash(c, 14, seed) * 0.3)), size = 0.4 + hash(c, seed, 15) * 0.16;
    const n = d.clone().add(new THREE.Vector3(hash(c, 1, 16) - 0.5, hash(c, 2, 16) - 0.5, hash(c, 3, 16) - 0.5).multiplyScalar(1.1)).normalize();
    t1.crossVectors(Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, n).normalize(); t2.crossVectors(n, t1);
    const roll = hash(c, 17, seed) * Math.PI * 2, a = t1.clone().multiplyScalar(Math.cos(roll)).addScaledVector(t2, Math.sin(roll)).multiplyScalar(size), b = n.clone().cross(a);
    const u0 = Math.floor(hash(c, 18, seed) * 3) * 0.25; // one of three tiles in the leaf area
    const q = [o.clone().sub(a).sub(b), o.clone().add(a).sub(b), o.clone().add(a).add(b), o.clone().sub(a).add(b)], quv = [[u0, 0], [u0 + 0.25, 0], [u0 + 0.25, 1], [u0, 1]];
    const j = (0.92 + hash(c, 19, seed) * 0.22) * (0.8 + 0.2 * (d.y * 0.5 + 0.5)); // per-card jitter x mild clump shade
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(q[i].x, q[i].y, q[i].z); uv.push(...quv[i]); jit.push(j); ctr.push(cx, cy, cz); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const p = g.attributes.position; let rad = 0, ymin = 1e9, ymax = -1e9; // normalise: radius 1, y in [-1, 1]
  for (let i = 0; i < p.count; i++) { rad = Math.max(rad, Math.hypot(p.getX(i), p.getZ(i))); ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
  const yc = (ymin + ymax) / 2, ys = 2 / (ymax - ymin);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / rad, (p.getY(i) - yc) * ys, p.getZ(i) / rad);
  const nrm = new Float32Array(p.count * 3), col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const out = Math.min(1, v.length()), y = v.y;
    const m = new THREE.Vector3(ctr[i * 3] / rad, (ctr[i * 3 + 1] - yc) * ys, ctr[i * 3 + 2] / rad), cl = v.clone().sub(m).normalize(); // out of this vertex's clump
    v.normalize().multiplyScalar(0.25).addScaledVector(cl, 0.75); // clump + crown normal: the sun models each lump, the crown stays one volume
    v.set(v.x, v.y * 0.8 + 0.25, v.z).normalize().toArray(nrm, i * 3); // tilted up so tops catch the sky
    const k = 1.12 * jit[i] * (0.42 + 0.66 * out ** 2) * (0.85 + 0.35 * THREE.MathUtils.clamp((y + 1) / 2, 0, 1)); // inner/underside shade, sunlit top
    col.set([k * 0.95, k, k * (0.86 + 0.06 * (1 - out))], i * 3); // inner shade slightly cooler
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

// Trunk: flared base with surface roots, a slight lean/twist, and 3-5 branches reaching into the crown (y = 1 is the crown centre).
export function trunkGeometry(type) {
  const bark = new THREE.Color('#4b3c33'), dark = new THREE.Color('#2f2621'), tip = new THREE.Color();
  const limb = (r0, r1, from, to, seg) => { // tapered cylinder between two points, smooth normals
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg, 2, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(...a.add(b).multiplyScalar(0.5).toArray()); const n = g.toNonIndexed(); g.dispose(); return n;
  };
  const R = { small: 0.1, medium: 0.12, large: 0.14 }[type], forks = { small: 3, medium: 4, large: 5 }[type], s = { small: 1, medium: 2, large: 3 }[type];
  const parts = [limb(R * 1.45, R * 1.05, [0, 0, 0], [0.03, 0.3, 0.02], 8), limb(R * 1.05, R * 0.8, [0.03, 0.3, 0.02], [-0.02, 0.58, 0.04], 8)];
  for (let i = 0; i < 5; i++) { // surface roots
    const a = i * Math.PI * 2 / 5 + hash(i, s, 1) * 0.6, l = 0.32 + hash(i, s, 2) * 0.14;
    parts.push(limb(R * 0.75, R * 0.12, [Math.cos(a) * R * 0.6, 0.14, Math.sin(a) * R * 0.6], [Math.cos(a) * l, -0.01, Math.sin(a) * l], 5));
  }
  for (let i = 0; i < forks; i++) { // branches lean outward into the crown
    const a = i * Math.PI * 2 / forks + 0.5 + hash(i, s, 3) * 0.5, out = 0.32 + hash(i, s, 4) * 0.2, top = 0.92 + hash(i, s, 5) * 0.3;
    parts.push(limb(R * 0.62, R * 0.22, [-0.02, 0.52, 0.04], [Math.cos(a) * out, top, Math.sin(a) * out], 6));
  }
  const g = mergeGeometries(parts); g.deleteAttribute('uv'); g.computeVertexNormals();
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) tip.copy(dark).lerp(bark, THREE.MathUtils.clamp(p.getY(i) * 1.6 + 0.25, 0, 1)).toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
