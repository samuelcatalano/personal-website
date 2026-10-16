import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, ALLOWED_LICENSES, creditsFor } from '../js/world/models.js';

test('manifest ids are unique and complete', () => {
  assert.equal(new Set(MODELS.map((m) => m.id)).size, MODELS.length);
  for (const m of MODELS) {
    assert.match(m.file, /^[a-z0-9-]+\.glb$/, m.id);
    assert.ok(m.height > 0, m.id);
    for (const k of ['title', 'author', 'license', 'url']) assert.ok(m.credit?.[k], `${m.id} credit.${k}`);
    assert.ok(ALLOWED_LICENSES.includes(m.credit.license), `${m.id} license ${m.credit.license}`);
    assert.match(m.credit.url, /^https:\/\/sketchfab\.com\/3d-models\//, m.id);
  }
});

test('credits list each published file once', () => {
  const files = new Set(MODELS.map((m) => m.file));
  assert.equal(creditsFor().length, files.size);
});

test('bus and figure scales stay human', () => {
  assert.ok(Math.abs(MODELS.find((m) => m.id === 'bus').height - 4.6) < 0.01);
});
