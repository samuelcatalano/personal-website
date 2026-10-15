import { createBoxes, buildMeshes } from './voxel.js';
import { LANDMARKS, stopIndex, RIVER_Z } from './layout.js';

const STONE = '#d8c08a', SLATE = '#2f3b45', WHITE = '#f4f4f4', GOLD = '#e0b84a', STEEL = '#6b8fb5';

const at = (stops, pts, key) => pts[stopIndex(stops, LANDMARKS[key])];

function bigBen(add, { x }) {
  const z = RIVER_Z - 16;
  add(x, 0, z, 5, 18, 5, STONE);
  add(x, 18, z, 6, 6, 6, STONE);                 // clock section
  for (const [dx, dz] of [[3.02, 0], [-3.02, 0], [0, 3.02], [0, -3.02]]) add(x + dx, 19, z + dz, dx ? 0.05 : 4, 4, dz ? 0.05 : 4, WHITE);
  add(x, 24, z, 5, 2, 5, SLATE);
  add(x, 26, z, 3.5, 2, 3.5, SLATE);
  add(x, 28, z, 2, 3, 2, SLATE);
  add(x, 31, z, 0.5, 3, 0.5, GOLD);
  add(x + 14, 0, z, 22, 10, 8, STONE);           // Parliament block
}

function towerBridge(add, { x }) {
  for (const dx of [-9, 9]) {
    add(x + dx, -1, RIVER_Z, 6, 24, 6, STONE);
    add(x + dx, 23, RIVER_Z, 6.6, 3, 6.6, SLATE);
    for (const c of [-2.5, 2.5]) add(x + dx + c, 26, RIVER_Z + c, 1, 3, 1, SLATE);
  }
  add(x, 4, RIVER_Z, 12, 1.2, 6, STEEL);         // road deck
  add(x, 19, RIVER_Z - 1.5, 12, 1.5, 1.2, STEEL); // high walkways
  add(x, 19, RIVER_Z + 1.5, 12, 1.5, 1.2, STEEL);
}

function wembley(add, { x, z }) {
  const cz = z - 32;
  for (let a = 0; a < 360; a += 15) {            // stadium bowl
    const r = (a * Math.PI) / 180;
    add(x + Math.cos(r) * 16, 0, cz + Math.sin(r) * 11, 5, 9, 5, '#c7c9cc');
  }
  add(x, 0, cz, 22, 0.5, 14, '#4c9a4c');         // pitch
  for (let a = 0; a <= 180; a += 6) {            // the arch
    const r = (a * Math.PI) / 180;
    add(x + Math.cos(r) * 20, Math.sin(r) * 34, cz, 1.4, 1.4, 1.4, WHITE);
  }
}

function heathrow(add, { x, z }) {
  const rz = z + 34;
  add(x, -0.15, rz, 70, 0.2, 8, '#2e3238');
  for (let i = -30; i <= 30; i += 6) add(x + i, -0.05, rz, 3, 0.06, 0.5, WHITE);
  add(x - 8, 0, rz - 12, 20, 6, 8, '#8fb8d8');   // terminal glass
  add(x - 22, 0, rz - 12, 2, 14, 2, '#d9d9d9');  // control tower
  add(x - 22, 14, rz - 12, 4, 2.5, 4, '#8fb8d8');
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
  add(1, 0.6, 0, 3, 0.4, 14, '#d0d4da');         // wings
  add(-5.5, 1, 0, 1.5, 3, 0.4, '#1e3a8a');       // tail
  add(-5.5, 1.5, 0, 1.5, 0.3, 5, '#d0d4da');
  return buildMeshes(list);
}

export function buildLandmarks(add, stops, pts) {
  heathrow(add, at(stops, pts, 'heathrow'));
  bigBen(add, at(stops, pts, 'bigben'));
  towerBridge(add, at(stops, pts, 'towerbridge'));
  wembley(add, at(stops, pts, 'wembley'));
  const i = stopIndex(stops, LANDMARKS.heathrow);
  return {
    eye: londonEye(at(stops, pts, 'eye').x),
    plane: plane(),
    planeAt: i / (stops.length - 1),
  };
}
