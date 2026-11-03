import * as THREE from 'three';
import { blockMaterial } from './textures.js';
import { createPlantGeometry } from './plant-mesh.js';
import { PALETTE as P } from './palette.js';
export function createBoxes() {
  const list = [];
  const add = (x, y, z, w, h, d, color, ry = 0) => { list.push(ry ? { x, y, z, w, h, d, color, ry } : { x, y, z, w, h, d, color }); };
  add.plant = (kind, x, y, z, w, h, d, tint, yaw = 0) => { list.push({ plant: kind, x, y, z, w, h, d, tint, yaw }); };
  return { list, add }; // ry: optional yaw (rad) about the box centre axis; kerbs and pavement slabs follow the route tangent
}
const MATS = new Map(), PLANT_MATS = new Map(), PLANT_GEOS = new Map(), UP = new THREE.Vector3(0, 1, 0);
const LAWN = new Set([P.patch, P.grass]), GRASS_STEP = 0.58, GRASS_HEIGHT = 0.36, GRASS_CELL = 2;
const hash = (x, z, k = 0) => { const n = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };
function grassInstances(boxes, plants, { trees = [], plots = [], lamps = [], kiosks = [] }) {
  const grounds = boxes.filter(b => LAWN.has(b.color) && b.h <= 0.24 && b.w >= 1.5 && b.d >= 1.3 && !b.ry);
  if (!grounds.length) return [];
  const cells = new Map(), grass = new Map();
  const addObstacle = (x, z, rx, rz, y0, y1) => {
    const o = { x, z, rx: rx + 0.5, rz: rz + 0.5, y0, y1 };
    for (let ix = Math.floor((x - o.rx) / GRASS_CELL); ix <= Math.floor((x + o.rx) / GRASS_CELL); ix++)
      for (let iz = Math.floor((z - o.rz) / GRASS_CELL); iz <= Math.floor((z + o.rz) / GRASS_CELL); iz++) {
        const key = `${ix},${iz}`;
        (cells.get(key) ?? cells.set(key, []).get(key)).push(o);
      }
  };
  for (const b of boxes) {
    if (LAWN.has(b.color) || b.y > 0.75 || b.y + b.h < 0) continue;
    const c = Math.abs(Math.cos(b.ry || 0)), s = Math.abs(Math.sin(b.ry || 0));
    addObstacle(b.x, b.z, (c * b.w + s * b.d) / 2, (s * b.w + c * b.d) / 2, b.y, b.y + b.h);
  }
  for (const b of plants) addObstacle(b.x, b.z, b.w / 2, b.d / 2, b.y, b.y + b.h);
  for (const t of trees) addObstacle(t.x, t.z, (t.crown || 2) * 0.55, (t.crown || 2) * 0.55, t.base || 0, (t.h || 4) + 1);
  for (const p of plots) if ([p.x, p.z, p.width, p.depth, p.height].every(Number.isFinite)) addObstacle(p.x, p.z, p.width / 2, p.depth / 2, 0, p.height);
  for (const [x, z] of lamps) addObstacle(x, z, 0.18, 0.18, 0, 1);
  for (const [x, z] of kiosks) addObstacle(x, z, 0.45, 0.45, 0, 3);
  for (const b of grounds) {
    const y = b.y + b.h + 0.012, x0 = b.x - b.w / 2 + 0.18, x1 = b.x + b.w / 2 - 0.18, z0 = b.z - b.d / 2 + 0.18, z1 = b.z + b.d / 2 - 0.18;
    for (let ix = Math.ceil(x0 / GRASS_STEP); ix <= Math.floor(x1 / GRASS_STEP); ix++) for (let iz = Math.ceil(z0 / GRASS_STEP); iz <= Math.floor(z1 / GRASS_STEP); iz++) {
      const x = (ix + 0.5 + (hash(ix, iz) - 0.5) * 0.56) * GRASS_STEP, z = (iz + 0.5 + (hash(ix, iz, 1) - 0.5) * 0.56) * GRASS_STEP;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const key = `${ix},${iz}`, old = grass.get(key);
      if (old && old.y >= y) continue;
      const blocked = (cells.get(`${Math.floor(x / GRASS_CELL)},${Math.floor(z / GRASS_CELL)}`) || []).some(o => y + GRASS_HEIGHT > o.y0 && y < o.y1 && Math.abs(x - o.x) < o.rx && Math.abs(z - o.z) < o.rz);
      if (blocked) continue;
      const v = hash(ix, iz, 2), w = 0.72 + hash(ix, iz, 3) * 0.22;
      grass.set(key, { plant: 'grass', x, y, z, w, h: 0.24 + v * 0.15, d: w * (0.86 + hash(ix, iz, 5) * 0.28), tint: '#f4f6e9', yaw: hash(ix, iz, 4) * Math.PI * 2 });
    }
  }
  return [...grass.values()];
}
export function buildMeshes(list, { glow = [], glowK = {}, grass = false } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const sourcePlants = list.filter(b => b.plant), boxes = sourcePlants.length ? list.filter(b => !b.plant) : list;
  const plants = grass ? [...sourcePlants, ...grassInstances(boxes, sourcePlants, typeof grass === 'object' ? grass : {})] : sourcePlants, byColor = new Map(), byPlant = new Map();
  for (const b of boxes) (byColor.get(b.color) ?? byColor.set(b.color, []).get(b.color)).push(b);
  for (const b of plants) (byPlant.get(b.plant) ?? byPlant.set(b.plant, []).get(b.plant)).push(b);
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [color, boxes] of byColor) {
    const k = glowK[color], key = color + glow.includes(color) + k;
    const mat = MATS.get(key) ?? MATS.set(key, blockMaterial(color, { glow: glow.includes(color), k })).get(key);
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), b.ry ? q.setFromAxisAngle(UP, b.ry) : q.identity(), s.set(b.w, b.h, b.d))));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const [kind, records] of byPlant) {
    const geometry = PLANT_GEOS.get(kind) ?? PLANT_GEOS.set(kind, createPlantGeometry(kind)).get(kind);
    const material = PLANT_MATS.get(kind) ?? PLANT_MATS.set(kind, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: kind === 'grass' ? THREE.DoubleSide : THREE.FrontSide })).get(kind);
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    records.forEach((b, i) => {
      mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), b.yaw ? q.setFromAxisAngle(UP, b.yaw) : q.identity(), s.set(b.w, b.h, b.d)));
      mesh.setColorAt(i, new THREE.Color(b.tint));
    });
    mesh.instanceMatrix.needsUpdate = mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = kind !== 'grass'; mesh.receiveShadow = kind !== 'grass';
    mesh.userData.plantKind = kind;
    group.add(mesh);
  }
  group.userData.list = boxes; // box-only list for tests/zfight.browser.py
  group.userData.plants = plants;
  return group;
}
