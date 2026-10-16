# With the local preview open in browser-harness:
# browser-harness < tests/world.browser.py
# Exercises the real Three.js scene; no test dependencies or product hooks.
assert page_info()['url'].startswith('http://localhost:'), 'Open the local preview first'
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
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const progress = [];
  const canvas = document.createElement('canvas');
  const world = await createWorld(canvas, stops, { reducedMotion: true, onProgress: p => progress.push(p) });
  try {
    world.setProgress(.6);
    world.setTheme('day');
    await nextFrame();
    check(progress.length === 1 && progress[0] === .6, 'First frame must use the actual stop');
    await new Promise(resolve => setTimeout(resolve, 200));
    check(progress.length === 1, 'Reduced motion must not render idle frames');
    world.setProgress(1);
    await nextFrame();
    check(progress.length === 2 && progress[1] === 1, 'Scroll must wake the static scene');
    world.setTheme('night');
    await nextFrame();
    check(progress.length === 3, 'Theme change must wake the static scene');
    dispatchEvent(new Event('resize'));
    await nextFrame();
    check(progress.length === 4, 'Resize must wake the static scene');
    document.dispatchEvent(new Event('visibilitychange'));
    await nextFrame();
    check(progress.length === 5, 'Document visibility must wake the scene');
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
