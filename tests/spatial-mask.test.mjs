import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRectMask, createPavementHeight } from '../js/world/spatial-mask.js';

const overlaps = (a, b) => a.x1 - a.x0 > 1e-6 && a.z1 - a.z0 > 1e-6 && b.x1 - b.x0 > 1e-6 && b.z1 - b.z0 > 1e-6 && a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

test('matches brute-force strict rectangle overlap across negative, boundary, and large bounds', () => {
  let seed = 94731;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const rectangles = Array.from({ length: 250 }, () => {
    const x0 = random() * 240 - 120, z0 = random() * 240 - 120;
    return { x0, x1: x0 + random() * 34, z0, z1: z0 + random() * 34 };
  });
  rectangles.push({ x0: -1024, x1: 1024, z0: -1024, z1: 1024 }, { x0: -16, x1: 0, z0: -16, z1: 0 }, { x0: 4, x1: 4, z0: 4, z1: 8 }, { x0: 7, x1: 9, z0: -2, z1: -2 });
  const queries = [
    { x0: 0, x1: 0, z0: -2, z1: 2 },
    { x0: 0, x1: 16, z0: 0, z1: 16 },
    { x0: -16, x1: 0, z0: -16, z1: 0 },
    { x0: 1024, x1: 1030, z0: 0, z1: 4 },
    { x0: 3, x1: 5, z0: 5, z1: 7 },
    { x0: 7, x1: 9, z0: -3, z1: -1 },
    ...Array.from({ length: 1000 }, () => {
      const x0 = random() * 240 - 120, z0 = random() * 240 - 120;
      return { x0, x1: x0 + random() * 36, z0, z1: z0 + random() * 36 };
    }),
  ];
  const intersects = createRectMask(rectangles).intersects;
  for (const query of queries) assert.equal(intersects(query), rectangles.some(r => overlaps(query, r)), JSON.stringify(query));
});

test('pedestrians use the highest pavement under their position, including rotated slabs', () => {
  const height = createPavementHeight([
    { x: 0, z: 0, w: 30, d: 30, y: 0, h: .07 },
    { x: 0, z: 0, w: 9, d: 1, y: .07, h: .10, ry: Math.PI / 4 },
    { x: 0, z: 0, w: 1, d: 1, y: 0, h: 3 },
  ]);
  assert.ok(Math.abs(height(2, -2, .02) - .17) < 1e-8);
  assert.equal(height(2, 2, .02), .07);
  assert.equal(height(2, 2, .16), .16);
  assert.equal(height(30, 30, .02), .02);
});
