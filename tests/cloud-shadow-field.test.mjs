import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudNoise } from '../js/world/cloud-shadow-field.js';

test('cloud noise is deterministic, varied and tileable', () => {
  const size = 128, a = buildCloudNoise(size), b = buildCloudNoise(size);
  assert.equal(a.length, size * size);
  assert.deepEqual(a, b);
  assert.ok(Math.min(...a) < 100 && Math.max(...a) > 150, 'field should span dark and bright cloud regions');
  const seam = Array.from({ length: size }, (_, y) => Math.abs(a[y * size] - a[y * size + size - 1])).reduce((sum, n) => sum + n, 0) / size;
  const interior = Array.from({ length: size }, (_, y) => Math.abs(a[y * size + 32] - a[y * size + 33])).reduce((sum, n) => sum + n, 0) / size;
  assert.ok(seam < interior * 1.5, `wrapped seam (${seam}) should stay smooth relative to interior (${interior})`);
});
