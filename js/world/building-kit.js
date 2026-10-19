import * as THREE from 'three';
import { PALETTE as P } from './palette.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const material = (name, color, roughness = 0.88) => new THREE.MeshStandardMaterial({ name, color, roughness });
const facade = {
  terrace: material('terrace-brick', P.brick),
  shop: material('shop-stucco', P.cream),
  midrise: material('midrise-stone', P.concreteMid),
  office: material('office-concrete', P.concrete),
  tower: material('tower-glass', P.steel, 0.38),
};
const roofs = {
  terrace: material('terrace-roof', P.roof), shop: material('shop-roof', P.redBrown),
  midrise: material('midrise-roof', P.stone), office: material('office-roof', P.ink),
  tower: material('tower-crown', P.navy, 0.42),
};
const glass = material('window-glass', P.glass, 0.32);
const frames = material('window-frame', P.offWhite);
const trim = material('architectural-trim', P.londonStock);

function addBox(group, mat, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(box, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addInstances(group, mat, details) {
  if (!details.length) return;
  const mesh = new THREE.InstancedMesh(box, mat, details.length);
  const transform = new THREE.Object3D();
  details.forEach(([x, y, z, w, h, d], i) => {
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
}

export function createBuilding(plot) {
  const { kind, width: w, depth: d, height: h } = plot;
  if (!facade[kind] || ![plot.x, plot.z, w, d, h].every(Number.isFinite) || w <= 0 || d <= 0 || h <= 0) {
    throw new TypeError('Invalid building plot');
  }
  const building = new THREE.Group();
  building.name = plot.id || kind;
  building.position.set(plot.x, 0, plot.z);
  building.userData.kind = kind;

  const roofH = Math.min(0.45, h * 0.1);
  const bodyHeight = h - roofH;
  addBox(building, facade[kind], 0, bodyHeight / 2, 0, w, bodyHeight, d);
  const roofY = bodyHeight;
  addBox(building, roofs[kind], 0, roofY + roofH / 2, 0, w * 0.96, roofH, d * 0.96);

  // Top features vary by archetype while staying inside the reserved footprint.
  if (kind === 'terrace') {
    addBox(building, roofs.terrace, 0, h * 0.9, 0, w * 0.54, h * 0.06, d * 0.42);
  } else if (kind === 'shop') {
    const awningH = h * 0.04;
    addBox(building, trim, 0, Math.min(h - awningH / 2, bodyHeight * 0.62), d / 2 - d * 0.06, w * 0.92, awningH, d * 0.12);
  } else if (kind === 'midrise') {
    addBox(building, trim, 0, bodyHeight * 0.52, 0, w, Math.min(0.12, h * 0.04), d);
  } else if (kind === 'office') {
    addBox(building, roofs.office, 0, h * 0.92, 0, w * 0.58, h * 0.04, d * 0.58);
  } else {
    addBox(building, roofs.tower, 0, h * 0.96, 0, w * 0.3, h * 0.03, d * 0.3);
  }

  const floors = Math.max(1, Math.floor(bodyHeight / (kind === 'terrace' || kind === 'shop' ? 2.6 : 3.1)));
  const columns = Math.max(2, Math.floor(w / (kind === 'terrace' ? 2.1 : 2.4)));
  const sideColumns = Math.max(1, Math.floor(d / 2.4));
  const windows = [], borders = [];
  const winW = Math.min(0.85, w / columns * 0.46), winH = Math.min(1.35, bodyHeight / floors * 0.48);
  const frameW = Math.min(winW + 0.1, w / columns * 0.9), frameH = Math.min(winH + 0.1, bodyHeight / floors * 0.9);
  const frontDepth = Math.min(0.02, d * 0.05), sideWidth = Math.min(0.02, w * 0.05);
  for (let floor = 0; floor < floors; floor++) for (let column = 0; column < columns; column++) {
    const x = -w / 2 + (column + 0.5) * w / columns;
    const y = (floor + 0.55) * bodyHeight / floors;
    windows.push([x, y, d / 2 - frontDepth / 2, winW, winH, frontDepth]);
    borders.push([x, y, d / 2 - frontDepth / 2, frameW, frameH, frontDepth]);
    if (kind !== 'shop') for (let sideColumn = 0; sideColumn < sideColumns; sideColumn++) {
      const z = -d / 2 + (sideColumn + 0.5) * d / sideColumns;
      windows.push([w / 2 - sideWidth / 2, y, z, sideWidth, winH, Math.min(0.85, d / sideColumns * 0.46)]);
    }
  }
  addInstances(building, frames, borders);
  addInstances(building, glass, windows);
  return building;
}
