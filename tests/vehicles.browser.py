# With the local preview open in browser-harness:
# browser-harness < tests/vehicles.browser.py
assert page_info()['url'].startswith('http://localhost:'), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildBus } = await import('./js/world/bus.js');
  const { createAmbient } = await import('./js/world/ambient.js');
  const { stops } = await import('./js/content.js');
  const { routePoints } = await import('./js/world/layout.js');
  const { routeT } = await import('./js/scroll.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const bounds = (object) => { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object); };

  const bus = buildBus({ avatar: false }), busBox = bounds(bus), busSize = busBox.getSize(new THREE.Vector3());
  check(Math.abs(busBox.min.y) < 1e-6, 'bus wheels must rest on the road');
  check(busSize.x / busSize.y > 2.3 && busSize.x / busSize.y < 2.6, 'double-decker proportions must stay near 2.4:1');

  const pts = routePoints(stops.length);
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z)));
  const scene = new THREE.Scene(), start = scene.children.length;
  const ambient = createAmbient(scene, { curve, pts, stops });
  const traffic = scene.children.slice(start, start + 4);
  check(traffic.length === 4, 'expected the bus and three traffic vehicles');
  const fleetBusSize = bounds(traffic[0]).getSize(new THREE.Vector3());
  check(['x', 'y', 'z'].every(axis => Math.abs(fleetBusSize[axis] - busSize[axis]) < 0.001), 'ambient route bus must retain the physical bus dimensions');
  const radii = traffic.map(v => { const s = bounds(v).getSize(new THREE.Vector3()); return Math.hypot(s.x, s.z) / 2; });
  const routeSamples = Array.from({ length: 501 }, (_, i) => curve.getPointAt(i / 500));
  let updates = 0;
  for (const time of [0, 120, 600, 3600]) for (const progress of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    ambient.update({ time, progress }); updates++;
    check(traffic[2].visible && traffic[3].visible, 'reverse traffic must stay visible after modulo wrap');
    for (const v of traffic) {
      if (!v.visible) continue;
      check([v.position.x, v.position.y, v.position.z].every(Number.isFinite), 'long-time traffic positions must remain finite');
      const lateral = Math.min(...routeSamples.map(p => Math.hypot(v.position.x - p.x, v.position.z - p.z)));
      check(lateral > 1.4 && lateral < 2.1, 'traffic must remain in its assigned road lane');
    }
    for (let i = 0; i < traffic.length; i++) for (let j = i + 1; j < traffic.length; j++) {
      if (!traffic[i].visible || !traffic[j].visible) continue;
      const gap = Math.hypot(traffic[i].position.x - traffic[j].position.x, traffic[i].position.z - traffic[j].position.z);
      check(gap > radii[i] + radii[j], 'vehicle footprints must remain separated');
    }
  }
  return { pass: true, bus: [Number(busSize.x.toFixed(2)), Number(busSize.y.toFixed(2))], traffic: traffic.length, longTimeProgressSamples: updates };
})()'''))
