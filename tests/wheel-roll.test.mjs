// Pure wheel kinematics (js/world/wheel-roll.js, no three.js): a wheel turns about its own axle (local z) by distance / radius;
// forward travel (+x) turns it negatively, so the tread moves with the road.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollWheels, wheelRadius } from '../js/world/wheel-roll.js';

const wheel = (radius, y = 0) => ({ rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y, z: 0 }, userData: radius === undefined ? {} : { radius } });

test('a wheel turns by distance over its radius, forward travel negative, reverse unwinds', () => {
  const w = wheel(0.5);
  rollWheels([w], 2);
  assert.ok(Math.abs(w.rotation.z + 4) < 1e-12, `expected -4 rad, got ${w.rotation.z}`);
  rollWheels([w], -2);
  assert.ok(Math.abs(w.rotation.z) < 1e-12);
});

test('the turn is proportional to 1/radius (same distance, smaller wheel turns more)', () => {
  const big = wheel(0.4), small = wheel(0.2);
  rollWheels([big, small], 1);
  assert.ok(Math.abs(small.rotation.z / big.rotation.z - 2) < 1e-12);
});

test('wheels without a measured radius roll with their centre height (authored wheel nodes sit at their radius)', () => {
  const w = wheel(undefined, 0.314);
  assert.equal(wheelRadius(w), 0.314);
  rollWheels([w], 1);
  assert.ok(Math.abs(w.rotation.z + 1 / 0.314) < 1e-12);
});

test('a measured radius wins over the centre height', () => {
  assert.equal(wheelRadius(wheel(0.321, 0.4)), 0.321);
});

test('rolling changes only the spin about the axle', () => {
  const w = wheel(0.3);
  rollWheels([w], 3);
  assert.equal(w.rotation.x, 0);
  assert.equal(w.rotation.y, 0);
  assert.notEqual(w.rotation.z, 0);
});

test('an empty wheel list is a no-op', () => {
  assert.doesNotThrow(() => rollWheels([], 5));
});
