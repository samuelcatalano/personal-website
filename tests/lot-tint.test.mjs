import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionalStoneTint } from '../js/world/building-character.js';

test('regional stone finishes are deterministic and distinct across city identities', () => {
  const regions = ['paulista', 'london', 'countryside', 'glasgow'];
  const first = regions.map((region) => regionalStoneTint(region, 0));
  assert.deepEqual(regions.map((region) => regionalStoneTint(region, 0)), first);
  assert.equal(new Set(first.map((tint) => tint.join(','))).size, regions.length);
  assert.ok(first.flat().every((channel) => channel >= 0.85 && channel <= 1.16));
});
