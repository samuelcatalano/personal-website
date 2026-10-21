# With the local preview open in browser-harness:
# browser-harness < tests/vehicles.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildBus } = await import('./js/world/bus.js');
  const { createAmbient } = await import('./js/world/ambient.js?traffic-speed-test');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const { routeT, stopMarks, fineMarks } = await import('./js/scroll.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const bounds = (object) => { object.updateMatrixWorld(true); const box = new THREE.Box3(); object.traverse((o) => { if (o.isMesh && o.name !== 'beam') box.union(new THREE.Box3().setFromObject(o)); }); return box; }; // night beams are separate transparent meshes, not body

  const bus = buildBus(), busBox = bounds(bus), busSize = busBox.getSize(new THREE.Vector3());
  check(Math.abs(busBox.min.y) < 1e-6, 'bus wheels must rest on the road');
  check(Math.abs(busSize.x - 11.2) < 0.35 && Math.abs(busSize.y - 4.4) < 0.2 && busSize.z > 2.4 && busSize.z < 3.1, `London bus must be ~11.2 x 4.4 x 2.55 m (got ${busSize.toArray().map(v => v.toFixed(2))})`);
  const tris = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.name !== 'beam') n += m.geometry.attributes.position.count / 3; }); return n; };
  const meshes = (o) => { const set = new Set(); o.traverse(m => { if (m.isMesh && m.name !== 'beam') set.add(m.material); }); return set.size; };
  check(bus.userData.wheels.length === 4 && bus.userData.length > 11 && bus.userData.front > 5.4, 'hero bus must expose userData wheels / length / front');
  check(tris(bus) <= 8000, `hero bus ≤ 8k tris (${tris(bus)})`);
  check(!bus.userData.setLivery, 'setLivery is gone: London and Glasgow are separate models');
  const gl = buildBus('glasgow'), glBox = bounds(gl), glSize = glBox.getSize(new THREE.Vector3());
  check(Math.abs(glBox.min.y) < 1e-6 && glSize.x > 10.6 && glSize.x < 11.4 && glSize.y > 4.1 && glSize.y < 4.6, 'Glasgow bus must be a double-decker of similar size');
  check(tris(gl) <= 8000, `hero Glasgow bus ≤ 8k tris (${tris(gl)})`);
  const hexes = (o) => { const h = new Set(); o.traverse(m => { if (m.isMesh && m.material?.color && m.name !== 'beam') h.add(m.material.color.getHexString()); }); return h; };
  check(hexes(bus).has('c9252b') && !hexes(bus).has('5b2a86'), 'London bus is red');
  check(hexes(gl).has('5b2a86') && !hexes(gl).has('c9252b'), 'Glasgow bus is purple');

  const { buildMini } = await import('./js/world/bus.js');
  const mini = buildMini(), miniBox = bounds(mini), miniSize = miniBox.getSize(new THREE.Vector3());
  check(Math.abs(miniBox.min.y) < 1e-6, 'mini wheels must rest on the road');
  check(miniSize.x > 3.6 && miniSize.x < 4.0 && miniSize.y < 1.8 && miniSize.z < 2, `mini must be ~3.8m long (${miniSize.x.toFixed(2)})`);
  check(tris(mini) <= 6000, `hero mini ≤ 6k tris (${tris(mini)})`);
  const { buildVehicle } = await import('./js/world/vehicles.js');
  const cabBox = bounds(buildVehicle('cab')).getSize(new THREE.Vector3());
  check(cabBox.x > 4.6 && cabBox.x < 5.2 && cabBox.y > 1.7 && cabBox.y < 2.05 && cabBox.z < 2.3, `cab must be an LEVC-sized van (${cabBox.toArray().map(v => v.toFixed(2))})`);
  const amb = ['london', 'glasgow', 'cab', 'mini'].map(t => buildVehicle(t));
  check(tris(amb[0]) <= 4000 && tris(amb[1]) <= 4000 && tris(amb[2]) <= 3500 && tris(amb[3]) <= 3500, `ambient budgets (${amb.map(tris).map(Math.round)})`);
  check(amb.every(v => v.children.filter(c => c.isMesh).length <= 8 && v.userData.wheels.length === 0), 'ambient: ≤ 8 meshes, wheels merged');
  check(amb.every(v => v.userData.length > 3 && v.userData.beamY > 0), 'userData contract');

  const pts = routePoints(stops.length);
  const curve = routeCurve(THREE, pts);
  const scene = new THREE.Scene(), start = scene.children.length;
  const ambient = createAmbient(scene, { curve, pts, stops });
  const traffic = scene.children.slice(start, start + 5);
  check(traffic.length === 5, 'expected London bus, Glasgow bus and three cabs');
  const fleetBusSize = bounds(traffic[0]).getSize(new THREE.Vector3());
  check(Math.abs(fleetBusSize.x - busSize.x) < 0.01 && Math.abs(fleetBusSize.y - busSize.y) < 0.01, 'ambient London bus must keep the physical bus dimensions');
  const radii = traffic.map(v => { const s = bounds(v).getSize(new THREE.Vector3()); return Math.hypot(s.x, s.z) / 2; });
  const marks = stopMarks(pts), knots = fineMarks(marks, curve), offset = 0.25;
  const routeSamples = Array.from({ length: 2001 }, (_, i) => curve.getPointAt(routeT(i / 2000, pts.length, knots)));
  const travel = (p) => {
    const time = ((offset - p + 1) % 1) / 0.012;
    ambient.update({ time, t: 0.5 });
    const before = traffic[3].position.clone();
    ambient.update({ time: time + 1, t: 0.5 });
    return before.distanceTo(traffic[3].position);
  };
  const assertAtRouteProgress = (p) => {
    const time = ((offset - p + 1) % 1) / 0.012;
    ambient.update({ time, t: 0.5 });
    const t = routeT(p, pts.length, knots), tangent = curve.getTangentAt(t);
    const expected = curve.getPointAt(t).add(new THREE.Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(-1.75));
    check(traffic[3].position.distanceTo(expected) < 1e-4, 'autonomous traffic must use the distance-mapped route position');
  };
  const shortProgress = (marks[2] + marks[3]) / 2, longProgress = (marks[10] + marks[11]) / 2;
  assertAtRouteProgress(shortProgress);
  assertAtRouteProgress(longProgress);
  const shortSpeed = travel(shortProgress), longSpeed = travel(longProgress);
  check(Math.abs(shortSpeed - longSpeed) < Math.max(shortSpeed, longSpeed) * 0.15, `traffic speed must stay consistent across short and OLM→Glasgow segments (${shortSpeed.toFixed(2)}m vs ${longSpeed.toFixed(2)}m per second)`);
  let updates = 0;
  for (const time of [0, 120, 600, 3600]) for (const progress of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    ambient.update({ time, t: progress }); updates++;
    check(traffic[3].visible && traffic[4].visible, 'reverse traffic must stay visible after modulo wrap');
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
