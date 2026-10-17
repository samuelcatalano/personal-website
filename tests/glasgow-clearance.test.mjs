import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildCity } from '../js/world/city.js';
import { routePoints, stopIndex } from '../js/world/layout.js';

const pts = routePoints(stops.length);
const curve = {
  getPointAt(u) {
    const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
  },
  getTangentAt(u) {
    const i = Math.min(Math.floor(u * (pts.length - 1)), pts.length - 2), x = pts[i + 1].x - pts[i].x, z = pts[i + 1].z - pts[i].z, l = Math.hypot(x, z);
    return { x: x / l, z: z / l };
  },
};

test('generated city buildings stay out of the Glasgow landmark footprint', () => {
  const boxes = [], p = pts[stopIndex(stops, 'glasgow')];
  buildCity((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve);
  const overlap = (b) => b.x - b.w / 2 < p.x + 20 && b.x + b.w / 2 > p.x - 20 && b.z - b.d / 2 < p.z - 17 && b.z + b.d / 2 > p.z - 43;
  assert.equal(boxes.filter((b) => b.w >= 5 && b.h >= 3 && overlap(b)).length, 0);
});
