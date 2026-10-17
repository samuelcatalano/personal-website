# With the local preview open in browser-harness:
# browser-harness < tests/vehicles.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildBus } = await import('./js/world/bus.js');
  const { createAmbient } = await import('./js/world/ambient.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const { routeT } = await import('./js/scroll.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const bounds = (object) => { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object); };

  const bus = buildBus(), busBox = bounds(bus), busSize = busBox.getSize(new THREE.Vector3());
  check(Math.abs(busBox.min.y) < 1e-6, 'bus wheels must rest on the road');
  check(Math.abs(busSize.x - 11) < 0.15 && Math.abs(busSize.y - 4.6) < 0.15 && Math.abs(busSize.z - 2.5) < 0.15, 'bus must retain its shared 11 × 4.6 × 2.5m envelope');
  check(busSize.x / busSize.y > 2.3 && busSize.x / busSize.y < 2.6, 'double-decker proportions must stay near 2.4:1');
  const wheels = bus.children.find(o => o.isInstancedMesh && o.geometry?.parameters?.radiusTop === 0.55);
  wheels?.geometry.computeBoundingBox();
  const wheelShape = wheels?.geometry.boundingBox.getSize(new THREE.Vector3());
  check(wheels?.count === 4 && wheelShape.x > wheelShape.z && wheelShape.y > wheelShape.z, 'four instanced wheels must have their cylinder axis on Z');
  const glass = [];
  bus.traverse(o => { if (o.isInstancedMesh && o.material?.color?.getHexString() === 'a9c5d3') glass.push(o); });
  check(glass.reduce((total, mesh) => total + mesh.count, 0) >= 4, 'bus must retain visible glass on multiple faces');

  const { buildMini } = await import('./js/world/bus.js');
  const mini = buildMini(), miniBox = bounds(mini), miniSize = miniBox.getSize(new THREE.Vector3());
  check(Math.abs(miniBox.min.y) < 1e-6, 'mini wheels must rest on the road');
  check(miniSize.x > 3.7 && miniSize.x < 4.1 && miniSize.y < 1.8 && miniSize.z < 2, 'mini must be ~3.9m long');

  const pts = routePoints(stops.length);
  const curve = routeCurve(THREE, pts);
  const scene = new THREE.Scene(), start = scene.children.length;
  const ambient = createAmbient(scene, { curve, pts, stops });
  const traffic = scene.children.slice(start, start + 4);
  check(traffic.length === 4, 'expected the bus and three traffic vehicles (plus a BR cab stand-in)');
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
