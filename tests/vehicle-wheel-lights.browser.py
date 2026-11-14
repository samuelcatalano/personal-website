# Wheels must stay dark without illumination; the shared body atlas still lights the headlamps.
assert page_info()['url'].startswith('http://localhost:')
print(js(r'''(async () => {
  const T = await import('three'), A = await import('/js/world/vehicle-assets.js?wheel-light-regression');
  const model = (await A.loadFleetCatalog()).find(m => m.id === 'toyota-corolla');
  const car = new T.Group(); await A.upgradeFleet(car, model); A.updateVehicleEnv(1);
  const renderer = new T.WebGLRenderer(), target = new T.WebGLRenderTarget(64, 64);
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-.4, .4, .4, -.4, .1, 10);
  const pixels = new Uint8Array(64 * 64 * 4), brightness = () => {
    renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, 64, 64, pixels);
    return pixels.reduce((max, value, i) => i % 4 === 3 ? max : Math.max(max, value), 0);
  };
  renderer.setSize(64, 64); renderer.setRenderTarget(target); renderer.setClearColor(0);
  try {
    for (const axle of car.userData.wheels) {
      const wheel = axle.clone(true); scene.add(wheel);
      camera.position.set(axle.position.x, axle.position.y, -4); camera.lookAt(axle.position.x, axle.position.y, 0);
      const max = brightness(); scene.remove(wheel);
      if (max > 1) throw Error(`Unlit wheel emits headlamp light: ${max}/255 at axle ${axle.position.x}`);
    }
    scene.add(car); camera.position.set(2.05, .64, -4); camera.lookAt(2.05, .64, 0);
    const headlamp = brightness();
    if (headlamp < 20) throw Error('Fix disabled the actual headlamps');
    if (renderer.getContext().getError()) throw Error('WebGL error');
    return {pass:true, darkAxles:car.userData.wheels.length, headlamp};
  } finally { target.dispose(); renderer.dispose(); }
})()'''))
