import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCountry } from '../js/world/country.js';
import { PALETTE as P } from '../js/world/palette.js';

const curve = { getPointAt: t => ({ x: t * 1000, z: 0 }) };
const collect = withPlants => {
  const out = { boxes: [], plants: [], trees: [] };
  const add = (...box) => out.boxes.push(box);
  if (withPlants) add.plant = (...plant) => out.plants.push(plant);
  buildCountry(add, curve, (draw, x, z, shape) => out.trees.push({ x, z, ...shape }), [0, 1000]);
  return out;
};

test('country pocket gardens use deterministic low planting at their existing edges', () => {
  const legacy = collect(false), actual = collect(true), repeated = collect(true);
  const gardens = actual.boxes.filter(([, , , w, h, d, color]) => w === 8 && h === 0.06 && d === 6 && color === P.grass);
  const oldGardens = legacy.boxes.filter(([, , , w, h, d, color]) => w === 8 && h === 0.06 && d === 6 && color === P.grass);

  assert.ok(gardens.length > 0, 'the country layout has pocket gardens');
  assert.deepEqual(gardens, oldGardens, 'grass garden rectangles stay unchanged');
  assert.deepEqual(actual.boxes, legacy.boxes, 'planting adds no boxes or obstacles');
  assert.deepEqual(actual.trees, legacy.trees, 'the two trees per garden keep their positions');
  assert.ok(actual.plants.length > 0, 'pocket gardens emit shared plant records');
  assert.equal(actual.plants.length, gardens.length * 6, 'each existing garden gets six edge plants');
  assert.deepEqual(actual.plants, repeated.plants, 'plant positions are deterministic');
  assert.deepEqual([...new Set(actual.plants.map(([kind]) => kind))].sort(), ['flower', 'shrub']);
  assert.ok(new Set(actual.plants.map(plant => plant[7])).size > 1, 'coordinate hash varies plant tints');
  assert.ok(new Set(actual.plants.map(plant => plant[8])).size > 1, 'coordinate hash varies plant yaw');
  assert.ok(actual.plants.every(plant => Math.abs(plant[8]) <= 0.06), 'plant yaw stays subtle');

  for (const [gx, , gz] of gardens) assert.equal(actual.plants.filter(([, x, , z]) => Math.abs(x - gx) < 4 && Math.abs(z - gz) < 3).length, 6);
  for (const [kind, x, y, z, w, h, d, , yaw] of actual.plants) {
    const garden = gardens.find(([gx, , gz]) => Math.abs(x - gx) < 4 && Math.abs(z - gz) < 3);
    assert.ok(garden, `${kind} stays inside an existing garden rectangle`);
    assert.ok(h < 1 && y + h <= 1, `${kind} stays below 1 m`);
    assert.ok(Math.min(3 - Math.abs(z - garden[2]), 4 - Math.abs(x - garden[0])) <= 1, `${kind} stays along a garden edge`);
    assert.ok(w > 0 && d > 0);

    const benches = actual.boxes.filter(([bx, , bz, , , , color]) => color === P.oak && Math.abs(bx - garden[0]) < 1e-6 && Math.abs(bz - garden[2]) < 5);
    assert.equal(benches.length, 2, 'existing garden bench boxes remain present');
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = (c * w + s * d) / 2, hz = (s * w + c * d) / 2;
    for (const [bx, , bz, bw, , bd] of benches) assert.ok(x + hx <= bx - bw / 2 || x - hx >= bx + bw / 2 || z + hz <= bz - bd / 2 || z - hz >= bz + bd / 2, `${kind} clears the existing bench`);

    const trees = actual.trees.filter(tree => Math.abs(Math.abs(tree.x - garden[0]) - 3) < 1e-6 && Math.abs(tree.z - garden[2]) <= 1);
    assert.equal(trees.length, 2, 'existing garden tree trunks remain present');
    for (const tree of trees) assert.ok(Math.hypot(x - tree.x, z - tree.z) >= Math.hypot(w, d) / 2 + 0.25, `${kind} clears tree trunk radius`);
  }
});
