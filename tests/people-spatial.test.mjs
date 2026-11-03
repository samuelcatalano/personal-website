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
