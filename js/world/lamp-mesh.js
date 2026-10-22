import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Two lamp families sharing two materials (metal + glowing glass), one InstancedMesh per family per material.
// uk: black cast-iron post (fluted base, tapered shaft, collar) with a four-sided tapered lantern, ~4 m.
// br: galvanised tapered pole with a curved outreach arm and a flat LED head over local +x (the road), ~5 m.
const part = (g, color, x = 0, y = 0, z = 0) => {
  g = (g.index ? g.toNonIndexed() : g).translate(x, y, z); g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  return g.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
const cyl = (r0, r1, h, y, c, seg = 10) => part(new THREE.CylinderGeometry(r1, r0, h, seg), c, 0, y + h / 2, 0);

function ukParts() {
  const IRON = '#1d2023', metal = [], glass = [];
  metal.push(cyl(0.2, 0.17, 0.12, 0, IRON), cyl(0.15, 0.12, 0.55, 0.12, IRON, 8), cyl(0.15, 0.15, 0.06, 0.67, IRON)); // plinth, fluted base, ring
  metal.push(cyl(0.075, 0.05, 2.75, 0.73, IRON, 8), cyl(0.09, 0.09, 0.08, 3.25, IRON)); // tapered shaft + collar
  metal.push(cyl(0.06, 0.14, 0.12, 3.48, IRON, 4).rotateY(Math.PI / 4)); // lantern seat
  glass.push(cyl(0.14, 0.21, 0.42, 3.6, '#ffe2a6', 4).rotateY(Math.PI / 4)); // tapered four-sided lantern
  for (let k = 0; k < 4; k++) metal.push(part(new THREE.BoxGeometry(0.025, 0.44, 0.025), IRON, 0.155, 3.81, 0.155).rotateY(k * Math.PI / 2)); // corner glazing bars
  metal.push(cyl(0.24, 0.05, 0.22, 4.02, IRON, 4).rotateY(Math.PI / 4), part(new THREE.SphereGeometry(0.05, 6, 4), IRON, 0, 4.27, 0)); // pyramid cap + finial
  return [mergeGeometries(metal), mergeGeometries(glass)];
}
function brParts() {
  const STEEL = '#8d949a', metal = [], glass = [];
  metal.push(cyl(0.13, 0.13, 0.35, 0, '#6c7277', 8), cyl(0.09, 0.055, 4.6, 0.35, STEEL, 8)); // base sleeve + tapered pole
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 4.85, 0), new THREE.Vector3(0.25, 5.15, 0), new THREE.Vector3(0.8, 5.25, 0), new THREE.Vector3(1.35, 5.2, 0)]);
  metal.push(part(new THREE.TubeGeometry(arm, 8, 0.04, 6), STEEL));
  metal.push(part(new THREE.BoxGeometry(0.62, 0.1, 0.26), '#5d6368', 1.55, 5.2, 0)); // luminaire housing
  glass.push(part(new THREE.BoxGeometry(0.5, 0.03, 0.2), '#fff1d6', 1.57, 5.135, 0)); // LED lens underneath
  return [mergeGeometries(metal), mergeGeometries(glass)];
}

export function buildLamps(spots) {
  const group = new THREE.Group(), o = new THREE.Object3D(); group.name = 'street-lamps';
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, emissive: '#000000' });
  glass.userData.glow = true; glass.userData.glowK = 1.6; glass.userData.glowColor = new THREE.Color('#ffd28a');
  const geoms = [];
  for (const [style, make] of [['uk', ukParts], ['br', brParts]]) {
    const list = spots.filter((s) => s[3] === style);
    if (!list.length) continue;
    make().forEach((g, j) => {
      geoms.push(g);
      const m = new THREE.InstancedMesh(g, j ? glass : metal, list.length); m.name = `lamp-${style}-${j ? 'glass' : 'post'}`;
      list.forEach(([x, z, yaw], i) => { o.position.set(x, 0, z); o.rotation.y = yaw; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.castShadow = !j; m.receiveShadow = true; m.computeBoundingSphere(); group.add(m);
    });
  }
  group.userData.dispose = () => { geoms.forEach((g) => g.dispose()); metal.dispose(); glass.dispose(); };
  return group;
}
