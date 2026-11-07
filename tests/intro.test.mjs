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
