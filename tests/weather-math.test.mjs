import test from 'node:test';
import assert from 'node:assert/strict';
import { moonIllumination, celestialFrame, celestialVisibility, shelterField, cloudNoise } from '../js/world/weather-math.js';

test('moon is always full with symmetric limb shading and no light outside its disc', () => {
  assert.equal(moonIllumination(1.1, 0), 0);
  assert.equal(moonIllumination(0, 0), 1);
  for (const radius of [.3, .8, .99]) {
    const value = moonIllumination(radius, 0);
    assert.ok(value >= .75 && value < 1);
    assert.equal(value, moonIllumination(-radius, 0));
    assert.equal(value, moonIllumination(0, radius));
    assert.equal(value, moonIllumination(0, -radius));
  }
});

test('astros clear the header on desktop and dense overcast hides them', () => {
  for (const [w, h, bar] of [[1280, 800, 68], [800, 500, 80]]) {
    const [x, y] = celestialFrame(w, h, bar);
    assert.ok(Math.abs(x) < 1 && Math.abs(y) < 1);
    assert.ok((1 - y) * h / 2 > bar + 16);
  }
  assert.equal(celestialVisibility(1, 1), 0);
  assert.ok(celestialVisibility(.75, .25) > 0);
  assert.ok(celestialVisibility(.3, 0) > celestialVisibility(.85, .3));
});

test('one shelter field preserves overlapping maximum roofs, oriented decks and open ground', () => {
  const field = shelterField([{ x: 0, z: 0, hx: 8, hz: 8, height: 12 }, { x: 0, z: 0, hx: 2, hz: 2, height: 20 }, { x: 25, z: 0, hx: 8, hz: 2, height: 6, tx: 0, tz: 1 }]);
  const at = (x, z) => {
    const [x0, z0, w, d] = field.bounds, col = Math.floor((x - x0) / w * field.width), row = Math.floor((z - z0) / d * field.height);
    return field.data[row * field.width + col] / 2;
  };
  assert.equal(at(0, 0), 20);
  assert.equal(at(6, 0), 12);
  assert.equal(at(25, 6), 6);
  assert.equal(at(31, 0), 0);
  assert.equal(at(15, 0), 0);
});

test('cloud noise volume is normalised and tiles without a seam', () => {
  const n = 32, d = cloudNoise(n), at = (x, y, z, c) => d[((z * n + y) * n + x) * 2 + c];
  assert.equal(d.length, n * n * n * 2);
  for (const c of [0, 1]) {
    let lo = 255, hi = 0, seam = 0, inner = 0;
    for (let i = c; i < d.length; i += 2) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); }
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) { seam += Math.abs(at(0, y, z, c) - at(n - 1, y, z, c)); inner += Math.abs(at(15, y, z, c) - at(16, y, z, c)); }
    assert.ok(lo === 0 && hi === 255);
    assert.ok(seam < inner * 1.5, `channel ${c} wraps like any interior neighbour`);
  }
});
