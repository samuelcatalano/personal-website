# With a local preview open: browser-harness < tests/city-depth.browser.py
assert page_info()['url'].startswith('http://localhost:')
reply = cdp('Runtime.evaluate', expression=r'''(async () => {
  const T = await import('three');
  const { createSky } = await import('./js/world/sky.js');
  const { createSkyline } = await import('./js/world/skyline.js');
  const { createMood } = await import('./js/world/mood.js');
  const { createWeather } = await import('./js/world/weather.js');
  const { stops } = await import('./js/content.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const scene = new T.Scene(); scene.fog = new T.Fog(0, 1, 1000);
  const hemi = new T.HemisphereLight(), sun = new T.DirectionalLight(); scene.add(hemi, sun);
  const camera = new T.PerspectiveCamera(40, 1.6, 1, 1400);
  camera.position.set(0, 20, 60); camera.lookAt(0, 12, 0); camera.updateMatrixWorld();
  const sky = createSky(scene, { hemi, sun, reducedMotion: true });
  const skyline = createSkyline([0, 1, 2].map(r => ({ x: (r - 1) * 20, y: 0, z: -r * 40, w: 12, h: 30, d: 10, color: `sky${r}t` })));
  scene.add(skyline);
  const renderer = new T.WebGLRenderer(); renderer.setSize(160, 100);
  const samples = [];
  try {
    for (const weather of ['clear', 'rain']) {
      const mood = createMood(stops, { weather: createWeather({ override: weather }) })(.5);
      for (const night of [0, .5, 1]) {
        sky.update(night, 0, camera.position, camera, mood);
        skyline.userData.update(night, scene.fog.color);
        check(scene.fog.near > 0 && scene.fog.near < scene.fog.far, 'Invalid fog range');
        check(scene.fog.near / mood.fogK <= 160, 'Atmosphere still starts behind the middle distance');
        check(hemi.intensity >= .68 || night < 1, 'Night fill loses nearby detail');
        for (const row of skyline.children) {
          check(row.material.userData.horizon?.value.equals(scene.fog.color), 'Skyline does not follow the live horizon');
          check(row.material.fog === false, 'Skyline is washed out by a second fog application');
        }
        renderer.render(scene, camera);
        check(renderer.getContext().getError() === 0, 'Atmosphere caused a WebGL error');
        check(renderer.info.programs.every(p => p.diagnostics?.runnable !== false), 'Atmosphere shader failed');
        samples.push({ weather, night, fog: [scene.fog.near, scene.fog.far], calls: renderer.info.render.calls });
      }
    }
    check(skyline.children.length === 3 && skyline.children.every(m => m.isInstancedMesh), 'Skyline lost its three shared row batches');
    return { pass: true, samples };
  } finally {
    sky.dispose();
    skyline.children[0].geometry.dispose(); skyline.children.forEach(row => row.material.dispose());
    renderer.dispose();
  }
})()''', returnByValue=True, awaitPromise=True)
assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
result = reply['result'].get('value')
assert result and result.get('pass'), result
print(result)
