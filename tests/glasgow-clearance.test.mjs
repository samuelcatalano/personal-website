import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildCity } from '../js/world/city.js';
import { buildBlocks } from '../js/world/blocks.js';
import { routePoints, stopIndex, regions, glasgowSites } from '../js/world/layout.js';
import { PALETTE as P } from '../js/world/palette.js';
import { buildSaoPaulo } from '../js/world/saopaulo.js';

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

test('the three marked gaps beside the starting park have low buildings', () => {
  const boxes = [], start = pts[0].x;
  buildCity((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve);
  const sites = [[start - 52, -14], [start - 52, 0], [start - 52, 14], [start - 52, -34], [start + 1, -36]];
  for (const [x, z] of sites) {
    const body = boxes.find(b => b.x === x && b.z === z && b.y === 0 && b.w >= 8 && b.h >= 6);
    assert.ok(body, `building at ${x},${z}`);
    assert.ok(body.h <= 12, 'new buildings stay below the cathedral facade');
    assert.ok(body.x + body.w / 2 < -293 || body.z + body.d / 2 < -24, 'starting park stays free');
  }
});

test('Wembley front stays open and two towers stand to its west', () => {
  const boxes = [], x = pts.at(-1).x;
  buildCity((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve);
  const front = boxes.filter(b => b.w >= 5 && b.h >= 3 && b.x - b.w / 2 < x + 30 && b.x + b.w / 2 > x - 30 && b.z + b.d / 2 > -49 && b.z - b.d / 2 < -33);
  assert.deepEqual(front, [], 'buildings must not hide the stadium entrance');
  for (const [dx, z] of [[-48, -68], [-34, -64]]) {
    const tower = boxes.find(b => b.x === x + dx && b.z === z && b.y === 0 && b.w >= 8 && b.h >= 20);
    assert.ok(tower, `west tower at ${x + dx},${z}`);
    assert.ok(tower.x + tower.w / 2 < x - 20, 'tower stays beside the stadium and arch');
  }
});

test('Sé forecourt stays clear of city buildings on both sides of the road', () => {
  const boxes = [], x = pts[stopIndex(stops, 'puc')].x;
  buildCity((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve);
  const front = boxes.filter(b => b.w >= 5 && b.h >= 3 && b.x - b.w / 2 < x + 24 && b.x + b.w / 2 > x - 24 && b.z + b.d / 2 > -56 && b.z - b.d / 2 < 40);
  assert.deepEqual(front, []);
});

test('Sé has a broad staircase rising continuously to its central doorway', () => {
  const boxes = [], x = pts[stopIndex(stops, 'puc')].x;
  buildSaoPaulo((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, pts);
  const steps = boxes.filter(b => b.x === x && b.z > -55.6 && b.z < -50 && b.w >= 12 && b.h <= 1.5).sort((a, b) => a.z - b.z);
  assert.equal(steps.length, 6);
  steps.forEach((b, i) => {
    assert.equal(b.y, 0);
    assert.equal(b.h, 1.5 - i * 0.25);
    if (i) assert.ok(Math.abs(steps[i - 1].z + steps[i - 1].d / 2 - (b.z - b.d / 2)) < 1e-8);
  });
  assert.ok(boxes.some(b => b.x === x && b.y === 1.5 && b.color === P.roof && Math.abs(b.z + 55.9) < 0.01), 'door starts at the upper landing');
});

test('Sé has pale verdigris spires and a rounded dome instead of square tiers', () => {
  const boxes = [], x = pts[stopIndex(stops, 'puc')].x;
  buildSaoPaulo((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, pts);
  const green = boxes.filter(b => b.color === P.verdigris);
  for (const side of [-1, 1]) assert.ok(green.some(b => b.x === x + side * 11 && b.y >= 30), 'both tower spires use pale green');
  const dome = green.filter(b => Math.abs(b.x - x) < 8 && b.y < 24);
  assert.ok(dome.length > 20, 'curved dome uses small curved rows');
  assert.ok(dome.some(b => b.w >= 13), 'dome has a broad rounded base');
  assert.ok(dome.some(b => b.y >= 22 && b.w < 7), 'dome narrows toward its crown');
  assert.ok(!dome.some(b => b.x + b.w / 2 >= x + 6 && b.z + b.d / 2 >= -57), 'round footprint leaves square corners empty');
});

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
  const eye = pts[stopIndex(stops, 'olm')].x;
  assert.ok(backdrop.filter((b) => b.z > -112 && b.x <= eye + 40).every((b) => b.y + b.h <= 16.4), 'background roofs behind the landmarks stay below the 18m Eye hub');
  assert.ok(backdrop.every((b) => b.y + b.h <= 29), 'back-lot skyline row stays under 29 m');
  const ben = pts[stopIndex(stops, 'xdesign')].x;
  assert.ok(backdrop.filter((b) => Math.abs(b.x - ben) < 12).every((b) => b.y + b.h <= 24), 'clear sky window around the Big Ben tower top');
  assert.equal(boxes.filter((b) => [out, back].some((rg) => b.x > rg.ctry[0] && b.x < rg.ctry[1])).length, 0, 'no city blocks in the countryside');
  assert.ok(boxes.some((b) => (b.x < west || b.x > east) && b.h > 30), 'other skyline districts retain their towers');
});

test('no generic block overlaps the museum or the university hill', () => {
  const boxes = [], { museum, uni } = glasgowSites(stops, pts);
  buildBlocks((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve, []);
  for (const s of [museum, { ...uni, w: 84, d: 30 }]) assert.equal(boxes.filter((b) => b.x - b.w / 2 < s.x + s.w / 2 && b.x + b.w / 2 > s.x - s.w / 2 && b.z - b.d / 2 < s.z + s.d / 2 && b.z + b.d / 2 > s.z - s.d / 2).length, 0);
});

test('nothing tall sits behind the Riverside Museum (countryside hills and the University plinth excepted)', () => {
  const boxes = [], { museum, uni } = glasgowSites(stops, pts), green = [P.hill, P.field, P.field2];
  buildCity((x, y, z, w, h, d, c) => boxes.push({ x, y, z, w, h, d, c }), stops, pts, curve);
  const behind = boxes.filter((b) => b.h > 1 && !green.includes(b.c) && b.x - b.w / 2 < museum.x + museum.w / 2 && b.x + b.w / 2 > museum.x - museum.w / 2 && b.z < museum.z - 8 && !(Math.abs(b.x - uni.x) < uni.w / 2 + 6 && Math.abs(b.z - uni.z) < 15));
  assert.deepEqual(behind.map(({ x, z, h }) => ({ x: +x.toFixed(1), z: +z.toFixed(1), h })), []);
});
