# Pure projection check using real Three.js; local preview must be open.
assert page_info()['url'].startswith('http://localhost:')
reply = cdp('Runtime.evaluate', expression=r'''(async () => {
  const T = await import('three');
  const { shotFor } = await import('./js/world/camera.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, RIVER_Z, FRAME_LIFT, copan } = await import('./js/world/layout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const camera = new T.PerspectiveCamera(40, 1280 / 800, 1, 1400);
  camera.setViewOffset(1280, 800, -222, -34, 1280, 800);
  const shots = [['hero', {}], ['follow', {}], ['follow', { lift: 1, stop: 'mira' }], ['follow', { lift: 1, stop: 'xdesign' }], ['follow', { lift: .6, stop: 'olm' }], ['follow', { stop: 'glasgow' }], ['high', {}], ['closing', {}]];
  const bounds = [];
  for (const [kind, options] of shots) {
    const shot = shotFor(kind, { x: 0, y: 0, z: 0 }, options);
    camera.position.fromArray(shot.position); camera.lookAt(...shot.target); camera.updateMatrixWorld();
    const points = [];
    for (const x of [-6.5, 6.5]) for (const y of [0, 4.5]) for (const z of [-2, 2]) {
      const p = new T.Vector3(x, y, z).project(camera);
      points.push([(p.x + 1) * 640, (1 - p.y) * 400]);
    }
    const b = { kind, stop: options.stop, left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])), top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])) };
    check(b.left > 452 && b.right < 1272 && b.top > 76 && b.bottom < 744, `${kind}/${options.stop}: vehicle clips UI or viewport: ${JSON.stringify(b)}`);
    bounds.push(b);
  }
  const points = routePoints(stops.length), towerX = points[stops.findIndex(s => s.id === 'xdesign')].x + 35.15;
  for (const stop of ['xdesign', 'olm']) {
    const bus = points[stops.findIndex(s => s.id === stop)];
    const shot = shotFor('follow', { ...bus, y: 0 }, { stop, lift: FRAME_LIFT[stop] });
    camera.position.fromArray(shot.position); camera.lookAt(...shot.target); camera.updateMatrixWorld();
    const face = new T.Vector3(towerX, 21, RIVER_Z - 14.5).project(camera);
    const x = (face.x + 1) * 640, y = (1 - face.y) * 400;
    check(x > 484 && x < 1248 && y > 100 && y < 744, `${stop}: clock face cropped at ${x},${y}`);
  }
  const site = copan(stops, points), bus = points[stops.findIndex(s => s.id === 'mira')];
  const shot = shotFor('follow', { ...bus, y: 0 }, { stop: 'mira', lift: FRAME_LIFT.mira });
  camera.position.fromArray(shot.position); camera.lookAt(...shot.target); camera.updateMatrixWorld();
  for (const dx of [-site.len / 2, site.len / 2]) for (const dz of [-site.amp - site.depth / 2, site.amp + site.depth / 2]) {
    const roof = new T.Vector3(site.x + dx, site.h, site.z + dz).project(camera);
    check((1 - roof.y) * 400 > 76, 'Copan roof clips the desktop header');
  }
  return { pass: true, bounds };
})()''', returnByValue=True, awaitPromise=True)
assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
result = reply['result'].get('value')
assert result and result.get('pass'), result
print(result)
