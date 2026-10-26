import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGlasgow } from '../js/world/glasgow.js';
import { buildGlasgowEdges } from '../js/world/glasgow.js';
import { stops } from '../js/content.js';
import { buildCity } from '../js/world/city.js';
import { routePoints, stopIndex } from '../js/world/layout.js';
import { PALETTE as P } from '../js/world/palette.js';

const BRONZE_DK = '#4a3a22';
const near = (n, value, tolerance = 0.01) => Math.abs(n - value) <= tolerance;

test('Glasgow builds George Square on the far side of its road anchor', () => {
  const boxes = [];
  buildGlasgow((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), { x: 100, z: 20 });

  assert.ok(boxes.length >= 35 && boxes.length <= 120, 'keeps the landmark batch modest');
  assert.ok(boxes.some((b) => b.color === P.gravel && b.y > 0 && near(b.x, 100) && near(b.z, -8) && b.w >= 34 && b.d >= 20), 'George Square paving clears the city ground across the road');
  assert.ok(boxes.some((b) => b.color === P.sandstone && near(b.x, 100) && near(b.z, -21) && b.w >= 28 && b.h >= 8), 'City Chambers closes the far side of the square');
  assert.ok(boxes.some((b) => b.color === P.gilt && near(b.x, 100) && near(b.z, -21) && b.y >= 12), 'City Chambers has a raised central dome');
  assert.ok(boxes.filter((b) => b.color === P.ink && near(b.z, -19.44)).length >= 6, 'City Chambers windows face the camera');
  assert.ok(boxes.filter((b) => b.color === P.trunk).length >= 6, 'tree rows frame the square');
});

test('Glasgow includes the Duke of Wellington horse, rider, and traffic cone', () => {
  const boxes = [];
  buildGlasgow((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), { x: 0, z: 0 });

  const at = (x, y, z, c) => boxes.some((b) => b.color === c && near(b.x, x) && near(b.y, y) && near(b.z, z));
  assert.ok(boxes.some((b) => b.color === P.bronze && near(b.w, 4.2) && near(b.y, 4.4) && near(b.z, -20)), 'horse has a 4.2-long body');
  for (const [x, z] of [[1.5, -20.45], [1.5, -19.55], [-1.5, -20.45], [-1.5, -19.55]]) assert.ok(at(x, 2.9, z, P.bronze), `horse leg at ${x},${z}`);
  assert.ok(at(2.4, 6.4, -20, P.bronze) && at(2.9, 6.7, -20, P.bronze) && at(3.45, 5.9, -20, P.bronze), 'raised neck, head and muzzle');
  assert.ok(boxes.some((b) => b.color === BRONZE_DK && near(b.x, -2.45) && b.h >= 1.5), 'tail hangs at the back');
  assert.ok(at(-0.1, 5.1, -19.15, P.bronze) && at(-0.1, 5.1, -20.85, P.bronze), 'rider legs on both sides of the horse');
  assert.ok(at(-0.2, 6.2, -20, P.bronze) && at(-0.2, 7.6, -20, P.bronze), 'rider torso and head');
  assert.ok(boxes.some((b) => b.color === '#f36b21' && near(b.x, -0.2) && b.y >= 8 && b.h >= 0.6 && b.z > -25 && b.z < -12), 'orange cone sits on the rider');
  assert.ok(boxes.some((b) => b.color === P.white && near(b.x, -0.2) && b.y >= 9 && b.z > -25 && b.z < -12), 'cone has its white band');
});

test('Glasgow exit keeps a varied row of houses and midrise tenements', () => {
  const pts = routePoints(stops.length), plots = [], curve = { getPointAt(u) {
    const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
  } };
  buildGlasgowEdges(() => {}, stops, pts, curve, () => {}, (plot) => plots.push(plot));
  assert.ok(plots.some((p) => p.id === 'glasgow-house-86'), 'houses reach the Glasgow exit');
  assert.ok(plots.some((p) => p.kind === 'midrise' && p.height >= 10), 'sandstone tenements rise above the houses');
  assert.ok(plots.every((p) => p.x < pts.at(-1).x + 100), 'edge plots stay within the Glasgow neighborhood');
});

test('Glasgow edge lots do not overlap country street lots', () => {
  const pts = routePoints(stops.length), plots = [], curve = { getPointAt(u) {
    const f = u * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
  }, getTangentAt(u) {
    const i = Math.min(Math.floor(u * (pts.length - 1)), pts.length - 2), x = pts[i + 1].x - pts[i].x, z = pts[i + 1].z - pts[i].z, l = Math.hypot(x, z);
    return { x: x / l, z: z / l };
  } };
  const g = pts[stopIndex(stops, 'glasgow')].x;
  buildCity(() => {}, stops, pts, curve, undefined, undefined, (plot) => plots.push(plot));
  const edges = plots.filter((p) => p.id.startsWith('glasgow-') && p.x > g + 45), country = plots.filter((p) => p.id.startsWith('country-'));
  assert.ok(edges.length > 0 && country.length > 0, 'both Glasgow edge and country lots are generated');
  for (const a of edges) for (const b of country) {
    assert.ok(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2, `${a.id} overlaps ${b.id}`);
  }
});
