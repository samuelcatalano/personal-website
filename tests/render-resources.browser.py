# Desktop only. Run with the local preview open: browser-harness < tests/render-resources.browser.py
assert page_info()['url'].startswith('http://localhost:'), 'Open the local preview first'
assert js('innerWidth >= 1100'), 'Use a desktop viewport (at least 1100px)'
expression = r'''(async () => {
  const T = await import('three');
  const { createPost } = await import('./js/world/post.js');
  const { createLandmarkEnv } = await import('./js/world/landmark-env.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const renderer = new T.WebGLRenderer({ canvas: document.createElement('canvas') });
  renderer.setSize(64, 64, false);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, .1, 100);
  camera.position.set(0, 1, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const geometry = new T.BoxGeometry(), material = new T.MeshBasicMaterial({ color: 0xdddddd });
  scene.add(new T.Mesh(geometry, material));
  const oldFromScene = T.PMREMGenerator.prototype.fromScene, targets = [];
  T.PMREMGenerator.prototype.fromScene = function (...args) {
    const target = oldFromScene.apply(this, args), record = { target, disposed: 0 };
    target.addEventListener('dispose', () => { record.disposed++; });
    targets.push(record); return target;
  };
  let env;
  try { env = createLandmarkEnv(renderer); }
  finally { T.PMREMGenerator.prototype.fromScene = oldFromScene; }
  try {
    check(targets.length === 2, 'day and night environment targets exist');
    check(targets.every(r => r.disposed === 0), 'environment targets remain live until teardown');
    env.dispose(); env.dispose();
    check(targets.every(r => r.disposed === 1), 'environment targets dispose exactly once');
    const tiers = [];
    for (const tier of ['high', 'medium']) {
      const post = createPost(renderer, scene, camera, { tier });
      post.render(1 / 60);
      check(renderer.getContext().getError() === 0, `${tier}: no WebGL error after rendering`);
      const original = T.WebGLRenderTarget.prototype.dispose, calls = new Map();
      T.WebGLRenderTarget.prototype.dispose = function () {
        calls.set(this, (calls.get(this) ?? 0) + 1);
        return original.call(this);
      };
      try { post.dispose(); post.dispose(); }
      finally { T.WebGLRenderTarget.prototype.dispose = original; }
      check(calls.size >= 2, `${tier}: render targets released`);
      check([...calls.values()].every(n => n === 1), `${tier}: targets released once`);
      const samples = [...calls.keys()].filter(target => target.samples > 0).map(target => target.samples);
      const expected = tier === 'high' ? 4 : matchMedia('(min-width: 768px)').matches ? 2 : 0;
      check(expected ? samples.length >= 2 && samples.every(n => n === expected) : samples.length === 0, `${tier}: wrong multisampling for viewport`);
      tiers.push({ tier, samples: expected, targetsDisposed: calls.size });
    }
    check(renderer.getContext().getError() === 0, 'no WebGL error after teardown');
    return { pass: true, environmentTargets: targets.length, tiers };
  } finally {
    env.dispose(); geometry.dispose(); material.dispose(); renderer.dispose();
  }
})()'''
try:
    for width in [1280, 375]:
        cdp('Emulation.setDeviceMetricsOverride', width=width, height=800, deviceScaleFactor=1, mobile=width == 375)
        reply = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=60)
        assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
        result = reply['result'].get('value')
        assert result and result.get('pass'), result
        print(dict(width=width, **result))
finally:
    cdp('Emulation.clearDeviceMetricsOverride')
