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
const tilt = (g, color, ang, x, y, z) => part(g.rotateX(ang), color, x, y, z);
GEOMS.pillar = () => [mergeGeometries([cyl(0.29, 0.27, 1.3, 0, '#b01c24', 12), cyl(0.31, 0.31, 0.07, 1.3, '#8c1219', 12), cyl(0.3, 0.1, 0.14, 1.37, '#b01c24', 12), box(0.3, 0.05, 0.02, 0, 1.0, 0.28, '#17191b'), box(0.2, 0.12, 0.012, 0, 0.62, 0.275, '#efe7d2')])];
GEOMS.shelter = () => { // posts, roof with overhang, bench seat, back rail; the lit advert panel is the glowing part
  const g = []; for (const x of [-1.35, 1.35]) for (const z of [-0.5, 0.5]) g.push(box(0.06, 2.35, 0.06, x, 0, z, '#2d3136'));
  g.push(box(2.9, 0.09, 1.25, 0, 2.35, 0, '#3a4047'), box(2.7, 0.05, 0.4, 0, 0.5, 0.28, '#6b4f3a'), box(2.7, 0.04, 0.04, 0, 1.05, 0.5, '#2d3136'), box(0.04, 1.5, 0.04, -0.45, 0.5, 0.5, '#2d3136'), box(0.04, 1.5, 0.04, 0.45, 0.5, 0.5, '#2d3136'));
  return [mergeGeometries(g), box(0.8, 1.15, 0.04, 1.0, 0.85, 0.52, '#ffe2a8')];
};
GEOMS.cafe = () => { // round table with two chairs facing it
  const g = [cyl(0.4, 0.4, 0.04, 0.72, '#d8cdb6', 14), cyl(0.04, 0.04, 0.72, 0, '#26292c', 6), cyl(0.2, 0.2, 0.025, 0, '#26292c', 10)];
  for (const s of [-1, 1]) { const x = s * 0.65; g.push(box(0.4, 0.04, 0.4, x, 0.44, 0, '#7a2f2a'), box(0.04, 0.42, 0.4, x + s * 0.17, 0.46, 0, '#7a2f2a'));
    for (const dx of [-0.16, 0.16]) for (const dz of [-0.16, 0.16]) g.push(box(0.03, 0.44, 0.03, x + dx, 0, dz, '#26292c')); }
  g.push(box(.09,.10,.09,-.15,.76,.10,'#eee5d6'), box(.09,.10,.09,.15,.76,-.10,'#eee5d6'));
  // A low terracotta pot beside the table, clear of both chairs and their original footprint.
  g.push(box(.22,.24,.22,0,0,-.34,'#a76d50'), box(.26,.04,.26,0,.24,-.34,'#b17a59'),
    box(.16,.19,.16,0,.28,-.34,'#526747'), box(.10,.10,.10,-.06,.43,-.34,'#657850'));
  return [mergeGeometries(g)];
};
GEOMS.board = () => [mergeGeometries([tilt(new THREE.BoxGeometry(0.5, 0.86, 0.03), '#2b3a32', 0.2, 0, 0.43, 0.13), tilt(new THREE.BoxGeometry(0.5, 0.86, 0.03), '#2b3a32', -0.2, 0, 0.43, -0.13), tilt(new THREE.BoxGeometry(0.38, 0.5, 0.012), '#e8e2d2', 0.2, 0, 0.5, 0.15)])];
// bicycles locked at the racks: wheels, frame, saddle, bars (one per two racks, deterministic)
const bikeGeom = () => {
  const ring = (x) => part(new THREE.TorusGeometry(0.32, 0.025, 5, 14).rotateY(Math.PI / 2), '#1b1d1f', 0, 0.34, x);
  return mergeGeometries([ring(-0.42), ring(0.42), box(0.03, 0.04, 0.9, 0, 0.5, 0, '#a83a2c'), box(0.03, 0.34, 0.03, 0, 0.5, -0.2, '#a83a2c'), box(0.07, 0.04, 0.2, 0, 0.84, -0.2, '#1b1d1f'), box(0.34, 0.03, 0.03, 0, 0.88, 0.38, '#1b1d1f'), box(0.03, 0.4, 0.03, 0, 0.5, 0.38, '#a83a2c')]);
};
export function buildProps(items) {
  const group = new THREE.Group(), o = new THREE.Object3D(), counts = {}, geoms = []; group.name = 'street-props';
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: '#000000' });
  glass.userData.glow = true; glass.userData.glowK = 2.2; glass.userData.glowColor = new THREE.Color('#ffa21f'); // sky.js: emissive = glowColor * night * glowK
  const advert = glass.clone(); advert.userData = { glow: true, glowK: .85, glowColor: new THREE.Color('#ffe7c4') };
  for (const kind of Object.keys(FOOT)) {
    const list = items.filter((i) => i.kind === kind);
    if (!list.length) continue;
    counts[kind] = list.length;
    GEOMS[kind]().forEach((g, j) => {
      geoms.push(g);
      const m = new THREE.InstancedMesh(g, j ? (kind === 'shelter' ? advert : glass) : metal, list.length); m.name = `prop-${kind}${j ? '-glass' : ''}`;
      list.forEach(({ x, y, z, yaw }, i) => { o.position.set(x, y, z); o.rotation.y = yaw; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); // no cast: tiny props, keeps the shadow pass untouched
    });
  }
  const racks = items.filter((i) => i.kind === 'rack').filter((_, i) => i % 2 === 0);
  if (racks.length) { // bikes stand across the rack, rotated a quarter turn from its long axis
    const g = bikeGeom(); geoms.push(g);
    const m = new THREE.InstancedMesh(g, metal, racks.length); m.name = 'prop-bike';
    racks.forEach(({ x, y, z, yaw }, i) => { o.position.set(x, y, z); o.rotation.y = yaw + Math.PI / 2; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); counts.bike = racks.length;
  }
  const contactGeometry = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const contactMaterial = new THREE.MeshBasicMaterial({ color: '#252726', transparent: true, opacity: 0.12, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const contacts = new THREE.InstancedMesh(contactGeometry, contactMaterial, items.length);
  contacts.name = 'prop-contact-shadows';
  items.forEach(({ x, y, z, r }, i) => { o.position.set(x, y + 0.012, z); o.rotation.set(0, 0, 0); o.scale.setScalar(Math.min(0.7, Math.max(0.15, r * 0.65))); o.updateMatrix(); contacts.setMatrixAt(i, o.matrix); });
  contacts.computeBoundingSphere(); group.add(contacts);
  group.userData.counts = counts;
  group.userData.dispose = () => { geoms.forEach((g) => g.dispose()); contacts.dispose(); contactGeometry.dispose(); contactMaterial.dispose(); metal.dispose(); glass.dispose(); advert.dispose(); };
  return group;
}
