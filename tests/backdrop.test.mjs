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

test('backdrop generation and facade modules are deterministic', () => {
  assert.deepEqual(make(), make());
});

test('all visible neighborhood bands have recessed, framed facade openings', () => {
  const boxes = make(), panes = boxes.filter((b) => b.d === 0.03 || b.w === 0.03), frames = boxes.filter((b) => (b.d === 0.08 && (b.w === 0.07 || b.h === 0.07)) || (b.w === 0.08 && (b.d === 0.07 || b.h === 0.07))), recesses = boxes.filter((b) => b.d === 0.04 || b.w === 0.04);
  assert.ok(panes.length > 1000, `${panes.length} glazed bays`);
  assert.ok(frames.length >= panes.length * 4 && recesses.length >= panes.length, 'each glazed bay has four frame rails and a shadowed reveal');
  const walls = boxes.filter((b) => b.y >= 0 && b.w > 1 && b.d > 1 && b.h > 0.2), spatial = new Map();
  for (const wall of walls) {
    const key = `${Math.floor(wall.x / 20)},${Math.floor(wall.z / 20)}`;
    (spatial.get(key) ?? spatial.set(key, []).get(key)).push(wall);
  }
  for (const pane of panes) {
    const candidates = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) candidates.push(...(spatial.get(`${Math.floor(pane.x / 20) + dx},${Math.floor(pane.z / 20) + dz}`) ?? []));
    const supported = candidates.some((wall) =>
      pane.y - pane.h / 2 >= wall.y && pane.y + pane.h / 2 <= wall.y + wall.h && (
        pane.d === 0.03 && Math.abs(pane.z - (wall.z + wall.d / 2 + 0.015)) < 1e-9 && pane.x - pane.w / 2 >= wall.x - wall.w / 2 && pane.x + pane.w / 2 <= wall.x + wall.w / 2 ||
        pane.w === 0.03 && Math.abs(Math.abs(pane.x - wall.x) - wall.w / 2 - 0.015) < 1e-9 && pane.z - pane.d / 2 >= wall.z - wall.d / 2 && pane.z + pane.d / 2 <= wall.z + wall.d / 2
      ));
    assert.ok(supported, `window at ${pane.x},${pane.y},${pane.z} belongs to a real wall segment`);
  }
  for (const [x0, x1] of [rgs[0].ctry, rgs[1].ctry]) {
    const neighborhood = boxes.filter((b) => b.x >= x0 + 25 && b.x <= x1 - 25 && b.z < -110);
    assert.ok(neighborhood.some((b) => b.d === 0.03 || b.w === 0.03), `urban facades in ${x0}–${x1}`);
    assert.ok(!neighborhood.some((b) => [P.hill, P.field2].includes(b.color)), 'no countryside hill geometry remains');
  }
});

test('urban masses vary and preserve the museum corridor and foreground clearance', () => {
  const boxes = make(), buildings = boxes.filter((b) => b.y === 0 && b.w < 1000 && b.h >= 5.6 && b.z < -110);
  assert.ok(buildings.length > 300, `${buildings.length} building masses`);
  assert.ok(new Set(buildings.map((b) => b.h)).size >= 5, 'varied building heights');
  assert.ok(new Set(buildings.map((b) => b.color)).size >= 4, 'varied wall colors');
  const rearStrip = (b) => Math.abs(b.x - museum.x) <= museum.w / 2 + 15 && b.z + b.d / 2 <= -122 && b.y + b.h <= 23;
  for (const b of boxes.filter((b) => b.h > 0 && b.w < 1000 && b.color !== P.pave)) {
    assert.ok(b.x + b.w / 2 <= museum.x - museum.w / 2 - 12 || b.x - b.w / 2 >= museum.x + museum.w / 2 + 12 || rearStrip(b), 'raised scenery clears museum corridor except for the low rear strip');
    assert.ok(b.z + b.d / 2 <= -110, `raised scenery stays behind z=-110 (${b.z + b.d / 2})`);
  }
  for (const b of buildings) {
    const row = Math.round(b.z / 80), peer = buildings.filter((other) => other !== b && Math.round(other.z / 80) === row);
    assert.ok(peer.every((p) => !overlaps(p, b)), 'building footprints in each band do not overlap');
  }
});

test('Riverside rear corridor has varied masses across the depth bands without moving outside scenery', () => {
  const boxes = make(), strip = boxes.filter((b) => b.y === 0 && b.z < -122 && b.x - b.w / 2 >= museum.x - museum.w / 2 - 12 && b.x + b.w / 2 <= museum.x + museum.w / 2 + 12 && b.w < 30);
  const depthBands = [-130, -170, -220, -280, -350, -440];
  const filled = depthBands.map((z) => strip.filter((b) => Math.abs(b.z - z) < 26));
  assert.ok(filled.filter((band) => band.length >= 3).length >= 5, 'masses fill at least five rear depth bands');
  assert.ok(strip.some((b) => b.h >= 14), 'rear skyline includes varied mid-rise masses');
  assert.ok(new Set(strip.map((b) => b.h)).size >= 4, 'rear-strip heights vary');
  assert.ok(strip.every((b) => b.z + b.d / 2 <= -122), 'rear-strip masses remain behind the landmark buffer');
});

test('local foundations and neighborhood paving support the backdrop', () => {
  const boxes = make();
  const foundations = boxes.filter((b) => b.color === P.concreteMid && b.y === -0.1 && b.h === 0.08);
  const buildings = boxes.filter((b) => b.y === 0 && b.h >= 2 && b.w > 1 && b.d > 1);
  for (const b of buildings) {
    assert.ok(foundations.some((f) => f.x === b.x && f.z === b.z && f.w === b.w && f.d === b.d), `foundation under ${b.x},${b.z}`);
  }
  assert.ok(!boxes.some((b) => b.w > 1000 && b.d > 1000), 'no blanket ground obscures the sky');
  const paving = boxes.filter((b) => b.color === P.pave && b.h <= 0.3 && b.w < 1000 && b.d < 1000);
  assert.ok(paving.length > 50, `${paving.length} paving segments`);
  assert.ok(paving.reduce((area, b) => area + b.w * b.d, 0) > 500_000, 'paving spans neighborhood bands');
});
