import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup(load, search = '') {
  const crowd = { visible: true, instanceMatrix: { array: [] }, geometry: { attributes: { aInfo: { array: [] } } } }, shadow = { visible: true };
  const component = (array, stride, offset) => new Proxy({}, { get: (_, i) => array()[Number(i) * stride + offset] });
  crowd.userData = { route: {
    x: component(() => crowd.instanceMatrix.array, 16, 12), z: component(() => crowd.instanceMatrix.array, 16, 14),
    fx: component(() => crowd.geometry.attributes.aInfo.array, 4, 1), fz: component(() => crowd.geometry.attributes.aInfo.array, 4, 2),
  } };
  const scene = { getObjectByName: (name) => name === 'crowd' ? crowd : shadow, add() {}, remove() {} };
  let deadline;
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    copy(v) { Object.assign(this, v); return this; }
  }
  class Matrix4 {
    multiplyMatrices(_projection, view) { Object.assign(this, view); return this; }
  }
  class Sphere { constructor(center = new Vector3(), radius = 0) { Object.assign(this, { center, radius }); } }
  class Frustum {
    setFromProjectionMatrix(matrix) { Object.assign(this, matrix); return this; }
    intersectsSphere(sphere) { return Math.hypot(sphere.center.x - this.cameraX, sphere.center.z - this.cameraZ) <= this.viewRadius + sphere.radius; }
  }
  class Object3D {
    constructor() { this.position = new Vector3(); this.scale = { setScalar() {} }; this.rotation = {}; this.matrix = {}; }
    updateMatrix() {}
  }
  const context = vm.createContext({ URL, URLSearchParams, location: { search },
    ROAD: { padIn: 1 }, crowdPlan: () => [], GLTFLoader: class { loadAsync() { return load; } },
    SkeletonUtils: { clone: (root) => root },
    THREE: { CircleGeometry: class { rotateX() { return this; } dispose() {} }, MeshBasicMaterial: class { dispose() {} },
      InstancedMesh: class { constructor(geometry, material) { Object.assign(this, { geometry, material, instanceMatrix: {} }); } traverse(fn) { fn(this); } setMatrixAt() {} }, Object3D, Vector3, Matrix4, Sphere, Frustum },
    setTimeout: (fn) => { deadline = fn; return 1; }, clearTimeout() {},
  });
  const source = readFileSync(new URL('../js/world/npc3d.js', import.meta.url), 'utf8')
    .replace(/^import .*;.*$/gm, '').replaceAll('import.meta.url', "'file:///npc3d.js'")
    .replace(/^export /gm, '');
  vm.runInContext(source, context);
  return { crowd, shadow, scene, context, create: context.createNpc3d, expire: () => deadline() };
}

test('failed NPC loading retains the sprites and returns a safe unit', async () => {
  const s = setup(Promise.reject(new Error('offline')));
  const unit = await s.create(s.scene, { stops: [], pts: [] });
  assert.equal(s.crowd.visible, true);
  assert.equal(s.shadow.visible, true);
  assert.doesNotThrow(() => unit.update({}));
});

test('a loaded NPC pack keeps the sprite crowd drawn; only a walker with a 3D body hides its own sprite', async () => {
  const root = { children: [], traverse() {} };
  const s = setup(Promise.resolve({ scene: root, animations: [] }));
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 0 });
  assert.notEqual(s.crowd.visible, false, 'sprites are not hidden as a whole, so no walker vanishes at the 3D cap');
  assert.notEqual(s.shadow.visible, false);
  assert.equal(typeof unit.update, 'function');
  assert.equal(s.context.__npcDiagnostics, undefined, 'normal runtime does not expose NPC diagnostics');
});

test('a stalled NPC load times out and ignores a late result', async () => {
  let resolve;
  const s = setup(new Promise((r) => { resolve = r; }));
  const result = s.create(s.scene, { stops: [], pts: [] });
  s.expire();
  const unit = await result;
  let disposed = 0;
  const texture = { isTexture: true, dispose() { disposed++; } };
  const material = { map: texture, dispose() { disposed++; } };
  const geometry = { dispose() { disposed++; } };
  resolve({ scene: { traverse(fn) { fn({ geometry, material }); } } });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(disposed, 3);
  assert.equal(s.crowd.visible, true);
  assert.equal(s.shadow.visible, true);
  assert.doesNotThrow(() => unit.update({}));
});

test('a failed NPC assembly leaves sprites visible and removes partial objects', async () => {
  let disposed = 0;
  const geometry = { dispose() { disposed++; } };
  const material = { dispose() { disposed++; } };
  const root = { children: [], traverse(fn) { fn({ name: 'fixture', geometry, material }); } };
  const s = setup(Promise.resolve({ scene: root, animations: [] }));
  s.scene.add = () => { throw new Error('assembly failed'); };
  s.scene.remove = () => {};
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 0 });
  assert.equal(s.crowd.visible, true);
  assert.equal(s.shadow.visible, true);
  assert.equal(disposed, 2);
  assert.doesNotThrow(() => unit.update({}));
});

test('partial walker assembly removes walkers and disposes shared assets once', async () => {
  const disposed = { geometry: 0, material: 0, texture: 0, image: 0 };
  const image = { close() { disposed.image++; } };
  const texture = { isTexture: true, source: { data: image }, dispose() { disposed.texture++; } };
  const material = { map: texture, dispose() { disposed.material++; } };
  const geometry = { dispose() { disposed.geometry++; } };
  const mesh = { name: 'fixture', geometry, material };
  const makeRoot = () => ({ children: [], traverse(fn) { fn(mesh); },
    getObjectByProperty() { return { material: { map: true } }; }, scale: { set() {} } });
  const s = setup(Promise.resolve({ scene: makeRoot(), animations: [{ name: 'NPC_Walk', duration: 1 }] }));
  s.context.SkeletonUtils.clone = makeRoot;
  s.context.THREE.AnimationMixer = class { clipAction() { return { play() {} }; } };
  s.context.THREE.Color = class {};
  const added = [], removed = [];
  s.scene.add = (object) => { if (added.length) throw new Error('second walker failed'); added.push(object); };
  s.scene.remove = (object) => removed.push(object);
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 2 });
  assert.equal(added.length, 1);
  assert.ok(removed.includes(added[0]));
  assert.equal(s.crowd.visible, true);
  assert.equal(s.shadow.visible, true);
  assert.deepEqual(disposed, { geometry: 1, material: 1, texture: 1, image: 1 });
  assert.doesNotThrow(() => unit.update({}));
});

test('camera jumps use the current crowd and hide walkers with no visible candidate', async () => {
  const mesh = { name: 'fixture', isMesh: true, material: { dispose() {} } };
  const root = () => ({ children: [], traverse(fn) { fn(mesh); }, getObjectByProperty() { return { material: { map: true } }; },
    scale: { set() {} }, position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {} });
  const s = setup(Promise.resolve({ scene: root(), animations: [{ name: 'NPC_Walk', duration: 1 }] }));
  const A = new Float32Array(32), I = new Float32Array(8);
  A[0] = A[16] = 1; A[28] = 100; I[2] = I[6] = 1;
  s.crowd.instanceMatrix.array = A;
  s.crowd.geometry.attributes.aInfo.array = I;
  s.context.crowdPlan = () => Array.from({ length: 2 }, () => ({ look: { kind: 'man', speed: 1, height: 1.8 }, path: {} }));
  s.context.SkeletonUtils.clone = root;
  s.context.THREE.Color = class {};
  s.context.THREE.AnimationMixer = class { clipAction() { return { play() {} }; } update() {} };
  s.context.THREE.Object3D = class { constructor() { this.scale = { setScalar() {} }; this.position = { set() {} }; this.matrix = {}; } updateMatrix() {} };
  s.context.THREE.InstancedMesh = class { constructor() { this.instanceMatrix = {}; } setMatrixAt() {} };
  const added = []; s.scene.add = (o) => added.push(o);
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 1 });
  const walker = added[0], camera = { position: { x: 0, y: 5, z: 0 }, projectionMatrix: {}, matrixWorldInverse: {}, viewRadius: 30,
    updateMatrixWorld() { Object.assign(this.matrixWorldInverse, { cameraX: this.position.x, cameraZ: this.position.z, viewRadius: this.viewRadius }); this.matrixUpdates = (this.matrixUpdates || 0) + 1; },
    getWorldDirection(v) { v.x = 1; v.y = 0; v.z = 0; } };
  const frame = { camera, dt: 0.016 };
  unit.update(frame);
  assert.equal(walker.position.x, 0);
  assert.equal(mesh.castShadow, true);
  camera.position.x = 80;
  unit.update(frame);
  assert.equal(walker.position.x, 100, 'a visible candidate gets the slot after its former owner leaves the current frustum');
  assert.equal(mesh.castShadow, true);
  camera.position.x = 500; A[0] = A[16] = 0;
  unit.update(frame);
  assert.equal(walker.visible, false);
  assert.equal(mesh.castShadow, false);
  assert.equal(camera.matrixUpdates, 3, 'the live camera matrix is refreshed before each ownership/frustum pass');
});

test('an in-frustum owner beyond the pool distance releases its slot to a nearby visible NPC', async () => {
  const mesh = { name: 'fixture', isMesh: true, material: { dispose() {} } };
  const root = () => ({ children: [], traverse(fn) { fn(mesh); }, getObjectByProperty() { return { material: { map: true } }; },
    scale: { set() {} }, position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {} });
  const s = setup(Promise.resolve({ scene: root(), animations: [{ name: 'NPC_Walk', duration: 1 }] }));
  const A = new Float32Array(32), I = new Float32Array(8);
  A[0] = A[16] = 1; A[28] = 20;
  s.crowd.instanceMatrix.array = A; s.crowd.geometry.attributes.aInfo.array = I;
  s.context.crowdPlan = () => Array.from({ length: 2 }, () => ({ look: { kind: 'man', speed: 1, height: 1.8 }, path: { type: 'loop' } }));
  s.context.SkeletonUtils.clone = root;
  s.context.THREE.Color = class {};
  s.context.THREE.AnimationMixer = class { clipAction() { return { play() {} }; } update() {} };
  const added = []; s.scene.add = (o) => added.push(o);
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 1 });
  const walker = added[0], camera = { position: { x: 0, y: 5, z: 0 }, projectionMatrix: {}, matrixWorldInverse: {}, viewRadius: 500,
    updateMatrixWorld() { Object.assign(this.matrixWorldInverse, { cameraX: this.position.x, cameraZ: this.position.z, viewRadius: this.viewRadius }); },
    getWorldDirection(v) { v.x = 1; v.y = 0; v.z = 0; } };
  const frame = { camera, dt: 0.1 };
  unit.update(frame);
  A[12] = 200;
  for (let i = 0; i < 12; i++) unit.update(frame);
  assert.equal(walker.position.x, 20, 'the distance cap frees a slot even while the old owner remains inside the camera frustum');
});

test('measured NPC clips keep scale-adjusted stride inside the playback cap for each rig', () => {
  const s = setup(Promise.resolve(null));
  const expected = {
    NPC_Walk: 0.621, NPC_Walk2: 0.628, NPC_Walk3: 0.592,
    NPC_Walk_C: 0.402, NPC_Walk2_C: 0.407, NPC_Walk3_C: 0.418,
  };
  const speeds = vm.runInContext('CLIP_SPEED', s.context);
  assert.deepEqual(Object.fromEntries(Object.entries(speeds)), expected);
  const clips = Object.keys(expected).map((name) => ({ name }));
  for (const [rig, isChild, speed] of [['adult', false, 0.82], ['child', true, 0.64]]) {
    const rigClips = s.context.clipsForRig(clips, rig);
    assert.deepEqual(rigClips.map((clip) => clip.name), Object.keys(expected).filter((name) => name.endsWith('_C') === isChild && name !== (isChild ? 'NPC_Walk2_C' : 'NPC_Walk2') && (!isChild || name !== 'NPC_Walk_C')));
    const variants = vm.runInContext('NPC_VARIANTS', s.context).filter((v) => (v.rig === 'child') === isChild);
    const smallestScale = Math.min(...variants.map((v) => v.height / v.measured * 0.96));
    const smallestWide = 0.94;
    for (const { name } of rigClips) {
      assert.equal(s.context.clipStride(name, 1, 1), expected[name]);
      const stride = s.context.clipStride(name, smallestScale, smallestWide);
      const requiredRate = speed / stride;
      assert.ok(requiredRate <= 1.76, `${name}/${rig} requires ${requiredRate.toFixed(3)}x at the speed/scale extremes`);
      assert.ok(Math.abs(s.context.clipTimeScale(speed, stride) - requiredRate) < 1e-9,
        `${name}/${rig} would hit the playback cap at the speed/scale extremes`);
    }
  }
  assert.ok(Math.abs(s.context.clipStride('NPC_Walk', 1, 0.94) / s.context.clipStride('NPC_Walk', 1, 1) - 0.94) < 1e-9,
    'wide scales the longitudinal stride as well as the model');
});

test('the desktop NPC pool targets thirty percent children and balances adult genders', () => {
  const s = setup(Promise.resolve(null));
  const kinds = s.context.poolKinds(56);
  const counts = kinds.reduce((result, kind) => ({ ...result, [kind]: (result[kind] || 0) + 1 }), {});
  assert.deepEqual(counts, { man: 20, woman: 19, kid: 17 });
  assert.ok(Math.abs(counts.kid / 56 - 0.3) < 0.01);
  assert.ok(Math.abs(counts.man - counts.woman) <= 1);
});

test('an incompatible adult candidate does not block a later child from using its free rig slot', async () => {
  const mesh = { name: 'fixture', isMesh: true, material: { dispose() {} } };
  const root = () => ({ children: [], traverse(fn) { fn(mesh); }, getObjectByProperty() { return { material: { map: true } }; },
    scale: { set() {} }, position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {} });
  const clips = ['NPC_Walk', 'NPC_Walk_C', 'NPC_Walk3_C'].map((name) => ({ name, duration: 1 }));
  const s = setup(Promise.resolve({ scene: root(), animations: clips }), '?qa=1');
  const A = new Float32Array(9 * 16), I = new Float32Array(9 * 4);
  for (let i = 0; i < 7; i++) { A[i * 16] = 1; A[i * 16 + 12] = -7 + i; }
  s.crowd.instanceMatrix.array = A; s.crowd.geometry.attributes.aInfo.array = I;
  s.context.crowdPlan = () => Array.from({ length: 9 }, (_, i) => ({
    look: { kind: i === 8 ? 'boy' : 'man', speed: 0.8, height: i === 8 ? 1.3 : 1.8 },
    path: { type: 'lane', name: 'underpass' },
  }));
  s.context.SkeletonUtils.clone = root;
  s.context.THREE.Color = class {};
  s.context.THREE.AnimationMixer = class { clipAction() { return { play() {} }; } update() {} };
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 10 });
  const camera = { position: { x: 0, y: 5, z: 0 }, projectionMatrix: {}, matrixWorldInverse: {}, viewRadius: 300,
    updateMatrixWorld() { Object.assign(this.matrixWorldInverse, { cameraX: this.position.x, cameraZ: this.position.z, viewRadius: this.viewRadius }); },
    getWorldDirection(v) { v.x = 1; v.y = 0; v.z = 0; } };
  unit.update({ camera, dt: 0 }); // fill all seven adult slots, leaving only the child slot free
  A[7 * 16] = A[8 * 16] = 1;
  A[7 * 16 + 12] = 10; // this adult ranks before the child, but has no compatible free slot
  A[8 * 16 + 12] = 20;
  for (let i = 0; i < 12; i++) unit.update({ camera, dt: 0 }); // next ownership pass
  const assignedChild = s.context.__npcDiagnostics.snapshot()[8];
  assert.equal(assignedChild.renderRepresentation, 'npc3d-full');
  assert.equal(s.context.poolKinds(10)[assignedChild.poolSlot], 'kid');
  unit.dispose();
});

test('QA diagnostics expose crowd identity, representation, slot and ownership events only when requested', async () => {
  const mesh = { name: 'fixture', isMesh: true, material: { dispose() {} } };
  const root = () => ({ children: [], traverse(fn) { fn(mesh); }, getObjectByProperty() { return { material: { map: true } }; },
    scale: { set() {} }, position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {} });
  const s = setup(Promise.resolve({ scene: root(), animations: [{ name: 'NPC_Walk', duration: 1 }] }), '?qa=1');
  const A = new Float32Array(16), I = new Float32Array(4);
  A[0] = 1;
  s.crowd.instanceMatrix.array = A; s.crowd.geometry.attributes.aInfo.array = I;
  s.context.crowdPlan = () => [{ look: { kind: 'man', speed: 1, height: 1.8 }, path: { type: 'loop', name: 'masp', dir: 1 }, s0: 0 }];
  s.context.SkeletonUtils.clone = root;
  s.context.THREE.Color = class {};
  s.context.THREE.AnimationMixer = class { clipAction() { return { play() {} }; } update() {} };
  const added = []; s.scene.add = (o) => added.push(o);
  const unit = await s.create(s.scene, { stops: [{ id: 'move' }, { id: 'glasgow' }], pts: [{ x: 0 }, { x: 100 }, { x: 200 }], count: 1 });
  const camera = { position: { x: 0, y: 5, z: 0 }, projectionMatrix: {}, matrixWorldInverse: {}, viewRadius: 250,
    updateMatrixWorld() { Object.assign(this.matrixWorldInverse, { cameraX: this.position.x, cameraZ: this.position.z, viewRadius: this.viewRadius }); },
    getWorldDirection(v) { v.x = 1; v.y = 0; v.z = 0; } };
  unit.update({ camera, dt: 0.016 });
  const diagnostic = s.context.__npcDiagnostics;
  assert.equal(typeof diagnostic.snapshot, 'function');
  assert.equal(typeof diagnostic.events, 'function');
  const npc = diagnostic.snapshot()[0];
  assert.equal(npc.id, 0);
  assert.equal(npc.region, 'sao-paulo');
  assert.equal(npc.path.name, 'masp');
  assert.equal(npc.renderRepresentation, 'npc3d-full');
  assert.equal(npc.poolSlot, 0);
  assert.equal(npc.visibility.rendered, true);
  assert.equal(diagnostic.events()[0].type, 'spawn');
  unit.dispose();
  assert.equal(s.context.__npcDiagnostics, undefined, 'disposing the 3D pool removes its QA hook');
});
