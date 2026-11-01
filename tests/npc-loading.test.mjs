import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup(load) {
  const crowd = { visible: true, instanceMatrix: { array: [] }, geometry: { attributes: { aInfo: { array: [] } } } }, shadow = { visible: true };
  const scene = { getObjectByName: (name) => name === 'crowd' ? crowd : shadow, add() {} };
  let deadline;
  const context = vm.createContext({ URL, URLSearchParams, location: { search: '' },
    ROAD: { padIn: 1 }, crowdPlan: () => [], GLTFLoader: class { loadAsync() { return load; } },
    SkeletonUtils: { clone: (root) => root },
    THREE: { CircleGeometry: class { rotateX() { return this; } dispose() {} }, MeshBasicMaterial: class { dispose() {} },
      InstancedMesh: class { constructor(geometry, material) { Object.assign(this, { geometry, material }); } traverse(fn) { fn(this); } }, Object3D: class {}, Vector3: class {} },
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

test('a loaded NPC pack replaces the sprites', async () => {
  const root = { children: [], traverse() {} };
  const s = setup(Promise.resolve({ scene: root, animations: [] }));
  const unit = await s.create(s.scene, { stops: [], pts: [], count: 0 });
  assert.equal(s.crowd.visible, false);
  assert.equal(s.shadow.visible, false);
  assert.equal(typeof unit.update, 'function');
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
