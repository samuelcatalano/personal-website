import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBuildingAccess } from '../js/world/building-access.js';

const fixture = () => ({
  plots: [{ id: 'home', x: 0, z: 0, width: 8, depth: 8, region: 'r' }],
  segments: [{ axis: 'x', a: -20, b: 20, c: 12, region: 'street' }],
});
const overlaps = (r, b) => r.x - r.w / 2 < b.x1 && r.x + r.w / 2 > b.x0 && r.z - r.d / 2 < b.z1 && r.z + r.d / 2 > b.z0;

test('creates walkable access from inferred frontage to street edge', () => {
  const input = fixture(), out = resolveBuildingAccess(input), a = out.accesses[0];
  assert.equal(out.unresolved.length, 0);
  assert.equal(a.lotId, 'home'); assert.equal(a.existing, false);
  assert.deepEqual(a.points[0], { x: 0, z: 4 });
  assert.ok(a.points.at(-1).z >= 9.75 && a.points.at(-1).z <= 14.25);
  assert.ok(out.rects.length > 0 && out.rects.every(r => r.kind === 'access'));
  assert.ok(out.rects.every(r => !overlaps(r, { x0: -4, x1: 4, z0: -4, z1: 4 })));
  for (const r of out.rects.filter(r => r.region === 'r' && r.x < 10)) assert.equal(overlaps(r, { x0: -4, x1: 4, z0: -4, z1: 4 }), false);
});

test('rejects paths blocked by neighboring lots, trees, and protected objects', () => {
  const input = fixture(); input.plots.push({ id: 'neighbor', x: 0, z: 9, width: 8, depth: 2, region: 'r' });
  input.trees = [{ x: 0, z: 7, crown: 4 }];
  input.protectedRects = [{ x0: -10, x1: 10, z0: 4.8, z1: 8 }];
  const out = resolveBuildingAccess(input);
  assert.ok(out.unresolved.includes('home')); assert.equal(out.accesses.find(a => a.lotId === 'home')?.existing, undefined);
});

test('moving a lot moves its door and generated path', () => {
  const a = fixture(), before = resolveBuildingAccess(a);
  a.plots[0] = { ...a.plots[0], x: 5 };
  const after = resolveBuildingAccess(a);
  assert.notDeepEqual(after.accesses[0].points, before.accesses[0].points);
});

test('records frontage already served by a nearby road anchor', () => {
  const input = fixture(); input.anchors = [{ x: 0, z: 4.5, width: 4.5, region: 'r' }];
  const out = resolveBuildingAccess(input);
  assert.equal(out.accesses[0].existing, true); assert.equal(out.rects.filter(r => r.x < 10).length, 0);
});


test('uses the edge of a wide existing arterial', () => {
  const input = fixture(); input.segments = [];
  input.anchors = [{ x: 0, z: 7, width: 6, region: 'r' }];
  const out = resolveBuildingAccess(input);
  assert.equal(out.accesses[0].existing, true);
  assert.deepEqual(out.accesses[0].points.at(-1), { x: 0, z: 4 });
});

test('routes around a house to a street behind it', () => {
  const input = fixture(); input.segments = [{ axis: 'x', a: -20, b: 20, c: -12, region: 'r' }];
  const out = resolveBuildingAccess(input), access = out.accesses[0];
  assert.equal(access.existing, false); assert.equal(out.unresolved.length, 0);
  assert.ok(access.points.some(p => Math.abs(p.x) > 4.5));
  assert.ok(out.rects.every(r => !overlaps(r, { x0: -4, x1: 4, z0: -4, z1: 4 })));
});

test('obstruction at the frontage prevents claiming existing access', () => {
  const input = fixture(); input.plots[0].front = { x: 0, z: 4 }; input.anchors = [{ x: 0, z: 4.5, width: 4.5, region: 'r' }];
  input.protectedRects = [{ x0: -.6, x1: .6, z0: 4, z1: 5.2 }];
  const out = resolveBuildingAccess(input);
  assert.notEqual(out.accesses[0]?.existing, true);
  assert.ok(out.unresolved.includes('home'));
});

test('connects an unreachable inner lot to a street-rooted neighbor path', () => {
  const input = {
    plots: [
      { id: 'root', x: -8.5, z: 0, width: 2, depth: 2, region: 'r' },
      { id: 'inner', x: 0, z: 0, width: 2, depth: 2, region: 'district' },
    ],
    segments: [{ axis: 'x', a: -20, b: 20, c: 12, region: 'r' }],
    protectedRects: [{ x0: -2, x1: 2, z0: 4.8, z1: 15 }, { x0: -7, x1: -1, z0: 1.8, z1: 10 }],
  };
  const out = resolveBuildingAccess(input), root = out.accesses.find(a => a.lotId === 'root'), inner = out.accesses.find(a => a.lotId === 'inner');
  assert.ok(root && inner); assert.equal(root.existing, false); assert.equal(root.viaLotId, undefined);
  assert.equal(root.region, 'r'); assert.equal(inner.region, 'district');
  assert.equal(inner.viaLotId, 'root'); assert.ok(out.unresolved.length === 0);
  assert.ok(inner.points.at(-1).x < -8);
  const dirs = inner.points.slice(1).map((p, i) => p.x === inner.points[i].x ? 'z' : 'x');
  const turns = dirs.slice(1).filter((d, i) => d !== dirs[i]).length;
  assert.ok(turns >= 3, 'maze path needs at least three turns');
  const length = inner.points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - inner.points[i].x) + Math.abs(p.z - inner.points[i].z), 0);
  assert.ok(length <= 30);
  assert.ok(out.rects.some(r => r.kind === 'access'));
});


test('allows a bounded BFS branch longer than thirty metres', () => {
  const input = {
    plots: [
      { id: 'root', x: -33, z: -1, width: 2, depth: 2, region: 'r' },
      { id: 'inner', x: 15.5, z: 0, width: 2, depth: 2, region: 'r' },
    ],
    segments: [{ axis: 'x', a: -20, b: 20, c: 12, region: 'street' }],
    protectedRects: [{ x0: 13, x1: 18, z0: 4.8, z1: 15 }],
  };
  const out = resolveBuildingAccess(input), access = out.accesses.find(a => a.lotId === 'inner');
  assert.equal(access?.viaLotId, 'root');
  const length = access.points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - access.points[i].x) + Math.abs(p.z - access.points[i].z), 0);
  assert.ok(length > 35 && length <= 45);
});
test('obstructions still block a shared-path branch at the door', () => {
  const input = {
    plots: [
      { id: 'root', x: -16, z: 0, width: 4, depth: 4, region: 'r' },
      { id: 'inner', x: 0, z: 0, width: 4, depth: 4, region: 'r', front: { x: 0, z: 2 } },
    ],
    segments: [{ axis: 'x', a: -20, b: 20, c: 12, region: 'r' }],
    protectedRects: [{ x0: -4, x1: 4, z0: 4.8, z1: 15 }, { x0: -14, x1: -1, z0: 2, z1: 10 }],
    obstacles: [{ x0: -.6, x1: .6, z0: 2, z1: 2.6 }],
  };
  const out = resolveBuildingAccess(input);
  assert.ok(out.accesses.some(a => a.lotId === 'root'));
  assert.ok(out.unresolved.includes('inner'));
});


test('uses a clear side frontage when the inferred center is obstructed', () => {
  const input = fixture(); input.protectedRects = [{ x0: -.6, x1: .6, z0: 4, z1: 5.2 }];
  const out = resolveBuildingAccess(input), access = out.accesses[0];
  assert.equal(out.unresolved.length, 0);
  assert.notEqual(access.points[0].x, 0);
  assert.ok(Math.abs(access.points[0].x) <= input.plots[0].width * .24);
});

test('does not move an explicitly specified frontage around an obstruction', () => {
  const input = fixture(); input.plots[0].front = { x: 0, z: 4 };
  input.protectedRects = [{ x0: -.6, x1: .6, z0: 4, z1: 5.2 }];
  const out = resolveBuildingAccess(input);
  assert.deepEqual(out.unresolved, ['home']);
});

test('does not treat a neighboring building footprint as an existing frontage', () => {
  const input = fixture(); input.plots[0].front = { x: 0, z: 4 };
  input.plots.push({ id: 'neighbor', x: 0, z: 4.2, width: 2, depth: 1, region: 'r' });
  input.segments = []; input.anchors = [{ x: 0, z: 4, width: 4.5, region: 'r' }];
  const out = resolveBuildingAccess(input);
  assert.ok(out.unresolved.includes('home'));
  assert.notEqual(out.accesses.find(a => a.lotId === 'home')?.existing, true);
});

test('routes diagonally to an anchor corner with axis-aligned clear rectangles', () => {
  const input = fixture(); input.segments = []; input.anchors = [{ x: 1.6, z: 5.6, width: 2, region: 'r' }];
  const out = resolveBuildingAccess(input), access = out.accesses[0];
  assert.equal(access.existing, true); assert.ok(out.rects.length > 0);
  for (let i = 1; i < access.points.length; i++) assert.ok(access.points[i].x === access.points[i - 1].x || access.points[i].z === access.points[i - 1].z);
  for (const rect of out.rects) assert.equal(overlaps(rect, { x0: -4, x1: 4, z0: -4, z1: 4 }), false);
  assert.ok(access.points.at(-1).x > 0 && access.points.at(-1).z > 4);
});


test('tries wider inferred frontage points only after center and quarter-width fail', () => {
  const input = fixture(); input.protectedRects = [{ x0: -2.4, x1: 2.4, z0: 4, z1: 5.2 }];
  const out = resolveBuildingAccess(input), point = out.accesses[0].points[0];
  assert.equal(Math.abs(point.x), input.plots[0].width * .36);
});

test('rebuilds rooted targets between fallback passes', () => {
  const input = {
    plots: [
      { id: 'z-root', x: 0, z: 0, width: 2, depth: 2, region: 'a' },
      { id: 'a-bridge', x: 30, z: 0, width: 2, depth: 2, region: 'b', front: { x: 30, z: 1 } },
      { id: 'b-end', x: 60, z: 0, width: 2, depth: 2, region: 'c', front: { x: 60, z: 1 } },
    ],
    segments: [{ axis: 'x', a: -10, b: 80, c: 12, region: 'street' }],
    protectedRects: [
      { x0: 29, x1: 31, z0: 4.8, z1: 15 },
      { x0: 59, x1: 61, z0: 4.8, z1: 15 },
    ],
  };
  const out = resolveBuildingAccess(input), bridge = out.accesses.find(a => a.lotId === 'a-bridge'), end = out.accesses.find(a => a.lotId === 'b-end');
  assert.ok(bridge && end); assert.equal(bridge.viaLotId, 'z-root'); assert.equal(end.viaLotId, 'a-bridge');
  assert.deepEqual(out.unresolved, []);
});
