import * as THREE from 'three';
import { blockMaterial } from './textures.js';
export function createBoxes() {
  const list = [];
  return { list, add(x, y, z, w, h, d, color, ry = 0) { list.push(ry ? { x, y, z, w, h, d, color, ry } : { x, y, z, w, h, d, color }); } }; // ry: optional yaw (rad) about the box centre axis; kerbs and pavement slabs follow the route tangent
}
const MATS = new Map(), UP = new THREE.Vector3(0, 1, 0);
export function buildMeshes(list, { glow = [], glowK = {} } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const byColor = new Map();
  for (const b of list) (byColor.get(b.color) ?? byColor.set(b.color, []).get(b.color)).push(b);
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [color, boxes] of byColor) {
    const k = glowK[color], key = color + glow.includes(color) + k;
    const mat = MATS.get(key) ?? MATS.set(key, blockMaterial(color, { glow: glow.includes(color), k })).get(key);
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), b.ry ? q.setFromAxisAngle(UP, b.ry) : q.identity(), s.set(b.w, b.h, b.d))));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.list = list; // for tests/zfight.browser.py
  return group;
}
