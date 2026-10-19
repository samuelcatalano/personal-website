import test from 'node:test';
import assert from 'node:assert/strict';
import { house } from '../js/world/houses.js';

function render(seed, lo = false) {
  let state = seed + 1;
  const q = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const boxes = [];
  house((...box) => boxes.push(box), q, 0, 0, 1, 9, 7, 3, 3.1, lo);
  return boxes;
}

test('house roof profiles vary deterministically within the existing footprint', () => {
  const outputs = Array.from({ length: 32 }, (_, seed) => render(seed));
  for (let seed = 0; seed < outputs.length; seed++) {
    assert.deepEqual(outputs[seed], render(seed));
  }
  assert.ok(outputs.flat().some(([, y, , w, , d]) => y > 9.3 && w === 9 * 0.6 && d === 7 * 0.6));
  for (const [, y, , , h] of render(0, true)) {
    if (y > 9.3) assert.ok(y + h <= 3 * 3.1 + 1.06);
  }
});
