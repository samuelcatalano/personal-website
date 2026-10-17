import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGlasgow } from '../js/world/glasgow.js';
import { PALETTE as P } from '../js/world/palette.js';

const near = (n, value, tolerance = 0.01) => Math.abs(n - value) <= tolerance;

test('Glasgow builds George Square on the far side of its road anchor', () => {
  const boxes = [];
  buildGlasgow((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), { x: 100, z: 20 });

  assert.ok(boxes.length >= 35 && boxes.length <= 80, 'keeps the landmark batch modest');
  assert.ok(boxes.some((b) => b.color === P.gravel && b.y > 0 && near(b.x, 100) && near(b.z, -8) && b.w >= 34 && b.d >= 20), 'George Square paving clears the city ground across the road');
  assert.ok(boxes.some((b) => b.color === P.sandstone && near(b.x, 100) && near(b.z, -21) && b.w >= 28 && b.h >= 8), 'City Chambers closes the far side of the square');
  assert.ok(boxes.some((b) => b.color === P.gilt && near(b.x, 100) && near(b.z, -21) && b.y >= 12), 'City Chambers has a raised central dome');
  assert.ok(boxes.filter((b) => b.color === P.ink && near(b.z, -19.44)).length >= 6, 'City Chambers windows face the camera');
  assert.ok(boxes.filter((b) => b.color === P.trunk).length >= 6, 'tree rows frame the square');
});

test('Glasgow includes the Duke of Wellington horse, rider, and traffic cone', () => {
  const boxes = [];
  buildGlasgow((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), { x: 0, z: 0 });

  assert.ok(boxes.some((b) => b.color === P.bronze && b.z > -25 && b.z < -12 && b.w >= 4), 'mounted statue has a bronze horse body');
  assert.ok(boxes.some((b) => b.color === P.bronze && near(b.x, 2.9) && near(b.y, 5) && near(b.z, -20)), 'horse has a visible snout');
  assert.ok(boxes.some((b) => b.color === P.bronze && near(b.x, -2.65) && near(b.y, 4.2) && near(b.z, -20)), 'horse has a visible tail');
  assert.ok(boxes.some((b) => b.color === '#f36b21' && b.y >= 7 && b.h >= 0.9 && b.z > -25 && b.z < -12), 'orange cone sits on the rider');
  assert.ok(boxes.some((b) => b.color === P.white && b.y >= 7 && b.z > -25 && b.z < -12), 'cone has its white band');
});
