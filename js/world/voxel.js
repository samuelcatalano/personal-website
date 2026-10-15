import * as THREE from 'three';

export function createBoxes() {
  const list = [];
  return { list, add(x, y, z, w, h, d, color) { list.push({ x, y, z, w, h, d, color }); } };
}

// One InstancedMesh per colour; each box is a scaled unit cube, so a 4x30x4 tower is one instance.
export function buildMeshes(list, { glow = [] } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const byColor = new Map();
  for (const b of list) (byColor.get(b.color) ?? byColor.set(b.color, []).get(b.color)).push(b);
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [color, boxes] of byColor) {
    const mat = new THREE.MeshLambertMaterial({ color });
    mat.userData.glow = glow.includes(color);
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d))));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
