import test from 'node:test';
import assert from 'node:assert/strict';
import { house } from '../js/world/houses.js';
import { PALETTE as P } from '../js/world/palette.js';

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
  assert.equal(outputs[0].filter(([x, y, z, w, h, d]) => x === 0 && y === 0 && z === 0 && w === 9 && h === 3 * 3.1 && d === 7).length, 1);
  assert.ok(outputs.flat().some(([, y, , w, , d]) => y > 9.3 && w === 9 * 0.6 && d === 7 * 0.6));
  assert.ok(outputs[0].some(([, y, , , h, depth, color]) => y === 0.28 && y + h <= 3.1 && Math.abs(depth - 0.06) < 1e-9 && color === P.brick));
  assert.ok(outputs[0].some(([, y, , w, h, , color]) => y === 0.43 && w === 1.7 && h === 0.14 && color === P.white));
  assert.ok(outputs[0].some(([, y, , w, h, , color]) => y === 0.62 && w === 0.72 && h === 0.48 && color === P.ink));
  assert.ok(outputs[0].some(([, y, , w, h, , color]) => y === 3 * 3.1 + 2.8 && w === 0.12 && h === 0.06 && color === P.ink));
  for (const boxes of outputs) for (const [x, y, z, w, h, d] of boxes) {
    assert.ok(Math.abs(x) + w / 2 <= 9 / 2 + 0.1 + 1e-9);
    assert.ok(Math.abs(z) + d / 2 <= 7 / 2 + 0.9 + 1e-9); // existing balcony rails define the deepest projection
    assert.ok(y >= -1e-9);
    assert.ok(y + h <= 3 * 3.1 + 2.86 + 1e-9);
  }
  for (const [, y, , , h] of render(0, true)) {
    if (y > 9.3) assert.ok(y + h <= 3 * 3.1 + 1.06);
  }
});
