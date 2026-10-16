import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
import { LANDMARKS, stopIndex, RIVER_Z } from './layout.js';

import { PALETTE as P } from './palette.js';
import { buildSaoPaulo } from './saopaulo.js';

const STONE = P.stone, SLATE = P.roof, WHITE = P.white, GOLD = P.gilt, STEEL = P.steel;

const at = (stops, pts, key) => pts[stopIndex(stops, LANDMARKS[key])];

function clockFaces(x, z) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#f4f0e2'; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#4d4030'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 116, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#6d604b'; c.lineWidth = 3;
  for (let i = 0; i < 60; i++) {
    const a = i * Math.PI / 30, r1 = i % 5 ? 103 : 91;
    c.beginPath(); c.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1);
    c.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108); c.stroke();
  }
  c.fillStyle = '#493d30'; c.font = 'bold 21px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = i * Math.PI / 6;
    c.fillText(['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][i - 1], 128 + Math.sin(a) * 77, 128 - Math.cos(a) * 77);
  }
  c.strokeStyle = '#392d24'; c.lineCap = 'round';
  const hour = (10 + 10 / 60) * Math.PI / 6;
  c.lineWidth = 8; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 45 * Math.sin(hour), 128 - 45 * Math.cos(hour)); c.stroke();
  c.lineWidth = 5; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 68 * Math.sin(Math.PI / 3), 128 - 68 * Math.cos(Math.PI / 3)); c.stroke();
  c.fillStyle = '#392d24'; c.beginPath(); c.arc(128, 128, 7, 0, Math.PI * 2); c.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(3.55, 3.55);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: texture }), 4);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  [[x, z + 3.06, 0], [x, z - 3.06, Math.PI], [x + 3.06, z, Math.PI / 2], [x - 3.06, z, -Math.PI / 2]]
    .forEach(([fx, fz, ry], i) => mesh.setMatrixAt(i, m.compose(p.set(fx, 21, fz), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), s)));
  mesh.name = 'bigben-four-clock-faces';
  mesh.userData = { faceCount: 4 };
  const group = new THREE.Group(); group.name = 'bigben-details'; group.add(mesh);
  return group;
}

function bigBen(add, { x }) {
  const z = RIVER_Z - 16;
  add(x, 0, z, 5, 18, 5, STONE);
  add(x, 18, z, 6, 6, 6, STONE);                 // clock section
  for (const [dx, dz] of [[3.02, 0], [-3.02, 0], [0, 3.02], [0, -3.02]]) add(x + dx, 19, z + dz, dx ? 0.05 : 4, 4, dz ? 0.05 : 4, WHITE);
  add(x, 24, z, 5, 2, 5, SLATE);
  add(x, 26, z, 3.5, 2, 3.5, SLATE);
  add(x, 28, z, 2, 3, 2, SLATE);
  add(x, 31, z, 0.5, 3, 0.5, GOLD);
  for (const side of [-1, 1]) {
    add(x + side * 2.55, 18, z, 0.18, 6, 0.18, GOLD);
    add(x, 18, z + side * 2.55, 0.18, 6, 0.18, GOLD);
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
  add(x + 14, 0, z, 22, 10, 8, STONE);
  return clockFaces(x, z);
}

function towerBridge(add, { x }) {
  const box = (along, y, across, length, height, width, color) =>
    add(x + across, y, RIVER_Z + along, width, height, length, color);
  for (const along of [-9.5, 9.5]) {
    box(along, -1, 0, 6, 24, 6.2, STONE);
    box(along, 23, 0, 6.6, 3, 6.6, SLATE);
    box(along, 25.7, 0, 6.1, 0.35, 6.1, GOLD);
    for (const c of [-3.09, 3.09]) for (const dz of [-3.09, 3.09]) {
      box(along + dz, 2, c, 0.22, 19, 0.22, SLATE); // tower corner pilasters
      box(along + dz, 26, c, 0.55, 3.2, 0.55, STEEL); // corner pinnacles
      box(along + dz, 28, c, 0.18, 3, 0.18, GOLD);
    }
    for (let y = 6; y <= 18; y += 4) {
      for (const side of [-1, 1]) {
        box(along, y, side * 3.12, 0.7, 1.8, 0.12, SLATE);
        box(along + side * 3.12, y, 0, 0.12, 1.8, 0.7, SLATE);
      }
    }
  }
  box(-16, 0, 0, 3, 4, 6, STONE);                 // grounded bank abutments
  box(16, 0, 0, 3, 4, 6, STONE);
  box(0, 4, 0, 34, 1.2, 6, STEEL);               // road deck and short approaches
  box(0, 19, -1.5, 13, 1.5, 1.2, STEEL);        // upper pedestrian decks only between towers
  box(0, 19, 1.5, 13, 1.5, 1.2, STEEL);
  for (const side of [-1, 1]) {
    box(0, 5.2, side * 2.86, 34, 0.28, 0.28, STEEL); // outer railings
    for (let along = -16; along <= 16; along += 2) box(along, 5.2, side * 2.86, 0.18, 1.1, 0.18, STEEL);
  }
  for (const along of [-9.5, 9.5]) for (const side of [-1, 1]) {
    box(along, 8, side * 3.12, 0.16, 0.16, 0.16, GOLD);
  }
  const cables = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.065, 1, 6), new THREE.MeshLambertMaterial({ color: STEEL }), 4);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  let i = 0;
  for (const along of [-9.5, 9.5]) for (const side of [-1, 1]) {
    const direction = Math.sign(along), start = new THREE.Vector3(x + side * 3.12, 8, RIVER_Z + along + direction * 3.1);
    const end = new THREE.Vector3(start.x, 5.5, RIVER_Z + direction * 16), delta = end.clone().sub(start);
    cables.setMatrixAt(i++, m.compose(p.copy(start).add(end).multiplyScalar(0.5), q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()), s.set(1, delta.length(), 1)));
  }
  cables.name = 'towerbridge-approach-cables';
  cables.castShadow = true;
  const details = new THREE.Group(); details.name = 'towerbridge-details'; details.add(cables);
  return details;
}

function wembley(add, { x, z }) {
  const cz = RIVER_Z - 26; // far bank: bowl z -82..-60, clear of river band -57..-33
  for (let a = 0; a < 360; a += 15) {            // stadium bowl
    const r = (a * Math.PI) / 180;
    add(x + Math.cos(r) * 16, 0, cz + Math.sin(r) * 11, 5, 9, 5, P.cream);
  }
  add(x, 0, cz, 22, 0.5, 14, P.patch);         // pitch
  for (let a = 0; a <= 180; a += 6) {            // the arch
    const r = (a * Math.PI) / 180;
    add(x + Math.cos(r) * 20, Math.sin(r) * 34, cz, 1.4, 1.4, 1.4, WHITE);
  }
}

function heathrow(add, { x }) {
  // Far-side arrival vignette between the street (z ≥ RIVER_Z + 24) and the river; the terminal stands on the riverside path strip.
  const rz = RIVER_Z + 20.5, tz = RIVER_Z + 15.5;
  add(x, -0.15, rz, 24, 0.2, 6, P.road);                                         // runway
  for (let i = -10; i <= 10; i += 4) add(x + i, 0.05, rz, 2, 0.06, 0.4, P.cream);  // centreline
  add(x - 4, 0, tz, 14, 4, 4, P.stone);                                           // terminal
  add(x - 4, 1, tz + 2.05, 13, 2.4, 0.1, P.glass);                                // glazed front
  add(x - 4, 4, tz, 14.6, 0.35, 4.6, P.roof);                                     // roof slab
  add(x + 9, 0, tz, 1.6, 9, 1.6, P.stone);                                        // control tower
  add(x + 9, 9, tz, 3.2, 1.8, 3.2, P.glass);
  add(x + 9, 10.8, tz, 3.6, 0.3, 3.6, P.roof);
}

function londonEye(x) {
  const { add, list } = createBoxes();
  for (let a = 0; a < 360; a += 6) {
    const r = (a * Math.PI) / 180;
    add(Math.cos(r) * 16, Math.sin(r) * 16, 0, 1, 1, 1, WHITE);
    if (a % 30 === 0) add(Math.cos(r) * 17.5, Math.sin(r) * 17.5, 0, 1.6, 1.4, 1.6, '#bfe3ff'); // capsules
  }
  for (let a = 0; a < 360; a += 45) {
    const r = (a * Math.PI) / 180;
    for (let k = 2; k < 16; k += 2) add(Math.cos(r) * k, Math.sin(r) * k, 0, 0.4, 0.4, 0.4, WHITE);
  }
  const eye = buildMeshes(list);
  eye.position.set(x, 18, RIVER_Z + 13);
  return eye;
}

function plane() {
  const { add, list } = createBoxes();
  add(0, 0, 0, 12, 2, 2, WHITE);                 // fuselage
  add(1, 0.6, 0, 3, 0.4, 14, P.stone);         // wings
  add(-5.5, 1, 0, 1.5, 3, 0.4, P.ink);       // tail
  add(-5.5, 1.5, 0, 1.5, 0.3, 5, P.stone);
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
