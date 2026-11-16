import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildCity } from '../js/world/city.js';
import { routePoints, stopIndex, glasgowSites, copan, LANDMARKS } from '../js/world/layout.js';

const pts = routePoints(stops.length);
const curve = {
  getPointAt(u) {
    const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
  },
  getTangentAt(u) {
    const i = Math.min(Math.floor(u * (pts.length - 1)), pts.length - 2), dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z, len = Math.hypot(dx, dz);
    return { x: dx / len, z: dz / len };
  },
};
const collect = () => {
  const plots = [], boxes = [];
  buildCity((...box) => boxes.push(box), stops, pts, curve, undefined, undefined, plot => plots.push(plot));
  return { plots, boxes };
};
const overlaps = (p, r) => p.x - p.width / 2 < r[1] && r[0] < p.x + p.width / 2 && p.z - p.depth / 2 < r[3] && r[2] < p.z + p.depth / 2;

test('only the owner-marked Wembley frontage house is removed', () => {
  const { plots } = collect();
  assert.equal(plots.some(p => p.id === 'frontage-stop-recs-765--1-9'), false);
  for (const dx of [-9, 0]) {
    assert.deepEqual(plots.find(p => p.id === `frontage-stop-recs-765--1-${dx}`), {
      id: `frontage-stop-recs-765--1-${dx}`, kind: 'terrace', x: 805 + dx, z: -29, width: 9, depth: 7, height: 15.100000000000001,
    });
  }
});

test('citywide architecture migration is deterministic, batched by plot, and keeps landmark fronts clear', () => {
  const { plots, boxes } = collect(), repeated = collect().plots;
  assert.ok(plots.length >= 490);
  assert.deepEqual(plots, repeated);
  assert.equal(new Set(plots.map(p => p.id)).size, plots.length);
  assert.deepEqual(new Set(plots.map(p => p.kind)), new Set(['terrace', 'midrise', 'shop', 'office']));
  for (const p of plots) assert.ok([p.x, p.z, p.width, p.depth, p.height].every(Number.isFinite) && p.width > 0 && p.depth > 0 && p.height > 0);
  assert.ok(boxes.length < 12000, 'ordinary building facade boxes have been removed while street props remain');

  assert.ok(plots.filter(p => p.id.startsWith('riverfront-')).length >= 3, 'old airport site is filled by the riverfront infill');
  const x = id => pts[stopIndex(stops, LANDMARKS[id] || id)].x, { museum, uni } = glasgowSites(stops, pts), cp = copan(stops, pts);
  const protectedRects = [
    [cp.x - cp.len / 2 - 3, cp.x + cp.len / 2 + 3, cp.z - cp.amp - cp.depth / 2 - 1.5, cp.z + cp.amp + cp.depth / 2 + 1.5],
    [x('taqtile') - 25, x('taqtile') + 25, -50, 12], [x('puc') - 24, x('puc') + 24, -56, 40],
    [x('estaiada') - 16, x('estaiada') + 16, -80, -12],
    [x('bigben') - 10, x('bigben') + 43, -76, -48], [x('wembley') - 30, x('wembley') + 30, -49, -33],
    [x('glasgow') - 20, x('glasgow') + 20, -43, -17],
    [museum.x - museum.w / 2 - 4.5, museum.x + museum.w / 2 + 4.5, museum.z - 100, museum.z - 8],
  ];
  for (const p of plots) {
    // Owner-marked infill reopens two east-flank pockets, outside the landmark's 6 m setback.
    const margin = p.id.startsWith('urban-infill-glasgow-east-flat-') ? 6 : 16;
    assert.ok(!overlaps(p, [uni.x - uni.w / 2 - margin, uni.x + uni.w / 2 + margin, uni.z - 19, uni.z + 19]), `plot ${p.id} crowds the university`);
    assert.ok(protectedRects.every(r => !overlaps(p, r)), `plot ${p.id} overlaps a protected landmark view`);
    for (let i = 0; i <= 120; i++) {
      const q = curve.getPointAt(i / 120), dx = Math.max(Math.abs(q.x - p.x) - p.width / 2, 0), dz = Math.max(Math.abs(q.z - p.z) - p.depth / 2, 0);
      assert.ok(Math.hypot(dx, dz) >= 9, `plot ${p.id} crowds the bus or pedestrian route`);
    }
  }
});
