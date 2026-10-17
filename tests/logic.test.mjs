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

test('routeT maps scroll continuously and uniformly onto the route', () => {
  const n = 5, seg = 1 / (n - 1);
  assert.equal(routeT(0, n), 0);
  assert.equal(routeT(1, n), 1);
  assert.equal(routeT(-1, n), 0);
  assert.equal(routeT(2, n), 1);
  for (let i = 0; i < n; i++) assert.equal(routeT(i * seg, n), i * seg);
  assert.equal(routeT(seg * 0.04, n), seg * 0.04);
  assert.equal(routeT(seg * 0.96, n), seg * 0.96);
  assert.equal(routeT(0.4, 1), 0);
  const eps = 1e-4;
  for (let i = 1; i < n - 1; i++) {
    const stop = i * seg;
    assert.ok(routeT(stop - eps, n) < stop && routeT(stop + eps, n) > stop);
    assert.ok(Math.abs((routeT(stop + eps, n) - routeT(stop - eps, n)) - 2 * eps) < 1e-12);
  }
  let prev = -1;
  for (let p = 0; p <= 1; p += 0.01) { const t = routeT(p, n); assert.ok(t >= prev); prev = t; }
});

test('spring gives nearly the same result mid-motion at 30, 60 and 120 Hz', () => {
  const after = (hz) => {
    let state = { value: 0, velocity: 0 };
    for (let i = 0; i < hz * 0.2; i++) state = spring(state, 1, 1 / hz, 0.18);
    return state;
  };
  const at30 = after(30), at60 = after(60), at120 = after(120);
  for (const state of [at30, at120]) {
    assert.ok(Math.abs(state.value - at60.value) < 0.002);
    assert.ok(Math.abs(state.velocity - at60.velocity) < 0.02);
  }
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

import { routePoints, LANDMARKS, stopIndex, rng, STOP_SPACING, GAP } from '../js/world/layout.js';
import { stops } from '../js/content.js';

test('route has one point per stop, increasing x', () => {
  const pts = routePoints(stops.length);
  assert.equal(pts.length, stops.length);
  pts.slice(1).forEach((p, i) => assert.equal(p.x - pts[i].x, STOP_SPACING + (i === GAP.after ? GAP.size : 0)));
  assert.equal(stops[GAP.after].id, LANDMARKS.masp); // the extra road sits right after MASP
});

test('every landmark is anchored to an existing stop', () => {
  for (const id of Object.values(LANDMARKS)) assert.ok(stopIndex(stops, id) >= 0, id);
});

test('Glasgow landmark is anchored between the OLM and Tribal stops', () => {
  const olm = stopIndex(stops, 'olm');
  const glasgow = stopIndex(stops, LANDMARKS.glasgow);
  const tribal = stopIndex(stops, 'tribal');
  assert.ok(olm < glasgow && glasgow < tribal);
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

test('blendShots eases camera framing at transition boundaries', () => {
  const a = { position: [0, 10, 40], target: [0, 0, 0] };
  const b = { position: [50, 30, 60], target: [60, 5, -20] };
  const velocityAt = (at) => {
    const epsilon = 1e-4;
    const before = blendShots(a, b, at - epsilon, 18).position;
    const after = blendShots(a, b, at + epsilon, 18).position;
    return Math.hypot(...after.map((v, i) => v - before[i])) / (2 * epsilon);
  };
  assert.ok(velocityAt(0.001) < velocityAt(0.1));
  assert.ok(velocityAt(0.999) < velocityAt(0.9));
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

test('spring reverses an in-flight scroll and converges inside the progress range', () => {
  let s = { value: 0, velocity: 0 };
  for (let i = 0; i < 18; i++) s = spring(s, 1, 1 / 60, 0.18);
  assert.ok(s.value > 0.5 && s.value < 1);
  for (let i = 0; i < 300; i++) {
    s = spring(s, 0, 1 / 60, 0.18);
    assert.ok(Number.isFinite(s.value) && s.value >= 0 && s.value <= 1);
  }
  assert.ok(s.value < 1e-3);
});

test('approach moves at most rate*dt and reverses smoothly', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  near(approach(0, 1, 0.1, 1.4), 0.14);
  near(approach(0.9, 1, 0.5, 1.4), 1);
  near(approach(0.5, 0, 0.1, 1.4), 0.36);
});

import { FRAME_LIFT } from '../js/world/layout.js';

test('follow shot is unchanged without lift', () => {
  const bus = { x: 5, y: 0, z: -3 };
  assert.deepEqual(shotFor('follow', bus, { mobile: false, lift: 0 }), shotFor('follow', bus, { mobile: false }));
});

test('lift raises the aim and pulls the camera back for tall landmarks', () => {
  const bus = { x: 0, y: 0, z: 0 };
  const flat = shotFor('follow', bus, { mobile: false }), tall = shotFor('follow', bus, { mobile: false, lift: 1 });
  assert.ok(tall.target[1] >= flat.target[1] + 8);
  assert.ok(Math.hypot(...tall.position) > Math.hypot(...flat.position));
  for (const v of Object.values(FRAME_LIFT)) assert.ok(v > 0 && v <= 1);
  for (const key of Object.keys(FRAME_LIFT)) assert.ok(stops.some((s) => s.id === key), key);
});

import { nextTier } from '../js/world/camera.js';
test('nextTier drops high to medium on low fps and never climbs', () => {
  assert.equal(nextTier('high', [30, 35]), 'medium');
  assert.equal(nextTier('high', [60, 58]), 'high');
  assert.equal(nextTier('high', []), 'high');
  assert.equal(nextTier('medium', [10]), 'medium');
  assert.equal(nextTier('medium', [120]), 'medium');
});
