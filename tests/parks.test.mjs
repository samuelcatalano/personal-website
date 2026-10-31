import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARKS, PLAZAS, SQUARES, RING, KEEP, WALK_INSET, buildParks } from '../js/world/parks.js';
import { walkPaths } from '../js/world/crowd.js';
import { routePoints, isWembleyBenchmark } from '../js/world/layout.js';
import { PALETTE } from '../js/world/palette.js';
import { tree } from '../js/world/city.js';
import { stops } from '../js/content.js';

const pts = routePoints(stops.length), loops = walkPaths(stops, pts).filter((p) => p.type === 'loop');
const hit = (a, b, e = 0) => a.x0 < b.x1 + e && b.x0 - e < a.x1 && a.z0 < b.z1 + e && b.z0 - e < a.z1;

test('park rects keep clear of the pedestrian plaza loops (3 m incl. railings)', () => {
  for (const p of PARKS) for (const l of loops) assert.ok(!hit(p, l.rect, 3), `${l.name} vs park ${p.x0},${p.z0}`);
});
test('park rects are big enough, do not overlap each other and stay off the road band', () => {
  PARKS.forEach((p, i) => {
    assert.ok(p.x1 - p.x0 >= 6 && p.z1 - p.z0 >= 6);
    PARKS.slice(i + 1).forEach((q) => assert.ok(!hit(p, q, 2), 'parks overlap'));
    assert.ok(p.z0 > 12 || p.z1 < -12 || p.x1 < -245 || p.x0 > 785, 'inside the road band');
  });
});
test('park colours exist in the palette', () => {
  for (const k of ['hedge', 'gravel', 'iron', 'tulip', 'violet']) assert.match(PALETTE[k], /^#[0-9a-f]{6}$/);
});
test('Sé plaza uses stone paving and stays aligned with its pedestrian loop', () => {
  const plaza = PLAZAS.find(p => p.name === 'se');
  assert.ok(plaza, 'Sé has a plaza');
  assert.equal(plaza.paved, PALETTE.stone);
  const curve = { getPointAt: () => ({ x: 0, z: 0 }), getTangentAt: () => ({ x: 1, z: 0 }) };
  const boxes = [];
  buildParks((x, y, z, w, h, d, c) => boxes.push({ x, y, z, w, h, d, c }), stops, pts, curve, []);
  const { rect: r } = loops.find(p => p.name === 'se');
  assert.ok(boxes.some(b => b.c === PALETTE.stone && b.x === (r.x0 + r.x1) / 2 && b.w >= 40 && b.d > 10 && b.h <= 0.1), 'broad paved surface');
  const inside = boxes.filter(b => b.x - b.w / 2 < r.x1 && b.x + b.w / 2 > r.x0 && b.z - b.d / 2 < r.z1 && b.z + b.d / 2 > r.z0);
  assert.ok(inside.every(b => b.c === PALETTE.stone && b.y + b.h <= 0.1), 'plain stone paving without gravel, furniture or plants');
  assert.ok(inside.some(b => b.x - b.w / 2 <= r.x0 && b.x + b.w / 2 >= r.x1 && b.z - b.d / 2 <= -56 && b.z + b.d / 2 >= r.z1), 'continuous paving reaches the cathedral stairs and covers pedestrian circuit');
});

test('plaza ring covers the walking inset; obstacles stay >= 2.4 m inside the loop rects', () => {
  assert.ok(RING[0] < WALK_INSET[0] && RING[1] > WALK_INSET[1] && KEEP > RING[1]);
  assert.deepEqual(PLAZAS.map((q) => q.name).sort(), loops.map((l) => l.name).sort());
  const curve = { getPointAt: (u) => { const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t }; }, getTangentAt: () => ({ x: 1, z: 0 }) };
  const boxes = [];
  buildParks((x, y, z, w, h, d, c) => boxes.push({ x, y, z, w, h, d, c }), stops, pts, curve, []);
  for (const { rect: r, name } of loops) for (const b of boxes) {
    if (b.x - b.w / 2 >= r.x1 || b.x + b.w / 2 <= r.x0 || b.z - b.d / 2 >= r.z1 || b.z + b.d / 2 <= r.z0 || b.y + b.h <= 0.12 || b.c === PALETTE.gravel) continue; // flat gravel/lawn may cover the ring
    const d = Math.min(b.x - b.w / 2 - r.x0, r.x1 - b.x - b.w / 2, b.z - b.d / 2 - r.z0, r.z1 - b.z - b.d / 2);
    assert.ok(d >= KEEP - 1e-6, `${name}: obstacle at inset ${d.toFixed(2)}`);
  }
});

test('tree renderer receives every park tree without changing layout', () => {
  const curve = { getPointAt: () => ({ x: 0, z: 0 }), getTangentAt: () => ({ x: 1, z: 0 }) };
  const collect = out => (...box) => out.push(box);
  const baseline = [], replaced = [], placements = [];
  buildParks(collect(baseline), stops, pts, curve, []);
  buildParks(collect(replaced), stops, pts, curve, [], (x, z, shape) => {
    placements.push({ x, z, ...shape });
    tree(collect(replaced), x, z, shape);
  });
  assert.deepEqual(replaced.filter(b => ![PALETTE.trunk, PALETTE.leaf, PALETTE.grass].includes(b[6])), baseline.filter(b => ![PALETTE.trunk, PALETTE.leaf, PALETTE.grass].includes(b[6])), 'non-tree park geometry remains identical');
  assert.ok(placements.length >= baseline.filter(b => b[6] === PALETTE.trunk).length, 'every original park tree reaches the renderer');
  assert.ok(placements.length > 7, 'the change extends beyond the pilot garden');
});

test('park planting records replace only their old boxes and keep stable tree and path clearances', () => {
  const curve = { getPointAt: () => ({ x: 0, z: 0 }), getTangentAt: () => ({ x: 1, z: 0 }) };
  const capture = plants => {
    const out = { boxes: [], plants: [], trees: [], treeBoxes: new Set() };
    out.draw = (...box) => out.boxes.push(box);
    if (plants) out.draw.plant = (kind, x, y, z, w, h, d, tint, yaw = 0) => out.plants.push({ kind, x, y, z, w, h, d, tint, yaw });
    out.onTree = (x, z, shape) => {
      out.trees.push({ x, z, ...shape });
      const start = out.boxes.length;
      tree(out.draw, x, z, shape);
      for (const box of out.boxes.slice(start)) out.treeBoxes.add(JSON.stringify(box));
    };
    return out;
  };
  const legacy = capture(false), actual = capture(true), repeated = capture(true);
  buildParks(legacy.draw, stops, pts, curve, [], legacy.onTree);
  buildParks(actual.draw, stops, pts, curve, [], actual.onTree);
  buildParks(repeated.draw, stops, pts, curve, [], () => {});

  assert.ok(actual.plants.length > 0, 'existing beds and planters emit plant records');
  assert.deepEqual([...new Set(actual.plants.map(p => p.kind))].sort(), ['flower', 'hedge', 'shrub']);
  assert.deepEqual(actual.plants, repeated.plants, 'plant tint and yaw are deterministic');
  assert.deepEqual(actual.trees, legacy.trees, 'tree positions and shapes stay unchanged');

  const replacements = new Map();
  for (const p of actual.plants) {
    const key = JSON.stringify([p.x, p.y, p.z]);
    replacements.set(key, (replacements.get(key) ?? 0) + 1);
  }
  const oldBoxes = legacy.boxes.filter(box => {
    if (legacy.treeBoxes.has(JSON.stringify(box))) return false;
    const key = JSON.stringify(box.slice(0, 3)), count = replacements.get(key) ?? 0;
    if (!count) return true;
    replacements.set(key, count - 1);
    return false;
  });
  assert.ok([...replacements.values()].every(count => count === 0), 'each plant replaces an existing planting box');
  assert.deepEqual(actual.boxes.filter(box => !actual.treeBoxes.has(JSON.stringify(box))), oldBoxes, 'all other park boxes stay unchanged');

  const homes = [...PARKS, ...SQUARES.map(q => ({ x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1 })), ...loops.map(l => l.rect)];
  for (const p of actual.plants) {
    const c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw)), hx = (c * p.w + s * p.d) / 2, hz = (s * p.w + c * p.d) / 2;
    const old = legacy.boxes.find(box => !legacy.treeBoxes.has(JSON.stringify(box)) && JSON.stringify(box.slice(0, 3)) === JSON.stringify([p.x, p.y, p.z]));
    assert.ok(old && hx <= old[3] / 2 + 1e-6 && hz <= old[5] / 2 + 1e-6, `${p.kind} stays within its former planting footprint`);
    assert.ok(p.h < 1 && p.y + p.h <= 1, `${p.kind} stays below 1 m`);
    assert.ok(homes.some(r => p.x - hx >= r.x0 && p.x + hx <= r.x1 && p.z - hz >= r.z0 && p.z + hz <= r.z1), `${p.kind} stays in an existing bed or park: ${JSON.stringify(p)}`);
    for (const loop of loops) {
      const r = loop.rect, intersects = p.x + hx > r.x0 && p.x - hx < r.x1 && p.z + hz > r.z0 && p.z - hz < r.z1;
      if (intersects) assert.ok(Math.min(p.x - hx - r.x0, r.x1 - p.x - hx, p.z - hz - r.z0, r.z1 - p.z - hz) >= KEEP, `${p.kind} keeps ${loop.name} clearance`);
    }
  }
});

test('Wembley benchmark trees stay inside the existing park and outside paths and building lots', () => {
  const curve = { getPointAt: () => ({ x: 0, z: 0 }), getTangentAt: () => ({ x: 1, z: 0 }) };
  const placements = [], occ = [];
  buildParks(() => {}, stops, pts, curve, [], (x, z, shape) => placements.push({ x, z, ...shape }));
  const trees = placements.filter(p => isWembleyBenchmark({ x: p.x, z: p.z }));
  assert.deepEqual(trees.map(p => [p.x, p.z]), [[688, -62.5], [708, -62.5], [728, -62.5]]);
  const rects = walkPaths(stops, pts).filter(p => p.type !== 'lane').map(p => p.rect);
  for (const p of trees) {
    const r = p.crown / 2;
    for (const q of rects) assert.ok(p.x + r + 0.22 <= q.x0 || p.x - r - 0.22 >= q.x1 || p.z + r + 0.22 <= q.z0 || p.z - r - 0.22 >= q.z1, 'crown stays out of walking route');
    assert.ok(p.x + r < 765, 'trees stay outside Wembley protected frontage');
  }
});

test('larger lawn parks have a low paved edge outside walking loops', () => {
  const curve = { getPointAt: () => ({ x: 0, z: 0 }), getTangentAt: () => ({ x: 1, z: 0 }) };
  const boxes = [];
  buildParks((x, y, z, w, h, d, c) => boxes.push({ x, y, z, w, h, d, c }), stops, pts, curve, []);
  const p = PARKS[0], lawn = boxes.find(b => b.c === PALETTE.patch && b.x === (p.x0 + p.x1) / 2 && b.z === (p.z0 + p.z1) / 2);
  assert.ok(lawn, 'first park lawn exists');
  const edges = boxes.filter(b => b.c === PALETTE.pave && b.y === 0.02 && b.h === 0.05 && (
    Math.abs(b.x - (p.x0 + p.x1) / 2) < 1e-6 || Math.abs(b.z - (p.z0 + p.z1) / 2) < 1e-6
  ) && (Math.abs(b.w - 0.45) < 1e-6 || Math.abs(b.d - 0.45) < 1e-6));
  assert.equal(edges.length, 4, 'four paved strips surround the lawn');
  for (const b of edges) {
    const rect = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 };
    assert.ok(loops.every(l => !hit(rect, l.rect, 2.4)), 'edge stays at least 2.4 m from pedestrian loops');
  }
  const horizontal = edges.filter(b => b.w > b.d), vertical = edges.filter(b => b.d > b.w);
  assert.equal(horizontal.length, 2);
  assert.equal(vertical.length, 2);
  for (const h of horizontal) for (const v of vertical) assert.ok(!hit(
    { x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 },
    { x0: v.x - v.w / 2, x1: v.x + v.w / 2, z0: v.z - v.d / 2, z1: v.z + v.d / 2 },
  ), 'edge corners do not overlap');
});
