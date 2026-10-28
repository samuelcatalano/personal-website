import * as THREE from 'three';
import { untone } from './sky.js';
// Far skyline rows: one unfogged MeshBasic InstancedMesh per row, colours authored as the on-screen value (untone, like the sky) so scene fog cannot wash them to the horizon.
// Instance colour = base/top split (darker base, lighter top); material colour lerps day -> night in update(night). ponytail: flat silhouettes, no lighting/shadows.
const DAY = ['#4d6277', '#5e7489', '#72889d'].map((c) => new THREE.Color(c)), NIGHT = ['#0a1226', '#0e1832', '#142040'].map((c) => new THREE.Color(c));
export function createSkyline(list) {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), m = new THREE.Matrix4(), s = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  const tones = [new THREE.Color(0.78, 0.8, 0.84), new THREE.Color(1, 1, 1)]; // base, top
  const rows = [0, 1, 2].map((r) => {
    const boxes = list.filter((b) => b.color[3] === String(r)), mat = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => { mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d))); mesh.setColorAt(i, tones[b.color.endsWith('t') ? 1 : 0]); });
    mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
    g.add(mesh); return mat;
  });
  g.name = 'distant-skyline';
  g.userData.update = (night) => rows.forEach((mat, r) => untone(mat.color.lerpColors(DAY[r], NIGHT[r], night)));
  g.userData.update(0);
  return g;
}
