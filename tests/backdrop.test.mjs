import assert from 'node:assert/strict';
import test from 'node:test';
import { stops } from '../js/content.js';
import { buildBackdrop } from '../js/world/backdrop.js';
import { routePoints, regions, glasgowSites } from '../js/world/layout.js';
import { PALETTE as P } from '../js/world/palette.js';

const pts = routePoints(stops.length), { museum } = glasgowSites(stops, pts), rgs = regions(stops, pts);
function make() {
  const boxes = [];
  buildBackdrop((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, pts);
  return boxes;
}
const overlaps = (a, b) => a.x - a.w / 2 < b.x + b.w / 2 && a.x + a.w / 2 > b.x - b.w / 2 && a.z - a.d / 2 < b.z + b.d / 2 && a.z + a.d / 2 > b.z - b.d / 2;

test('backdrop is deterministic and stays within the box budget', () => {
  const a = make(), b = make();
  assert.deepEqual(a, b);
  assert.ok(a.length <= 2500, `${a.length} boxes`);
});

test('near backdrop has an extra stepped roof tier while far rows stay muted', () => {
  const a = make(), b = make();
  assert.deepEqual(a, b);
  assert.ok(a.length <= 2500, `${a.length} boxes`);
  const walls = a.filter((box) => box.y === 0 && box.z < -110 && box.z > -150 && box.h >= 5.6 && box.h <= 11.2);
  const tiers = a.filter((box) => box.h === 0.28 && walls.some((wall) =>
    box.x === wall.x && box.z === wall.z && box.y === wall.h + 1.1 &&
    Math.abs(box.w - wall.w * 0.38) < 1e-9 && Math.abs(box.d - wall.d * 0.45) < 1e-9));
  assert.ok(tiers.length > 0, 'near houses have the extra 0.38 × stepped roof tier');
  const farWalls = a.filter((box) => box.y === 0 && box.z <= -180 && box.h >= 5.6 && box.h <= 19.6);
  assert.ok(farWalls.every((box) => [P.stone, P.concreteMid, P.taupe, P.steel].includes(box.color)));
});

test('ground reaches well past the route and beyond the fog horizon in every direction', () => {
  const ground = make().filter((b) => b.h >= 0.2 && b.y + b.h <= -1.05 && b.w > 1000 && b.d > 1000);
  assert.equal(ground.length, 1);
  const g = ground[0];
  assert.ok(g.x - g.w / 2 <= pts[0].x - 1000 && g.x + g.w / 2 >= pts.at(-1).x + 1000);
  assert.ok(g.z - g.d / 2 <= -1100 && g.z + g.d / 2 >= 1100);
});

test('building bodies vary in height and stay out of the landmark and museum corridor', () => {
  const boxes = make(), green = [P.field, P.field2, P.hill];
  const buildings = boxes.filter((b) => b.y === 0 && !green.includes(b.color) && b.w < 1000 && b.z < -110);
  assert.ok(buildings.length > 169, `${buildings.length} buildings: denser neighborhoods than the old backdrop`);
  assert.ok(new Set(buildings.map((b) => b.h)).size >= 5, 'varied building heights');
  assert.ok(new Set(buildings.map((b) => b.z)).size > 20, 'staggered setbacks avoid rigid skyline rows');
  assert.ok(buildings.every((b) => b.h <= 22), 'buildings stay below 22 m');
  assert.ok(buildings.filter((b) => b.z > -180).every((b) => b.h >= 5.6 * .5 && b.h <= 11.2), 'near component masses fit the 2–4 floor envelope');
  const distant = buildings.filter((b) => b.z <= -180);
  assert.ok(distant.every((b) => b.h >= 5.6 * .5 && b.h <= 19.6), 'far component masses fit the 2–7 floor envelope');
  for (const b of distant) assert.ok([P.stone, P.concreteMid, P.taupe, P.steel].includes(b.color), 'far blocks use muted walls');
  for (const b of boxes.filter((b) => b.h > 0 && b.w < 1000 && b.color !== P.pave)) {
    assert.ok(b.x + b.w / 2 <= museum.x - museum.w / 2 - 12 || b.x - b.w / 2 >= museum.x + museum.w / 2 + 12, 'all raised scenery clears the museum corridor');
  }
  for (const b of buildings) for (const [a, z] of rgs.map((rg) => rg.ctry)) {
    assert.ok(b.x + b.w / 2 <= a - 20 || b.x - b.w / 2 >= z + 20, 'building stays outside country hill terrain');
  }
  for (const b of buildings) {
    assert.ok(b.x + b.w / 2 <= museum.x - museum.w / 2 - 12 || b.x - b.w / 2 >= museum.x + museum.w / 2 + 12, 'museum view corridor');
  }
  for (const b of boxes.filter((b) => b.h > 0 && b.w < 1000)) assert.ok(b.z + b.d / 2 <= -110, `geometry reaches forward to ${b.z + b.d / 2}`);
  const rows = new Map();
  for (const b of buildings) {
    const row = Math.round(b.z / 80);
    const prior = rows.get(row) ?? [];
    assert.ok(prior.every((p) => !overlaps(p, b)), `overlapping backdrop footprints at ${b.x},${b.z}`);
    prior.push(b); rows.set(row, prior);
  }
});

test('urban paving breaks up the green ground while countryside remains green', () => {
  const boxes = make(), green = [P.field, P.field2, P.hill];
  const paving = boxes.filter((b) => b.color === P.pave && b.h <= 0.3 && b.w < 1000 && b.d < 1000);
  assert.ok(paving.length > 20, 'many low urban paving chunks');
  assert.ok(paving.reduce((area, b) => area + b.w * b.d, 0) > 300_000, 'paving covers full neighborhood bands');
  for (const [i, b] of paving.entries()) assert.ok(paving.slice(i + 1).every((other) => !overlaps(b, other)), 'paving tiles touch without overlapping');
  assert.ok(boxes.some((b) => b.color === P.field), 'continuous green base remains');
  assert.ok(boxes.some((b) => green.includes(b.color) && b.w < 1000), 'green breaks remain in the city');
  for (const rg of rgs) {
    const patch = boxes.filter((b) => b.x >= rg.ctry[0] + 30 && b.x <= rg.ctry[1] - 30 && b.z < -110);
    assert.ok(patch.some((b) => green.includes(b.color)), 'countryside remains green');
  }
});

test('countryside contains hills and no tall buildings', () => {
  const boxes = make(), green = [P.field, P.field2, P.hill];
  for (const rg of rgs) {
    const patch = boxes.filter((b) => b.x >= rg.ctry[0] + 30 && b.x <= rg.ctry[1] - 30 && b.z < -110);
    assert.ok(patch.some((b) => green.includes(b.color)), 'countryside hills');
    assert.ok(patch.every((b) => green.includes(b.color) || b.h <= 8), 'low countryside transition');
  }
});
