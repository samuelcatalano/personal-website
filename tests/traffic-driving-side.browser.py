# Run through browser-harness with the local preview open (desktop only).
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
  const THREE = await import('three');
  const { createAmbient } = await import('./js/world/ambient.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve, swapTunnelFrame, SWAP_TUNNEL } = await import('./js/world/layout.js');
  const pts = routePoints(stops.length), curve = routeCurve(THREE, pts), scene = new THREE.Scene();
  const ambient = createAmbient(scene, { curve, pts, stops });
  await ambient.ready;
  const bridge = scene.children.filter(o => o.userData.length).slice(-4);
  const samples = Array.from({ length: 4001 }, (_, i) => curve.getPointAt(i / 4000));
  const frame = swapTunnelFrame(curve, stops);
  let ukSamples = 0, brSamples = 0;
  try {
    for (let k = 0; k < 3000; k++) {
      ambient.update({ time: k * 0.1, t: frame.t, dt: 0.1 });
      if (k % 30) continue;
      for (const car of bridge) {
        if (!car.visible) continue;
        let nearest = 0;
        for (let i = 1; i < samples.length; i++) if (car.position.distanceToSquared(samples[i]) < car.position.distanceToSquared(samples[nearest])) nearest = i;
        const p = samples[nearest], t = nearest / 4000, s = (t - frame.t) * frame.speed;
        if (car.position.distanceTo(p) > 2.2 || Math.abs(s) < SWAP_TUNNEL.half + SWAP_TUNNEL.ramp) continue;
        const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(car.quaternion);
        const left = (car.position.x - p.x) * forward.z - (car.position.z - p.z) * forward.x;
        if (s > 0) ukSamples++; else brSamples++;
        if (left * Math.sign(s) < 1.4) throw Error(`Bridge car drives on the wrong side in ${s > 0 ? 'UK' : 'Brazil'}: ${left.toFixed(2)} m`);
      }
    }
    if (!ukSamples || !brSamples) throw Error('Must exercise bridge cars on both sides of the regional crossover');
    return { pass: true, ukSamples, brSamples };
  } finally { ambient.dispose(); }
})()'''))
