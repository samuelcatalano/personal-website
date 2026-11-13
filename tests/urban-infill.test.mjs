import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { stops } from '../js/content.js';
import { buildCity } from '../js/world/city.js';
import { buildUrbanInfill, URBAN_INFILL } from '../js/world/urban-infill.js';
import { routePoints, stopIndex, LANDMARKS, east, eastAdd, stretch, LEGACY_GAPS, copan, glasgowSites } from '../js/world/layout.js';
import { PARKS, SQUARES } from '../js/world/parks.js';
import { walkPaths } from '../js/world/crowd.js';
import { buildBackdrop } from '../js/world/backdrop.js';

const pts = routePoints(stops.length), curve = {
  getPointAt(u) {
    const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
  },
  getTangentAt(u) {
    const i = Math.min(Math.floor(u * (pts.length - 1)), pts.length - 2), x = pts[i + 1].x - pts[i].x, z = pts[i + 1].z - pts[i].z, k = Math.hypot(x, z);
    return { x: x / k, z: z / k };
  },
};
const collect = () => {
  const plots = [], trees = [], boxes = [];
  buildCity((...b) => boxes.push(b), stops, pts, curve, (x, z, shape) => trees.push({ x, z, ...shape }), undefined, p => plots.push(p));
  return { plots, trees, boxes };
};
const isNew = p => p.id.startsWith('urban-infill-');
const bounds = p => [p.x - p.width / 2, p.x + p.width / 2, p.z - p.depth / 2, p.z + p.depth / 2];
const hit = (a, b, e = 0) => a[0] < b[1] + e && b[0] - e < a[1] && a[2] < b[3] + e && b[2] - e < a[3];
const hash = a => createHash('sha256').update(JSON.stringify(a)).digest('hex');

test('surveyed infill preserves baseline lots/props except the six approved bridge-street relocations', () => {
  const { plots, trees, boxes } = collect(), added = plots.filter(isNew);
  assert.equal(added.length, 27);
  assert.equal(URBAN_INFILL.length, added.length);
  assert.equal(new Set(plots.map(p => p.id)).size, plots.length);
  assert.deepEqual(added, collect().plots.filter(isNew));
  const approvedMoves={
    'country-infill-0-0':[291.8672036547214,264.8],
    'country-infill-0-1':[291.8672036547214,264.8],
    'block--43--93':[-35.75067056529224,-37.65067056529224],
    'block--24--93':[-17.297834250843152,-23.097834250843153],
    'rear--20':[-19.569937156280503,-21.169937156280504],
    'rear--5':[-4.877749034785666,-2.9777490347856657],
  };
  // This linear-curve fixture has different front-row IDs; the real-curve browser test covers those two moves.
  const moved=plots.filter(p=>approvedMoves[p.id]);assert.equal(moved.length,4);
  assert.ok(!plots.some(p=>p.id==='block--43--93'||p.id==='block--24--93'));
  for(const p of moved){
    assert.ok(Math.abs(p.x-approvedMoves[p.id][1])<1e-9);
    for(const other of plots)if(other!==p)assert.ok(!hit(bounds(p),bounds(other),.2),`${p.id} overlaps ${other.id}`);
  }
  const priorLots=plots.filter(p=>!isNew(p)).map(p=>approvedMoves[p.id]?{...p,x:approvedMoves[p.id][0]}:p);
  assert.equal(hash(priorLots), 'ffdac02377a2b7e56b957083b2cc415c22dd57a57cd9a8caf21ff0a4acb5b90a');
  assert.equal(hash(trees), '607691e858326e6e3363f96abdbeb994a16025d5ba58997991df847caf3dc6f4');
  let patios=0;const priorBoxes=boxes.map(b=>{if(Math.abs(b[0]-264.8)<1e-9&&b[1]===-.02&&(Math.abs(b[2]+100.7)<1e-6||Math.abs(b[2]+109.3)<1e-6)){patios++;return[291.8672036547214,...b.slice(1)]}return b});
  assert.equal(patios,2);
  assert.equal(hash(priorBoxes), '074515fb998072f0c6fdd3ba190776307c672bc779982c879791a56eb0768ec9');
  const fallback = [];
  const backdrop = [];
  buildUrbanInfill((...b) => fallback.push(b));
  buildBackdrop(eastAdd((...b) => backdrop.push(b), stretch), stops, routePoints(stops.length, LEGACY_GAPS));
  for (const p of added) {
    assert.ok(fallback.some(b => b[0] === p.x && b[2] === p.z && b[4] > 3), `${p.id} retains fallback geometry`);
    for (const q of plots) if (p !== q) assert.ok(!hit(bounds(p), bounds(q), 1.5), `${p.id} overlaps ${q.id}`);
    for (const t of trees) assert.ok(!hit(bounds(p), [t.x, t.x, t.z, t.z], (t.crown || 3) / 2 + .5), `${p.id} crowds an existing tree`);
    for (const b of boxes) if (b[1] + b[4] > .35) assert.ok(!hit(bounds(p), [b[0] - b[3] / 2, b[0] + b[3] / 2, b[2] - b[5] / 2, b[2] + b[5] / 2], .5), `${p.id} crowds an existing prop`);
    for (const b of backdrop) if (b[1] + b[4] > .35) assert.ok(!hit(bounds(p), [b[0] - b[3] / 2, b[0] + b[3] / 2, b[2] - b[5] / 2, b[2] + b[5] / 2], 1), `${p.id} overlaps the skyline`);
  }
});

test('infill preserves parks, pedestrian areas, reserved anchors and landmark fronts', () => {
  const added = collect().plots.filter(isNew);
  const protectedRects = [...PARKS, ...SQUARES].map(p => {
    const x = (p.x0 + p.x1) / 2, dx = east(x) - x;
    return [p.x0 + dx, p.x1 + dx, p.z0, p.z1];
  });
  protectedRects.push(...walkPaths(stops, pts).filter(p => p.rect).map(({ rect: p }) => [p.x0, p.x1, p.z0, p.z1]));
  protectedRects.push(...pts.map(p => [p.x - 6, p.x + 6, p.z - 33, p.z - 22]));
  const X = k => pts[stopIndex(stops, LANDMARKS[k])].x, cp = copan(stops, pts), { museum, uni } = glasgowSites(stops, pts);
  protectedRects.push(
    [cp.x - cp.len / 2 - 4, cp.x + cp.len / 2 + 4, cp.z - cp.amp - cp.depth / 2 - 2, cp.z + cp.amp + cp.depth / 2 + 2],
    [X('masp') - 27, X('masp') + 27, -80, 12], [X('se') - 25, X('se') + 25, -80, 40],
    [museum.x - museum.w / 2 - 6, museum.x + museum.w / 2 + 6, -145, museum.z + museum.d / 2 + 5],
    [uni.x - uni.w / 2 - 17, uni.x + uni.w / 2 + 17, uni.z - uni.d / 2 - 17, uni.z + uni.d / 2 + 17],
  );
  for (const p of added) {
    for (const r of protectedRects) assert.ok(!hit(bounds(p), r, .5), `${p.id} enters protected public space`);
    for (let i = 0; i <= 800; i++) {
      const q = curve.getPointAt(i / 800), dx = Math.max(Math.abs(q.x - p.x) - p.width / 2, 0), dz = Math.max(Math.abs(q.z - p.z) - p.depth / 2, 0);
      assert.ok(Math.hypot(dx, dz) >= 9, `${p.id} crowds the road/sidewalk`);
    }
    if (p.z > -35) assert.ok(p.height <= 9.6 + .001, `${p.id} blocks foreground sightlines`);
  }
});
