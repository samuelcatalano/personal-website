import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLook, walkPaths, crowdPlan, chooseVariants, hairShape, SKIN } from '../js/world/crowd.js';
import { routePoints, rng } from '../js/world/layout.js';
import { stops } from '../js/content.js';

const pts = routePoints(stops.length), plan = crowdPlan(stops, pts, 42), looks = plan.map((p) => p.look);

test('plan is deterministic and about 600 people', () => {
  assert.deepEqual(crowdPlan(stops, pts, 42), plan);
  assert.notDeepEqual(crowdPlan(stops, pts, 43), plan);
  assert.equal(plan.length, 600);
  assert.ok(plan.every((p) => p.s0 >= 0 && p.s0 < 1));
  const lanes = plan.filter((p) => p.path.type === 'lane').length / plan.length;
  assert.ok(lanes > 0.6 && lanes < 0.8, `lane share ${lanes}`);
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
  assert.equal(loops.length, 4);
  for (const { rect: q } of loops) {
    assert.ok(q.x0 < q.x1 && q.z0 < q.z1);
    const d = Math.min(...line.map((p) => Math.hypot(p.x - Math.max(q.x0, Math.min(p.x, q.x1)), p.z - Math.max(q.z0, Math.min(p.z, q.z1)))));
    assert.ok(d >= 5.6, `${d}`);
  }
  assert.ok(plan.some((p) => p.path.type === 'loop' && (p.path.dir === 1 || p.path.dir === -1)));
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
