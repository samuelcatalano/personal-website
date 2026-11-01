import test from 'node:test';
import assert from 'node:assert/strict';
import { fadeVehicle, updateFadedVehicle } from '../js/world/fade.js';

const material = () => ({ opacity: 1, visible: true, transparent: false, blending: 1, clone() { return { ...this }; } });
const mesh = () => ({ material: material(), castShadow: true });
const root = (...children) => ({ userData: {}, children, traverse(fn) { for (const child of this.children) fn(child); } });

test('replacement body and beams inherit an ongoing fade and restore shared materials', () => {
  const old = mesh(), vehicle = root(old);
  fadeVehicle(vehicle, 0.5);
  const body = mesh(), beam = mesh(), sharedBody = body.material, sharedBeam = beam.material;
  updateFadedVehicle(vehicle, () => { vehicle.children = [body, beam]; });
  assert.notEqual(body.material, sharedBody);
  assert.equal(body.material.opacity, 0.5);
  assert.equal(beam.material.opacity, 0.5);
  assert.equal(body.castShadow, false);
  assert.equal(sharedBody.opacity, 1);
  fadeVehicle(vehicle, 1);
  assert.equal(body.material, sharedBody);
  assert.equal(beam.material, sharedBeam);
  assert.equal(body.castShadow, true);
});

test('reskin during a fade preserves the new shared paint when the fade ends', () => {
  const oldPaint = material(), newPaint = material();
  const body = { material: oldPaint, castShadow: true }, other = { material: newPaint, castShadow: true };
  const vehicle = root(body);
  fadeVehicle(vehicle, 0.5);
  updateFadedVehicle(vehicle, () => { body.material = newPaint; });
  assert.notEqual(body.material, newPaint);
  assert.equal(body.material.opacity, 0.5);
  assert.equal(other.material.opacity, 1);
  fadeVehicle(vehicle, 1);
  assert.equal(body.material, newPaint);
  assert.equal(other.material, newPaint);
});
