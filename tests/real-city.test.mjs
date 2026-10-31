import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildBlocks } from '../js/world/blocks.js';
import { routePoints, stopIndex, glasgowSites, copan, regions } from '../js/world/layout.js';

const pts = routePoints(stops.length);
const curve = { getPointAt(u) { const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t }; } };
const plotsFor = () => { const plots = []; buildBlocks(() => {}, stops, pts, curve, [], (p) => plots.push(p)); return plots; };
const overlaps = (p, b, e = 0) => p.x - p.width / 2 < b[1] + e && b[0] - e < p.x + p.width / 2 && p.z - p.depth / 2 < b[3] + e && b[2] - e < p.z + p.depth / 2;

test('pilot plots replace three procedural buildings', () => {
  const plots = plotsFor();
  assert.ok(plots.length <= 3);
  assert.deepEqual(new Set(plots.map(p => p.kind)), new Set(['terrace', 'midrise', 'office']));
  assert.deepEqual(plots, plotsFor());
  for (const p of plots) for (const v of [p.x, p.z, p.width, p.depth, p.height]) assert.ok(Number.isFinite(v));
  assert.ok(Math.max(...plots.map(p => p.x)) - Math.min(...plots.map(p => p.x)) <= 70, 'pilot plots stay within the selected block width');
  assert.ok(Math.max(...plots.map(p => p.z)) - Math.min(...plots.map(p => p.z)) <= 165, 'pilot plots stay within the selected block depth');
});

test('pilot descriptor kinds match their source building forms', () => {
  const plots = Object.fromEntries(plotsFor().map(p => [p.kind, [p.width, p.depth, p.height]]));
  assert.deepEqual(plots, {
    terrace: [24, 9, 6],
    midrise: [16, 11, 16],
    office: [12, 12, 14.4],
  });
});

test('pilot plots clear protected landmark and route regions', () => {
  const plots = plotsFor(), xs = (id) => pts[stopIndex(stops, id)].x, { museum, uni } = glasgowSites(stops, pts), cp = copan(stops, pts), [out] = regions(stops, pts);
  const protectedRects = [
    [cp.x - cp.len / 2 - 3, cp.x + cp.len / 2 + 3, cp.z - cp.amp - cp.depth / 2 - 1.5, cp.z + cp.amp + cp.depth / 2 + 1.5],
    [xs('taqtile') - 25, xs('taqtile') + 25, -50, 12], [xs('puc') - 24, xs('puc') + 24, -56, 40],
    [xs('contact') - 30, xs('contact') + 30, -49, -33],
    [museum.x - museum.w / 2 - 5, museum.x + museum.w / 2 + 5, museum.z - 100, museum.z - 8],
    [uni.x - uni.w / 2 - 16, uni.x + uni.w / 2 + 16, uni.z - 19, uni.z + 19],
    [xs('xdesign') - 10, xs('xdesign') + 43, -76, -48],
  ];
  for (const p of plots) {
    assert.ok(plots.every(q => q === p || !overlaps(p, [q.x - q.width / 2, q.x + q.width / 2, q.z - q.depth / 2, q.z + q.depth / 2])));
    assert.ok(protectedRects.every(r => !overlaps(p, r)), `plot ${p.id} intersects protected region`);
    for (let i = 0; i <= 240; i++) { const q = curve.getPointAt(i / 240); assert.ok(Math.hypot(Math.max(Math.abs(q.x - p.x) - p.width / 2, 0), Math.max(Math.abs(q.z - p.z) - p.depth / 2, 0)) >= 25, `plot ${p.id} intersects road or pedestrian corridor`); }
    assert.ok(p.x > xs('olm') && p.x < out.ctry[0], 'pilot stays in generic London block');
  }
});

test('architecture callback replaces the city blocks while preserving safe plots', () => {
  const collect = () => {
    const plots = [], boxes = [];
    buildBlocks((...b) => boxes.push(b), stops, pts, curve, [], undefined, (p) => plots.push(p));
    return { plots, boxes };
  };
  const { plots, boxes } = collect();
  assert.ok(plots.length >= 300);
  assert.deepEqual(plots, collect().plots);
  assert.ok(new Set(plots.map(p => p.kind)).has('shop'));
  assert.ok(new Set(plots.map(p => p.kind)).has('office'));
  assert.ok(new Set(plots.map(p => p.kind)).has('midrise'));
  assert.ok(new Set(plots.map(p => p.kind)).has('terrace'));
  assert.equal(new Set(plots.map(p => p.id)).size, plots.length, 'plot ids remain unique');
  const density = plots.filter(p => p.id.includes('density-'));
  assert.equal(density.length, 24, '24 explicit architectural infill lots are included');
  assert.deepEqual(density, collect().plots.filter(p => p.id.includes('density-')), 'density lots are deterministic');
  for (const p of density) for (const q of plots) if (q !== p) {
    assert.ok(!overlaps(p, [q.x - q.width / 2, q.x + q.width / 2, q.z - q.depth / 2, q.z + q.depth / 2]), `${p.id} does not overlap ${q.id}`);
  }
  const namedStyles = new Set(plots.map(p => p.archetype).filter(Boolean));
  for (const name of ['paulista-arcade-shop', 'paulista-brise-apartment', 'paulista-finned-tower', 'london-bay-terrace', 'london-corner-pub', 'london-mansion-block', 'glasgow-blonde-bay-tenement', 'glasgow-red-stepped-tenement', 'glasgow-sandstone-gabled-row']) {
    assert.ok(namedStyles.has(name), `density lots expose ${name}`);
  }
  for (const p of plots) {
    assert.ok([p.x, p.z, p.width, p.depth, p.height].every(Number.isFinite));
    assert.ok(p.width > 0 && p.depth > 0 && p.height > 0);
    for (let i = 0; i <= 240; i++) {
      const q = curve.getPointAt(i / 240), dx = Math.max(Math.abs(q.x - p.x) - p.width / 2, 0), dz = Math.max(Math.abs(q.z - p.z) - p.depth / 2, 0);
      assert.ok(Math.hypot(dx, dz) >= 10, `plot ${p.id} preserves a useful road/pedestrian gap`);
    }
  }
  assert.ok(boxes.length < 10, 'ordinary block facades are no longer emitted as voxel boxes');
});
