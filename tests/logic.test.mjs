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

import { routePoints, LANDMARKS, stopIndex, rng, scotRange, STOP_SPACING, GAPS, LONG_GAP, OUT_GAP, regions, towerX, glasgowSites, riverEnd } from '../js/world/layout.js';
import { stops } from '../js/content.js';

test('route has one point per stop, increasing x', () => {
  const pts = routePoints(stops.length);
  assert.equal(pts.length, stops.length);
  pts.slice(1).forEach((p, i) => assert.equal(p.x - pts[i].x, STOP_SPACING + (GAPS.find((g) => g.after === i)?.size ?? 0)));
  assert.equal(stops[GAPS[0].after].id, LANDMARKS.masp); // the extra road sits right after MASP
  assert.equal(GAPS[0].size, 60);
  assert.equal(stops[GAPS[1].after].id, LANDMARKS.eye); // the long road sits right after the Eye
  const [o, g] = ['olm', 'glasgow'].map((id) => pts[stopIndex(stops, id)].x);
  assert.equal(g - o, STOP_SPACING + OUT_GAP); // the Eye -> Glasgow trip is the long out gap
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

test('scotRange starts after the OLM stop and ends where the Scottish edge ends on the way back', () => {
  const [a, b] = scotRange(stops);
  const at = (id) => stopIndex(stops, id) / (stops.length - 1);
  assert.ok(at('olm') < a && a < at(LANDMARKS.glasgow));
  assert.ok(at(LANDMARKS.glasgow) < b && b < at('tribal'));
  const pts = routePoints(stops.length), g = pts[stopIndex(stops, 'glasgow')].x, t = pts[stopIndex(stops, 'tribal')].x;
  assert.equal(t - g, STOP_SPACING + LONG_GAP); // Glasgow -> Tribal is the return gap
  assert.ok(Math.abs(g + (b * (stops.length - 1) - stopIndex(stops, 'glasgow')) * (t - g) - (g + 55)) < 1e-6);
});

test('Tower Bridge sits after the Eye, before the lower terraces; out-leg countryside is >= 80 m; the river runs past Glasgow', () => {
  const pts = routePoints(stops.length), [out, back] = regions(stops, pts), e = pts[stopIndex(stops, 'olm')].x, g = pts[stopIndex(stops, 'glasgow')].x, t = pts[stopIndex(stops, 'tribal')].x;
  assert.ok(e < towerX(stops, pts) && towerX(stops, pts) + 19 < out.sub[0] && out.sub[0] < out.ctry[0]);
  assert.ok(out.ctry[1] - out.ctry[0] >= 80 && back.ctry[1] - back.ctry[0] >= 80);
  assert.ok(out.scot[1] - out.scot[0] >= 80 && out.scot[1] < g && back.sub[1] < t);
  assert.ok(riverEnd(stops, pts) > g + 55 && riverEnd(stops, pts) < t);
  const { museum, uni } = glasgowSites(stops, pts);
  for (const s of [museum, uni]) {
    assert.ok(s.x - s.w / 2 > out.scot[0] && s.x + s.w / 2 < g, 'inside the Scottish approach');
    assert.ok(s.z + s.d / 2 < pts[stopIndex(stops, 'glasgow')].z - 43, 'clear of the square');
  }
  assert.ok(museum.x < uni.x && museum.z - museum.d / 2 > uni.z + uni.d / 2, 'museum first, on the river bank; university behind it without overlap');
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

test('former Glasgow countryside is paved and urban, with no turbines or field hills', async () => {
  const { buildCountry } = await import('../js/world/country.js'), { PALETTE: P } = await import('../js/world/palette.js');
  const curve = { getPointAt: (t) => ({ x: t * 1000, z: 0 }) };
  for (const leg of [0, 1]) {
    const boxes = [], plots = [];
    const hubs = buildCountry((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), curve, () => {}, [0, 1000], leg, (p) => plots.push(p));
    assert.deepEqual(hubs, []);
    assert.ok(!boxes.some((b) => [P.field, P.field2, P.hill].includes(b.color)), 'no rural field or hill ground');
    assert.ok(plots.length >= 100, `dense lots on leg ${leg}`);
    assert.ok(plots.some((p) => p.kind === 'midrise' && p.height >= 12), 'midrise flats punctuate the houses');
    assert.ok(plots.some((p) => p.kind === 'terrace'), 'detailed terraces remain in the urban mix');
    const masses = boxes.filter((b) => b.y === 0 && b.h > 3);
    assert.ok(masses.every((b) => b.z + b.d / 2 <= -60 || b.z - b.d / 2 >= -30), 'country buildings stay outside the river and bank path');
    assert.ok(masses.every((b) => b.z - b.d / 2 >= -121), 'country buildings stop before the distant horizon');
    for (let i = 0; i < masses.length; i++) for (let j = i + 1; j < masses.length; j++) {
      const a = masses[i], b = masses[j];
      assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2, 'country building footprints do not overlap');
    }
  }
});

test('outskirts: each former-countryside stretch is built up with houses, and nothing sits on the road band', async () => {
  const { buildCountry } = await import('../js/world/country.js'), { tree } = await import('../js/world/city.js');
  for (const leg of [0, 1]) {
    const boxes = [], curve = { getPointAt: (t) => ({ x: t * 100, z: 10 }) };
    buildCountry((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), curve, tree, [0, 100], leg);
    assert.ok(boxes.filter((b) => b.w >= 6 && b.h >= 5 && b.y === 0 && b.z > -100).length >= 12, 'house bodies');
    assert.equal(boxes.filter((b) => b.y + b.h > 0.1 && Math.abs(b.z - 10) < b.d / 2 + 4.25).length, 0, 'road band is clear');
  }
});

test('countryside rear infill is stable, bounded, clear of existing plots, and still draws without a callback', async () => {
  const { buildCountry } = await import('../js/world/country.js');
  const { stops } = await import('../js/content.js');
  const { routePoints, regions } = await import('../js/world/layout.js');
  const ranges = regions(stops, routePoints(stops.length)).map((r) => r.ctry);
  const curve = { getPointAt: (t) => ({ x: t * 1000, z: 0 }) };
  const collect = (range, leg) => {
    const plots = [];
    buildCountry(() => {}, curve, () => {}, range, leg, (p) => plots.push(p));
    return plots;
  };
  const plots = ranges.flatMap(collect), infill = plots.filter((p) => p.id.startsWith('country-infill-'));
  const repeated = ranges.flatMap(collect).filter((p) => p.id.startsWith('country-infill-'));
  assert.equal(infill.length, 8);
  assert.deepEqual(infill, repeated);
  assert.equal(new Set(infill.map((p) => p.id)).size, infill.length);
  const styles = [...new Set(plots.map((p) => p.archetype).filter(Boolean))].sort();
  assert.deepEqual(styles, ['country-garden-flat', 'country-garden-pair', 'country-slate-cottage']);
  const gardenFlat = plots.find((p) => p.id === 'country-flat-0-5-0');
  assert.equal(gardenFlat?.archetype, 'country-garden-flat');
  for (const p of infill) {
    assert.ok(ranges.some(([c0, c1]) => p.x >= c0 + 12 && p.x <= c1 - 12));
    assert.ok(['country-garden-pair', 'country-slate-cottage'].includes(p.archetype));
    assert.ok(p.z + p.depth / 2 <= -99.98, `infill ${p.id} clears the side-street path`);
    assert.ok(p.z + p.depth / 2 + 1.8 <= -99.98, `infill path ${p.id} clears the side-street terminus`);
    assert.ok(p.z - p.depth / 2 - 0.4 >= -121, `infill ${p.id} roof stays before the horizon`);
    for (const other of plots.filter((q) => q !== p)) {
      assert.ok(Math.abs(p.x - other.x) >= (p.width + other.width) / 2 || Math.abs(p.z - other.z) >= (p.depth + other.depth) / 2, `infill ${p.id} does not overlap ${other.id}`);
    }
  }
  const boxes = [];
  ranges.forEach((range, leg) => buildCountry((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), curve, () => {}, range, leg));
  for (const p of infill) assert.ok(boxes.some((b) => b.x === p.x && b.y === 0 && b.z === p.z && b.w === p.width && b.d === p.depth), `legacy output draws ${p.id}`);
  assert.ok(boxes.some((b) => b.x === gardenFlat.x && b.y === 0 && b.z === gardenFlat.z && b.w === gardenFlat.width && b.d === gardenFlat.depth && b.h === gardenFlat.height), 'garden-flat archetype preserves its legacy footprint and height');
});

test('swapAt derives from the first UK stop', async () => {
  const { swapAt, ukStart } = await import('../js/world/layout.js');
  const { stops: STOPS } = await import('../js/content.js');
  const i = STOPS.findIndex((s) => s.id === 'move');
  assert.equal(ukStart(STOPS), i);
  assert.equal(swapAt(STOPS), (i - 0.5) / (STOPS.length - 1));
});
