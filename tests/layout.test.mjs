import { test } from 'node:test';
import assert from 'node:assert/strict';
import { furnitureSpots, ROAD } from '../js/world/layout.js';

test('furnitureSpots: one sign per stop, plaque only with a brand', () => {
  const curve = { getPointAt: (t) => ({ x: t * 100, z: 0 }), getTangentAt: () => ({ x: 1, z: 0 }) };
  const spots = furnitureSpots([{ brand: {} }, {}, { brand: {} }], curve);
  assert.equal(spots.filter((s) => s.kind === 'sign').length, 3);
  assert.deepEqual(spots.find((s) => s.kind === 'plaque').xz, [7, 11.5]);
  assert.deepEqual(spots.find((s) => s.kind === 'sign' && s.i === 0).xz, [-5, ROAD.furniture]);
});
