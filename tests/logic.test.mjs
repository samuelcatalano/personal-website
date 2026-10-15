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

import { routePoints, LANDMARKS, stopIndex, rng, STOP_SPACING } from '../js/world/layout.js';
import { stops } from '../js/content.js';

test('route has one point per stop, increasing x', () => {
  const pts = routePoints(stops.length);
  assert.equal(pts.length, stops.length);
  pts.slice(1).forEach((p, i) => assert.equal(p.x - pts[i].x, STOP_SPACING));
});

test('every landmark is anchored to an existing stop', () => {
  for (const id of Object.values(LANDMARKS)) assert.ok(stopIndex(stops, id) >= 0, id);
});

test('rng is deterministic', () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

import { SECTION_SHOT, shotFor, blendShots, spring, approach } from '../js/world/camera.js';
import { SECTIONS as ALL_SECTIONS } from '../js/content.js';

const close = (a, b, eps = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${a} vs ${b}`));

test('every section has a shot kind', () => {
  for (const s of ALL_SECTIONS) assert.ok(['hero', 'follow', 'high', 'closing'].includes(SECTION_SHOT[s]), s);
});

test('shotFor returns finite vectors for every kind', () => {
  for (const k of ['hero', 'follow', 'high', 'closing']) for (const mobile of [false, true]) {
    const s = shotFor(k, { x: 10, y: 0, z: -3 }, { extent: { minX: -225, maxX: 225 }, mobile });
    [...s.position, ...s.target].forEach(v => assert.ok(Number.isFinite(v), k));
  }
});

test('blendShots hits endpoints and arcs at the middle', () => {
  const a = { position: [0, 10, 40], target: [0, 0, 0] };
  const b = { position: [50, 30, 60], target: [60, 5, -20] };
  close(blendShots(a, b, 0).position, a.position); close(blendShots(a, b, 0).target, a.target, 1e-4);
  close(blendShots(a, b, 1).position, b.position); close(blendShots(a, b, 1).target, b.target, 1e-4);
  assert.ok(Math.abs(blendShots(a, b, 0.5, 18).position[1] - (20 + 18)) < 1e-9);
});

test('blendShots turns the short way round', () => {
  const a = { position: [0, 0, 0], target: [-10, 0, 1] };   // yaw ≈ +174°
  const b = { position: [0, 0, 0], target: [-10, 0, -1] };  // yaw ≈ -174°
  const mid = blendShots(a, b, 0.5).target;
  assert.ok(mid[0] < -9.9 && Math.abs(mid[2]) < 1e-6);       // still looking to -x, not swung round to +x
});

test('spring snaps on dt <= 0 and converges without overshoot', () => {
  assert.deepEqual(spring({ value: 0, velocity: 3 }, 1, 0, 0.32), { value: 1, velocity: 0 });
  let s = { value: 0, velocity: 0 };
  for (let i = 0; i < 240; i++) { s = spring(s, 1, 1 / 60, 0.32); assert.ok(s.value <= 1 + 1e-12); }
  assert.ok(Math.abs(s.value - 1) < 1e-3);
});

test('approach moves at most rate*dt and reverses smoothly', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  near(approach(0, 1, 0.1, 1.4), 0.14);
  near(approach(0.9, 1, 0.5, 1.4), 1);
  near(approach(0.5, 0, 0.1, 1.4), 0.36);
});
