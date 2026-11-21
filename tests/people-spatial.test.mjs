import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {findPedestrianPath} from '../js/world/pedestrian-path.js';

// people.js is pure simulation (no three, no rendering): load it in a vm with stubbed imports.
function load(plan, passages = [], extra = {}) {
  const context = vm.createContext({ findPedestrianPath, crowdPlan: () => plan,
    estaiadaRoute: () => ({ stations: [{ x: 0, z: 0 }] }), LANDMARKS: { estaiada: 0 }, ROAD: { padIn: 7, padOut: 8.9, furniture: [] }, RIVER_Z: 0, stopIndex: () => 0,
    underpassFrames: () => passages, UNDERPASS_HALF_LENGTH: 7.5, ARCH_HALF_WIDTH: 5.5, ...extra });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);
  return context;
}
const curve = { getPoint(t) { return { x: 100 * t, z: 0, distanceTo(p) { return Math.abs(this.x - p.x); } }; } };
const loadPeople = (plan, passages = [], options = {}) => load(plan, passages).createPeople({ curve, pts: [{ x: 0 }], stops: [], ...options });
// A walker standing exactly at (x, z) on a 10 m loop, walking +x at 1 m/s.
const walker = (x, z) => ({ s0: 0, look: { height: 1, speed: 1 }, path: { type: 'loop', dir: 1, inset: 0, rect: { x0: x - 0.75, x1: x + 9.25, z0: z, z1: z + 10 } } });

test('approaching walkers yield before contact and resume without leaving their paths', () => {
  const a=walker(0,0),b=walker(2,0);b.path.dir=-1;
  const people=loadPeople([a,b]),initial=people.route.x[1],dt=1/60;
  let minPace=1;
  for(let i=0;i<45;i++){
    people.update(dt,{x:0,z:0});minPace=Math.min(minPace,people.walkPace[1]);
    assert.ok(Math.abs(people.route.z[1])<=.55,'avoidance stays within the existing separation envelope');
  }
  assert.ok(minPace<.9,'one walker anticipates the encounter');
  assert.ok(people.route.x[1]<initial,'yielding keeps forward progress instead of deadlocking');
  for(let i=0;i<300;i++)people.update(dt,{x:0,z:0});
  assert.ok(people.walkPace[1]>.95,'normal pace returns after passing');
});

const straightWalker = (x, z, dir = 1, speed = 1) => ({
  s0: (x + 20 - .75) / (2 * (220 + 10) - 8 * .75 + 2 * Math.PI * .75),
  look: { height: 1.8, speed },
  path: { type: 'loop', dir, inset: 0, rect: { x0: -20, x1: 200, z0: z, z1: z + 10 } },
});

test('head-on walkers pass with body clearance instead of stacking on their route', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const a = straightWalker(0, 0), b = straightWalker(3, 0, -1);
    const people = loadPeople([a, b]);
    let minimumGap = Infinity, maximumStep = 0;
    for (let t = 0; t < 6; t += dt) {
      const before = [people.route.x.slice(), people.route.z.slice()];
      people.update(dt, { x: 0, z: 0 });
      for (let i = 0; i < 2; i++) maximumStep = Math.max(maximumStep, Math.hypot(people.route.x[i] - before[0][i], people.route.z[i] - before[1][i]));
      minimumGap = Math.min(minimumGap, Math.hypot(people.route.x[0] - people.route.x[1], people.route.z[0] - people.route.z[1]));
    }
    assert.ok(maximumStep <= 1.5 * dt, `head-on teleport at ${1 / dt} FPS: ${maximumStep} m/frame`);
    assert.ok(minimumGap >= .7, `head-on clearance at ${1 / dt} FPS: ${minimumGap}`);
    assert.ok(people.route.x[0] > people.route.x[1] + 1, 'both walkers pass rather than deadlock');
  }
});

test('a faster follower leaves room behind a slower walker for a sustained encounter', () => {
  const a = straightWalker(0, 0), b = straightWalker(1.2, 0, 1, .45);
  const people = loadPeople([a, b]), dt = 1 / 60;
  let minimumGap = Infinity;
  for (let k = 0; k < 1200; k++) {
    people.update(dt, { x: 0, z: 0 });
    minimumGap = Math.min(minimumGap, Math.hypot(people.route.x[0] - people.route.x[1], people.route.z[0] - people.route.z[1]));
  }
  assert.ok(people.route.x[0] < people.route.x[1], 'follower must queue instead of passing through the leader');
  assert.ok(minimumGap >= .7, `following clearance: ${minimumGap}`);
  assert.ok(people.route.x[1] > 9, 'the leader keeps walking');
});

test('a queue on a sidewalk keeps body clearance without passing through its leader', () => {
  const plan = [20, 21, 22].map((x, i) => ({ s0: x / 200,
    look: { height: 1.8, speed: i === 2 ? .4 : .8 }, path: { type: 'lane', dir: 1, offset: 8 },
  }));
  const people = loadPeople(plan);
  let minimumGap = Infinity;
  for (let k = 0; k < 1800; k++) {
    people.update(1 / 60, { x: 30, z: 8 });
    for (let i = 1; i < plan.length; i++) {
      minimumGap = Math.min(minimumGap, people.route.x[i] - people.route.x[i - 1]);
      assert.ok(Math.abs(people.route.z[i] - 8) <= .21, 'queue stays on its sidewalk');
    }
  }
  assert.ok(minimumGap >= .7, `sidewalk queue clearance: ${minimumGap}`);
  assert.ok(people.route.x[0] > 30, 'the queue keeps making progress');
});

test('an established encounter freezes with zero simulation time', () => {
  const people = loadPeople([straightWalker(0, 0), straightWalker(3, 0, -1)]);
  for (let i = 0; i < 150; i++) people.update(1 / 60, { x: 0, z: 0 });
  const before = [...people.route.x, ...people.route.z];
  for (let i = 0; i < 60; i++) people.update(0, { x: 0, z: 0 });
  assert.deepEqual([...people.route.x, ...people.route.z], before, 'paused avoidance must not creep');
});

test('nearby parallel companions match pace without changing their paths', () => {
  const a=walker(0,0),b=walker(0,1);b.look.speed=.92;
  const people=loadPeople([a,b]),dt=1/60;
  let first=0,second=0;
  for(let i=0;i<120;i++){
    const x=people.route.x[0],other=people.route.x[1];people.update(dt,{x:0,z:0});
    first=(people.route.x[0]-x)/dt;second=(people.route.x[1]-other)/dt;
  }
  assert.ok(Math.abs(first-second)<.015,'companions settle to the same walking speed');
  assert.ok(people.route.x[0]>1&&people.route.x[1]>1,'matching pace does not stall the pair');
  assert.equal(people.route.z[0],0);assert.equal(people.route.z[1],1);
});

test('a walker watching the stopped bus really stops instead of drifting with a frozen gait', () => {
  const people = loadPeople([walker(0, 0)]), { route } = people, dt = 1 / 60;
  for (let i = 0; i < 480; i++) people.update(dt, { x: 0, z: 0 }, { x: route.x[0], z: route.z[0], speed: 0 });
  const x = route.x[0], z = route.z[0];
  people.update(dt, { x: 0, z: 0 }, { x, z, speed: 0 });
  const speed = Math.hypot(route.x[0] - x, route.z[0] - z) / dt;
  assert.ok(speed < .001, `stopped pedestrian still drifts at ${speed} m/s`);
  assert.ok(Math.abs(speed - people.walkPace[0]) < .001, 'translation and animation report the same pace');
});

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

test('open sidewalk endpoints and both sides of the bridge mouth turn without wrapping across the map', () => {
  for (const offset of [8, -8]) for (const s0 of [.1, .49, .6, .9]) {
    const plan = [{ s0, look: { height: 1.8, speed: 1 }, path: { type: 'lane', dir: 1, offset } }];
    const context = load(plan, [], { estaiadaRoute: () => ({ stations: [{ x: 50, z: 0 }] }) });
    const people = context.createPeople({ curve, pts: [{ x: 0 }], stops: [] });
    let maxStep = 0;
    for (let k = 0; k < 2400; k++) {
      const x = people.route.x[0], z = people.route.z[0];
      people.update(.1, { x: 50, z: 0 });
      maxStep = Math.max(maxStep, Math.hypot(people.route.x[0] - x, people.route.z[0] - z));
      if (offset < 0) assert.ok(people.route.x[0] <= 44.5 || people.route.x[0] >= 55.5, 'bridge-side walker does not cross the ramp mouth');
    }
    assert.ok(maxStep < .14, `sidewalk wrap at offset ${offset}, phase ${s0}: ${maxStep} m`);
  }
});

test('counterflow keeps its encounter partner and passing side until the pair has passed', () => {
  const people = loadPeople([straightWalker(0, 0), straightWalker(3, 0, -1)]);
  let acquired = false, side;
  for (let k = 0; k < 180; k++) {
    people.update(1 / 60, { x: 0, z: 0 });
    const state = people.behavior[0];
    if (state.partner === 1) {
      if (!acquired) { acquired = true; side = state.passSide; }
      assert.equal(state.passSide, side, 'do not alternate passing side during the encounter');
    }
  }
  assert.ok(acquired, 'the encounter has an explicit partner');
  for (let k = 0; k < 240; k++) people.update(1 / 60, { x: 0, z: 0 });
  assert.equal(people.behavior[0].partner, -1, 'release the partner after passing');
});

test('blocked sidewalk counterflow recovers by giving way along the same safe route', () => {
  const plan = [20, 23].map((x, i) => ({ s0: x / 200,
    look: { height: 1.8, speed: .8 }, path: { type: 'lane', dir: i ? -1 : 1, offset: 8 },
  }));
  const people = loadPeople(plan);
  for (let k = 0; k < 1200; k++) people.update(1 / 60, { x: 20, z: 8 });
  assert.ok(people.behavior.some(p => p.recoveries > 0), 'an obstructed encounter triggers recovery');
  assert.ok(people.route.x[0] > 26 && people.route.x[1] > 26, `the pair escapes the deadlock: ${[...people.route.x]}, ${JSON.stringify(people.behavior)}`);
  assert.ok(people.behavior.every(p => p.blocked < 2.1), 'nobody remains stuck indefinitely');
  assert.ok([...people.route.z].every(z => z >= 7.3 && z <= 8.6), 'the whole body remains on the sidewalk while merging into the return track');
});

test('a legitimate following queue does not trigger stuck recovery', () => {
  const people = loadPeople([straightWalker(0, 0), straightWalker(1, 0, 1, .3)]);
  for (let k = 0; k < 1200; k++) people.update(1 / 60, { x: 0, z: 0 });
  assert.ok(people.behavior.every(p => p.recoveries === 0));
});

test('obstacle avoidance chooses the free side and keeps the whole body on paving', async () => {
  const { createPedestrianSpace } = await import('../js/world/spatial-mask.js');
  const space = createPedestrianSpace({
    solids: [{ x0: 1.7, x1: 2.3, z0: -.08, z1: .08 }, { x0: 1, x1: 4, z0: .4, z1: 1.5 }],
    walkable: [{ x: 8, z: 0, y: 0, h: .1, w: 30, d: 3 }],
  });
  const people = loadPeople([straightWalker(0, 0)], [], { space });
  for (let k = 0; k < 600; k++) {
    people.update(1 / 60, { x: 0, z: 0 });
    assert.ok(space.allows(people.route.x[0], people.route.z[0], .288), 'body penetrated an obstacle or left paving');
  }
  assert.ok(people.route.x[0] > 5, `walker must pass the obstacle: ${people.route.x[0]}`);
});

test('a fully blocked corridor stops or reverses without entering the obstacle', async () => {
  const { createPedestrianSpace } = await import('../js/world/spatial-mask.js');
  const space = createPedestrianSpace({ solids: [{ x0: 2, x1: 3, z0: -2, z1: 2 }] });
  const people = loadPeople([straightWalker(0, 0)], [], { space });
  for (let k = 0; k < 900; k++) {
    people.update(1 / 60, { x: 0, z: 0 });
    assert.ok(space.allows(people.route.x[0], people.route.z[0], .288));
  }
  assert.ok(people.behavior[0].recoveries > 0, 'blocked terrain activates recovery');
});

test('bus attention has individual delays, stopping, slowing and glance-only profiles', () => {
  const people = loadPeople([-3, -1, 1, 3].map(z => straightWalker(0, z)));
  const hero = { x: 0, z: 0, speed: 0 }, cam = { x: 0, z: 0 };
  people.update(.1, cam, hero);
  assert.ok([...people.walkPace].every(p => p > .95), 'people do not react before their reaction delay');
  for (let k = 0; k < 240; k++) people.update(1 / 60, cam, hero);
  assert.ok(people.walkPace[0] < .05, 'interested pedestrian stops');
  assert.ok(people.walkPace[1] > .35 && people.walkPace[1] < .8, 'another slows down');
  assert.ok(people.walkPace[2] > .95 && people.walkPace[3] > .95, 'glance-only and uninterested pedestrians keep walking');
  assert.ok(people.behavior.every(p => p.recoveries === 0), 'attention is not mistaken for a blocked route');
  for (let k = 0; k < 960; k++) people.update(1 / 60, cam, hero);
  assert.ok(people.walkPace[0] > .95, 'attention ends even if the bus remains parked');
  assert.equal(people.behavior[0].busPhase, 'cooldown');
});

test('bus departure releases attention and zero-time updates do not consume its timers', () => {
  const people = loadPeople([straightWalker(0, 0)]), cam = { x: 0, z: 0 };
  for (let k = 0; k < 240; k++) people.update(1 / 60, cam, { x: 0, z: 0, speed: 0 });
  const timer = people.behavior[0].busTime;
  assert.ok(Number.isFinite(timer) && timer > 0, 'active attention has a finite timer');
  for (let k = 0; k < 60; k++) people.update(0, cam, { x: 0, z: 0, speed: 0 });
  assert.equal(people.behavior[0].busTime, timer);
  for (let k = 0; k < 240; k++) people.update(1 / 60, cam, { x: 0, z: 0, speed: 4 });
  assert.ok(people.walkPace[0] > .95, 'pedestrian resumes after departure');
});

test('compatible companions keep a stable group, yield in single file and regroup after an encounter', () => {
  const plan = [straightWalker(0, 0, 1, .8), straightWalker(1.1, 0, 1, .75), straightWalker(4, 0, -1, .8)];
  const people = loadPeople(plan), repeat = loadPeople(plan);
  assert.ok(people.behavior[0].group >= 0, 'nearby compatible walkers form a companion group');
  assert.equal(people.behavior[0].group, people.behavior[1].group);
  assert.notEqual(people.behavior[0].group, people.behavior[2].group, 'counterflow is not a companion');
  assert.deepEqual(people.behavior.map(p => p.group), repeat.behavior.map(p => p.group));
  let singleFile = false, minGap = Infinity;
  for (let k = 0; k < 1200; k++) {
    people.update(1 / 60, { x: 0, z: 0 });
    singleFile ||= people.behavior[0].formation === 'single-file';
    for (let i = 0; i < 3; i++) for (let j = 0; j < i; j++) minGap = Math.min(minGap, Math.hypot(people.route.x[i] - people.route.x[j], people.route.z[i] - people.route.z[j]));
  }
  assert.ok(singleFile, 'companions give way together during external encounters');
  assert.ok(minGap >= .6, `grouping must retain body clearance: ${minGap}`);
  assert.ok(Math.hypot(people.route.x[1] - people.route.x[0], people.route.z[1] - people.route.z[0]) < 2, 'companions reunite');
  assert.equal(people.behavior[0].formation, 'together');
});

test('companions recover together at a dead end instead of abandoning a group member', async () => {
  const { createPedestrianSpace } = await import('../js/world/spatial-mask.js');
  const space = createPedestrianSpace({ solids: [{x0:4,x1:5,z0:-2,z1:2}] });
  const people=loadPeople([straightWalker(0,0,1,.8),straightWalker(1.1,0,1,.75)],[],{space});
  for(let k=0;k<1800;k++)people.update(1/60,{x:0,z:0});
  assert.ok([...people.route.x].every(x=>x<0)||[...people.route.x].every(x=>x>6),`both companions must leave the dead end: ${[...people.route.x]}`);
  assert.ok(Math.hypot(people.route.x[0]-people.route.x[1],people.route.z[0]-people.route.z[1])<2,'group remains together');
});

test('terrain lookahead follows rounded route corners without inventing a dead end', async () => {
  const {createPedestrianSpace}=await import('../js/world/spatial-mask.js');
  const space=createPedestrianSpace({walkable:[{x:10,z:6,w:20,d:12,y:0,h:.1}]});
  const people=loadPeople([{s0:.1,look:{height:1.8,speed:.8},path:{type:'loop',dir:1,inset:.35,rect:{x0:0,x1:20,z0:0,z1:12}}}],[],{space});
  for(let k=0;k<7200;k++)people.update(1/60,{x:10,z:6});
  assert.equal(people.behavior[0].recoveries,0,'a clear authored corner is not a blocked corridor');
});

test('terrain detours use additional free paving when the ordinary sidestep cannot clear an obstacle', async () => {
  const {createPedestrianSpace}=await import('../js/world/spatial-mask.js');
  const space=createPedestrianSpace({solids:[{x0:2,x1:3,z0:-.35,z1:.35}],walkable:[{x:5,z:0,w:30,d:3,y:0,h:.1}]});
  const people=loadPeople([straightWalker(0,0)],[],{space});
  for(let k=0;k<900;k++){
    people.update(1/60,{x:0,z:0});
    assert.ok(space.allows(people.route.x[0],people.route.z[0],.288));
    assert.ok(Math.abs(people.route.z[0])<=.751,'detour remains bounded');
  }
  assert.ok(people.route.x[0]>5,'use the free paving to pass rather than bouncing at a passable obstacle');
});

test('the legacy kiosk correction cannot push a terrain-validated walker into adjacent furniture', async () => {
  const {createPedestrianSpace}=await import('../js/world/spatial-mask.js');
  const space=createPedestrianSpace({solids:[{x0:29,x1:31,z0:8.7,z1:9},{x0:29,x1:31,z0:7.1,z1:7.4}]});
  const people=loadPeople([{s0:.15,look:{height:1.8,speed:.8},path:{type:'lane',dir:1,offset:8}}],[],{space,obstacles:[[30,8.8]]});
  for(let k=0;k<120;k++){
    people.update(1/60,{x:30,z:8});
    assert.ok(space.allows(people.route.x[0],people.route.z[0],.288),'kiosk correction bypassed the common obstacle query');
  }
});

test('a rounded promenade can clear a square lawn corner without repeated recovery', async () => {
  const {createPedestrianSpace}=await import('../js/world/spatial-mask.js');
  const space=createPedestrianSpace({walkable:[{x:10,z:6,w:20,d:12,y:0,h:.1}],lawns:[{x:10,z:6,w:16.2,d:8.2,y:0,h:.15}]});
  const people=loadPeople([{s0:.1,look:{height:1.8,speed:.8},path:{type:'loop',dir:1,inset:2.21,rect:{x0:0,x1:20,z0:0,z1:12}}}],[],{space});
  let maximumStep=0;
  for(let k=0;k<7200;k++){
    const x=people.route.x[0],z=people.route.z[0];
    people.update(1/60,{x:10,z:6});
    if(k>120)maximumStep=Math.max(maximumStep,Math.hypot(people.route.x[0]-x,people.route.z[0]-z));
    assert.ok(space.allows(people.route.x[0],people.route.z[0],.288));
  }
  assert.ok(maximumStep<=1.5/60,`a wider detour must not accelerate walking at a corner: ${maximumStep*60} m/s`);
  assert.equal(people.behavior[0].recoveries,0,'free promenade corners must not cause endless turnarounds');
});

test('sidewalk return traffic occupies the opposite track and passes without deadlocking', () => {
  const people=loadPeople([.05,.935].map(s0=>({s0,look:{height:1.8,speed:.8},path:{type:'lane',dir:1,offset:7.35}})));
  assert.ok(Math.abs(people.route.z[0]-people.route.z[1])>=.8,'return traffic needs its own track');
  let maximumStep=0;
  for(let k=0;k<1200;k++){
    const x=people.route.x.slice(),z=people.route.z.slice();people.update(1/60,{x:20,z:8});
    for(let i=0;i<2;i++)maximumStep=Math.max(maximumStep,Math.hypot(people.route.x[i]-x[i],people.route.z[i]-z[i]));
  }
  assert.ok(people.behavior.every(s=>s.recoveries===0),'clear opposing tracks do not need recovery');
  assert.ok(maximumStep<.025,'the U-turn must remain continuous');
});

test('queued sidewalk turnarounds preserve body clearance and continuous motion while merging', () => {
  const plan=[20,21,24,25].map((x,i)=>({s0:x/200,look:{height:1.8,speed:.8},path:{type:'lane',dir:i<2?1:-1,offset:8}}));
  const people=loadPeople(plan);let minimum=Infinity,maximumStep=0;
  for(let k=0;k<1800;k++){
    const x=people.route.x.slice(),z=people.route.z.slice();people.update(1/60,{x:22,z:8});
    for(let i=0;i<4;i++){
      maximumStep=Math.max(maximumStep,Math.hypot(people.route.x[i]-x[i],people.route.z[i]-z[i]));
      for(let j=0;j<i;j++)minimum=Math.min(minimum,Math.hypot(people.route.x[i]-people.route.x[j],people.route.z[i]-people.route.z[j]));
    }
  }
  assert.ok(minimum>=.6,`merging clearance ${minimum}`);
  assert.ok(maximumStep<.03,`merging jump ${maximumStep}`);
});

 test('local recovery walks around an obstacle wider than the ordinary steering envelope', async()=>{
  const {createPedestrianSpace}=await import('../js/world/spatial-mask.js');
  const space=createPedestrianSpace({solids:[{x0:2,x1:4,z0:-2,z1:2}],walkable:[{x:5,z:0,w:30,d:10,y:0,h:.1}]});
  const people=loadPeople([straightWalker(0,0)],[],{space});let usedPath=false;
  for(let k=0;k<1800;k++){people.update(1/60,{x:0,z:0});usedPath||=!!people.behavior[0].detour;assert.ok(space.allows(people.route.x[0],people.route.z[0],.288));}
  assert.ok(usedPath,'a local path is used when sidestepping is insufficient');
  assert.ok(people.route.x[0]>5,'the pedestrian resumes beyond the obstacle');
 });
