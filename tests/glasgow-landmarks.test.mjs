import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRiverside } from '../js/world/riverside.js';
import { buildUniversity } from '../js/world/university.js';

const build = (fn, x = 100, z = 20) => {
  const boxes = [];
  fn((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), { x, z });
  return boxes;
};
const ext = (boxes, lo, hi) => [Math.min(...boxes.map(lo)), Math.max(...boxes.map(hi))];

test('Riverside Museum fits its footprint, has a zigzag with a spike peak', () => {
  const b = build(buildRiverside);
  assert.ok(b.length >= 60 && b.length <= 160, `box count ${b.length}`);
  const [x0, x1] = ext(b, (q) => q.x - q.w / 2, (q) => q.x + q.w / 2), [z0, z1] = ext(b, (q) => q.z - q.d / 2, (q) => q.z + q.d / 2);
  assert.ok(x1 - x0 <= 32.01 && z1 - z0 <= 16.01, 'footprint <= 32x16');
  assert.ok(b.every((q) => q.y >= 0) && Math.max(...b.map((q) => q.y + q.h)) <= 18, 'on ground, <= 18 high');
  // roof height per x column from the front silver band
  const band = b.filter((q) => q.color === '#c9ccd0' && Math.abs(q.z - 27.5) < 0.01).sort((a, c) => a.x - c.x);
  const tops = band.map((q) => q.y + q.h);
  let peaks = 0;
  for (let i = 1; i < tops.length - 1; i++) if (tops[i] > tops[i - 1] && tops[i] >= tops[i + 1]) peaks++;
  assert.ok(peaks >= 4, `zigzag peaks ${peaks}`);
  assert.ok(Math.max(...tops) >= 15 && tops.filter((t) => t >= 15).length <= 6, 'one spiky tall peak');
});

test('University main building: tower is tallest, centred, within footprint', () => {
  const b = build(buildUniversity);
  assert.ok(b.length >= 60 && b.length <= 150, `box count ${b.length}`);
  const [x0, x1] = ext(b, (q) => q.x - q.w / 2, (q) => q.x + q.w / 2), [z0, z1] = ext(b, (q) => q.z - q.d / 2, (q) => q.z + q.d / 2);
  assert.ok(x1 - x0 <= 44.01 && z1 - z0 <= 18.01, 'footprint <= 44x18');
  assert.ok(b.every((q) => q.y >= 0));
  const top = b.reduce((m, q) => (q.y + q.h > m.y + m.h ? q : m));
  assert.ok(top.y + top.h >= 30 && top.y + top.h <= 36, 'tower + spire 30-36 m');
  assert.ok(Math.abs(top.x - 100) <= 6, 'tallest element centred');
  const rest = b.filter((q) => Math.abs(q.x - 100) > 6);
  assert.ok(Math.max(...rest.map((q) => q.y + q.h)) < 20, 'range stays well below the tower');
});
