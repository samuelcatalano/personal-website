import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARKS, PLAZAS, RING, KEEP, WALK_INSET, buildParks } from '../js/world/parks.js';
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

test('plaza ring covers the walking inset; obstacles stay >= 2.4 m inside the loop rects', () => {
  assert.ok(RING[0] < WALK_INSET[0] && RING[1] > WALK_INSET[1] && KEEP > RING[1]);
  assert.deepEqual(PLAZAS.map((q) => q.name).sort(), loops.map((l) => l.name).sort());
  const curve = { getPointAt: (u) => { const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t }; }, getTangentAt: () => ({ x: 1, z: 0 }) };
  const boxes = [];
  buildParks((x, y, z, w, h, d, c) => boxes.push({ x, y, z, w, h, d, c }), stops, pts, curve, []);
  for (const { rect: r, name } of loops) for (const b of boxes) {
    if (b.x - b.w / 2 >= r.x1 || b.x + b.w / 2 <= r.x0 || b.z - b.d / 2 >= r.z1 || b.z + b.d / 2 <= r.z0 || b.y + b.h <= 0.12 || b.c === PALETTE.gravel) continue; // flat gravel/lawn may cover the ring
    const d = Math.min(b.x - b.w / 2 - r.x0, r.x1 - b.x - b.w / 2, b.z - b.d / 2 - r.z0, r.z1 - b.z - b.d / 2);
    assert.ok(d >= KEEP - 1e-6, `${name}: obstacle at inset ${d.toFixed(2)}`);
  }
});
