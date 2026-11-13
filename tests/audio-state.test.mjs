import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audioState, near, fires, thunder, createDoor, createToll, BUS, VOICE_CAP } from '../js/audio/state.js';
import { BUSES } from '../js/audio/engine.js';
import { i18n } from '../js/content.js';

const base = { s: 3, speed: 0, night: 0, rain: 0, storm: 0, wind: 0.8, rs: 1, rl: 0, rg: 0, world: true, tunnel: 0, planeD: null, crowd: 0.5, bigben: 0, glasgow: 0 };
const GAINS = ['rain', 'wind', 'bedSp', 'bedLon', 'bedGla', 'crickets', 'engine', 'road', 'plane', 'crowd'];

test('every gain stays finite and inside 0..1 across the input corners', () => {
  for (const night of [0, 1]) for (const rain of [0, 0.3, 1]) for (const speed of [0, 0.6, 5]) for (const tunnel of [0, 1]) for (const planeD of [null, -1, -0.5, 0.5]) {
    const st = audioState({ ...base, night, rain, speed, tunnel, planeD, storm: 1, wind: 1.1, crowd: 1, rs: 0.4, rl: 0.3, rg: 0.3 });
    for (const k of GAINS) assert.ok(Number.isFinite(st[k]) && st[k] >= 0 && st[k] <= 1, `${k}=${st[k]}`);
    for (const [k, v] of Object.entries(st)) assert.ok(Number.isFinite(v), `${k} is not finite`);
    // the voices are uncorrelated noise and tones, so their levels add as power; the measured peak is checked in tests/audio.browser.py.
    // 0.4 (was 0.6) sits just above today's worst corner (0.35), so a voice made much louder fails here; the real loudness bound is the -1 dBFS peak there
    const power = Math.hypot(st.rain * BUS.weather, st.wind * BUS.weather, st.bedSp * BUS.ambience, st.bedLon * BUS.ambience, st.bedGla * BUS.ambience, st.crickets * BUS.ambience, st.engine * BUS.vehicles, st.road * BUS.vehicles, st.plane * BUS.traffic, st.crowd * BUS.people);
    assert.ok(power < 0.4, `continuous power sum ${power}`);
  }
});

test('dry weather is silent rain; more rain is louder, brighter and denser', () => {
  const dry = audioState({ ...base }), drizzle = audioState({ ...base, rain: 0.3 }), heavy = audioState({ ...base, rain: 1 });
  assert.equal(dry.rain, 0); assert.equal(dry.drops, 0);
  assert.ok(heavy.rain > drizzle.rain && drizzle.rain > 0);
  assert.ok(heavy.drops > drizzle.drops && heavy.rainCut > drizzle.rainCut);
  assert.ok(heavy.wind > dry.wind);
});

test('city beds crossfade by region and dim at night', () => {
  const sp = audioState({ ...base }), lon = audioState({ ...base, rs: 0, rl: 1 }), mid = audioState({ ...base, rs: 0.5, rl: 0.5 });
  assert.ok(sp.bedSp > 0 && sp.bedLon === 0 && lon.bedSp === 0 && lon.bedLon > 0);
  assert.ok(mid.bedSp > 0 && mid.bedLon > 0 && mid.bedSp < sp.bedSp);
  const night = audioState({ ...base, night: 1 });
  assert.ok(night.bedSp < sp.bedSp && night.bedCut < sp.bedCut);
  assert.ok(night.crickets > 0 && sp.crickets === 0 && night.birds === 0 && sp.birds > 0);
  assert.ok(audioState({ ...base, rs: 0, rg: 1 }).gulls > 0);
});

test('the engine follows speed, and a tunnel dulls the outside while the engine grows', () => {
  const idle = audioState({ ...base }), fast = audioState({ ...base, speed: 1.2 });
  assert.ok(idle.engine > 0 && fast.engine > idle.engine && fast.engineFreq > idle.engineFreq && idle.road === 0 && fast.road > 0);
  const inside = audioState({ ...base, speed: 1.2, tunnel: 1 });
  assert.ok(inside.outsideCut < 1000 && fast.outsideCut > 15000 && inside.engine > fast.engine);
  assert.equal(inside.crowd, 0);
});

test('without the 3D world only the ambience and the weather play', () => {
  const st = audioState({ ...base, world: false, speed: 1, rain: 1, planeD: -0.5, bigben: 1, crowd: 1 });
  for (const k of ['engine', 'road', 'passes', 'plane', 'crowd', 'steps', 'bigben', 'boat']) assert.equal(st[k], 0, k);
  assert.ok(st.bedSp > 0 && st.rain > 0);
});

test('the plane is heard only around its flyby, pans across and drops in pitch', () => {
  assert.equal(audioState({ ...base, planeD: -3 }).plane, 0);
  assert.equal(audioState({ ...base, planeD: 3 }).plane, 0);
  const inbound = audioState({ ...base, planeD: -0.8 }), outbound = audioState({ ...base, planeD: 0.2 });
  assert.ok(inbound.plane > 0 && outbound.plane > 0);
  assert.ok(inbound.planePan < outbound.planePan && inbound.planeRate > outbound.planeRate && inbound.planeCut > outbound.planeCut);
});

test('near, fires and the voice caps', () => {
  assert.equal(near(5, 5), 1); assert.equal(near(7, 5), 0); assert.equal(near(5, -1), 0);
  assert.equal(fires(100, 0.1, 0, 3, () => 0.5), true);
  assert.equal(fires(100, 0.1, 3, 3, () => 0.5), false); // at the cap: dropped
  assert.equal(fires(0, 0.1, 0, 3, () => 0), false);
  for (const v of Object.values(VOICE_CAP)) assert.ok(v >= 1 && v <= 8);
});

test('thunder arrives later, fainter and duller from farther away', () => {
  const a = thunder(0.4), b = thunder(3);
  assert.ok(Math.abs(a.delay - 0.4 / 0.343) < 1e-9 && b.delay > a.delay && b.gain < a.gain && b.cut < a.cut && b.dur > a.dur);
});

test('the door hisses once per arrival, and bells toll once per approach', () => {
  const door = createDoor();
  assert.equal(door(0, 3), false);        // never drove: no hiss
  assert.equal(door(0.5, 3.5), false);
  assert.equal(door(0, 3.5), false);      // stopped between stops
  assert.equal(door(0.5, 3.8), false);
  assert.equal(door(0, 4.02), true);
  assert.equal(door(0, 4.02), false);
  const toll = createToll();
  assert.deepEqual([0.2, 0.5, 0.9, 0.5, 0.1, 0.6].map(toll), [false, true, false, false, false, true]);
});

test('bus levels cover the engine buses, and the Sound label exists in both languages', () => {
  assert.deepEqual(Object.keys(BUS).sort(), [...BUSES].sort());
  assert.ok(i18n.en.ui.sound && i18n.pt.ui.sound && i18n.en.ui.sound !== i18n.pt.ui.sound);
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /data-sound aria-pressed="false"/);
});
