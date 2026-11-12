import test from 'node:test';
import assert from 'node:assert/strict';
import { moonIllumination, celestialFrame, celestialVisibility, shelterField } from '../js/world/weather-math.js';

test('fixed gibbous moon has a dim dark limb, readable centre and no light outside its disc', () => {
  assert.equal(moonIllumination(1.1, 0), 0);
  assert.ok(moonIllumination(.8, 0) > moonIllumination(-.8, 0) * 3);
  assert.ok(moonIllumination(0, 0) > .5);
  for (let x = -1; x <= 1; x += .05) assert.ok(Number.isFinite(moonIllumination(x, .2)));
});

test('astros clear the header on desktop/mobile and dense overcast hides them', () => {
  for (const [w, h, bar] of [[1280, 800, 68], [375, 812, 174], [800, 500, 80]]) {
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
