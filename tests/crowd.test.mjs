import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLook, walkPaths, crowdPlan, chooseVariants, hairShape, SKIN } from '../js/world/crowd.js';
import { routePoints, rng } from '../js/world/layout.js';
import { buildParks } from '../js/world/parks.js';
import { stops } from '../js/content.js';

const pts = routePoints(stops.length), plan = crowdPlan(stops, pts, 42), looks = plan.map((p) => p.look);

test('plan is deterministic, defaults to 1000, and preserves the 600-person plan', () => {
  assert.deepEqual(crowdPlan(stops, pts, 42), plan);
  assert.notDeepEqual(crowdPlan(stops, pts, 43), plan);
  assert.equal(plan.length, 1000);
  const sixHundred = crowdPlan(stops, pts, 42, 600);
  assert.deepEqual(plan.slice(0, 600).filter((p) => p.path.name !== 'thames'), sixHundred.filter((p) => p.path.name !== 'thames'), 'the non-Thames base stays identical');
  assert.equal(crowdPlan(stops, pts, 42, 600).length, 600);
  assert.equal(crowdPlan(stops, pts, 999, 700).length, 700);
  assert.ok(plan.every((p) => p.s0 >= 0 && p.s0 < 1));
  const lanes = plan.filter((p) => p.path.type === 'lane').length / plan.length;
  assert.equal(lanes, 0.42);
});
test('heights, children and hair rules', () => {
  const r = rng(1), many = Array.from({ length: 2000 }, () => makeLook(r)), kids = many.filter((l) => /boy|girl/.test(l.kind)), adults = many.filter((l) => /man|woman/.test(l.kind));
  assert.ok(adults.every((l) => l.height >= 1.6 && l.height <= 1.9));
  assert.ok(kids.every((l) => l.height >= 1.1 && l.height <= 1.35));
  assert.ok(Math.max(...kids.map((l) => l.height)) < Math.min(...adults.map((l) => l.height)));
  assert.ok(kids.every((l) => l.hair !== '#b5b5b0'), 'no grey on children');
  assert.ok(many.filter((l) => l.kind === 'girl' || l.kind === 'woman').every((l) => l.hairStyle !== 'bald'));
  assert.ok(many.filter((l) => l.kind === 'boy').every((l) => l.hairStyle === 'short'));
  assert.ok(many.filter((l) => l.kind === 'girl').every((l) => ['long', 'ponytail'].includes(l.hairStyle)));
  const share = adults.length / many.length;
  assert.ok(share > 0.65 && share < 0.75, `adult share ${share}`);
  assert.ok(many.some((l) => l.kind === 'man') && many.some((l) => l.kind === 'woman') && many.some((l) => l.hair === '#b5b5b0'));
});
test('runtime crowd walking speeds fit the adult and child clip limits', () => {
  const people = crowdPlan(stops, pts, 1017), adults = people.filter((p) => /man|woman/.test(p.look.kind) && p.path.name !== 'thames-front').map((p) => p.look);
  const kids = people.filter((p) => /boy|girl/.test(p.look.kind)).map((p) => p.look);
  assert.ok(adults.length > 0 && adults.every((l) => l.speed >= 0.72 && l.speed < 0.82), 'adult speed stays in [0.72, 0.82) m/s');
  assert.ok(kids.length > 0 && kids.every((l) => l.speed >= 0.56 && l.speed < 0.64), 'child speed stays in [0.56, 0.64) m/s');
  assert.ok(people.filter((p) => p.path.name === 'thames-front').every((p) => p.look.speed === 0.62), 'Thames front shares the 0.62 m/s promenade speed');
});
test('at least 6 skin tones in the plan, all from SKIN', () => {
  const used = new Set(looks.map((l) => l.skin));
  assert.ok(used.size >= 6, `${used.size} tones`);
  assert.ok([...used].every((s) => SKIN.includes(s)));
});
test('lanes: both directions on each side, offsets on the sidewalk', () => {
  const lanes = walkPaths(stops, pts).filter((p) => p.type === 'lane');
  assert.equal(lanes.length, 4);
  for (const side of [-1, 1]) assert.deepEqual(lanes.filter((l) => Math.sign(l.offset) === side).map((l) => l.dir).sort(), [-1, 1]);
  assert.ok(lanes.every((l) => Math.abs(l.offset) > 5.45 && Math.abs(l.offset) < 8.75));
  for (const side of [-1, 1]) for (const dir of [-1, 1]) assert.ok(plan.some((p) => p.path.type === 'lane' && Math.sign(p.path.offset) === side && p.path.dir === dir));
});
test('plaza loops stay 5.6 m clear of the road', () => {
  const loops = walkPaths(stops, pts).filter((p) => p.type === 'loop'), line = [];
  for (let i = 1; i < pts.length; i++) for (let k = 0; k < 60; k++) line.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 60, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * k / 60 });
  line.push(pts[pts.length - 1]);
  assert.equal(loops.length, 7);
  assert.ok(loops.some((l) => l.name === 'glasgow-uni'));
  for (const { rect: q } of loops) {
    assert.ok(q.x0 < q.x1 && q.z0 < q.z1);
    const d = Math.min(...line.map((p) => Math.hypot(p.x - Math.max(q.x0, Math.min(p.x, q.x1)), p.z - Math.max(q.z0, Math.min(p.z, q.z1)))));
    assert.ok(d >= 5.6, `${d}`);
  }
  assert.ok(plan.some((p) => p.path.type === 'loop' && (p.path.dir === 1 || p.path.dir === -1)));
});
test('Sé plaza has pedestrians walking both ways below the cathedral stairs', () => {
  const path = walkPaths(stops, pts).find(p => p.name === 'se');
  assert.ok(path, 'Sé has a walking loop');
  assert.ok(path.rect.z0 > -50.8 && path.rect.z1 < -27, 'loop clears stairs and existing park');
  const people = crowdPlan(stops, pts, 1017).filter(p => p.path.name === 'se');
  assert.ok(people.length >= 12, 'plaza feels populated');
  assert.deepEqual([...new Set(people.map(p => p.path.dir))].sort(), [-1, 1]);
});
test('dedicated wander corridors all carry walkers in both directions', () => {
  const paths = walkPaths(stops, pts).filter((p) => p.type === 'wander');
  const people = plan.slice(600);
  assert.equal(paths.length, 17);
  for (const path of paths) {
    const walkers = people.filter((p) => p.path.name === path.name);
    assert.ok(walkers.length > 0, `${path.name} populated`);
    assert.deepEqual([...new Set(walkers.map((p) => p.path.dir))].sort(), [-1, 1], `${path.name} has both directions`);
    if (path.name === 'thames-front') assert.deepEqual([...new Set(walkers.map((p) => p.path.inset))].sort((a, b) => a - b), [0.05, 0.57], 'counterflow uses separated tracks');
    else assert.ok(new Set(walkers.map((p) => p.path.inset)).size > 3, `${path.name} has varied insets`);
    if (path.name === 'thames-front') assert.deepEqual([...new Set(walkers.map((p) => p.look.speed))], [0.62], 'front walkers share one speed');
    else assert.ok(new Set(walkers.map((p) => p.look.speed)).size > 3, `${path.name} has varied speeds`);
    assert.ok(new Set(walkers.map((p) => p.s0)).size > 3, `${path.name} has varied starting positions`);
  }
});
test('London hotspots lead the fixed overflow while existing plazas stay denser than ordinary paths', () => {
  const london = new Set(['thames', 'thames-front']);
  const plazas = ['glasgow-cross', 'glasgow-axis', 'glasgow-west', 'glasgow-east', 'glasgow-front', 'masp-west', 'masp-east', 'masp-front'];
  const current = crowdPlan(stops, pts, 42), overflow = current.slice(600);
  assert.equal(current.length, 1000);
  assert.equal(overflow.length, 400, 'density is reallocated within the existing overflow');
  assert.deepEqual(current.slice(0, 600).filter((p) => p.path.name !== 'thames'), crowdPlan(stops, pts, 42, 600).filter((p) => p.path.name !== 'thames'), 'other base routes stay intact');
  assert.deepEqual(current, crowdPlan(stops, pts, 42), 'the regional allocation is seeded');
  for (const { name } of walkPaths(stops, pts).filter((p) => p.type === 'wander')) {
    const expected = london.has(name) ? 40 : plazas.includes(name) ? 30 : 10;
    assert.equal(overflow.filter((p) => p.path.name === name).length, expected, `${name} keeps its regional share`);
  }
  assert.equal(overflow.filter((p) => p.path.name === 'thames').length, 40, 'the existing Big Ben–Eye loop receives the London hotspot share');
  assert.equal(current.filter((p) => p.path.name === 'thames').length, crowdPlan(stops, pts, 42, 600).filter((p) => p.path.name === 'thames').length + 40, 'the original loop population plus 40 allocated walkers');
  for (const name of [...london, ...plazas]) {
    const people = overflow.filter((p) => p.path.name === name);
    for (const dir of [-1, 1]) {
      const starts = people.filter((p) => p.path.dir === dir).map((p) => p.s0).sort((a, b) => a - b);
      assert.ok(starts.length > 3, `${name} has both directions`);
      if (name !== 'thames-front' && name !== 'thames') {
        const gaps = starts.slice(1).map((s, i) => s - starts[i]);
        assert.ok(Math.min(...gaps) > 0.003, `${name} keeps spacing within small groups`);
        assert.ok(Math.max(...gaps) / Math.min(...gaps) > 6, `${name} forms separated small groups`);
      }
    }
  }
});
test('London pedestrian routes keep safe bounds and counterflow spacing across seeds', () => {
  const seeds = [1017, 42, 7, 2026];
  const curve = {
    getPointAt(u) {
      const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
    },
    getTangentAt() { return { x: 1, z: 0 }; },
  };
  const obstacles = [];
  buildParks((x, y, z, w, h, d) => obstacles.push({ x, y, z, w, h, d }), stops, pts, curve, []);
  const pointAt = ({ path, s0, look }, seconds = 0) => {
    const { rect: q, inset = 0.6 } = path, a = q.x0 + inset, b = q.x1 - inset, c = q.z0 + inset, d = q.z1 - inset;
    const w = b - a, h = d - c, r = Math.max(0, Math.min(0.75, w / 2, h / 2));
    const sx = Math.max(0, w - 2 * r), sz = Math.max(0, h - 2 * r), arc = r * Math.PI / 2;
    const length = 2 * (sx + sz) + 4 * arc;
    let t = ((s0 * length + path.dir * look.speed * seconds) % length + length) % length, x, z;
    if (t < sx) { x = a + r + t; z = c; }
    else if ((t -= sx) < arc) { const angle = -Math.PI / 2 + t / r; x = b - r + r * Math.cos(angle); z = c + r + r * Math.sin(angle); }
    else if ((t -= arc) < sz) { x = b; z = c + r + t; }
    else if ((t -= sz) < arc) { const angle = t / r; x = b - r + r * Math.cos(angle); z = d - r + r * Math.sin(angle); }
    else if ((t -= arc) < sx) { x = b - r - t; z = d; }
    else if ((t -= sx) < arc) { const angle = Math.PI / 2 + t / r; x = a + r + r * Math.cos(angle); z = d - r + r * Math.sin(angle); }
    else if ((t -= arc) < sz) { x = a; z = d - r - t; }
    else { const angle = Math.PI + (t - sz) / r; x = a + r + r * Math.cos(angle); z = c + r + r * Math.sin(angle); }
    return { x, z };
  };
  const assertWalkable = (p, point, seed, seconds) => {
    const { x, z } = point, { rect, inset } = p.path;
    assert.ok(x >= rect.x0 + inset - 1e-8 && x <= rect.x1 - inset + 1e-8, `${p.path.name} stays within x bounds at ${seconds}s for seed ${seed}`);
    assert.ok(z >= rect.z0 + inset - 1e-8 && z <= rect.z1 - inset + 1e-8, `${p.path.name} stays within z bounds at ${seconds}s for seed ${seed}`);
    for (const b of obstacles) {
      if (b.y >= p.look.height + 0.02 || b.y + b.h <= 0.22) continue;
      const clear = Math.abs(x - b.x) >= b.w / 2 + 0.25 || Math.abs(z - b.z) >= b.d / 2 + 0.25;
      assert.ok(clear, `${p.path.name} ${p.look.kind} inset=${inset} at (${x.toFixed(2)},${z.toFixed(2)}) overlaps box (${b.x.toFixed(2)},${b.z.toFixed(2)}) size ${b.w.toFixed(2)}x${b.d.toFixed(2)} at ${seconds}s seed ${seed}`);
    }
  };
  const assertSpacing = (people, seconds, name, seed) => {
    const positions = people.map((p) => ({ p, ...pointAt(p, seconds) }));
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      const distance = Math.hypot(positions[i].x - positions[j].x, positions[i].z - positions[j].z);
      assert.ok(distance >= 0.5, `${name} keeps 0.5 m spacing at ${seconds}s for seed ${seed}`);
    }
    return positions;
  };
  const thamesTracks = {
    '1:adult': { inset: 0.65, speed: 0.78 },
    '1:child': { inset: 1.17, speed: 0.6 },
    '-1:adult': { inset: 1.69, speed: 0.76 },
    '-1:child': { inset: 2.21, speed: 0.62 },
  };
  for (const seed of seeds) {
    const crowd = crowdPlan(stops, pts, seed), overflow = crowd.slice(600);
    const thames = crowd.filter((p) => p.path.name === 'thames');
    const front = overflow.filter((p) => p.path.name === 'thames-front');
    assert.equal(front.length, 40, `thames-front retains its regional share for seed ${seed}`);
    assert.deepEqual([...new Set(front.map((p) => p.path.dir))].sort(), [-1, 1], `thames-front keeps both directions for seed ${seed}`);
    assert.ok(front.every((p) => p.path.inset === (p.path.dir === 1 ? 0.05 : 0.57)), `thames-front uses separated counterflow tracks for seed ${seed}`);
    assert.ok(front.every((p) => p.look.speed === 0.62), `thames-front shares the slow promenade speed for seed ${seed}`);
    for (const p of front) assertWalkable(p, pointAt(p), seed, 0);
    assertSpacing(front, 0, 'thames-front', seed);
    for (const seconds of [0, 5, 30, 90]) {
      const positions = assertSpacing(front, seconds, 'thames-front', seed);
      for (const { p, ...point } of positions) assertWalkable(p, point, seed, seconds);
    }
    assert.equal(overflow.filter((p) => p.path.name === 'thames').length, 40, `thames keeps its overflow share for seed ${seed}`);
    assert.equal(thames.length, crowdPlan(stops, pts, seed, 600).filter((p) => p.path.name === 'thames').length + 40, `thames keeps base plus overflow for seed ${seed}`);
    if (seed === 1017) assert.equal(thames.length + front.length, 105, 'runtime seed keeps 105 London candidates');
    assert.equal(thames.length + front.length, crowdPlan(stops, pts, seed, 600).filter((p) => p.path.name === 'thames').length + 80, `London preserves base plus 80 regional overflow candidates for seed ${seed}`);
    for (const p of thames) {
      const spec = thamesTracks[`${p.path.dir}:${/boy|girl/.test(p.look.kind) ? 'child' : 'adult'}`];
      assert.equal(p.path.inset, spec.inset, `thames keeps a distinct safe track for ${p.look.kind} dir ${p.path.dir} seed ${seed}`);
      assert.equal(p.look.speed, spec.speed, `thames speed is common to its track for seed ${seed}`);
      assert.ok(p.s0 >= 0 && p.s0 < 1);
    }
    assert.equal(new Set(thames.map((p) => `${p.path.dir}:${/boy|girl/.test(p.look.kind) ? 'child' : 'adult'}`)).size, 4, `thames uses four direction/type tracks for seed ${seed}`);
    for (const key of Object.keys(thamesTracks)) {
      const starts = thames.filter((p) => `${p.path.dir}:${/boy|girl/.test(p.look.kind) ? 'child' : 'adult'}` === key).map((p) => p.s0).sort((a, b) => a - b);
      const gaps = starts.slice(1).map((s, i) => s - starts[i]);
      assert.ok(starts.length > 3 && Math.max(...gaps) / Math.min(...gaps) > 2, `thames ${key} positions form safe groups for seed ${seed}`);
    }
    for (const p of thames) assertWalkable(p, pointAt(p), seed, 0);
    assertSpacing(thames, 0, 'thames', seed);
    for (const seconds of [0, 5, 30, 90]) {
      const positions = assertSpacing(thames, seconds, 'thames', seed);
      for (const { p, ...point } of positions) assertWalkable(p, point, seed, seconds);
    }
  }
});
test('sprite variants cover every skin tone, kind and hair style', () => {
  const { variants, of } = chooseVariants(looks, 32);
  assert.equal(variants.length, 32);
  assert.ok(of.every((v) => v >= 0 && v < 32));
  assert.ok(of.every((v, i) => variants[v].kind === looks[i].kind), 'variant keeps the kind');
  assert.equal(new Set(variants.map((l) => l.skin)).size, 7);
  assert.equal(new Set(variants.map((l) => l.kind)).size, 4);
  assert.ok(new Set(variants.map((l) => l.hairStyle)).size >= 4);
  assert.ok(new Set(variants.map(hairShape)).size >= 7, 'quiff, curly, afro, long, bun, pigtails, ...');
});
