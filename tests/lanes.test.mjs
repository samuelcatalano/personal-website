import test from 'node:test';
import assert from 'node:assert/strict';
import { laneSide } from '../js/world/lanes.js';
import { SWAP_TUNNEL } from '../js/world/layout.js';

test('Sao Paulo drives on the right, the UK on the left', () => {
  assert.equal(laneSide(-100), -1);
  assert.equal(laneSide(100), 1);
});

test('the crossover is centred on the tunnel and spans its covered length', () => {
  assert.equal(laneSide(0), 0);
  assert.equal(laneSide(-SWAP_TUNNEL.half), -1);
  assert.equal(laneSide(SWAP_TUNNEL.half), 1);
});

test('the crossover is monotonic', () => {
  let prev = -2;
  for (let s = -SWAP_TUNNEL.half; s <= SWAP_TUNNEL.half; s += 0.5) { const v = laneSide(s); assert.ok(v >= prev); prev = v; }
});
