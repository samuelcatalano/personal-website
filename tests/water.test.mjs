import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reflectionMode, REFLECT_DEFAULT, detailWaves, detailHeight, detailTexture } from '../js/world/water-math.js';

test('bank reflection survives a quality drop, while the full city remains high-only', () => {
  assert.equal(reflectionMode('medium', null), REFLECT_DEFAULT);
  assert.equal(reflectionMode('medium', '1'), REFLECT_DEFAULT);
  assert.equal(reflectionMode('medium', '0'), 'off');
  assert.equal(reflectionMode('high', '0'), 'off');
  assert.equal(reflectionMode('high', '1'), 'full');
  assert.equal(reflectionMode('high', null), REFLECT_DEFAULT);
  assert.equal(reflectionMode('high', null, 'off'), 'off');
});

test('detail map tiles seamlessly and is deterministic', () => {
  const w = detailWaves();
  for (const v of [0, 0.31, 0.77]) assert.ok(Math.abs(detailHeight(w, 0, v) - detailHeight(w, 1, v)) < 1e-9);
  for (const u of [0.1, 0.5]) assert.ok(Math.abs(detailHeight(w, u, 0) - detailHeight(w, u, 1)) < 1e-9);
  const a = detailTexture(32), b = detailTexture(32);
  assert.deepEqual(a, b);
  assert.equal(a.length, 32 * 32 * 4);
});

test('detail slopes average to flat, so mipmaps calm the far water', () => {
  const t = detailTexture(64);
  let r = 0, g = 0;
  for (let i = 0; i < t.length; i += 4) { r += t[i]; g += t[i + 1]; }
  const n = t.length / 4;
  assert.ok(Math.abs(r / n - 127.5) < 4 && Math.abs(g / n - 127.5) < 4);
});

test('Tower Bridge foam follows the active model pier footprints on both banks', async () => {
  const { towerPierBounds } = await import('../js/world/water-math.js');
  assert.equal(typeof towerPierBounds, 'function');
  const old = towerPierBounds(100, -45), authored = towerPierBounds(100, -45, true);
  assert.deepEqual(old.map(p => p.z), [-54.5, -35.5]);
  for (const [i, p] of authored.entries()) {
    assert.equal(p.x, 100);
    assert.ok(Math.abs(Math.abs(p.z + 45) - 14.6) < 1e-9);
    assert.ok(Math.abs(p.hx - 4.704) < 1e-9);
    assert.ok(Math.abs(p.hz - 3.504) < 1e-9);
    assert.ok(Math.abs(old[i].z - p.z) > old[i].hz + 1);
  }
});
