import * as THREE from 'three';
import { loadFleetCatalog, regionalFleetModel, upgradeFleet } from './vehicle-assets.js';
import { ROAD, ukStart, rng } from './layout.js';
import { parkingBays } from './bays.js';
// Static kerbside cars in the painted bays on BOTH sides of the road (bays.js decides where bays exist), ROAD.bayMid m from the centre line: wheels fully
// on asphalt, inside the edge line and the kerb, nose along the traffic direction of that side. Same fleet GLBs as the moving traffic, unlit lamps, shared
// geometry and per-paint materials. A seeded rng thins the bays; it is drawn for every bay and side, eligible or not, so editing a keep-out zone never reshuffles the other cars.
const FILL = 0.8, SEED = 4242; // share of bays taken
const PAINT = ['#f1f1ee', '#c4c8cc', '#6c7177', '#1b1d21', '#25324a', '#7a1620', '#2f6fcf', '#b3161f', '#e8c425', '#2e6b46', '#c4c8cc', '#f1f1ee']; // everyday mix, unlike the saturated moving cars
export function createParked(scene, { curve, pts, stops, pilotCrossings }) {
  const group = new THREE.Group(); group.name = 'parked-cars'; scene.add(group);
  let disposed = false;
  const { bays, sample } = parkingBays(curve, pts, stops, pilotCrossings), ukX = pts[ukStart(stops)].x - 15, rand = rng(SEED), spots = [];
  for (const b of bays) {
    const { p, t } = sample(b.s);
    for (const side of [-1, 1]) { // -1: oncoming side (normal -t.z, t.x), +1: the player's side
      const roll = rand(), paint = PAINT[Math.floor(rand() * PAINT.length)];
      if (!b.ok || roll > FILL) continue;
      const o = -side * ROAD.bayMid;
      spots.push({ x: p.x - t.z * o, z: p.z + t.x * o, yaw: Math.atan2(-t.z, t.x) + (side < 0 ? Math.PI : 0), paint, uk: p.x >= ukX, side });
    }
  }
  const ready = loadFleetCatalog().then((catalog) => Promise.all(spots.map(async (c, i) => {
    const model = regionalFleetModel(catalog, c.uk ? 'uk' : 'br', spots.slice(0, i).filter((o) => o.uk === c.uk).length + (c.uk ? 1 : 0));
    if (!model || disposed) return;
    const car = new THREE.Group(); car.name = 'parked'; car.position.set(c.x, 0, c.z); car.rotation.y = c.yaw;
    await upgradeFleet(car, model, { body: c.paint, parked: true, isDisposed: () => disposed });
    if (!disposed && car.userData.fleetModel) group.add(car);
  })));
  return { ready, spots, update() {}, dispose() { disposed = true; scene.remove(group); } };
}
