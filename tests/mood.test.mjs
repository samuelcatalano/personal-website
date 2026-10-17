import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { swapAt, scotRange } from '../js/world/layout.js';
import { createMood } from '../js/world/mood.js';

const n = stops.length, moodAt = createMood(stops), sw = swapAt(stops), [g0, g1] = scotRange(stops), u = 1 / (n - 1);
const snap = (t) => JSON.parse(JSON.stringify(moodAt(t)));
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], sat = (c) => Math.max(...c) - Math.min(...c);

test('São Paulo is warm, London neutral, Glasgow overcast with rain', () => {
  const sp = snap(sw - 3 * u), lon = snap((sw + g0) / 2 - 0.0001), gla = snap((g0 + g1) / 2);
  assert.deepEqual([sp.rain, lon.rain, gla.rain], [0, 0, 1]);
  assert.ok(sp.light[2] < lon.light[2] && sp.sun > lon.sun, 'SP light is warmer and stronger');
  assert.ok(sat(gla.hor) < sat(lon.hor) && sat(gla.zen) < sat(lon.zen), 'Glasgow sky is greyer');
  assert.ok(gla.sun < lon.sun && gla.hemi > lon.hemi && gla.fogK < lon.fogK, 'dimmer sun, flatter light, denser fog');
  assert.ok(lum(gla.zen) < lum(lon.zen) + 0.2 && gla.cloudOp > 0);
});

test('mood is continuous across every boundary', () => {
  for (const b of [sw, g0, g1]) for (let d = -1; d <= 1; d += 0.01) {
    const a = snap(b + d * u), c = snap(b + d * u + 1e-4);
    for (const k of Object.keys(a)) [].concat(a[k]).forEach((v, i) => assert.ok(Math.abs(v - [].concat(c[k])[i]) < 0.01, `${k} jumps near ${b}`));
  }
});

test('output object is reused', () => assert.equal(moodAt(0), moodAt(0.5)));
