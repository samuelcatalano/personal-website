import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup(GLTFLoader = class {}) {
  const context = vm.createContext({ URL, GLTFLoader });
  const source = readFileSync(new URL('../js/world/reference-npc.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/^export /gm, '')
    .replaceAll('import.meta.url', "'file:///js/world/reference-npc.js'");
  vm.runInContext(source, context);
  return context;
}

test('reference LOD keeps its state across the hysteresis bands', () => {
  const { referenceLod: lod } = setup();
  assert.equal(lod(15, 0), 0);
  assert.equal(lod(15.5, 0), 1);
  assert.equal(lod(13, 1), 1);
  assert.equal(lod(12, 1), 0);
  assert.equal(lod(34, 1), 1);
  assert.equal(lod(36, 1), 2);
  assert.equal(lod(30, 2), 2);
  assert.equal(lod(28, 2), 1);
});

test('reference LOD handles a camera jump and returns from culling', () => {
  const { referenceLod: lod } = setup();
  assert.equal(lod(1000, 0), 3);
  assert.equal(lod(95, 3), 3);
  assert.equal(lod(80, 3), 2);
  assert.equal(lod(0, 3), 0);
});

test('a failed LOD load disposes the other completed resources', async () => {
  const disposed = [];
  const asset = level => ({ scene: { traverse(fn) {
    fn({ geometry: { dispose: () => disposed.push(`geometry${level}`) }, material: {
      dispose: () => disposed.push(`material${level}`), map: {
        isTexture: true, dispose: () => disposed.push(`texture${level}`),
        source: { data: { close: () => disposed.push(`image${level}`) } },
      },
    } });
  } } });
  const { loadReferenceNpcAssets } = setup(class {
    loadAsync(url) {
      const level = Number(url.match(/lod(\d)/)[1]);
      return level === 1 ? Promise.reject(new Error('failed LOD1')) : Promise.resolve(asset(level));
    }
  });
  await assert.rejects(loadReferenceNpcAssets({ levels: [0, 1, 2] }), /failed LOD1/);
  assert.deepEqual(disposed.sort(), ['geometry0', 'geometry2', 'image0', 'image2', 'material0', 'material2', 'texture0', 'texture2']);
});
