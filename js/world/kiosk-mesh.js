import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Red K6-style kiosk (~1 x 2.75 x 1): plinth, dark corner posts, glazed grid on 3 sides + door, light sign band, 4 curved crown pediments.
// (node tests import city.js without three: this module is loaded lazily)
const RED = '#d02028', DARK = '#8c1219', GLASS = '#1f2c36', SIGN = '#f1e6c0', BRASS = '#c9b36a';
const part = (g, color, x = 0, y = 0, z = 0) => {
  g = (g.index ? g.toNonIndexed() : g).translate(x, y, z); g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  return g.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
const box = (w, h, d, x, y, z, c) => part(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);

function kioskParts() {
  const body = [], glass = [], sign = [];
  body.push(box(1.06, 0.12, 1.06, 0, 0, 0, DARK));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.push(box(0.09, 2.2, 0.09, sx * 0.455, 0.12, sz * 0.455, DARK));
  body.push(box(1.0, 0.1, 1.0, 0, 2.32, 0, RED)); // frieze under the crown
  for (let side = 0; side < 4; side++) { // build the +z face, rotate for the rest
    const rot = (g) => g.rotateY(side * Math.PI / 2), F = 0.47, doorSide = side === 0;
    body.push(rot(box(0.82, 0.26, 0.04, 0, 0.12, F, RED))); // solid kick panel
    glass.push(rot(box(0.82, 1.72, 0.02, 0, 0.4, F - 0.01, GLASS)));
    for (const bx of [-0.137, 0.137]) body.push(rot(box(0.03, 1.72, 0.04, bx, 0.4, F + 0.01, RED)));
    for (let k = 0; k <= 5; k++) body.push(rot(box(0.82, 0.03, 0.04, 0, 0.4 + k * 0.338, F + 0.01, RED)));
    body.push(rot(box(0.82, 0.1, 0.05, 0, 2.12, F, RED))); // header rail below the sign
    sign.push(rot(box(0.78, 0.13, 0.03, 0, 2.2, F + 0.005, SIGN)));
    if (doorSide) { body.push(rot(box(0.035, 0.28, 0.05, 0.3, 1.0, F + 0.04, BRASS))); body.push(rot(box(0.05, 1.72, 0.05, 0.38, 0.4, F + 0.02, DARK))); } // handle + door stile
  }
  for (let side = 0; side < 4; side++) { // curved pediments: upper half-discs, flattened
    const g = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.55, 1);
    body.push(part(g, RED, 0, 2.42, 0.44).rotateY(side * Math.PI / 2));
  }
  body.push(part(new THREE.SphereGeometry(0.1, 6, 4), RED, 0, 2.7, 0));
  const merge = (l) => mergeGeometries(l);
  return [merge(body), merge(glass), merge(sign)];
}

export function buildKiosks(spots) {
  const [bg, gg, sg] = kioskParts(), group = new THREE.Group(), o = new THREE.Object3D(); group.name = 'phone-boxes';
  const mats = [
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  ];
  mats[2].userData.glow = true; mats[2].userData.glowK = 1.2; mats[2].userData.glowColor = new THREE.Color('#ffe6a0');
  [bg, gg, sg].forEach((g, j) => {
    const m = new THREE.InstancedMesh(g, mats[j], spots.length); m.name = ['phone-body', 'phone-glass', 'phone-sign'][j];
    spots.forEach(([x, z, yaw], i) => { o.position.set(x, 0, z); o.rotation.y = yaw; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = j !== 1; m.receiveShadow = true; m.frustumCulled = false; group.add(m);
  });
  group.userData.dispose = () => { [bg, gg, sg].forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); };
  return group;
}
