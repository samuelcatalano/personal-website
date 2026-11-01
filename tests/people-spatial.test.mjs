import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('frozen crowd updates visibility after camera moves without advancing its pose', () => {
  class Geometry { translate() { return this; } rotateX() { return this; } setAttribute(k, v) { this[k] = v; } }
  class Attribute { constructor(array) { this.array = array; } setUsage() { return this; } }
  class Mesh { constructor(geometry, material, n) { this.geometry = geometry; this.material = material; this.instanceMatrix = new Attribute(new Float32Array(n * 16)); } }
  const SP = { FRAMES: 8, COLS: 1, FB_COLS: 1, ROWS: 1, strideOf: () => 1, setScale() {}, buildAtlas: () => new Promise(() => {}), CELL_W: 1, CELL_H: 1, GROUND: 1, S: 1 };
  const plan = [0, 1000].map((x) => ({ s0: 0, look: { height: 1, speed: 1 }, path: { type: 'loop', dir: 1, inset: 0, rect: { x0: x, x1: x + 10, z0: 0, z1: 10 } } }));
  const context = vm.createContext({ SP, crowdPlan: () => plan, chooseVariants: () => ({ variants: [], of: [0, 0] }),
    estaiadaRoute: () => ({ stations: [{ x: 0, z: 0 }] }), LANDMARKS: { estaiada: 0 }, RIVER_Z: 0, stopIndex: () => 0,
    THREE: { DataTexture: class {}, PlaneGeometry: Geometry, CircleGeometry: Geometry, InstancedBufferAttribute: Attribute, InstancedMesh: Mesh, MeshLambertMaterial: class {}, MeshBasicMaterial: class {} }, performance });
  const source = readFileSync(new URL('../js/world/people.js', import.meta.url), 'utf8').replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(source, context);
  const curve = { getPoint(t) { return { x: 100 * t, z: 0, distanceTo(p) { return Math.abs(this.x - p.x); } }; } };
  for (const reducedMotion of [false, true]) {
    const people = context.createPeople({ add() {} }, { curve, pts: [{ x: 0 }], stops: [], hd: false, reducedMotion });
    const crowd = people.meshes[0], A = crowd.instanceMatrix.array, I = crowd.geometry.aInfo.array;
    people.update(0, { x: 0, z: 0 });
    assert.equal(A[0], 1); assert.equal(A[16], 0);
    const pose = I[0];
    people.update(reducedMotion ? 1 : 0, { x: 1000, z: 0 });
    assert.equal(A[0], 0); assert.equal(A[16], 1);
    assert.equal(A[28], 1000); assert.equal(I[0] % 8, pose % 8);
  }
});
