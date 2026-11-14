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
      const nativeFetch = window.fetch, loadTexture = T.TextureLoader.prototype.load;
      let release, held = false, atlasLoads = 0, settled = false;
      T.TextureLoader.prototype.load = function(url, ...args) {
        if (/\/vegetation\/.*\.(png|jpe?g|webp)(?:[?#]|$)/i.test(String(url))) atlasLoads++;
        return loadTexture.call(this, url, ...args);
      };
      window.fetch = (input, ...args) => {
        const url = String(input?.url ?? input);
        if (!url.includes('/vegetation/botanical-trees.glb')) return nativeFetch(input, ...args);
        held = true;
        return new Promise((resolve, reject) => { release = () => nativeFetch(input, ...args).then(resolve, reject); });
      };
      const errors = [], onReject = event => errors.push(String(event.reason));
      addEventListener('unhandledrejection', onReject);
      const placements = Array.from({length: 40}, (_, i) => ({x: i * 11, z: i % 3 * 8, h: 4, crown: 3, base: .1}));
      const pending = createAuthoredTrees(placements);
      pending.then(() => { settled = true; }, () => { settled = true; });
      let group;
      try {
        const deadline = performance.now() + 10000;
        while (!held && performance.now() < deadline) await new Promise(r => setTimeout(r, 25));
        check(held && !settled, 'botanical GLB request gates forest assembly');
        check(atlasLoads === 0 && !performance.getEntriesByType('resource').some(e => /\/vegetation\/.*\.(png|jpe?g|webp)(?:[?#]|$)/i.test(e.name)), 'held forest requests no external tree atlas');
        release(); release = null;
        group = await pending;
        check(group.name === 'trees' && group.userData.renderer === 'botanical' && group.userData.batches.length > 0, 'released GLB assembles authored forest');
        check(group.userData.batches.every(b => b.lods.length === 2) && group.userData.batches.reduce((n,b) => n + b.lods[0].count, 0) === placements.length, 'full forest retains every placement in two physical levels');
        check(atlasLoads === 0 && !errors.length, 'GLB-only loading has no atlas or unhandled rejection');
        return { pass: true, glbOnly: true, externalAtlasLoads: atlasLoads, chunks: group.userData.batches.length, trees: placements.length };
      } finally {
        window.fetch = nativeFetch;
        release?.();
        if (!group) group = await pending.catch(() => null);
        group?.userData.dispose(); renderer.dispose();
        T.TextureLoader.prototype.load = loadTexture;
        removeEventListener('unhandledrejection', onReject);
      }
    })()'''))

    print(evaluate(r'''(async () => {
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const T = await import('three'), { createAuthoredTrees } = await import('/js/world/authored-trees.js'), { createTrees } = await import('/js/world/trees.js');
      const nativeFetch = window.fetch, loadTexture = T.TextureLoader.prototype.load;
      let atlasLoads = 0, failedRequests = 0, fallback, group;
      T.TextureLoader.prototype.load = function(url, ...args) {
        if (/\/vegetation\/.*\.(png|jpe?g|webp)(?:[?#]|$)/i.test(String(url))) atlasLoads++;
        return loadTexture.call(this, url, ...args);
      };
      const errors = [], onReject = event => errors.push(String(event.reason));
      addEventListener('unhandledrejection', onReject);
      const placements = [{ x: 0, z: 0, h: 4, crown: 3, base: .1 }];
      try {
        window.fetch = (input, ...args) => {
          if (!String(input?.url ?? input).includes('/vegetation/botanical-trees.glb')) return nativeFetch(input, ...args);
          failedRequests++; return Promise.resolve(new Response('', { status: 503 }));
        };
        let rejection;
        await createAuthoredTrees(placements).catch(error => { rejection = error; });
        check(rejection && /503/.test(String(rejection)), 'failed botanical GLB rejects with HTTP failure');
        fallback = await createTrees(placements);
        check(failedRequests === 2 && fallback.name === 'trees' && fallback.userData.renderer !== 'botanical' && fallback.userData.batches.length > 0 && fallback.userData.batches.every(b => b.lods.length === 3), 'createTrees preserves procedural fallback after GLB failure');
        fallback.userData.dispose(); fallback = null;
        window.fetch = nativeFetch;
        group = await createAuthoredTrees(placements);
        const resources = new Set();
        group.traverse(mesh => {
          if (!mesh.isMesh) return;
          resources.add(mesh.geometry);
          for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
            resources.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
          }
        });
        const disposals = new Map();
        for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) || 0) + 1));
        group.userData.dispose(); group.userData.dispose();
        check(resources.size > 0 && [...resources].every(resource => disposals.get(resource) === 1), 'successful forest disposes shared geometry/materials/embedded maps exactly once');
        await new Promise(r => setTimeout(r, 0));
        check(atlasLoads === 0 && !errors.length, 'failure, fallback and disposal allocate no external atlas or unhandled rejection');
        return { pass: true, failedRequests, proceduralFallback: true, externalAtlasLoads: atlasLoads, disposedResources: resources.size, idempotent: true };
      } finally {
        window.fetch = nativeFetch;
        T.TextureLoader.prototype.load = loadTexture;
        fallback?.userData.dispose(); group?.userData.dispose();
        removeEventListener('unhandledrejection', onReject);
      }
    })()'''))
finally:
    cdp('Target.closeTarget', targetId=tab if isinstance(tab, str) else tab.get('targetId', tab))
