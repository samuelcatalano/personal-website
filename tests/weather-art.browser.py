# Real pixels and resource sharing; run with a local preview open.
reply = cdp('Runtime.evaluate', expression=r'''(async () => {
  const T = await import('three');
  const { createSky } = await import('./js/world/sky.js');
  const { createRain } = await import('./js/world/rain.js');
  const { createWeatherCover } = await import('./js/world/weather-cover.js');
  const { createMood } = await import('./js/world/mood.js');
  const { createWeather } = await import('./js/world/weather.js');
  const { stops } = await import('./js/content.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const scene = new T.Scene(); scene.fog = new T.Fog(0, 1, 1000);
  const hemi = new T.HemisphereLight(), sun = new T.DirectionalLight(); scene.add(hemi, sun);
  const camera = new T.PerspectiveCamera(40, 1.6, 1, 1400); camera.position.set(10, 20, 30); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const sky = createSky(scene, { hemi, sun, reducedMotion: true });
  const mood = createMood(stops, { weather: createWeather({ override: 'clear' }) })(.5);
  sky.setViewport(1280, 800, 68); sky.update(0, 0, camera.position, camera, mood);
  const sunDisc = scene.getObjectByName('weather-sun'), moon = scene.getObjectByName('weather-moon'), clouds = scene.getObjectByName('weather-clouds');
  check(sunDisc.geometry.parameters.width === 100 && moon.geometry.parameters.width === 64, 'Astros lost their intended scale');
  const pixels = moon.material.map.image.getContext('2d').getImageData(0, 0, 256, 256).data;
  check(pixels[(128 * 256 + 208) * 4] > pixels[(128 * 256 + 48) * 4] * 3, 'Moon texture lost its phase');
  for (const [width, height, bar, fov] of [[1280, 800, 68, 40], [375, 812, 174, 65]]) {
    camera.aspect = width / height; camera.fov = fov; camera.updateProjectionMatrix(); sky.setViewport(width, height, bar); sky.update(0, 0, camera.position, camera, mood);
    for (const object of [sunDisc, moon]) {
      const top = new T.Vector3(0, object.geometry.parameters.height / 2, 0).applyQuaternion(object.quaternion).add(object.position).project(camera);
      check((1 - top.y) * height / 2 > bar, 'Astro intersects header');
    }
    check(sky.sunDir.y > .25 && Math.abs(sky.sunDir.length() - 1) < 1e-6, 'Key points below ground');
  }
  camera.aspect = 1.6; camera.fov = 40; camera.updateProjectionMatrix(); sky.setViewport(1280, 800, 68); sky.update(0, 0, camera.position, camera, mood);
  const renderer = new T.WebGLRenderer(), target = new T.WebGLRenderTarget(256, 160), pixel = new Uint8Array(4);
  renderer.setSize(256, 160); renderer.setRenderTarget(target);
  const readSun = () => {
    renderer.render(scene, camera);
    const p = sunDisc.position.clone().project(camera);
    renderer.readRenderTargetPixels(target, Math.floor((p.x + 1) * 128), Math.floor((p.y + 1) * 80), 1, 1, pixel);
    return pixel[0] + pixel[1] + pixel[2];
  };
  const cover = createWeatherCover([{ x: 0, z: 0, hx: 500, hz: 500, height: 100 }]);
  let rain;
  try {
    clouds.children.forEach(c => { c.visible = false; });
    const clear = readSun(), cloud = clouds.children.find(c => !c.userData.high);
    cloud.visible = true; cloud.position.copy(sunDisc.position); cloud.quaternion.copy(sunDisc.quaternion); cloud.scale.set(150, 150, 1);
    for (const key of ['uTop', 'uBase', 'uRim']) cloud.material.uniforms[key].value.set(0);
    cloud.material.uniforms.uFade.value = cloud.material.uniforms.uOp.value = 1;
    const blocked = readSun();
    cloud.position.add(new T.Vector3(250, 0, 0).applyQuaternion(camera.quaternion));
    const uncovered = readSun();
    check(clear > 100 && blocked < clear * .35 && uncovered > clear * .9, 'Cloud alpha does not locally occlude the sun');
    const rainScene = new T.Scene(); rainScene.background = new T.Color(0);
    rain = createRain(rainScene, { cover });
    rain.update(5, camera, { rain: 1, fall: 1.4, wind: 1, storm: 0 }, 0, 'high');
    const mesh = rainScene.getObjectByName('weather-rain');
    check(mesh.material.uniforms.uWeatherCover.value === cover.uniforms.uWeatherCover.value, 'Rain clones the cover texture');
    const image = new Uint8Array(256 * 160 * 4);
    const brightness = () => { renderer.render(rainScene, camera); renderer.readRenderTargetPixels(target, 0, 0, 256, 160, image); return image.reduce((sum, value, i) => sum + (i % 4 === 3 ? 0 : value), 0); };
    cover.uniforms.uWeatherCoverOn.value = 0; const exposed = brightness();
    cover.uniforms.uWeatherCoverOn.value = 1; const sheltered = brightness();
    check(exposed > 0 && sheltered < exposed * .05, 'Rain remains visible beneath the roof envelope');
    rain.update(5.016, camera, { rain: .24, fall: .52, wind: .55, storm: 0 }, 1, 'medium');
    check(mesh.geometry.drawRange.count < 450 * 6, 'Drizzle keeps heavy-rain density');
    check(renderer.info.programs.every(p => p.diagnostics?.runnable !== false) && renderer.getContext().getError() === 0, 'Weather shader failed');
    let disposed = 0; cover.uniforms.uWeatherCover.value.addEventListener('dispose', () => disposed++);
    cover.dispose(); cover.dispose(); check(disposed === 1, 'Cover texture disposed twice');
    return { pass: true, sun: { clear, blocked, uncovered }, rain: { exposed, sheltered }, coverBytes: cover.field.data.byteLength };
  } finally { rain?.dispose(); cover.dispose(); sky.dispose(); target.dispose(); renderer.dispose(); }
})()''', returnByValue=True, awaitPromise=True, _response_timeout=60)
assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
result = reply['result'].get('value')
assert result and result.get('pass'), result
print(result)
