import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
import { LANDMARKS, stopIndex, RIVER_Z } from './layout.js';
import { PALETTE as P } from './palette.js';
import { buildSaoPaulo } from './saopaulo.js';
const STONE = P.sand, SLATE = P.slate, WHITE = P.white, GOLD = P.gilt, STEEL = P.steel;
const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
const PI = Math.PI, at = (stops, pts, key) => pts[stopIndex(stops, LANDMARKS[key])];
function clockFaces(x, z) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#f4f0e2'; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#4d4030'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 116, 0, PI * 2); c.stroke();
  c.strokeStyle = '#6d604b'; c.lineWidth = 3;
  for (let i = 0; i < 60; i++) {
    const a = i * PI / 30, r1 = i % 5 ? 103 : 91;
    c.beginPath(); c.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1);
    c.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108); c.stroke();
  }
  c.fillStyle = '#493d30'; c.font = 'bold 21px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = i * PI / 6;
    c.fillText('I II III IV V VI VII VIII IX X XI XII'.split(' ')[i - 1], 128 + Math.sin(a) * 77, 128 - Math.cos(a) * 77);
  }
  c.strokeStyle = '#392d24'; c.lineCap = 'round';
  const hand = (w, len, a) => { c.lineWidth = w; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + len * Math.sin(a), 128 - len * Math.cos(a)); c.stroke(); };
  hand(8, 45, (10 + 10 / 60) * PI / 6); hand(5, 68, PI / 3);
  c.fillStyle = '#392d24'; c.beginPath(); c.arc(128, 128, 7, 0, PI * 2); c.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(3.55, 3.55);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: texture }), 4);
  [[x, z + 3.06, 0], [x, z - 3.06, PI], [x + 3.06, z, PI / 2], [x - 3.06, z, -PI / 2]]
    .forEach(([fx, fz, ry], i) => mesh.setMatrixAt(i, m.compose(p.set(fx, 21, fz), q.setFromAxisAngle(UP, ry), s)));
  mesh.name = 'bigben-four-clock-faces';
  mesh.userData = { faceCount: 4 };
  const group = new THREE.Group(); group.name = 'bigben-details'; group.add(mesh);
  return group;
}
function bigBen(add, { x }) {
  const z = RIVER_Z - 16;
  add(x, 0, z, 5, 18, 5, STONE);
  add(x, 18, z, 6, 6, 6, STONE);
  for (const [dx, dz] of [[3.02, 0], [-3.02, 0], [0, 3.02], [0, -3.02]]) add(x + dx, 19, z + dz, dx ? 0.05 : 4, 4, dz ? 0.05 : 4, WHITE);
  add(x, 24, z, 5, 2, 5, SLATE);
  add(x, 26, z, 3.5, 2, 3.5, SLATE);
  add(x, 28, z, 2, 3, 2, SLATE);
  add(x, 31, z, 0.5, 3, 0.5, GOLD);
  for (const side of [-1, 1]) {
    add(x + side * 2.55, 18, z, 0.18, 5.96, 0.18, GOLD);
    add(x, 18, z + side * 2.55, 0.18, 5.96, 0.18, GOLD);
    for (const dx of [-2.25, 2.25]) add(x + dx, 1, z + side * 2.54, 0.28, 16, 0.28, SLATE);
    for (const dz of [-2.25, 2.25]) add(x + side * 2.54, 1, z + dz, 0.28, 16, 0.28, SLATE);
    for (const y of [4, 9, 14]) {
      add(x + side * 2.54, y, z, 0.12, 1.4, 0.45, SLATE);
      add(x, y, z + side * 2.54, 0.45, 1.4, 0.12, SLATE);
    }
  }
  for (const y of [24.5, 25.3, 26.1]) {
    for (const side of [-1, 1]) {
      add(x + side * 2.02, y, z, 0.12, 0.22, 1.4, SLATE);
      add(x, y, z + side * 2.02, 1.4, 0.22, 0.12, SLATE);
    }
  }
  for (const y of [17.5, 22.5, 24]) add(x, y, z, 6.2, 0.35, 6.2, GOLD);
  add(x + 14, 0, z, 22, 10, 8, P.sandd);
  return clockFaces(x, z);
}
function towerBridge(add, { x }) {
  const box = (along, y, across, length, height, width, color) =>
    add(x + across, y, RIVER_Z + along, width, height, length, color);
  for (const along of [-9.5, 9.5]) {
    box(along, -1, 0, 6, 24, 6.2, STONE);
    box(along, 23, 0, 6.6, 3, 6.6, P.roof);
    box(along, 25.7, 0, 6.1, 0.35, 6.1, GOLD);
    for (const c of [-3.09, 3.09]) for (const dz of [-3.09, 3.09]) {
      box(along + dz, 2, c, 0.22, 19, 0.22, P.roof);
      box(along + dz, 26, c, 0.55, 3.2, 0.55, STEEL);
      box(along + dz, 28, c, 0.18, 3, 0.18, GOLD);
    }
    for (let y = 6; y <= 18; y += 4) {
      for (const side of [-1, 1]) {
        box(along, y, side * 3.12, 0.7, 1.8, 0.12, P.roof);
        box(along + side * 3.12, y, 0, 0.12, 1.8, 0.7, P.roof);
      }
    }
  }
  for (const along of [-16, 16]) box(along, 0, 0, 3, 4, 6, P.sandd);
  box(0, 4, 0, 34, 1.2, 6, STEEL);
  for (const across of [-1.5, 1.5]) box(0, 19, across, 13, 1.5, 1.2, STEEL);
  for (const side of [-1, 1]) {
    box(0, 5.2, side * 2.86, 34, 0.28, 0.28, STEEL);
    for (let along = -16; along <= 16; along += 2) box(along, 5.2, side * 2.86, 0.18, 1.1, 0.18, STEEL);
  }
  const cables = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.065, 1, 6), new THREE.MeshLambertMaterial({ color: STEEL }), 4);
  let i = 0;
  for (const along of [-9.5, 9.5]) for (const side of [-1, 1]) {
    box(along, 8, side * 3.12, 0.16, 0.16, 0.16, GOLD);
    const direction = Math.sign(along), start = new THREE.Vector3(x + side * 3.12, 8, RIVER_Z + along + direction * 3.1);
    const end = new THREE.Vector3(start.x, 5.5, RIVER_Z + direction * 16), delta = end.clone().sub(start);
    cables.setMatrixAt(i++, m.compose(p.copy(start).add(end).multiplyScalar(0.5), q.setFromUnitVectors(UP, delta.clone().normalize()), s.set(1, delta.length(), 1)));
  }
  cables.name = 'towerbridge-approach-cables';
  cables.castShadow = true;
  const details = new THREE.Group(); details.name = 'towerbridge-details'; details.add(cables);
  return details;
}
function wembley(add, { x }) {
  const cz = RIVER_Z - 26;
  for (let a = 0; a < 360; a += 15) {
    const r = (a * PI) / 180;
    add(x + Math.cos(r) * 16, 0, cz + Math.sin(r) * 11, 5, 9, 5, P.cream);
  }
  add(x, 0, cz, 22, 0.5, 14, P.patch);
  for (let a = 0; a <= 180; a += 6) {
    const r = (a * PI) / 180;
    add(x + Math.cos(r) * 20, Math.sin(r) * 34, cz, 1.4, 1.4, 1.4, P.arch);
  }
}
function heathrow(add, { x }) {
  const rz = RIVER_Z + 20.5, tz = RIVER_Z + 15.5;
  add(x, -0.15, rz, 24, 0.2, 6, P.road);
  for (let i = -10; i <= 10; i += 4) add(x + i, 0.05, rz, 2, 0.06, 0.4, P.cream);
  add(x - 4, 0, tz, 14, 4, 4, P.stone);
  add(x - 4, 1, tz + 2.05, 13, 2.4, 0.1, P.glass);
  add(x - 4, 4, tz, 14.6, 0.35, 4.6, P.roof);
  add(x + 9, 0, tz, 1.6, 9, 1.6, P.stone);
  add(x + 9, 9, tz, 3.2, 1.8, 3.2, P.glass);
  add(x + 9, 10.8, tz, 3.6, 0.3, 3.6, P.roof);
}
const RIM = P.eyeRim, POD = P.eyePod; // Eye: cool white rim, warm pods, both glow at night
function londonEye(x) {
  const { add, list } = createBoxes();
  for (let a = 0; a < 360; a += 6) {
    const r = (a * PI) / 180;
    add(Math.cos(r) * 16, Math.sin(r) * 16, 0, 1, 1, 1, RIM);
    if (a % 30 === 0) add(Math.cos(r) * 17.5, Math.sin(r) * 17.5, 0, 1.6, 1.4, 1.6, POD);
  }
  for (let a = 0; a < 360; a += 45) {
    const r = (a * PI) / 180;
    for (let k = 2; k < 16; k += 2) add(Math.cos(r) * k, Math.sin(r) * k, 0, 0.4, 0.4, 0.4, WHITE);
  }
  const eye = buildMeshes(list, { glow: [RIM, POD], glowK: { [RIM]: 1.0, [POD]: 1.2 } });
  eye.position.set(x, 18, RIVER_Z + 13);
  return eye;
}
function plane() {
  const { add, list } = createBoxes(), W = P.white, R = P.red, N = P.navy, L = P.pearl;
  add(0, 0, 0, 16, 0.9, 2.2, N);
  add(0, 0.9, 0, 16, 1.1, 2.2, L);
  add(0, 0.9, 0, 16.04, 0.14, 2.26, R);
  add(1, 2, 0, 6, 0.7, 1.6, L);
  add(8, 0.3, 0, 1.2, 1.4, 1.6, L);
  add(5.6, 1.2, 0, 1.6, 0.6, 2.26, R);
  add(-7.6, 1.1, 0, 2.4, 3.6, 0.36, N);
  for (let i = 0; i < 3; i++) {
    add(-8.3 + i * 0.7, 1.9 + i, 0, 0.7, 1, 0.4, R);
    add(-7.6 + i * 0.7, 1.9 + i, 0, 0.7, 1, 0.4, W);
  }
  add(-7.2, 1, 0, 1.7, 0.25, 7, L);
  for (const s of [-1, 1]) {
    add(2, 0.5, s * 4, 4, 0.3, 7, L);
    add(0.2, 0.5, s * 9, 2.4, 0.3, 4, L);
    for (const [ex, ez] of [[2.6, 3.4], [1.4, 7]]) add(ex, -0.3, s * ez, 2.2, 1, 1, L);
  }
  return buildMeshes(list);
}
export function buildLandmarks(add, stops, pts) {
  heathrow(add, at(stops, pts, 'heathrow'));
  const details = new THREE.Group(); details.name = 'landmark-details';
  details.add(bigBen(add, at(stops, pts, 'bigben')));
  details.add(towerBridge(add, at(stops, pts, 'towerbridge')));
  wembley(add, at(stops, pts, 'wembley'));
  buildSaoPaulo(add, stops, pts);
  const i = stopIndex(stops, LANDMARKS.heathrow);
  return {
    eye: londonEye(at(stops, pts, 'eye').x),
    details,
    plane: plane(),
    planeAt: i / (stops.length - 1),
  };
}
