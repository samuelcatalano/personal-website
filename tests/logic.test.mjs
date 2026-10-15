import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressFromScroll, nearestStop, routeT, scrollYForStop } from '../js/scroll.js';

test('progress clamps and handles short pages', () => {
  assert.equal(progressFromScroll(0, 5000, 1000), 0);
  assert.equal(progressFromScroll(4000, 5000, 1000), 1);
  assert.equal(progressFromScroll(9999, 5000, 1000), 1);
  assert.equal(progressFromScroll(-50, 5000, 1000), 0);
  assert.equal(progressFromScroll(0, 800, 1000), 0); // page shorter than viewport
  assert.equal(progressFromScroll(2000, 5000, 1000), 0.5);
});

test('nearestStop maps ends to first and last', () => {
  assert.equal(nearestStop(0, 16), 0);
  assert.equal(nearestStop(1, 16), 15);
  assert.equal(nearestStop(0.5, 3), 1);
  assert.equal(nearestStop(2, 16), 15);
  assert.equal(nearestStop(0, 1), 0);
});

test('routeT dwells at stops and is monotonic', () => {
  const n = 5, seg = 1 / (n - 1);
  assert.equal(routeT(0, n), 0);
  assert.equal(routeT(1, n), 1);
  assert.equal(routeT(seg * 0.1, n), 0);            // still parked at stop 0
  assert.equal(routeT(seg * 0.9, n), seg);          // already parked at stop 1
  let prev = -1;
  for (let p = 0; p <= 1; p += 0.01) { const t = routeT(p, n); assert.ok(t >= prev); prev = t; }
});

test('scrollYForStop is the inverse of nearestStop', () => {
  const n = 16, H = 16000, V = 1000;
  for (let i = 0; i < n; i++) assert.equal(nearestStop(progressFromScroll(scrollYForStop(i, n, H, V), H, V), n), i);
});

import { loadPrefs, savePref } from '../js/ui.js';

test('prefs default and survive throwing storage', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadPrefs(throwing), { lang: 'en', theme: 'day' });
  assert.deepEqual(loadPrefs(undefined), { lang: 'en', theme: 'day' });
  assert.doesNotThrow(() => savePref(throwing, 'lang', 'pt'));
  const mem = new Map([['lang', 'pt'], ['theme', 'night']]);
  assert.deepEqual(loadPrefs({ getItem: k => mem.get(k) ?? null }), { lang: 'pt', theme: 'night' });
  assert.deepEqual(loadPrefs({ getItem: () => 'garbage' }), { lang: 'en', theme: 'day' });
});
