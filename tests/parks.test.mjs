import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARKS } from '../js/world/parks.js';
import { walkPaths } from '../js/world/crowd.js';
import { routePoints } from '../js/world/layout.js';
import { PALETTE } from '../js/world/palette.js';
import { stops } from '../js/content.js';

const pts = routePoints(stops.length), loops = walkPaths(stops, pts).filter((p) => p.type === 'loop');
const hit = (a, b, e = 0) => a.x0 < b.x1 + e && b.x0 - e < a.x1 && a.z0 < b.z1 + e && b.z0 - e < a.z1;

test('park rects keep clear of the pedestrian plaza loops (3 m incl. railings)', () => {
  for (const p of PARKS) for (const l of loops) assert.ok(!hit(p, l.rect, 3), `${l.name} vs park ${p.x0},${p.z0}`);
});
test('park rects are big enough, do not overlap each other and stay off the road band', () => {
  PARKS.forEach((p, i) => {
    assert.ok(p.x1 - p.x0 >= 6 && p.z1 - p.z0 >= 6);
    PARKS.slice(i + 1).forEach((q) => assert.ok(!hit(p, q, 2), 'parks overlap'));
    assert.ok(p.z0 > 12 || p.z1 < -12 || p.x1 < -245 || p.x0 > 305, 'inside the road band');
  });
});
test('park colours exist in the palette', () => {
  for (const k of ['hedge', 'gravel', 'iron', 'tulip', 'violet']) assert.match(PALETTE[k], /^#[0-9a-f]{6}$/);
});
