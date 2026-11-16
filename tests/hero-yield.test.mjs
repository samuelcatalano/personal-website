import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstInBand } from '../js/world/hero-yield.js';

test('first sample inside the hero lane band, as a path fraction', () => {
  assert.equal(firstInBand([-1.75, -1.75, 0.5, 2, 4.25], -0.1, 3.6), 0.5); // oncoming lane, then the turn crosses into the band
  assert.equal(firstInBand([4.25, 3, 1, -1.75], -0.1, 3.6), 1 / 3);        // coming off the ramp
  assert.equal(firstInBand([-1.75, -1.75], -0.1, 3.6), -1);                  // never crosses
});
