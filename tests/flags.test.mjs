import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flag, pixel, W, H } from '../js/world/flags.js';
const count = (kind) => { const b = []; flag((...a) => b.push(a), 0, 0, 0, kind); return b.length; };
test('saltire: white centre and diagonals, blue edges', () => {
  assert.equal(pixel('saltire', 5, 3), '#f4f4f0');
  assert.equal(pixel('saltire', 0, 0), '#f4f4f0');
  assert.equal(pixel('saltire', W - 1, 0), '#f4f4f0');
  assert.equal(pixel('saltire', 5, 0), '#1f6fd6');
  assert.equal(pixel('saltire', 0, H >> 1), '#1f6fd6');
});
test('union jack: red centre cross, white border, blue field', () => {
  assert.equal(pixel('jack', 5, 3), '#cf1f2e');
  assert.equal(pixel('jack', 5, 0), '#cf1f2e');
  assert.equal(pixel('jack', 4, 0), '#f4f4f0');
  assert.equal(pixel('jack', 2, 0), '#1f3a8a');
});
test('flags stay under 50 boxes', () => { assert.ok(count('saltire') <= 50); assert.ok(count('jack') <= 50); });
