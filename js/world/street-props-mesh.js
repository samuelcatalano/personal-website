import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOOT } from './street-props.js';
// Street prop geometry: one InstancedMesh per prop type, all sharing one painted-metal material; the Belisha globe has its own glowing one (sky.js night loop).
// Footprints live in street-props.js (FOOT); every mesh here fits inside its footprint.
const part = (g, color, x = 0, y = 0, z = 0) => {
  g = (g.index ? g.toNonIndexed() : g).translate(x, y, z); g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  return g.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
const cyl = (r0, r1, h, y, c, seg = 8) => part(new THREE.CylinderGeometry(r1, r0, h, seg), c, 0, y + h / 2, 0); // r0 bottom, r1 top
const box = (w, h, d, x, y, z, c) => part(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
const GEOMS = {
  bollard: () => [mergeGeometries([cyl(0.09, 0.08, 0.85, 0, '#2d3136'), cyl(0.085, 0.085, 0.07, 0.62, '#e9e6dc'), cyl(0.08, 0.04, 0.06, 0.85, '#2d3136')])],
  bin: () => [mergeGeometries([cyl(0.22, 0.24, 0.8, 0, '#2f4a3b', 10), cyl(0.25, 0.25, 0.06, 0.8, '#1c1f22', 10), cyl(0.2, 0.2, 0.02, 0.86, '#101214', 10), box(0.2, 0.07, 0.01, 0, 0.55, 0.235, '#d9d5c6')])],
  hydrant: () => [mergeGeometries([cyl(0.11, 0.1, 0.52, 0, '#b8312b'), cyl(0.12, 0.12, 0.05, 0.52, '#8f2420'), cyl(0.1, 0.03, 0.1, 0.57, '#b8312b'), box(0.34, 0.09, 0.09, 0, 0.3, 0, '#b8312b'), cyl(0.12, 0.13, 0.05, 0, '#6e1c19')])],
  marker: () => [mergeGeometries([cyl(0.035, 0.03, 1.1, 0, '#3b4045', 6), box(0.26, 0.2, 0.015, 0, 0.9, 0.025, '#f2c400'), box(0.05, 0.12, 0.018, 0, 0.94, 0.03, '#1c1f22')])],
  rack: () => { const g = []; for (const x of [-0.4, 0, 0.4]) g.push(box(0.04, 0.8, 0.04, x, 0, -0.08, '#9aa1a8'), box(0.04, 0.8, 0.04, x, 0, 0.08, '#9aa1a8'), box(0.04, 0.04, 0.2, x, 0.8, 0, '#9aa1a8')); return [mergeGeometries(g)]; }, // Sheffield stands: two posts + top bar each
  beacon: () => { // black/white banded pole + amber globe
    const pole = [cyl(0.07, 0.07, 0.12, 0, '#1c1f22')]; for (let k = 0; k < 6; k++) pole.push(cyl(0.05, 0.05, 0.3, 0.12 + k * 0.3, k % 2 ? '#f2f0ea' : '#1c1f22')); pole.push(cyl(0.06, 0.05, 0.06, 1.92, '#1c1f22'), cyl(0.09, 0.09, 0.05, 2.18, '#1c1f22'));
    return [mergeGeometries(pole), part(new THREE.SphereGeometry(0.165, 10, 8), '#ffb02e', 0, 2.36, 0)];
  },
};
export function buildProps(items) {
  const group = new THREE.Group(), o = new THREE.Object3D(), counts = {}, geoms = []; group.name = 'street-props';
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: '#000000' });
  glass.userData.glow = true; glass.userData.glowK = 2.2; glass.userData.glowColor = new THREE.Color('#ffa21f'); // sky.js: emissive = glowColor * night * glowK
  for (const kind of Object.keys(FOOT)) {
    const list = items.filter((i) => i.kind === kind);
    if (!list.length) continue;
    counts[kind] = list.length;
    GEOMS[kind]().forEach((g, j) => {
      geoms.push(g);
      const m = new THREE.InstancedMesh(g, j ? glass : metal, list.length); m.name = `prop-${kind}${j ? '-glass' : ''}`;
      list.forEach(({ x, y, z, yaw }, i) => { o.position.set(x, y, z); o.rotation.y = yaw; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); // no cast: tiny props, keeps the shadow pass untouched
    });
  }
  group.userData.counts = counts;
  group.userData.dispose = () => { geoms.forEach((g) => g.dispose()); metal.dispose(); glass.dispose(); };
  return group;
}
