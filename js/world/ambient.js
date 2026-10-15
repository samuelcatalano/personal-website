import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
import { RIVER_Z, LANDMARKS, stopIndex } from './layout.js';

const LIGHT = '#fff7c2';

function cab() {
  const { add, list } = createBoxes();
  add(0, 0.4, 0, 3.2, 1.2, 1.6, '#16181c');
  add(-0.2, 1.6, 0, 1.8, 0.8, 1.5, '#16181c');
  add(0.5, 1.7, 0, 0.6, 0.5, 1.52, '#9fc6e6');
  add(1.62, 0.8, 0.5, 0.05, 0.3, 0.3, LIGHT);
  add(1.62, 0.8, -0.5, 0.05, 0.3, 0.3, LIGHT);
  for (const x of [-1, 1]) for (const z of [0.8, -0.8]) add(x, 0, z, 0.7, 0.7, 0.2, '#0b0b0b');
  return buildMeshes(list, { glow: [LIGHT] });
}

function miniBus() {
  const { add, list } = createBoxes();
  add(0, 0.6, 0, 7, 4.4, 2.4, '#d6211f');
  for (const y of [1.6, 3.6]) { add(0, y, 1.21, 6, 0.9, 0.05, '#bfe3ff'); add(0, y, -1.21, 6, 0.9, 0.05, '#bfe3ff'); }
  add(3.52, 0.9, 0.8, 0.05, 0.35, 0.35, LIGHT);
  add(3.52, 0.9, -0.8, 0.05, 0.35, 0.35, LIGHT);
  for (const x of [-2.3, 2.3]) for (const z of [1.1, -1.1]) add(x, 0, z, 1, 1, 0.3, '#0b0b0b');
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
  const traffic = Array.from({ length: 6 }, (_, i) => {
    const mesh = i % 3 === 2 ? miniBus() : cab();
    scene.add(mesh);
    return { mesh, lane: i % 2 ? 1 : -1, offset: i / 6, speed: 0.012 + (i % 3) * 0.004 };
  });

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
  birds.position.set(bb.x + 10, 0, RIVER_Z - 10);
  scene.add(birds);

  const blink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  blink.position.set(bb.x, 34.4, RIVER_Z - 16); // top of Big Ben's spire
  scene.add(blink);

  const nrm = new THREE.Vector3();
  return {
    update({ time }) {
      for (const v of traffic) {
        let t = (v.offset + time * v.speed) % 1;
        if (v.lane < 0) t = 1 - t;
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        nrm.set(tan.z, 0, -tan.x).normalize();
        v.mesh.position.copy(p).addScaledVector(nrm, 2.6 * v.lane); // lanes clear of the 3.6-wide hero bus
        v.mesh.rotation.y = Math.atan2(-tan.z, tan.x) + (v.lane < 0 ? Math.PI : 0);
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
