import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { swapAt, scotRange } from '../js/world/layout.js';
import { createMood } from '../js/world/mood.js';
import { createWeather } from '../js/world/weather.js';

const n = stops.length, clearWeather = createWeather({ override: 'clear' }), moodAt = createMood(stops, { weather: clearWeather }), sw = swapAt(stops), [g0, g1] = scotRange(stops), u = 1 / (n - 1);
const snap = (t) => JSON.parse(JSON.stringify(moodAt(t)));
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], sat = (c) => Math.max(...c) - Math.min(...c);

test('clear-weather mood preserves warm entry cities and muted Glasgow sky', () => {
  const sp = snap(sw - 3 * u), lon = snap((sw + g0) / 2 - 0.0001), gla = snap((g0 + g1) / 2);
  assert.deepEqual([sp.rain, lon.rain, gla.rain], [0, 0, 0]);
  assert.ok(sp.light[2] < lon.light[2] && sp.sun > lon.sun, 'SP light is warmer and stronger');
  assert.ok(sat(gla.hor) < sat(lon.hor) && sat(gla.zen) < sat(lon.zen), 'Glasgow sky is greyer');
  assert.ok(gla.sun < lon.sun && gla.hemi >= lon.hemi && gla.fogK < lon.fogK, 'muted Glasgow light and denser fog');
  assert.deepEqual([gla.sun, gla.hemi, gla.fogK], [1.2, 1.02, 1.05]);
  assert.ok(lum(gla.zen) < lum(lon.zen) + 0.2 && gla.cloudOp > 0);
});

test('mood is continuous across every boundary', () => {
  for (const b of [sw, g0, g1]) for (let d = -1; d <= 1; d += 0.01) {
    const a = snap(b + d * u), c = snap(b + d * u + 1e-4);
    for (const k of Object.keys(a)) [].concat(a[k]).forEach((v, i) => assert.ok(Math.abs(v - [].concat(c[k])[i]) < 0.01, `${k} jumps near ${b}`));
  }
});

test('output object is reused', () => assert.equal(moodAt(0), moodAt(0.5)));

test('weather data blends continuously with regional mood', () => {
  for (const b of [sw, g0, g1]) for (let d = -1; d <= 1; d += 0.01) {
    const a = snap(b + d * u), c = snap(b + d * u + 1e-4);
    for (const k of ['cover', 'wet', 'storm', 'fall', 'wind', 'rain']) {
      assert.ok(Number.isFinite(a[k]) && Number.isFinite(c[k]), `${k} is numeric`);
      assert.ok(Math.abs(a[k] - c[k]) < 0.01, `${k} jumps near ${b}`);
    }
  }
});

test('rainy palettes apply at entry and in each city with darker light and shorter fog', () => {
  const rainyMood = createMood(stops, { weather: createWeather({ override: 'rain' }) });
  const places = [0, 2 * u, (sw + g0) / 2, (g0 + g1) / 2];
  for (const t of places) {
    const m = JSON.parse(JSON.stringify(rainyMood(t))), clear = snap(t);
    assert.ok(m.rain > 0 && m.cover === 1 && m.wet === 1);
    assert.ok(m.sun < clear.sun && m.fogK < clear.fogK);
  }
  const expectedZen = [0x384d62, 0x384d62, 0x4b5d70, 0x43566b].map((hex) => [hex >> 16, (hex >> 8) & 255, hex & 255].map((v) => v / 255));
  places.forEach((t, i) => assert.deepEqual(JSON.parse(JSON.stringify(rainyMood(t).zen)), expectedZen[i]));
});

test('default mood factories use the same visit weather', () => {
  const a = createMood(stops), b = createMood(stops);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) assert.deepEqual(JSON.parse(JSON.stringify(a(t))), JSON.parse(JSON.stringify(b(t))));
});
