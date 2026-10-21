import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildBlocks } from '../js/world/blocks.js';
import { routePoints, isWembleyBenchmark, WEMBLEY_BENCHMARK } from '../js/world/layout.js';

test('Wembley benchmark selects only complete existing lots inside its approved envelope', () => {
  assert.deepEqual(WEMBLEY_BENCHMARK, { x0: 660, x1: 880, z0: -113, z1: -25 });
  const pts = routePoints(stops.length);
  const curve = { getPointAt(u) {
    const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
  } };
  const plots = [];
  buildBlocks(() => {}, stops, pts, curve, [], undefined, p => plots.push(p));
  const selected = plots.filter(isWembleyBenchmark);
  assert.ok(selected.length > 20);
  assert.ok(selected.every(p => p.x - p.width / 2 >= 660 && p.x + p.width / 2 <= 880 && p.z - p.depth / 2 >= -113 && p.z + p.depth / 2 <= -25));
  for (const kind of ['terrace', 'midrise', 'office']) assert.ok(selected.some(p => p.kind === kind), `missing ${kind} archetype`);
  assert.ok(plots.some(p => !isWembleyBenchmark(p)), 'control plots remain outside the benchmark');
});
