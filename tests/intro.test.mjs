import { test } from 'node:test';
import assert from 'node:assert/strict';
import { practice } from '../js/intro.js';

const run = (...dys) => dys.reduce(practice, { p: 0, down: false, up: false });

test('scrolling down to the flag completes the first step only', () => {
  const s = run(300, 300);
  assert.deepEqual([s.p, s.down, s.up], [1, true, false]);
});
test('going back up only counts after the flag was reached', () => {
  assert.equal(run(-400).up, false);
  assert.equal(run(600, -600).up, true);
});
test('position never leaves 0..1', () => {
  assert.equal(run(-9999).p, 0);
  assert.equal(run(9999).p, 1);
});

import { destination } from '../js/intro.js';
test('roller blind walks São Paulo, London, Glasgow as the bus advances', () => {
  assert.deepEqual([0, 0.2, 0.5, 0.8, 1].map(destination), [0, 0, 1, 2, 2]);
});

import { nextStop, travelMs } from '../js/autoride.js';
test('auto-ride resumes at the next stop ahead and restarts after the last', () => {
  const ys = [0, 900, 1800, 2700];
  assert.equal(nextStop(ys, 0), 1);
  assert.equal(nextStop(ys, 950), 2);
  assert.equal(nextStop(ys, 2700), 0);
});
test('auto-ride travel time is bounded', () => {
  assert.equal(travelMs(10), 1400);
  assert.equal(travelMs(100000), 5500);
});
