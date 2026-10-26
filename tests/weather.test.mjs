import assert from 'node:assert/strict';
import test from 'node:test';
import { createLightning, createWeather, lagWetness, visitWeather } from '../js/world/weather.js';

const regions = ['sp', 'lon', 'gla'];

test('weather makes one independent roll per region and uses the regional chance boundaries', () => {
  const rolls = [0.24, 0.45, 0.70];
  let calls = 0;
  const weather = createWeather({ random: () => rolls[calls++] });
  assert.equal(calls, 3);
  assert.equal(weather.entry, weather.sp);
  assert.deepEqual(regions.map((region) => weather[region].rain), [1, 0, 0]);
  const clearEnds = createWeather({ random: () => 1 });
  assert.deepEqual(regions.map((region) => clearEnds[region].cover), [0.4, 0.7, 0.85]);
});

test('rain overrides every region; clear and unknown overrides preserve stable rolls', () => {
  let calls = 0;
  const rain = createWeather({ random: () => { calls++; return 0.99; }, override: 'rain' });
  assert.equal(calls, 3);
  assert.deepEqual(regions.map((region) => rain[region].rain), [1, 0.65, 0.75]);
  assert.deepEqual(regions.map((region) => rain[region].fall), [1.4, 0.7, 0.6]);

  const clear = createWeather({ random: () => 0.5, override: 'clear' });
  assert.deepEqual(regions.map((region) => clear[region].rain), [0, 0, 0]);
  assert.deepEqual(regions.map((region) => clear[region].cover), [0.12, 0.25, 0.45]);
  const unknown = createWeather({ random: () => 0.9, override: 'snow' });
  assert.deepEqual(regions.map((region) => unknown[region].rain), [0, 0, 0]);
});

test('non-rain weather shares fall and wind per city and stays within numeric ranges', () => {
  const weather = createWeather({ random: () => 0.9 });
  for (const region of regions) {
    const value = weather[region];
    for (const key of ['rain', 'wet', 'storm', 'cover', 'fall', 'wind']) assert.ok(Number.isFinite(value[key]));
    for (const key of ['rain', 'wet', 'storm', 'cover']) assert.ok(value[key] >= 0 && value[key] <= 1);
    assert.equal(value.rain, 0);
    assert.equal(value.wet, 0);
    assert.equal(value.storm, 0);
  }
  assert.deepEqual(regions.map((region) => weather[region].fall), [1.4, 0.7, 0.6]);
  assert.deepEqual(regions.map((region) => weather[region].wind), [1.1, 0.65, 0.8]);
  assert.ok(Object.isFrozen(weather) && regions.every((region) => Object.isFrozen(weather[region])));
  assert.ok(weather.sp.cover >= 0.12 && weather.sp.cover <= 0.4);
  assert.ok(weather.lon.cover >= 0.25 && weather.lon.cover <= 0.7);
  assert.ok(weather.gla.cover >= 0.45 && weather.gla.cover <= 0.85);
});

test('visit weather is initialized once and reused', () => {
  assert.deepEqual(Object.keys(visitWeather).sort(), ['entry', 'sp', 'lon', 'gla'].sort());
});

test('wetness approaches target exponentially and dries slower than it wets', () => {
  assert.equal(lagWetness(0, 1, 0), 1);
  const wetStep = lagWetness(0, 1, 1);
  const dryStep = lagWetness(1, 0, 1);
  assert.ok(wetStep > 0 && wetStep < 1);
  assert.ok(1 - dryStep < wetStep, 'drying changes less than wetting over one second');
  assert.equal(lagWetness(0.5, 0.5, 1), 0.5);
  assert.equal(lagWetness(0, 1, -1), 0);
});

test('lightning has one smooth pulse, ends at .45s, and waits at least 20s to recur', () => {
  const lightning = createLightning({ random: () => 0 });
  assert.equal(lightning(19.99, 1, 1), 0);
  assert.equal(lightning(20, 1, 1), 0);
  assert.ok(Math.abs(lightning(20.225, 1, 1) - 0.04) < 1e-12);
  assert.equal(lightning(20.45, 1, 1), 0);
  assert.equal(lightning(39.999, 1, 1), 0);
  assert.equal(lightning(40, 1, 1), 0);
  assert.ok(Math.abs(lightning(40.225, 1, 1) - 0.04) < 1e-12);
});

test('lightning stays off when rain is absent or storm strength is zero', () => {
  const dry = createLightning({ random: () => 0 });
  assert.equal(dry(20, 0.05, 1), 0);
  assert.equal(dry(20.225, 0, 1), 0);
  const calm = createLightning({ random: () => 0 });
  assert.equal(calm(20, 1, 0), 0);
  assert.equal(calm(20.225, 1, 0), 0);
  const clampedLow = createLightning({ random: () => 0 });
  assert.equal(clampedLow(20, 1, -1), 0);
  const clampedHigh = createLightning({ random: () => 0 });
  clampedHigh(20, 1, 2);
  assert.ok(Math.abs(clampedHigh(20.225, 1, 2) - 0.04) < 1e-12);
});

test('large time jumps schedule one current pulse without catching up missed intervals', () => {
  const lightning = createLightning({ random: () => 0 });
  assert.equal(lightning(100, 1, 1), 0);
  assert.ok(Math.abs(lightning(100.225, 1, 1) - 0.04) < 1e-12);
  assert.equal(lightning(100.45, 1, 1), 0);
});

test('reduced motion lightning never rolls and always returns zero', () => {
  let calls = 0;
  const lightning = createLightning({ random: () => { calls++; return 0; }, reducedMotion: true });
  assert.deepEqual([lightning(20, 1, 1), lightning(100, 1, 1), lightning(1000, 0, 0)], [0, 0, 0]);
  assert.equal(calls, 0);
});
