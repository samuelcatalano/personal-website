import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riverProfile, BRIDGE_H, DECK_T, BOAT_TOP, RIVER_WIDTH, RIVER_EXIT } from '../js/world/underwater-profile.js';
const BANK = 46.6; // near bank of the London crossing
test('the road stays at the 7.5 m arch crest through the far bank without a valley', () => {
  assert.equal(BRIDGE_H, 7.5);
  for (const bank of [BANK, 49]) {
    for (let az = 0; az <= bank + RIVER_WIDTH; az += 0.5) assert.equal(riverProfile(az, bank), 7.5, `height at ${az}, bank ${bank}`);
  }
});
test('the deck spans the whole channel level at BRIDGE_H', () => {
  for (const az of [BANK, BANK + RIVER_WIDTH / 2, BANK + RIVER_WIDTH]) assert.equal(riverProfile(az, BANK), BRIDGE_H);
});
test('the soffit clears the Mercury Clippers with at least 1 m of headroom', () => {
  assert.ok(BRIDGE_H - DECK_T - BOAT_TOP >= 1);
});
test('the road comes back to ground level on the far side of the river', () => {
  assert.ok(Math.abs(riverProfile(BANK + RIVER_WIDTH + RIVER_EXIT, BANK)) < 1e-9);
  assert.ok(Math.abs(riverProfile(BANK + RIVER_WIDTH + RIVER_EXIT + 5, BANK)) < 1e-9);
});
test('the profile is continuous (no step above 0.6 m per 0.5 m)', () => {
  let prev = riverProfile(0, BANK);
  for (let az = 0.5; az <= BANK + RIVER_WIDTH + RIVER_EXIT + 2; az += 0.5) {
    const y = riverProfile(az, BANK);
    assert.ok(Math.abs(y - prev) < 0.6, `step at ${az}`);
    prev = y;
  }
});
test('the exit is the only descent, with level tangents at both ends', () => {
  const start = BANK + RIVER_WIDTH, end = start + RIVER_EXIT, eps = 0.001;
  assert.ok((riverProfile(start, BANK) - riverProfile(start + eps, BANK)) / eps < 0.01);
  assert.ok(riverProfile(end - eps, BANK) / eps < 0.01);
  let prev = BRIDGE_H;
  for (let az = start; az <= end + 1; az += 0.1) {
    const y = riverProfile(az, BANK);
    assert.ok(y <= prev + 1e-9 && y >= 0);
    prev = y;
  }
});
test('the extended exit halves the former peak grade without moving the level river deck', () => {
  assert.ok(RIVER_EXIT >= 28);
  const start = BANK + RIVER_WIDTH;
  for (let az = start; az < start + RIVER_EXIT; az += 0.1) {
    assert.ok((riverProfile(az, BANK) - riverProfile(az + 0.1, BANK)) / 0.1 <= 0.36);
  }
});
