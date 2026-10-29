import * as THREE from 'three';

// Shared by facade-kit.js and hirise-kit.js: module placement into the mass/trim/glass accumulators.
export const BUCKET = { mass: 0, trim: 1, glass: 2 };
// Local hash: never touches the city RNG.
export const hash = (id) => { let n = 2166136261; for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0; return n; };
export const pick = (h, shift, n) => (h >>> shift) % n;

export const accumulators = () => Array.from({ length: 3 }, () => ({ position: [], normal: [], uv: [], aSurface: [], color: [] }));
const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Matrix4(), nm = new THREE.Matrix3();
// ry: optional yaw (radians about +Y) so modules can sit on rotated faces.
export function place(acc, kit, name, x, y, z, sx, sy, sz, surf, ry = 0) {
  const mod = kit.get(name);
  if (!mod) throw new Error(`Facade kit module missing: ${name}`);
  q.setFromAxisAngle(UP, ry); one.compose(tmp.set(x, y, z), q, nrm.set(sx, sy, sz)); nm.getNormalMatrix(one);
  for (const [role, data] of Object.entries(mod.roles)) {
    const b = acc[BUCKET[role]], s = surf[role];
    for (let i = 0; i < data.pos.length; i += 3) {
      tmp.fromArray(data.pos, i).applyMatrix4(one); nrm.fromArray(data.nor, i).applyMatrix3(nm).normalize();
      b.position.push(tmp.x, tmp.y, tmp.z); b.normal.push(nrm.x, nrm.y, nrm.z); b.aSurface.push(s); b.color.push(1, 1, 1);
      // Same planar mapping as the procedural slices (1 x 2 m atlas tiles).
      const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y);
      b.uv.push(...(ax > .7 ? [tmp.z, tmp.y] : ay > .7 ? [tmp.x, tmp.z] : [tmp.x, tmp.y]));
    }
  }
}
export const geometryOf = (data) => {
  if (!data.position.length) return null;
  const g = new THREE.BufferGeometry();
  for (const [key, size] of [['position', 3], ['normal', 3], ['uv', 2], ['aSurface', 1], ['color', 3]]) g.setAttribute(key, new THREE.Float32BufferAttribute(data[key], size));
  return g;
};

