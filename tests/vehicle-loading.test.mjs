import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load(search = '', fail = () => false) {
  const calls = [], asset = {}, model = { id: 'honda-hr-v', path: 'assets/vehicles/honda-hr-v.glb', sha256: 'source-hash' };
  const url = new URL('../js/world/vehicle-assets.js', import.meta.url);
  const source = readFileSync(url, 'utf8').split('export function adoptVisual')[0]
    .replace(/^import .*;.*$/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', JSON.stringify(url.href));
  const context = vm.createContext({ URL, URLSearchParams, location: { search }, MeshoptDecoder: {},
    fetch: async () => ({ ok: true, json: async () => ({ models: [model] }) }),
    GLTFLoader: class {
      setMeshoptDecoder() { return this; }
      async loadAsync(url) { calls.push(new URL(url)); if (fail(url)) throw Error('unavailable'); return { scene: asset }; }
    },
  });
  vm.runInContext(source, context);
  return { calls, asset, get: context.loadVehicleAsset };
}

test('default Mini and regional fleet use full-quality compressed assets', async () => {
  const loader = load();
  assert.equal(await loader.get('mini'), loader.asset);
  assert.equal(await loader.get('honda-hr-v'), loader.asset);
  assert.ok(loader.calls.every(url => url.pathname.endsWith('.full.glb')));
  assert.ok(loader.calls.every(url => url.searchParams.has('v')), 'version compressed derivatives');
});
test('compressed failure falls back to the original full-quality source', async () => {
  const loader = load('', url => url.includes('.full.glb'));
  assert.equal(await loader.get('mini'), loader.asset);
  assert.deepEqual(loader.calls.map(url => url.pathname.split('/').pop()), ['mini-cooper-2011.full.glb', 'mini-cooper-2011.glb']);
});
test('concurrent requests share one decoded asset, and total failure stays safe', async () => {
  const loader = load();
  const [a, b] = await Promise.all([loader.get('mini'), loader.get('mini')]);
  assert.equal(a, b); assert.equal(loader.calls.length, 1);
  assert.equal(await load('', () => true).get('mini'), null);
});
test('explicit processed opt-in and authored bus path remain compatible', async () => {
  const loader = load('?glb=processed');
  await loader.get('mini'); await loader.get('bus');
  assert.ok(loader.calls[0].pathname.endsWith('mini-cooper-2011.lod0.glb'));
  assert.ok(loader.calls[1].pathname.endsWith('double-decker-bus.glb'));
});
