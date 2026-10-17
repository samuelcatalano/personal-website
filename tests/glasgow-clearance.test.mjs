import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildCity } from '../js/world/city.js';
import { buildBlocks } from '../js/world/blocks.js';
import { routePoints, stopIndex, regions, glasgowSites } from '../js/world/layout.js';

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

test('the civic skyline stays below landmark silhouettes on the London stretch and around Glasgow, and the countryside is empty of blocks', () => {
  const boxes = [], west = pts[stopIndex(stops, 'xdesign')].x - 20, [out, back] = regions(stops, pts), east = back.scot[1];
  buildBlocks((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve, []);
  const backdrop = boxes.filter((b) => (b.x >= west && b.x <= out.sub[1] || b.x >= out.scot[0] && b.x <= east) && b.z <= -65);
  assert.ok(backdrop.length > 0, 'retains a city backdrop');
  assert.ok(backdrop.every((b) => b.y + b.h <= 16.4), 'background roofs stay below the 18m Eye hub');
  assert.equal(boxes.filter((b) => [out, back].some((rg) => b.x > rg.ctry[0] && b.x < rg.ctry[1])).length, 0, 'no city blocks in the countryside');
  assert.ok(boxes.some((b) => (b.x < west || b.x > east) && b.h > 30), 'other skyline districts retain their towers');
});

test('no generic block overlaps the museum or the university hill', () => {
  const boxes = [], { museum, uni } = glasgowSites(stops, pts);
  buildBlocks((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve, []);
  for (const s of [museum, { ...uni, w: 56, d: 30 }]) assert.equal(boxes.filter((b) => b.x - b.w / 2 < s.x + s.w / 2 && b.x + b.w / 2 > s.x - s.w / 2 && b.z - b.d / 2 < s.z + s.d / 2 && b.z + b.d / 2 > s.z - s.d / 2).length, 0);
});
