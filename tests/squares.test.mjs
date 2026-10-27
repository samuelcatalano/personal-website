import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQUARES, PARKS } from '../js/world/parks.js';
import { buildCity } from '../js/world/city.js';
import { walkPaths } from '../js/world/crowd.js';
import { routePoints } from '../js/world/layout.js';
import { stops } from '../js/content.js';

const pts = routePoints(stops.length);
const at = (u) => { const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2); return [f - i, i]; };
const curve = {
  getPointAt: (u) => { const [t, i] = at(u); return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t }; },
  getTangentAt: (u) => { const [, i] = at(u), dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; },
};
const hit = (a, b, e = 0) => a.x0 < b.x1 + e && b.x0 - e < a.x1 && a.z0 < b.z1 + e && b.z0 - e < a.z1;

test('squares stay off parks, pedestrian loops and buildings', () => {
  const tall = [];
  buildCity((x, y, z, w, h, d) => { if (h >= 4 && w < 60 && d < 60) tall.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); }, stops, pts, curve);
  const rects = walkPaths(stops, pts).filter((p) => p.rect).map((p) => p.rect);
  for (const q of SQUARES) {
    assert.ok(q.x1 - q.x0 >= 20 && q.z1 - q.z0 >= 4 && /^[BTUSPF]+$/.test(q.mix));
    for (const p of [...PARKS, ...rects]) assert.ok(!hit(q, p, 1), `square ${q.x0},${q.z0} vs park/walk`);
    for (const b of tall) assert.ok(!hit(q, b, 0), `square ${q.x0},${q.z0} inside a building`);
  }
});
