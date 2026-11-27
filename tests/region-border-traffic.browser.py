assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve, swapAt } = await import('./js/world/layout.js');
  const { createAmbient } = await import('./js/world/ambient.js?region-border-regression=' + Date.now());
  const pts = routePoints(stops.length), curve = routeCurve(THREE, pts), swap = swapAt(stops);
  const scene = new THREE.Scene(), ambient = createAmbient(scene, { curve, pts, stops });
  await ambient.ready;
  const bus = scene.getObjectByName('regional-bus'), playerT = swap + 0.008, player = curve.getPointAt(playerT);
  ambient.update({ time: 0, t: playerT, dt: 0 });
  if (!bus.visible) throw Error('regional bus should be visible before reaching the nearby border');
  let borderSwapVisible = false, closest = Infinity;
  for (let k = 1; k <= 400 && !borderSwapVisible; k++) {
    ambient.update({ time: k / 10, t: playerT, dt: 0.1 });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const distance = bus.position.distanceTo(player);
    closest = Math.min(closest, distance);
    if (distance < 30) {
      if (!bus.visible || bus.scale.x <= 0.1) throw Error(`regional bus disappeared within ${distance.toFixed(1)} m of the player`);
    }
    if (bus.userData.regionTransitions >= 1) borderSwapVisible = true;
  }
  if (!borderSwapVisible) throw Error('regional bus should complete its São Paulo model swap');
  const jumpScene = new THREE.Scene(), jumpAmbient = createAmbient(jumpScene, { curve, pts, stops });
  await jumpAmbient.ready;
  const jumpBus = jumpScene.getObjectByName('regional-bus'), jumpStart = swap + 0.012, jumpStartPoint = curve.getPointAt(jumpStart), jumpEnd = swap - 0.012;
  jumpAmbient.update({ time: 0, t: jumpStart, dt: 0 });
  let reachedPlayer = false;
  for (let k = 1; k <= 280 && !reachedPlayer; k++) {
    jumpAmbient.update({ time: k / 10, t: jumpStart, dt: 0.1 });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    reachedPlayer = jumpBus.position.distanceTo(jumpStartPoint) < 50;
  }
  if (!reachedPlayer || !jumpBus.visible) throw Error('regional bus should be visible near the route border before a navigation jump');
  jumpAmbient.update({ time: 29, t: jumpEnd, dt: 0 });
  if (!jumpBus.visible || jumpBus.scale.x <= 0.1) throw Error('navigation jumps must not remove nearby regional traffic');
  return { pass: true, borderTransitions: bus.userData.regionTransitions, closestDistance: Number(closest.toFixed(1)), visible: bus.visible, jumpVisible: jumpBus.visible, scale: Number(bus.scale.x.toFixed(2)) };
})()'''))
