# With the local preview open in browser-harness:
# browser-harness < tests/world.browser.py
# Exercises the real Three.js scene; no test dependencies or product hooks.
assert page_info()['url'].startswith('http://localhost:'), 'Open the local preview first'
try:
    cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=2, mobile=False)
    print(js("""(async () => {
  const { createWorld } = await import('./js/world/scene.js');
  const { stops } = await import('./js/content.js');
  window.__renderCanvas = document.createElement('canvas');
  window.__renderWorld = await createWorld(window.__renderCanvas, stops, { reducedMotion: true });
  const waitForBuffer = async (width, height, bufferWidth, bufferHeight) => {
    const deadline = performance.now() + 2500;
    let state;
    do {
      state = { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, buffer: [__renderCanvas.width, __renderCanvas.height], expected: [bufferWidth, bufferHeight], hidden: document.hidden };
      if (state.viewport[0] === width && state.viewport[1] === height && state.buffer[0] === bufferWidth && state.buffer[1] === bufferHeight) return state.buffer;
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (performance.now() < deadline);
    throw Error(`Resize did not settle: ${JSON.stringify(state)}`);
  };
  window.__waitForBuffer = waitForBuffer;
  return { desktopBuffer: await waitForBuffer(1440, 900, 2160, 1350) };
})()"""))
    cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=3, mobile=True)
    print(js("""(async () => ({ mobileBuffer: await __waitForBuffer(375, 812, 375, 812) }))()"""))
    cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=2, mobile=False)
    print(js("""(async () => ({ restoredDesktopBuffer: await __waitForBuffer(1440, 900, 2160, 1350) }))()"""))
finally:
    js("window.__renderWorld?.dispose(); delete window.__renderWorld; delete window.__renderCanvas; delete window.__waitForBuffer")
    cdp('Emulation.clearDeviceMetricsOverride')
print(js("""(async () => {
  const THREE = await import('three');
  const { createSigns } = await import('./js/world/signs.js');
  const { routePoints } = await import('./js/world/layout.js');
  const { stops } = await import('./js/content.js');
  const pts = routePoints(stops.length);
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z)));
  const scene = new THREE.Scene();
  const signs = await createSigns(scene, { stops, curve });
  const year = scene.children.find(o => o.isSprite);
  const boundary = (stops.length - 1.5) / (stops.length - 1), epsilon = 1e-6, bus = { x: 0, y: 0, z: 0 };
  const at = (progress, active) => {
    signs.update({ progress, active, bus });
    return year.position.toArray();
  };
  const before = at(boundary - epsilon, stops.length - 2), after = at(boundary + epsilon, stops.length - 1);
  const distance = Math.hypot(...before.map((v, i) => v - after[i]));
  if (!Number.isFinite(distance) || distance > 0.01) throw Error(`Year sign jumps ${distance} at the active-stop boundary`);
  scene.traverse(o => {
    o.geometry?.dispose();
    for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
      material?.map?.dispose(); material?.dispose();
    }
  });
  return { signBoundaryPositionDelta: distance };
})()"""))
cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)
try:
    print(js("""(async () => {
  const previous = scrollY;
  try {
    scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 700));
    const target = (document.documentElement.scrollHeight - innerHeight) * 8 / 15;
    scrollTo(0, target);
    await new Promise(resolve => setTimeout(resolve, 700));
    const panel = document.querySelector('#panel').getBoundingClientRect();
    const active = document.querySelector('.on button')?.getBoundingClientRect();
    if (!active || active.top < panel.top || active.bottom > panel.bottom) throw Error('Active career row must remain visible');
    if (Math.abs(scrollY - target) > 1) throw Error('Revealing the row must not move the page');
    return { activeRowVisible: true, pageScrollStable: true };
  } finally {
    scrollTo(0, previous);
  }
})()"""))
finally:
    cdp('Emulation.clearDeviceMetricsOverride')
print(js("""(async () => {
  const { createWorld } = await import('./js/world/scene.js');
  const { stops } = await import('./js/content.js');
  const nextFrame = () => Promise.race([
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    new Promise((_, reject) => setTimeout(() => reject(Error('Timed out waiting for animation frame')), 2000)),
  ]);
  const waitForIdle = async progress => {
    let previous = progress.length, stable = 0;
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      stable = progress.length === previous ? stable + 1 : 0;
      if (stable === 10) return;
      previous = progress.length;
    }
    throw Error('Reduced-motion scene did not settle after async assets loaded');
  };
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const progress = [];
  const canvas = document.createElement('canvas');
  await document.fonts.ready;
  const world = await createWorld(canvas, stops, { reducedMotion: true, onProgress: p => progress.push(p) });
  try {
    await nextFrame();
    await waitForIdle(progress);
    progress.length = 0;
    world.setProgress(.6);
    world.setTheme('day');
    await nextFrame();
    await new Promise(resolve => setTimeout(resolve, 200));
    check(progress.at(-1) === .6, 'First frame must use the actual stop');
    const settledFrames = progress.length;
    await new Promise(resolve => setTimeout(resolve, 200));
    check(progress.length === settledFrames, `Reduced motion continued rendering while idle (${settledFrames} to ${progress.length})`);
    world.setProgress(1);
    await nextFrame();
    check(progress.at(-1) === 1, 'Scroll must wake the static scene');
    const afterScroll = progress.length;
    world.setTheme('night');
    await nextFrame();
    check(progress.length > afterScroll, 'Theme change must wake the static scene');
    const afterTheme = progress.length;
    dispatchEvent(new Event('resize'));
    await nextFrame();
    check(progress.length > afterTheme, 'Resize must wake the static scene');
    const afterResize = progress.length;
    document.dispatchEvent(new Event('visibilitychange'));
    await nextFrame();
    check(progress.length > afterResize, 'Document visibility must wake the scene');
  } finally {
    world.dispose();
  }
  const count = progress.length;
  dispatchEvent(new Event('resize'));
  await nextFrame();
  check(progress.length === count, 'Disposed world must stop receiving events');

  const moving = [];
  const animated = await createWorld(document.createElement('canvas'), stops, { onProgress: p => moving.push(p) });
  try {
    animated.setProgress(0);
    animated.setTheme('day');
    await nextFrame();
    animated.setProgress(1);
    await nextFrame();
    check(moving.at(-1) > 0 && moving.at(-1) < 1, 'Progress notification must follow the smoothed position');
    animated.setProgress(0);
    await new Promise(resolve => setTimeout(resolve, 1100));
    check(Number.isFinite(moving.at(-1)) && moving.at(-1) >= 0 && moving.at(-1) <= 1, 'Reversed progress must stay finite and in range');
    check(moving.at(-1) < 0.01, 'Reversed progress must converge to the new target');
    animated.setProgress(1);
    await new Promise(resolve => setTimeout(resolve, 1000));
    check(moving.at(-1) > .99, 'Camera must catch up after a navigation jump');
    animated.jump(.4);
    await nextFrame();
    check(Math.abs(moving.at(-1) - .4) < 1e-9, 'Deep-link jump must not fly in from the previous stop');
    return { pass: true, staticFrames: count, idleFrames: 0, animatedFrames: moving.length };
  } finally {
    animated.dispose();
  }
})()"""))
