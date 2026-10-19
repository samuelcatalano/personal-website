import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildBlocks } from '../js/world/blocks.js';
import { routePoints, glasgowSites, regions } from '../js/world/layout.js';

const pts = routePoints(stops.length);
const curve = { getPointAt(u) {
  const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
  return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
} };
test('rear infill adds varied low buildings behind every landmark and clears the museum', () => {
  const boxes = [];
  buildBlocks((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve, []);
  const houses = boxes.filter(b => b.y === 0 && b.z === -108);
  assert.ok(houses.length >= 30, 'rear streets fill urban gaps');
  assert.ok(new Set(houses.map(b => b.h)).size > 1, 'varied roof line');
  const { museum, uni } = glasgowSites(stops, pts);
  for (const b of houses) {
    assert.ok(b.h <= 9 && b.z + b.d / 2 <= -100, 'all new bodies remain behind the landmarks');
    assert.ok(b.x + b.w / 2 < museum.x - museum.w / 2 - 12 || b.x - b.w / 2 > museum.x + museum.w / 2 + 12, 'museum backdrop clear');
    assert.ok(b.x + b.w / 2 < uni.x - 46 || b.x - b.w / 2 > uni.x + 46, 'university base clear');
    for (const { ctry: [a, z] } of regions(stops, pts)) assert.ok(b.x + b.w / 2 <= a - 30 || b.x - b.w / 2 >= z + 30, 'country hills keep their full footprint');
  }
});

test('start-side neighborhood and corner shop fill marked gaps away from landmark views', () => {
  const boxes = [];
  buildBlocks((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve, []);
  const side = boxes.filter(b => b.y === 0 && b.w >= 5 && b.h >= 3 && b.x <= pts[0].x - 90 && b.z >= -99);
  assert.ok(side.length >= 12, 'lateral neighborhood fills the green gap');
  const corner = boxes.find(b => b.x === pts[0].x - 13 && b.z === -3 && b.y === 0 && b.h >= 3);
  assert.ok(corner, 'corner shop beside the starting park');
  assert.ok(corner.w <= 6 && corner.d <= 6 && corner.h <= 6, 'shop fits the small paved gap');
  for (const b of [...side, corner]) assert.ok(b.x + b.w / 2 < pts[1].x - 30, 'entire footprint stays west of every landmark view');
  const bodies = boxes.filter(b => b.y === 0 && b.w >= 5 && b.h >= 3);
  for (const b of [...side, corner]) assert.ok(bodies.every(o => o === b || Math.abs(o.x-b.x) >= (o.w+b.w)/2 || Math.abs(o.z-b.z) >= (o.d+b.d)/2), 'new footprint does not overlap another building');
});
