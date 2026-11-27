import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { stops as liveStops } from '../js/content.js';
import { legacyStops } from '../js/world/layout.js';
const stops = legacyStops(liveStops); // the city map is the legacy road: milestone stops are not in it
import { buildCity } from '../js/world/city.js';
import { buildUrbanInfill, URBAN_INFILL } from '../js/world/urban-infill.js';
import { routePoints, stopIndex, LANDMARKS, east, eastAdd, stretch, LEGACY_GAPS, copan, glasgowSites } from '../js/world/layout.js';
import { PARKS, SQUARES } from '../js/world/parks.js';
import { walkPaths } from '../js/world/crowd.js';
import { buildBackdrop } from '../js/world/backdrop.js';
import { ARCHITECTURE_LAYOUT_OFFSETS, applyArchitectureLayoutOffset } from '../js/world/layout-data.js';

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
const layoutMoveOld = {
  'block-713--43-3': [773.6271433031652, -43.09061256479842],
  'block-713--43-4': [779.6271433031652, -43.09061256479842],
  'block-746--47': [794.1684200223535, -46.823959783945206],
  'frontage-gap-glasgow-585--1-0': [625, -6.428571428571427],
  'gap-47--98-0': [84, -97.52750330851623],
  'wembley-side--34--64': [801, -64],
  'wembley-side--48--68': [787, -68],
};

test('layout data applies exact offsets without mutating plot records', () => {
  const plot = Object.freeze({ id: 'unlisted-layout-plot', x: 12, z: -8, width: 9, depth: 7, archetype: 'terrace' });
  assert.equal(applyArchitectureLayoutOffset(plot), plot);
  assert.deepEqual(plot, { id: 'unlisted-layout-plot', x: 12, z: -8, width: 9, depth: 7, archetype: 'terrace' });
  assert.equal(Object.keys(ARCHITECTURE_LAYOUT_OFFSETS).length, 7);
  for (const [id, old] of Object.entries(layoutMoveOld)) {
    const source = Object.freeze({ id, x: old[0], z: old[1], width: 6, depth: 9, height: 12 });
    const moved = applyArchitectureLayoutOffset(source), offset = ARCHITECTURE_LAYOUT_OFFSETS[id];
    assert.deepEqual([moved.x, moved.z], [old[0] + offset.dx, old[1] + offset.dz]);
    assert.deepEqual([moved.width, moved.depth, moved.height], [6, 9, 12]);
    assert.deepEqual([source.x, source.z], old, 'source descriptor stays unchanged');
  }
});

test('surveyed infill preserves baseline lots/props except the six approved bridge-street relocations', () => {
  const { plots, trees, boxes } = collect(), added = plots.filter(isNew);
  assert.equal(added.length, 719);
  assert.equal(hash(added.slice(0, 27)), 'eb358c3e9eb41ee0fb2aff15bbcf406196073ad6a5faaa300bc3d10d57b8a47a');
  const pockets = [
    { bounds: [422, 457, 28, 36], count: 4, kind: 'terrace', height: 6.4 },
    { bounds: [437, 445, -27, -19], count: 1, kind: 'terrace', height: 6.4 },
    { bounds: [481, 491, -104, -79], count: 2, kind: 'midrise', height: 12.8 },
  ];
  const glasgow = added.slice(27, 34);
  assert.ok(glasgow.every(p => p.region === 'glasgow'));
  for (const pocket of pockets) {
    const [x0, x1, z0, z1] = pocket.bounds;
    const lots = glasgow.filter(p => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1);
    assert.equal(lots.length, pocket.count);
    for (const p of lots) {
      const b = bounds(p);
      assert.ok(b[0] >= x0 && b[1] <= x1 && b[2] >= z0 && b[3] <= z1);
      assert.equal(p.kind, pocket.kind);
      assert.ok(p.height <= pocket.height);
    }
  }
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
  const approvedDensityMoves = {
    'paulista-density-midrise': { current: [-287, -133.5], prior: [-289, -127] },
    'paulista-density-terrace-1': { current: [-84.5, -134.5], prior: [-85, -127] },
    'london-density-house': { current: [77, -134], prior: [79, -127] },
    'glasgow-density-tenement': { current: [513, -134.5], prior: [514, -127] },
  };
  const movedLayout = plots.filter(p => ARCHITECTURE_LAYOUT_OFFSETS[p.id]);
  assert.equal(movedLayout.length, 3, 'the linear-curve preservation fixture emits three of the six affected legacy records');
  for (const p of movedLayout) {
    const { dx, dz } = ARCHITECTURE_LAYOUT_OFFSETS[p.id], [x, z] = layoutMoveOld[p.id];
    assert.deepEqual([p.x, p.z], [x + dx, z + dz], `${p.id} uses the approved world offset`);
  }
  const densityMoveId = p => Object.keys(approvedDensityMoves).find(id => p.id === id || p.id.startsWith(`${id}-`));
  const movedDensity = plots.filter(p => densityMoveId(p));
  assert.equal(movedDensity.length, 4);
  for (const p of movedDensity) assert.deepEqual([p.x, p.z], approvedDensityMoves[densityMoveId(p)].current, `${p.id} uses its approved clear position`);
  // This linear-curve fixture has different front-row IDs; the real-curve browser test covers those two moves.
  const moved=plots.filter(p=>approvedMoves[p.id]);assert.equal(moved.length,4);
  assert.ok(!plots.some(p=>p.id==='block--43--93'||p.id==='block--24--93'));
  for(const p of moved){
    assert.ok(Math.abs(p.x-approvedMoves[p.id][1])<1e-9);
    for(const other of plots)if(other!==p)assert.ok(!hit(bounds(p),bounds(other),.2),`${p.id} overlaps ${other.id}`);
  }
  const priorLots=plots.filter(p=>!isNew(p)).map(p=>{
    if (approvedMoves[p.id]) return { ...p, x: approvedMoves[p.id][0] };
    const move = approvedDensityMoves[densityMoveId(p)];
    if (move) return { ...p, x: move.prior[0], z: move.prior[1] };
    const prior = layoutMoveOld[p.id];
    return prior ? { ...p, x: prior[0], z: prior[1] } : p;
  });
  // e089dc76... = the prior ffdac023... lots minus 'frontage-stop-recs-765--1-9', the owner-marked Wembley frontage house removed in 002f864 (architecture-migration.test.mjs pins that removal); nothing else differs
  assert.equal(hash(priorLots), 'e089dc762f10fc72326508e6dda3c87b02552a78af9f22293bc6633f8a6768e4');
  // re-pinned 2026-11-16: 4f492cf moved the foreground park 3 m in z to clear the curved avenue (3 trees out, 4 in around x -300..-310, z 12..22)
  // re-pinned 2026-11-24: street-pair broadleaf crowns 1.8-2.3 -> 2.25-2.85 m (owner-approved realism pass); positions and count unchanged
  // re-pinned 2026-11-27: start-park trees carry a crown `variant` (0-2, parks.js); positions and count unchanged, only the shape key is new
  assert.equal(hash(trees), 'd5de08f3d06aeee350b05433994b1b7706d05d5509da662db835bf0a292e0387');
  let patios=0;const priorBoxes=boxes.map(b=>{if(Math.abs(b[0]-264.8)<1e-9&&b[1]===-.02&&(Math.abs(b[2]+100.7)<1e-6||Math.abs(b[2]+109.3)<1e-6)){patios++;return[291.8672036547214,...b.slice(1)]}return b});
  assert.equal(patios,2);
  // re-pinned 2026-11-16: the same park move (59 boxes out, 44 in) plus the 24 m carriageway run-out past the last stop (city.js ROAD_RUNOUT)
  // re-pinned again 2026-11-16: square paving tiles (parks.js) are 0.055 high instead of 0.06, so their top (0.075) sits under the urban road surface (0.08) instead of z-fighting with it
  // re-pinned 2026-11-23: owner-authorised background pass; parks.js squares add a small flower planter in slots whose planned item did not fit
  assert.equal(hash(priorBoxes), '9e07bbf2467c0d72d5a0987a0d1a868fd4018cc733baebf162213cf3e623bd6e');
  const fallback = [];
  const backdrop = [];
  buildUrbanInfill((...b) => fallback.push(b));
  buildBackdrop(eastAdd((...b) => backdrop.push(b), stretch), stops, routePoints(stops.length, LEGACY_GAPS));
  for (const p of movedDensity) {
    for (const b of backdrop) if (b[1] + b[4] > .35) assert.ok(!hit(bounds(p), [b[0] - b[3] / 2, b[0] + b[3] / 2, b[2] - b[5] / 2, b[2] + b[5] / 2], .3), `${p.id} clears backdrop geometry`);
  }
  // The straight-curve unit fixture has route-dependent lot coordinates; retain its baseline occupancy for infill overlap checks.
  const collisionPlots = plots.map(q => layoutMoveOld[q.id] ? { ...q, x: layoutMoveOld[q.id][0], z: layoutMoveOld[q.id][1] } : q);
  for (const p of added) {
    assert.ok(fallback.some(b => b[0] === p.x && b[2] === p.z && b[4] > 3), `${p.id} retains fallback geometry`);
    for (const q of collisionPlots) if (p.id !== q.id) assert.ok(!hit(bounds(p), bounds(q), 1.5), `${p.id} overlaps ${q.id}`);
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
  );
  for (const p of added) {
    // The two owner-marked east-side lots reopen only this flank, keeping a 6 m landmark setback.
    const margin = p.id.startsWith('urban-infill-glasgow-east-flat-') ? 6 : 17;
    const university = [uni.x - uni.w / 2 - margin, uni.x + uni.w / 2 + margin, uni.z - uni.d / 2 - margin, uni.z + uni.d / 2 + margin];
    assert.ok(!hit(bounds(p), university, .5), `${p.id} crowds the university`);
    for (const r of protectedRects) assert.ok(!hit(bounds(p), r, .5), `${p.id} enters protected public space`);
    for (let i = 0; i <= 800; i++) {
      const q = curve.getPointAt(i / 800), dx = Math.max(Math.abs(q.x - p.x) - p.width / 2, 0), dz = Math.max(Math.abs(q.z - p.z) - p.depth / 2, 0);
      assert.ok(Math.hypot(dx, dz) >= 9, `${p.id} crowds the road/sidewalk`);
    }
    const farDistrict = p.id.startsWith('urban-infill-district-') && p.z >= 100;
    if (p.z > -35) assert.ok(p.height <= (farDistrict ? 16 : 9.6) + .001, `${p.id} blocks foreground sightlines`);
  }
});


test('Glasgow lower-side density extends the existing neighbourhood without shifting prior infill', () => {
  const all = collect().plots.filter(isNew), lower = all.filter(p => p.id.startsWith('urban-infill-glasgow-lower-'));
  assert.equal(hash(all.slice(0, 34)), 'f9d64c5d3030339937f727e9ead7593e70a86720b5bf9bae41b69bfb38ae1b1c');
  assert.equal(lower.length, 20);
  for (const z of [87, 102]) assert.equal(lower.filter(p => p.z === z).length, 10);
  assert.deepEqual(new Set(lower.map(p => p.kind)), new Set(['terrace', 'midrise']));
  for (const p of lower) {
    assert.equal(p.region, 'glasgow');
    assert.ok(p.x >= 390 && p.x <= 507 && p.height <= 9.6 + .001);
    assert.ok(p.width === 9 && p.depth === 9);
  }
});


test('Glasgow outlined west and bottom edges form complete housing rows', () => {
  const all = collect().plots.filter(isNew), edge = all.filter(p => p.id.startsWith('urban-infill-glasgow-outline-'));
  assert.equal(hash(all.slice(0, 54)), '5feae7d235e9ba6fbbfa207319d9bc9d24e894aabe3ab69f5153fbf181e41686');
  assert.equal(edge.length, 46);
  for (const z of [45, 59, 73, 87, 101, 115]) {
    const xs = edge.filter(p => p.z === z).map(p => p.x).sort((a, b) => a - b);
    assert.deepEqual(xs, z < 87 ? [300, 312, 325, 338, 351] : [300, 312, 325, 338, 351, 364, 377]);
  }
  assert.deepEqual(edge.filter(p => p.z === 117).map(p => p.x), [390, 403, 416, 429, 442, 455, 468, 481, 494, 507]);
  assert.deepEqual(new Set(edge.map(p => p.kind)), new Set(['terrace', 'midrise']));
  for (const p of edge) {
    const narrow = p.id.startsWith('urban-infill-glasgow-outline-bridge-side-');
    assert.ok(p.region === 'glasgow' && p.width === (narrow ? 6 : 9) && p.depth === (narrow ? 7 : 9) && p.height <= 9.6 + .001);
  }
});


test('authorized neighbourhood completion covers four bounded districts and preserves previous infill', () => {
  const all = collect().plots.filter(isNew), added = all.filter(p => p.id.startsWith('urban-infill-district-'));
  assert.equal(hash(all.slice(0, 100)), '057090e9ff4df3a7da703114f7798aa352e967a70953950a77bbe339ef870abf');
  assert.equal(added.length, 379);
  for (const [region, x0, x1, count] of [['paulista', -440, -25, 165], ['london', 1, 260, 69], ['glasgow', 261, 650, 56], ['return', 651, 911, 89]]) {
    const lots = added.filter(p => p.id.startsWith(`urban-infill-district-${region}-`));
    assert.equal(lots.length, count);
    assert.ok(lots.some(p => p.z < 87) && lots.some(p => p.z >= 100));
    for (const p of lots) {
      const west = p.id.startsWith('urban-infill-district-paulista-west-');
      assert.ok(p.x >= x0 && p.x <= x1 && p.z >= (west ? -65 : 32) && p.z <= (west ? 19 : 115));
      if (west) assert.ok(p.x <= -350);
      assert.equal(p.region, region === 'return' ? 'london' : region);
      assert.ok(p.height <= (p.z >= 100 ? 16 : 9.6) + .001);
      assert.ok(['terrace', 'midrise'].includes(p.kind));
    }
  }
  assert.ok(added.some(p => p.height > 9.601), 'larger volumes remain in the far rows');
});


test('owner-cropped edge strips and both post-bridge pockets are populated without moving prior lots', () => {
  const all = collect().plots.filter(isNew), gaps = all.filter(p => p.id.startsWith('urban-infill-gaps-'));
  assert.equal(hash(all.slice(0, 479)), '49062d7ccb647539f8961cff4cea8591e367ceb02967adcd40a0bbe4e77d8ff6');
  assert.equal(gaps.length, 147);
  for (const [area, count, x0, x1, z0, z1, region] of [['west', 77, -531, -453, -23, 115, 'paulista'], ['east', 56, 924, 1015, 32, 115, 'london'], ['core', 14, 275, 546, 45, 87, 'glasgow']]) {
    const lots = gaps.filter(p => p.id.startsWith(`urban-infill-gaps-${area}-`));
    assert.equal(lots.length, count);
    for (const p of lots) assert.ok(p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && p.region === region && p.width === 9 && p.depth === 9 && p.height <= 9.601);
    if (area === 'core') {
      assert.equal(lots.filter(p => p.x < 300).length, 7);
      assert.equal(lots.filter(p => p.x > 500).length, 7);
    } else {
      const rows = area === 'west' ? [-23, -9, 5, 19, 32, 45, 59, 73, 87, 101, 115] : [32, 45, 59, 73, 87, 101, 115];
      for (const z of rows) assert.equal(lots.filter(p => p.z === z).length, area === 'west' ? 7 : 8);
    }
  }
});


test('owner-selected eastern stadium pocket is populated while stadium and gardens remain clear', () => {
  const all = collect().plots.filter(isNew), added = all.filter(p => p.id.startsWith('urban-infill-stadium-east-'));
  assert.equal(hash(all.slice(0, 626)), '9303b7081ad08b0389ca98e85e4ade512ba6582a6cb3654610550f9cf7ba8aff');
  assert.equal(added.length, 93);
  const wx = pts[stopIndex(stops, LANDMARKS.wembley)].x;
  for (const p of added) {
    assert.ok(p.x >= 880 && p.x <= 1010 && p.z >= -107 && p.z <= 19);
    assert.ok(p.region === 'london' && p.width === 9 && p.depth === 9 && p.height <= 9.601);
    assert.ok(!hit(bounds(p), [wx - 34, wx + 34, -96, -46]), `${p.id} crowds the stadium envelope/setback`);
  }
  for (const [z, count] of [[-107, 5], [-93, 9], [-79, 9], [-65, 10], [-51, 10], [-37, 10], [-23, 11], [-9, 10], [5, 10], [19, 9]]) assert.equal(added.filter(p => p.z === z).length, count);
});
