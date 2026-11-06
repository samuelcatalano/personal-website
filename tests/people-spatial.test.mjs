import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// people.js is pure simulation (no three, no rendering): load it in a vm with stubbed imports.
function load(plan, passages = [], extra = {}) {
  const context = vm.createContext({ crowdPlan: () => plan,
    estaiadaRoute: () => ({ stations: [{ x: 0, z: 0 }] }), LANDMARKS: { estaiada: 0 }, ROAD: { padIn: 0.5, furniture: [] }, RIVER_Z: 0, stopIndex: () => 0,
    underpassFrames: () => passages, UNDERPASS_HALF_LENGTH: 7.5, ARCH_HALF_WIDTH: 5.5, ...extra });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);
  return context;
}
const curve = { getPoint(t) { return { x: 100 * t, z: 0, distanceTo(p) { return Math.abs(this.x - p.x); } }; } };
const loadPeople = (plan, passages = [], options = {}) => load(plan, passages).createPeople({ curve, pts: [{ x: 0 }], stops: [], ...options });
// A walker standing exactly at (x, z) on a 10 m loop, walking +x at 1 m/s.
const walker = (x, z) => ({ s0: 0, look: { height: 1, speed: 1 }, path: { type: 'loop', dir: 1, inset: 0, rect: { x0: x - 0.75, x1: x + 9.25, z0: z, z1: z + 10 } } });

test('a frozen crowd (reduced motion) keeps its route positions; a moving one advances', () => {
  for (const reducedMotion of [false, true]) {
    const people = loadPeople([walker(0, 0)], [], { reducedMotion });
    const x0 = people.route.x[0], z0 = people.route.z[0];
    people.update(1, { x: 0, z: 0 });
    const moved = Math.hypot(people.route.x[0] - x0, people.route.z[0] - z0) > 0.1;
    assert.equal(moved, !reducedMotion);
  }
});

test('standing pairs keep their position and facing while nearby walkers separate', () => {
  const idle={s0:0,look:{height:1.8,speed:.78},path:{type:'idle',x:5,z:3,fx:0,fz:-1}};
  for(const reducedMotion of [false,true]){
    const people=loadPeople([idle,walker(5,3)],[],{reducedMotion});
    for(let i=0;i<120;i++)people.update(.25,{x:5,z:3});
    assert.equal(people.route.x[0],5);assert.equal(people.route.z[0],3);
    assert.equal(people.route.fx[0],0);assert.equal(people.route.fz[0],-1);assert.equal(people.walkPace[0],0);
  }
});

test('rounded loop is deterministic, stays in its rectangle, and keeps position and heading continuous', () => {
  const context = load([]);

  const path = { type: 'loop', dir: 1, inset: 0, rect: { x0: 0, x1: 20, z0: 0, z1: 12 } };
  context.testPath = path;
  const radius = vm.runInContext('LOOP_TURN_RADIUS', context);
  const perimeter = context.loopPerimeter(path);
  const expectedPerimeter = 2 * (20 + 12) - 8 * radius + 2 * Math.PI * radius;
  assert.ok(Math.abs(perimeter - expectedPerimeter) < 1e-9);
  const sample = (s, p = path) => {
    const point = context.loopAt(p, s);
    return [point.x, point.z, point.fx, point.fz];
  };

  for (let i = 0; i <= 512; i++) {
    const [x, z, fx, fz] = sample(perimeter * i / 512);
    assert.ok(x >= 0 && x <= 20 && z >= 0 && z <= 12, `sample ${i} escaped rectangle: ${x}, ${z}`);
    assert.ok(Math.abs(Math.hypot(fx, fz) - 1) < 1e-9, `sample ${i} has non-unit heading`);
  }

  const w = 20, h = 12, straightX = w - 2 * radius, straightZ = h - 2 * radius, arc = radius * Math.PI / 2;
  const joins = [straightX, straightX + arc, straightX + arc + straightZ,
    straightX + 2 * arc + straightZ, 2 * straightX + 2 * arc + straightZ,
    2 * straightX + 3 * arc + straightZ, 2 * straightX + 3 * arc + 2 * straightZ, perimeter];
  const epsilon = 1e-4;
  for (const join of joins) {
    const before = sample(join - epsilon), after = sample(join + epsilon);
    assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < epsilon * 2.1, `position discontinuity at s=${join}`);
    assert.ok(before[2] * after[2] + before[3] * after[3] > 0.999, `heading discontinuity at s=${join}`);
  }

  const reverse = { ...path, dir: -1 }, forwardPoint = sample(17.25), reversePoint = sample(17.25, reverse);
  assert.deepEqual(reversePoint.slice(0, 2), forwardPoint.slice(0, 2));
  assert.ok(Math.abs(reversePoint[2] + forwardPoint[2]) < 1e-9 && Math.abs(reversePoint[3] + forwardPoint[3]) < 1e-9);
  assert.deepEqual(sample(17.25), sample(17.25));
});

test('lane turns cap overspeed and keep the walk pace matched to route distance', () => {
  const plan = [{ s0: 0.004, look: { height: 1.7, speed: 0.76 }, path: { type: 'lane', dir: 1, offset: 1 } }];
  const context = load(plan, [], { estaiadaRoute: () => ({ stations: [{ x: 1000, z: 0 }] }) });
  const people = context.createPeople({ curve, pts: [{ x: 0 }], stops: [] });
  const { route, walkPace } = people, x = route.x[0], z = route.z[0], dt = 0.01;
  people.update(dt, { x, z });
  const speed = Math.hypot(route.x[0] - x, route.z[0] - z) / dt;
  assert.ok(Math.abs(speed - 0.76) < 0.04, `turn peak should remain at route speed, got ${speed.toFixed(3)} m/s`);
  assert.equal(walkPace[0], 1, 'animation pace follows the capped route speed through the turn');
});

test('every walker stays in the simulation at any distance, so none vanishes with the camera', () => {
  const people = loadPeople([walker(250, 0), walker(-250, 0), walker(1150, 0)]);
  people.update(0, { x: 0, z: 0 });
  assert.deepEqual([...people.visible], [1, 1, 1]);
  people.update(0, { x: 1200, z: 0 });
  assert.deepEqual([...people.visible], [1, 1, 1]);
});

test('walkers far from the camera keep walking', () => {
  const people = loadPeople([walker(300, 0)]);
  const x0 = people.route.x[0];
  for (let k = 0; k < 10; k++) people.update(0.1, { x: 0, z: 0 });
  assert.ok(people.route.x[0] > x0, 'the walker keeps moving along the route');
});

test('separation eases out between 140 and 150 m instead of jumping at the edge', () => {
  const people = loadPeople([walker(0, 0), walker(0, 0)]); // two walkers on the same spot
  const { route } = people;
  let last = null, worst = 0;
  for (let d = 120; d <= 170.0001; d += 0.05) {
    people.update(0, { x: d, z: 0 });
    const here = [route.x[0], route.z[0]];
    if (last) worst = Math.max(worst, Math.hypot(here[0] - last[0], here[1] - last[1]));
    last = here;
  }
  assert.ok(worst < 0.01, `largest step ${worst.toFixed(4)} m for 5 cm of camera travel`);
});

test('a walker squeezed under an arch is hidden inside its clear opening, not by distance', () => {
  // Arch centred at x = 50 m: a lane walker at offset 7 m is squeezed to about 4.75 m (inside the 5.5 m clear half-width).
  const lane = (s0) => ({ s0, look: { height: 1, speed: 1 }, path: { type: 'lane', dir: 1, offset: 7 } });
  const people = loadPeople([lane(0.25), lane(0.4)], [{ x: 50, z: 0, tx: 1, tz: 0 }]); // walkers at x = 50 (under the arch) and x = 80 (open street)
  people.update(0, { x: 0, z: 0 });
  assert.equal(people.visible[0], 0, 'the walker under the arch is hidden');
  assert.equal(people.visible[1], 1, 'the walker 30 m past the arch in the open street stays');
});
