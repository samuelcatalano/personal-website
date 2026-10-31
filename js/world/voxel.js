import * as THREE from 'three';
import { blockMaterial } from './textures.js';
import { createPlantGeometry } from './plant-mesh.js';
export function createBoxes() {
  const list = [];
  const add = (x, y, z, w, h, d, color, ry = 0) => { list.push(ry ? { x, y, z, w, h, d, color, ry } : { x, y, z, w, h, d, color }); };
  add.plant = (kind, x, y, z, w, h, d, tint, yaw = 0) => { list.push({ plant: kind, x, y, z, w, h, d, tint, yaw }); };
  return { list, add }; // ry: optional yaw (rad) about the box centre axis; kerbs and pavement slabs follow the route tangent
}
const MATS = new Map(), PLANT_MATS = new Map(), PLANT_GEOS = new Map(), UP = new THREE.Vector3(0, 1, 0);
export function buildMeshes(list, { glow = [], glowK = {} } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const plants = list.filter(b => b.plant), boxes = plants.length ? list.filter(b => !b.plant) : list, byColor = new Map(), byPlant = new Map();
  for (const b of boxes) (byColor.get(b.color) ?? byColor.set(b.color, []).get(b.color)).push(b);
  for (const b of plants) (byPlant.get(b.plant) ?? byPlant.set(b.plant, []).get(b.plant)).push(b);
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
  for (const [kind, records] of byPlant) {
    const geometry = PLANT_GEOS.get(kind) ?? PLANT_GEOS.set(kind, createPlantGeometry(kind)).get(kind);
    const material = PLANT_MATS.get(kind) ?? PLANT_MATS.set(kind, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })).get(kind);
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    records.forEach((b, i) => {
      mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), b.yaw ? q.setFromAxisAngle(UP, b.yaw) : q.identity(), s.set(b.w, b.h, b.d)));
      mesh.setColorAt(i, new THREE.Color(b.tint));
    });
    mesh.instanceMatrix.needsUpdate = mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.plantKind = kind;
    group.add(mesh);
  }
  group.userData.list = boxes; // box-only list for tests/zfight.browser.py
  group.userData.plants = plants;
  return group;
}
