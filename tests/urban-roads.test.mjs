import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planUrbanRoads } from '../js/world/urban-roads.js';

const area = (r, p) => r.x - r.w / 2 < p.x + p.width / 2 - 1e-6 && r.x + r.w / 2 > p.x - p.width / 2 + 1e-6 && r.z - r.d / 2 < p.z + p.depth / 2 - 1e-6 && r.z + r.d / 2 > p.z - p.depth / 2 + 1e-6;
const contains = (r, x, z) => x >= r.x - r.w / 2 - 1e-6 && x <= r.x + r.w / 2 + 1e-6 && z >= r.z - r.d / 2 - 1e-6 && z <= r.z + r.d / 2 + 1e-6;
const fixture = () => {
  const plots = [];
  for (const z of [-28, -14, 0, 14, 28]) for (const x of [0, 14, 28, 42, 56]) plots.push({ id: `p-${x}-${z}`, x, z, width: 5, depth: 5, region: 'test' });
  return { plots, regions: [{ name: 'test', x0: -10, x1: 70, z0: -40, z1: 40 }], anchors: [{ x: -4, z: -21, region: 'test' }] };
};

test('planner is deterministic and surfaces do not overlap lot footprints', () => {
  const input = fixture(), before = structuredClone(input), a = planUrbanRoads(input), b = planUrbanRoads(input);
  assert.deepEqual(a, b);
  assert.deepEqual(input, before, 'planner leaves caller data unchanged');
  assert.ok(a.rects.some(r => r.kind === 'road'));
  assert.ok(a.rects.some(r => r.kind === 'sidewalk'));
  for (const r of a.rects) for (const p of input.plots) assert.equal(area(r, p), false, `${r.kind} overlaps ${p.id}`);
  for (let i = 0; i < a.rects.length; i++) for (let j = i + 1; j < a.rects.length; j++) assert.equal(area(a.rects[i], { x: a.rects[j].x, z: a.rects[j].z, width: a.rects[j].w, depth: a.rects[j].d }), false, 'output surfaces overlap');
});

test('crossings are welded and every graph node reaches an anchor', () => {
  const out = planUrbanRoads(fixture());
  const adj = new Map(out.nodes.map((_, i) => [i, []]));
  for (const e of out.edges) { adj.get(e.from).push(e.to); adj.get(e.to).push(e.from); }
  const starts = out.nodes.flatMap((n, i) => n.anchor ? [i] : []);
  assert.ok(starts.length > 0, 'at least one street reaches an existing-road anchor');
  const seen = new Set(starts), q = [...starts];
  while (q.length) for (const j of adj.get(q.shift())) if (!seen.has(j)) { seen.add(j); q.push(j); }
  assert.equal(seen.size, out.nodes.length, 'all graph nodes are in the anchored component');
  assert.ok([...adj.values()].some(next => next.length >= 3), 'a junction has at least three connected edges');
  for (const e of out.edges.filter(e => e.kind === 'road')) {
    const a = out.nodes[e.from], b = out.nodes[e.to], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 4);
    for (let i = 0; i <= steps; i++) assert.ok(out.rects.some(r => r.kind === 'road' && contains(r, a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps)), 'graph edge follows asphalt');
  }
});

test('moving an obstructing lot changes the planned corridor', () => {
  const a = fixture(), before = planUrbanRoads(a).rects;
  a.plots.push({ id: 'moved', x: 28, z: 0, width: 6, depth: 6, region: 'test' });
  const after = planUrbanRoads(a).rects;
  assert.notDeepEqual(after, before);
  for (const r of after) for (const p of a.plots) assert.equal(area(r, p), false);
});

test('protected area and tree trunk remain clear of surfaces', () => {
  const input = fixture(); input.protectedRects = [{ x0: 20, x1: 35, z0: -2, z1: 2 }]; input.trees = [{ x: 14, z: -21, crown: 10 }];
  const out = planUrbanRoads(input);
  assert.ok(out.stats.disconnectedSegments >= 0);
  for (const r of out.rects) assert.ok(!(r.x - r.w / 2 < 35 && r.x + r.w / 2 > 20 && r.z - r.d / 2 < 2 && r.z + r.d / 2 > -2));
  for (const r of out.rects) assert.ok(!(r.x - r.w / 2 < 14.6 && r.x + r.w / 2 > 13.4 && r.z - r.d / 2 < -20.4 && r.z + r.d / 2 > -21.6));
});

test('uses the exact midpoint of a six metre Glasgow style row gap', () => {
  const plots = [];
  for (const z of [87, 102]) for (const x of [390, 403, 416, 429, 442, 455, 468, 481, 494, 507]) plots.push({ id: `row-${x}-${z}`, x, z, width: 9, depth: 9, region: 'glasgow' });
  const out = planUrbanRoads({
    plots,
    regions: [{ name: 'glasgow', x0: 300, x1: 570, z0: 70, z1: 120 }],
    anchors: [{ x: 400, z: 94.5, region: 'glasgow' }],
  });
  assert.ok(out.rects.some(r => r.kind === 'road' && r.region === 'glasgow' && r.z - r.d / 2 <= 94.5 && r.z + r.d / 2 >= 94.5));
  assert.ok(out.edges.length > 0);
});

test('uses a five metre flank gap to connect a row street without moving lots', () => {
  const plots = [];
  for (const z of [87, 102]) for (const x of [390, 403, 416, 429, 442, 455, 468, 481, 494, 507]) plots.push({ id: `grid-${x}-${z}`, x, z, width: 9, depth: 9, region: 'glasgow' });
  plots.push({ id: 'east-flank', x: 521, z: 101, width: 9, depth: 9, region: 'glasgow' });
  const out = planUrbanRoads({ plots, regions: [{ name: 'glasgow', x0: 300, x1: 570 }], anchors: [{ x: 514, z: 94.5, region: 'glasgow' }] });
  assert.ok(out.rects.some(r => r.kind === 'road' && r.region === 'glasgow' && r.z - r.d / 2 <= 94.5 && r.z + r.d / 2 >= 94.5));
  assert.ok(out.rects.some(r => r.kind === 'road' && r.region === 'glasgow' && r.x - r.w / 2 <= 514 && r.x + r.w / 2 >= 514));
  assert.ok(out.rects.some(r => r.kind === 'sidewalk' && r.region === 'glasgow' && r.x + r.w / 2 >= 514 && r.x - r.w / 2 <= 522 && r.z + r.d / 2 >= 91 && r.z - r.d / 2 <= 96), 'tight flank retains at least one continuous sidewalk strip');
  for (const r of out.rects) for (const p of plots) assert.equal(area(r, p), false);
});

test('limits fallback routing and keeps blocked corridors collision free', () => {
  const input = fixture();
  input.anchors = [{ x: -4, z: -21, region: 'test' }];
  input.obstacles = [
    { x0: 27, x1: 29, z0: -40, z1: 40 },
  ];
  const out = planUrbanRoads(input);
  assert.ok(out.stats.routeAttempts > 0);
  assert.ok(out.stats.routeAttempts <= out.stats.candidateSegments * 3, 'A* tries at most three pairs per disconnected candidate component');
  assert.ok(out.edges.length > 0);
  for (const r of out.rects) for (const o of input.obstacles) assert.ok(!(r.x - r.w / 2 < o.x1 && r.x + r.w / 2 > o.x0 && r.z - r.d / 2 < o.z1 && r.z + r.d / 2 > o.z0));
});

test('continuous asphalt footprint closes the gaps between sparse road anchors', () => {
  const input = fixture();
  input.anchors = Array.from({ length: 17 }, (_, i) => ({ x: -8 + i * 5, z: -21, width: 13.1 }));
  input.existingAsphaltRects = [{ x0: -10, x1: 70, z0: -27.55, z1: -14.45 }];
  const out = planUrbanRoads(input);
  assert.ok(out.rects.some(r => r.kind === 'road'));
  assert.ok(out.accesses.length > 0);
  for (const r of out.rects.filter(r => r.kind !== 'road')) {
    assert.equal(area(r, { x: 30, z: -21, width: 80, depth: 13.1 }), false, `${r.kind} crosses continuous asphalt between sparse anchors`);
  }
});
