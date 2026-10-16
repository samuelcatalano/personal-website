import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildBus } from './bus.js';
import { RIVER_Z, LANDMARKS, stopIndex } from './layout.js';
import { routeT } from '../scroll.js';
const LIGHT = '#fff7c2';
function cab() {
  const { add, list } = createBoxes();
  add(0, 0.3, 0, 4.3, 1, 1.8, '#16181c');
  add(-0.1, 1.15, 0, 2.2, 0.55, 1.55, '#16181c');
  add(0.5, 1.2, 0, 0.7, 0.4, 1.57, '#9fc6e6');
  add(2.15, 0.6, 0.5, 0.05, 0.25, 0.3, LIGHT);
  add(2.15, 0.6, -0.5, 0.05, 0.25, 0.3, LIGHT);
  for (const x of [-1.3, 1.3]) for (const z of [0.75, -0.75]) add(x, 0, z, 0.65, 0.55, 0.2, '#0b0b0b');
  return buildMeshes(list, { glow: [LIGHT] });
}
function boat() {
  const { add, list } = createBoxes();
  add(0, 0, 0, 6, 1, 2.2, '#6b4f3a');
  add(-0.5, 1, 0, 2.6, 1.2, 1.8, '#f4f4f4');
  add(-0.5, 1.4, 0.91, 2, 0.4, 0.05, '#bfe3ff');
  return buildMeshes(list);
}
export function createAmbient(scene, { curve, pts, stops }) {
  const traffic = [
    { mesh: buildBus({ avatar: false }), lane: 1.75, offset: -0.16, relative: true },
    { mesh: cab(), lane: 1.75, offset: 0.22, relative: true },
    { mesh: cab(), lane: -1.75, offset: 0.25, reverse: true },
    { mesh: cab(), lane: -1.75, offset: 0.75, reverse: true },
  ];
  traffic.forEach((v) => scene.add(v.mesh));
  const boats = [-0.3, 0.05, 0.35].map((f, i) => {
    const mesh = boat();
    mesh.position.set(pts[0].x + (pts.at(-1).x - pts[0].x) * (f + 0.3), 0.1, RIVER_Z + (i - 1) * 5);
    scene.add(mesh);
    return mesh;
  });
  const birds = new THREE.Group();
  const birdMesh = buildMeshes([{ x: 0, y: 0, z: 0, w: 0.8, h: 0.3, d: 0.5, color: '#7d8590' }]);
  for (let i = 0; i < 8; i++) {
    const b = birdMesh.clone();
    b.position.set(Math.cos(i) * 12, 26 + (i % 3) * 2, Math.sin(i) * 12);
    birds.add(b);
  }
  const bb = pts[stopIndex(stops, LANDMARKS.bigben)];
  birds.position.set(bb.x, 0, RIVER_Z - 16);
  scene.add(birds);
  const blink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  blink.position.set(bb.x, 34.4, RIVER_Z - 16); // top of Big Ben's spire
  scene.add(blink);
  const nrm = new THREE.Vector3();
  return {
    update({ time, progress }) {
      const route = routeT(progress, stops.length);
      for (const v of traffic) {
        let t = v.relative ? route + v.offset : ((v.offset - time * 0.012) % 1 + 1) % 1;
        v.mesh.visible = t >= 0 && t <= 1;
        if (!v.mesh.visible) continue;
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        nrm.set(tan.z, 0, -tan.x).normalize();
        v.mesh.position.copy(p).addScaledVector(nrm, v.lane);
        v.mesh.rotation.y = Math.atan2(-tan.z, tan.x) + (v.reverse ? Math.PI : 0);
      }
      boats.forEach((b, i) => {
        b.position.y = 0.1 + Math.sin(time * 1.1 + i * 2) * 0.25;
        b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
      });
      birds.rotation.y = time * 0.3;
      blink.visible = Math.floor(time * 1.4) % 2 === 0;
    },
  };
}
