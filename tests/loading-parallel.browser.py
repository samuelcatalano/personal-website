# browser-harness < tests/loading-parallel.browser.py
import os

base = os.environ.get('URL', 'http://localhost:8000/').rstrip('/')
tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Network.enable')
cdp('Network.setBypassServiceWorker', bypass=True)
cdp('Network.setCacheDisabled', cacheDisabled=True)

def evaluate(expression):
    reply = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=120)
    assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
    return reply['result'].get('value')

try:
    # Separate documents keep the singleton decoder's successful and failed initialization isolated.
    for fail in [True, False]:
        goto_url(base + '/tests/fixtures/npc-stage.html?loading-parallel=' + ('blocked' if fail else 'worker'))
        wait_for_load()
        print(evaluate(r'''(async () => {
          const check = (ok, message) => { if (!ok) throw Error(message); };
          const { initGlbLoader } = await import('/js/world/glb-loader.js');
          const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
          const NativeWorker = window.Worker;
          let workers = 0, tasks = 0, attempts = 0;
          const failures = [], useWorkers = MeshoptDecoder.useWorkers;
          MeshoptDecoder.useWorkers = (...args) => {
            attempts++;
            try { return useWorkers(...args); }
            catch (error) { failures.push(String(error)); throw error; }
          };
          window.Worker = class extends NativeWorker {
            constructor(...args) {
              if (FAIL) throw Error('blocked worker constructor');
              super(...args); workers++;
              const post = this.postMessage.bind(this);
              this.postMessage = (...values) => { tasks++; return post(...values); };
            }
          };
          try { initGlbLoader({}); initGlbLoader({}); }
          finally { window.Worker = NativeWorker; MeshoptDecoder.useWorkers = useWorkers; }
          const buffer = await (await fetch('/assets/processed/vegetation/realistic-tree.glb')).arrayBuffer();
          const view = new DataView(buffer), jsonLength = view.getUint32(12, true);
          const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
          const ext = doc.bufferViews.find(v => v.extensions?.EXT_meshopt_compression).extensions.EXT_meshopt_compression;
          const source = new Uint8Array(buffer, 28 + jsonLength + (ext.byteOffset || 0), ext.byteLength);
          await MeshoptDecoder.ready;
          const expected = new Uint8Array(ext.count * ext.byteStride);
          MeshoptDecoder.decodeGltfBuffer(expected, ext.count, ext.byteStride, source, ext.mode, ext.filter);
          const actual = await MeshoptDecoder.decodeGltfBufferAsync(ext.count, ext.byteStride, source, ext.mode, ext.filter);
          check(actual.length === expected.length && actual.every((value, i) => value === expected[i]), 'worker/fallback decode preserves exact geometry bytes');
          check(attempts === 1 && (FAIL ? workers === 0 && tasks === 0 : workers === 1 && tasks > 0), `one shared worker initializes once and blocked workers fall back: ${JSON.stringify({ attempts, workers, tasks, failures })}`);
          return { pass: true, blockedWorker: FAIL, workers, tasks, decodedBytes: actual.length };
        })()'''.replace('FAIL', 'true' if fail else 'false')))

    goto_url(base + '/tests/fixtures/npc-stage.html?loading-parallel=trees')
    wait_for_load()
    print(evaluate(r'''(async () => {
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const T = await import('three'), { initGlbLoader } = await import('/js/world/glb-loader.js');
      const renderer = new T.WebGLRenderer(); initGlbLoader(renderer);
      const { createAuthoredTrees } = await import('/js/world/authored-trees.js');
      const nativeFetch = window.fetch;
      let release, held = false;
      window.fetch = (input, ...args) => {
        const url = String(input?.url ?? input);
        if (!url.includes('/vegetation/realistic-tree.glb')) return nativeFetch(input, ...args);
        held = true;
        return new Promise((resolve, reject) => { release = () => nativeFetch(input, ...args).then(resolve, reject); });
      };
      const errors = [], onReject = event => errors.push(String(event.reason));
      addEventListener('unhandledrejection', onReject);
      const pending = createAuthoredTrees([{ x: 0, z: 0, h: 4, crown: 3, base: .1 }]);
      pending.catch(() => {});
      let group;
      try {
        const deadline = performance.now() + 10000;
        while (performance.now() < deadline && !performance.getEntriesByType('resource').some(e => e.name.includes('/vegetation/tree-impostors.png'))) await new Promise(r => setTimeout(r, 25));
        check(held && performance.getEntriesByType('resource').some(e => e.name.includes('/vegetation/tree-impostors.png')), 'tree atlas finishes while GLB request is held');
        release(); release = null;
        group = await pending;
        check(group.name === 'trees' && group.userData.batches.length > 0, 'parallel assets assemble full authored trees');
        check(!errors.length, 'parallel loading has no unhandled rejection');
        return { pass: true, parallelTreeAtlas: true, chunks: group.userData.batches.length };
      } finally {
        window.fetch = nativeFetch;
        release?.();
        if (!group) group = await pending.catch(() => null);
        group?.userData.dispose(); renderer.dispose();
        removeEventListener('unhandledrejection', onReject);
      }
    })()'''))

    print(evaluate(r'''(async () => {
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const T = await import('three'), { createAuthoredTrees } = await import('/js/world/authored-trees.js');
      const nativeFetch = window.fetch, loadTexture = T.TextureLoader.prototype.loadAsync, disposeGeometry = T.BufferGeometry.prototype.dispose;
      let atlasDisposals = 0, rootDisposals = 0, atlasLoads = 0, failAtlas = false;
      T.TextureLoader.prototype.loadAsync = async function(url, ...args) {
        if (!String(url).includes('/vegetation/tree-impostors.png')) return loadTexture.call(this, url, ...args);
        atlasLoads++;
        if (failAtlas) throw Error('atlas unavailable');
        const texture = await loadTexture.call(this, url, ...args);
        texture.addEventListener('dispose', () => atlasDisposals++);
        return texture;
      };
      T.BufferGeometry.prototype.dispose = function() { rootDisposals++; return disposeGeometry.call(this); };
      const placements = [{ x: 0, z: 0, h: 4, crown: 3, base: .1 }];
      try {
        window.fetch = (input, ...args) => String(input?.url ?? input).includes('/vegetation/realistic-tree.glb') ? Promise.resolve(new Response('', { status: 503 })) : nativeFetch(input, ...args);
        let rejected = false;
        await createAuthoredTrees(placements).catch(() => { rejected = true; });
        check(rejected && atlasLoads === 1 && atlasDisposals === 1, 'failed GLB disposes concurrently loaded tree atlas');
        window.fetch = nativeFetch; failAtlas = true; rootDisposals = 0;
        rejected = false;
        await createAuthoredTrees(placements).catch(() => { rejected = true; });
        check(rejected && rootDisposals > 0, 'failed atlas disposes successfully decoded tree roots');
        return { pass: true, failedGlbAtlasDisposals: atlasDisposals, failedAtlasRootDisposals: rootDisposals };
      } finally {
        window.fetch = nativeFetch;
        T.TextureLoader.prototype.loadAsync = loadTexture;
        T.BufferGeometry.prototype.dispose = disposeGeometry;
      }
    })()'''))
finally:
    cdp('Target.closeTarget', targetId=tab if isinstance(tab, str) else tab.get('targetId', tab))
