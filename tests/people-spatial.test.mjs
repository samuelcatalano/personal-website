import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('frozen crowd updates visibility after camera moves without advancing its pose', () => {
  class Geometry { translate() { return this; } rotateX() { return this; } setAttribute(k, v) { this[k] = v; } }
  class Attribute { constructor(array) { this.array = array; } setUsage() { return this; } }
  class Mesh { constructor(geometry, material, n) { this.geometry = geometry; this.material = material; this.userData = {}; this.instanceMatrix = new Attribute(new Float32Array(n * 16)); } }
  const SP = { FRAMES: 8, COLS: 1, FB_COLS: 1, ROWS: 1, strideOf: () => 1, setScale() {}, buildAtlas: () => new Promise(() => {}), CELL_W: 1, CELL_H: 1, GROUND: 1, S: 1 };
  const plan = [0, 1000].map((x) => ({ s0: 0, look: { height: 1, speed: 1 }, path: { type: 'loop', dir: 1, inset: 0, rect: { x0: x, x1: x + 10, z0: 0, z1: 10 } } }));
  const context = vm.createContext({ SP, crowdPlan: () => plan, chooseVariants: () => ({ variants: [], of: [0, 0] }),
    estaiadaRoute: () => ({ stations: [{ x: 0, z: 0 }] }), LANDMARKS: { estaiada: 0 }, RIVER_Z: 0, stopIndex: () => 0,
    underpassFrames: () => [], UNDERPASS_HALF_LENGTH: 7.5, ARCH_HALF_WIDTH: 5.5,
    THREE: { DataTexture: class {}, PlaneGeometry: Geometry, CircleGeometry: Geometry, InstancedBufferAttribute: Attribute, InstancedMesh: Mesh, MeshLambertMaterial: class {}, MeshBasicMaterial: class {} }, performance });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);
  const curve = { getPoint(t) { return { x: 100 * t, z: 0, distanceTo(p) { return Math.abs(this.x - p.x); } }; } };
  for (const reducedMotion of [false, true]) {
    const people = context.createPeople({ add() {} }, { curve, pts: [{ x: 0 }], stops: [], hd: false, reducedMotion });
    const crowd = people.meshes[0], A = crowd.instanceMatrix.array, I = crowd.geometry.aInfo.array;
    const farX = A[28];
    people.update(0, { x: 0, z: 0 });
    assert.equal(A[0], 1); assert.equal(A[16], 0);
    const pose = I[0];
    people.update(reducedMotion ? 1 : 0, { x: 1000, z: 0 });
    assert.equal(A[0], 0); assert.equal(A[16], 1);
    assert.equal(A[28], farX); assert.equal(I[0] % 8, pose % 8);
  }
});

test('rounded loop is deterministic, stays in its rectangle, and keeps position and heading continuous', () => {
  class Geometry { translate() { return this; } rotateX() { return this; } setAttribute(k, v) { this[k] = v; } }
  class Attribute { constructor(array) { this.array = array; } setUsage() { return this; } }
  class Mesh { constructor(geometry, material, n) { this.geometry = geometry; this.material = material; this.instanceMatrix = new Attribute(new Float32Array(n * 16)); } }
  const SP = { FRAMES: 8, COLS: 1, FB_COLS: 1, ROWS: 1, strideOf: () => 1, setScale() {}, buildAtlas: () => new Promise(() => {}), CELL_W: 1, CELL_H: 1, GROUND: 1, S: 1 };
  const context = vm.createContext({ SP, crowdPlan: () => [], chooseVariants: () => ({ variants: [], of: [] }),
    estaiadaRoute: () => ({ stations: [{ x: 0, z: 0 }] }), LANDMARKS: { estaiada: 0 }, RIVER_Z: 0, stopIndex: () => 0,
    underpassFrames: () => [], UNDERPASS_HALF_LENGTH: 7.5, ARCH_HALF_WIDTH: 5.5,
    THREE: { DataTexture: class {}, PlaneGeometry: Geometry, CircleGeometry: Geometry, InstancedBufferAttribute: Attribute, InstancedMesh: Mesh, MeshLambertMaterial: class {}, MeshBasicMaterial: class {} }, performance });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);

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
  class Geometry { translate() { return this; } rotateX() { return this; } setAttribute(k, v) { this[k] = v; } }
  class Attribute { constructor(array) { this.array = array; } setUsage() { return this; } }
  class Mesh { constructor(geometry, material, n) { this.geometry = geometry; this.material = material; this.userData = {}; this.instanceMatrix = new Attribute(new Float32Array(n * 16)); } }
  const plan = [{ s0: 0.004, look: { height: 1.7, speed: 0.76 }, path: { type: 'lane', dir: 1, offset: 1 } }];
  const SP = { FRAMES: 8, COLS: 1, FB_COLS: 1, ROWS: 1, strideOf: () => 1, setScale() {}, buildAtlas: () => new Promise(() => {}), CELL_W: 1, CELL_H: 1, GROUND: 1, S: 1 };
  const context = vm.createContext({ SP, crowdPlan: () => plan, chooseVariants: () => ({ variants: [], of: [0] }),
    estaiadaRoute: () => ({ stations: [{ x: 1000, z: 0 }] }), LANDMARKS: { estaiada: 0 }, ROAD: { padIn: 0.5, furniture: [] }, RIVER_Z: 0, stopIndex: () => 0,
    underpassFrames: () => [], UNDERPASS_HALF_LENGTH: 7.5, ARCH_HALF_WIDTH: 5.5,
    THREE: { DataTexture: class {}, PlaneGeometry: Geometry, CircleGeometry: Geometry, InstancedBufferAttribute: Attribute, InstancedMesh: Mesh, MeshLambertMaterial: class {}, MeshBasicMaterial: class {} }, performance });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);
  const curve = { getPoint(t) { return { x: 100 * t, z: 0, distanceTo(p) { return Math.abs(this.x - p.x); } }; } };
  const people = context.createPeople({ add() {} }, { curve, pts: [{ x: 0 }], stops: [], hd: false });
  const crowd = people.meshes[0], route = crowd.userData.route, x = route.x[0], z = route.z[0], dt = 0.01;
  people.update(dt, { x, z });
  const speed = Math.hypot(route.x[0] - x, route.z[0] - z) / dt;
  assert.ok(Math.abs(speed - 0.76) < 0.04, `turn peak should remain at route speed, got ${speed.toFixed(3)} m/s`);
  assert.equal(crowd.userData.walkPace[0], 1, 'animation pace follows the capped route speed through the turn');
});

// Visibility: walkers are drawn by view distance and frustum only (no short radius), so a crowd is complete on arrival.
function loadPeople(plan, passages = []) {
  class Geometry { translate() { return this; } rotateX() { return this; } setAttribute(k, v) { this[k] = v; } }
  class Attribute { constructor(array) { this.array = array; } setUsage() { return this; } }
  class Mesh { constructor(geometry, material, n) { this.geometry = geometry; this.material = material; this.userData = {}; this.instanceMatrix = new Attribute(new Float32Array(n * 16)); } }
  const SP = { FRAMES: 8, COLS: 1, FB_COLS: 1, ROWS: 1, strideOf: () => 1, setScale() {}, buildAtlas: () => new Promise(() => {}), CELL_W: 1, CELL_H: 1, GROUND: 1, S: 1 };
  const context = vm.createContext({ SP, crowdPlan: () => plan, chooseVariants: () => ({ variants: [], of: plan.map(() => 0) }),
    estaiadaRoute: () => ({ stations: [{ x: 0, z: 0 }] }), LANDMARKS: { estaiada: 0 }, RIVER_Z: 0, stopIndex: () => 0,
    underpassFrames: () => [], UNDERPASS_HALF_LENGTH: 7.5, ARCH_HALF_WIDTH: 5.5,
    THREE: { DataTexture: class {}, PlaneGeometry: Geometry, CircleGeometry: Geometry, InstancedBufferAttribute: Attribute, InstancedMesh: Mesh, MeshLambertMaterial: class {}, MeshBasicMaterial: class {} }, performance });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);
  const curve = { getPoint(t) { return { x: 100 * t, z: 0, distanceTo(p) { return Math.abs(this.x - p.x); } }; } };
  context.underpassFrames = () => passages; // arch frames that the lane squeeze reads
  return context.createPeople({ add() {} }, { curve, pts: [{ x: 0 }], stops: [], hd: false });
}
// A walker standing exactly at (x, z) on a 10 m loop, walking +x at 1 m/s.
const walker = (x, z) => ({ s0: 0, look: { height: 1, speed: 1 }, path: { type: 'loop', dir: 1, inset: 0, rect: { x0: x - 0.75, x1: x + 9.25, z0: z, z1: z + 10 } } });
// THREE.Frustum-shaped planes (inward normals): camera at the origin looking down +x with a 90 degree horizontal view.
const SQRT_HALF = Math.SQRT1_2;
const eastView = { planes: [[SQRT_HALF, 0, -SQRT_HALF, 0], [SQRT_HALF, 0, SQRT_HALF, 0], [1, 0, 0, -1], [-1, 0, 0, 2000], [0, 1, 0, 200], [0, -1, 0, 200]]
  .map(([x, y, z, constant]) => ({ normal: { x, y, z }, constant })) };

test('walkers in view are drawn out to the view distance; walkers outside the frustum are hidden', () => {
  const people = loadPeople([walker(250, 0), walker(-250, 0), walker(950, 0)]);
  const A = people.meshes[0].instanceMatrix.array;
  people.update(0, { x: 0, z: 0 }, eastView);
  assert.ok(A[0] > 0, 'a walker 250 m ahead inside the view is drawn');
  assert.equal(A[16], 0, 'a walker behind the camera is outside the frustum and hidden');
  assert.equal(A[32], 0, 'a walker beyond the 900 m view distance is hidden');
});

test('without a frustum only the view distance applies', () => {
  const people = loadPeople([walker(250, 0), walker(950, 0)]);
  const A = people.meshes[0].instanceMatrix.array;
  people.update(0, { x: 0, z: 0 });
  assert.ok(A[0] > 0, 'a walker 250 m away is drawn');
  assert.equal(A[16], 0, 'a walker 950 m away is hidden');
});

test('a group 250-265 m ahead is already drawn before the camera gets close', () => {
  const plan = Array.from({ length: 8 }, (_, k) => walker(250 + k * 2, k % 2 ? 3 : -3));
  const people = loadPeople(plan);
  const A = people.meshes[0].instanceMatrix.array;
  const drawn = () => plan.reduce((count, _, i) => count + (A[i * 16] > 0 ? 1 : 0), 0);
  people.update(0, { x: 0, z: 0 });
  const far = drawn();
  people.update(0, { x: 200, z: 0 });
  assert.equal(far, 8, `all 8 walkers should be drawn at 250 m, got ${far}`);
  assert.equal(drawn(), 8);
});

test('walkers beyond the old 140 m radius keep their walk cycle and keep walking', () => {
  const people = loadPeople([walker(300, 0)]);
  const I = people.meshes[0].geometry.aInfo.array, A = people.meshes[0].instanceMatrix.array;
  people.update(0, { x: 0, z: 0 }, eastView);
  const x0 = A[12], frames = new Set();
  for (let k = 0; k < 10; k++) { people.update(0.1, { x: 0, z: 0 }, eastView); frames.add(I[0] % 8); }
  assert.ok(frames.size > 3, `walk frames should cycle at 300 m, saw ${[...frames]}`);
  assert.ok(A[12] > x0, 'the walker keeps moving along the route');
});

test('separation eases out between 140 and 150 m instead of jumping at the edge', () => {
  const people = loadPeople([walker(0, 0), walker(0, 0)]); // two walkers on the same spot
  const route = people.meshes[0].userData.route;
  let last = null, worst = 0;
  for (let d = 120; d <= 170.0001; d += 0.05) {
    people.update(0, { x: d, z: 0 });
    const here = [route.x[0], route.z[0]];
    if (last) worst = Math.max(worst, Math.hypot(here[0] - last[0], here[1] - last[1]));
    last = here;
  }
  assert.ok(worst < 0.01, `largest step ${worst.toFixed(4)} m for 5 cm of camera travel`);
});

test('after a camera jump the drawn crowd does not grow over the next 3 s', () => {
  const plan = Array.from({ length: 40 }, (_, k) => walker(40 + (k % 5) * 20, (k % 8) * 8 - 28));
  const people = loadPeople(plan);
  const A = people.meshes[0].instanceMatrix.array;
  const drawn = () => plan.reduce((count, _, i) => count + (A[i * 16] > 0 ? 1 : 0), 0);
  let atTenth = 0;
  for (let f = 1; f <= 180; f++) { people.update(1 / 60, { x: 0, z: 0 }); if (f === 6) atTenth = drawn(); }
  const atThree = drawn();
  assert.ok(atThree > 0 && Math.abs(atThree - atTenth) <= 0.1 * atThree, `${atTenth} drawn at 0.1 s, ${atThree} at 3 s`);
});

test('a walker squeezed under an arch is hidden inside its clear opening, not by distance', () => {
  // Arch centred at x = 50 m: a lane walker at offset 7 m is squeezed to about 4.75 m (inside the 5.5 m clear half-width).
  const lane = (s0) => ({ s0, look: { height: 1, speed: 1 }, path: { type: 'lane', dir: 1, offset: 7 } });
  const people = loadPeople([lane(0.25), lane(0.4)], [{ x: 50, z: 0, tx: 1, tz: 0 }]); // walkers at x = 50 (under the arch) and x = 80 (open street)
  const A = people.meshes[0].instanceMatrix.array;
  people.update(0, { x: 0, z: 0 });
  assert.equal(A[0], 0, 'the walker under the arch is hidden');
  assert.ok(A[16] > 0, 'the walker 30 m past the arch in the open street is drawn');
});
