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
  check(Math.abs(busSize.x - 11.2) < 0.35 && Math.abs(busSize.y - 4.4) < 0.2 && busSize.z > 2.4 && busSize.z < 3.3, `London bus must be ~11.2 x 4.4 x 2.55 m (+ mirrors) (got ${busSize.toArray().map(v => v.toFixed(2))})`);
  const tris = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.name !== 'beam') n += m.geometry.attributes.position.count / 3; }); return n; };
  const meshes = (o) => { const set = new Set(); o.traverse(m => { if (m.isMesh && m.name !== 'beam') set.add(m.material); }); return set.size; };
  check(bus.userData.wheels.length === 4 && bus.userData.length > 11 && bus.userData.front > 5.4, 'hero bus must expose userData wheels / length / front');
  check(tris(bus) <= 12000, `hero bus ≤ 12k tris (asset spec hero budget) (${tris(bus)})`);
  check(!bus.userData.setLivery, 'setLivery is gone: London and Glasgow are separate models');
  const gl = buildBus('glasgow'), glBox = bounds(gl), glSize = glBox.getSize(new THREE.Vector3());
  check(Math.abs(glBox.min.y) < 1e-6 && glSize.x > 10.6 && glSize.x < 11.4 && glSize.y > 4.1 && glSize.y < 4.6, 'Glasgow bus must be a double-decker of similar size');
  check(tris(gl) <= 12000, `hero Glasgow bus ≤ 12k tris (${tris(gl)})`);
  const hexes = (o) => { const h = new Set(); o.traverse(m => { if (m.isMesh && m.material?.color && m.name !== 'beam') h.add(m.material.color.getHexString()); }); return h; };
  check(hexes(bus).has('c9252b') && !hexes(bus).has('5b2a86'), 'London bus is red');
  check(hexes(gl).has('5b2a86') && !hexes(gl).has('c9252b'), 'Glasgow bus is purple');

  const { buildMini } = await import('./js/world/bus.js');
  const mini = buildMini(), miniBox = bounds(mini), miniSize = miniBox.getSize(new THREE.Vector3());
  check(Math.abs(miniBox.min.y) < 1e-6, 'mini wheels must rest on the road');
  check(miniSize.x > 3.6 && miniSize.x < 4.0 && miniSize.y < 1.8 && miniSize.z < 2, `mini must be ~3.85m long (${miniSize.x.toFixed(2)})`);
  check(tris(mini) <= 10000, `hero mini ≤ 10k tris (${tris(mini)})`);
  const assets = await import('./js/world/vehicle-assets.js');
  const authoredMini = await assets.loadVehicleAsset('mini');
  check(authoredMini, 'authored Mini GLB loads');
  const miniA = new THREE.Group(), miniB = new THREE.Group();
  await Promise.all([assets.upgradeMini(miniA), assets.upgradeMini(miniB)]);
  const glassOf = (root) => { const found = []; root.traverse(o => { if (o.isMesh && o.material?.transparent) found.push(o.material); }); return found; };
  const glass = glassOf(miniA), glassB = glassOf(miniB);
  check(glass.length > 0 && glassB.length > 0 && glass.every(m => m === glass[0]) && glassB.every(m => m === glass[0]), 'Mini glass uses one shared runtime material');
  check(glass[0].transparent && glass[0].opacity > 0.5 && glass[0].opacity < 0.65 && glass[0].color.b > glass[0].color.r, 'Mini glass has a readable smoky tint and visible cabin');
  const priorNight = document.body.classList.contains('theme-night');
  assets.updateVehicleEnv(0);
  const dayReflection = glass[0].envMapIntensity;
  check(dayReflection === glass[0].userData.envDay, 'Mini glass starts reflection check in day state');
  assets.updateVehicleEnv(1);
  check(glass[0].envMapIntensity >= 0.12 && glass[0].envMapIntensity < dayReflection, 'Mini glass reflections dim with night environment');
  assets.updateVehicleEnv(priorNight ? 1 : 0);
  const { buildVehicle } = await import('./js/world/vehicles.js');
  const cabBox = bounds(buildVehicle('cab')).getSize(new THREE.Vector3());
  check(cabBox.x > 4.6 && cabBox.x < 5.2 && cabBox.y > 1.7 && cabBox.y < 2.05 && cabBox.z < 2.3, `cab must be an LEVC-sized van (${cabBox.toArray().map(v => v.toFixed(2))})`);
  const amb = ['london', 'glasgow', 'cab', 'mini'].map(t => buildVehicle(t));
  check(tris(amb[0]) <= 6000 && tris(amb[1]) <= 6000 && tris(amb[2]) <= 5000 && tris(amb[3]) <= 5000, `ambient budgets (${amb.map(tris).map(Math.round)})`);
  check(amb.every(v => v.children.filter(c => c.isMesh).length <= 8 && v.userData.wheels.length === 0), 'ambient: ≤ 8 meshes, wheels merged');
  check(amb.every(v => v.userData.length > 3 && v.userData.beamY > 0), 'userData contract');

  const pts = routePoints(stops.length);
  const curve = routeCurve(THREE, pts);
  const scene = new THREE.Scene(), start = scene.children.length;
  const ambient = createAmbient(scene, { curve, pts, stops });
  const traffic = scene.children.slice(start, start + 20);
  check(traffic.length === 20 && traffic.every(v => v.userData.length > 3), 'expected 20 traffic vehicles (12 London + 4 Glasgow + 4 Sao Paulo)');
  const count = (n) => traffic.filter(v => v.name === n).length;
  check(count('london') === 2 && count('glasgow') === 2 && count('cab') === 4 && count('mini') === 3, 'fleet: 2 London buses, 2 Glasgow buses, 4 cabs, 3 Minis');
  const fleetBusSize = bounds(traffic[0]).getSize(new THREE.Vector3());
  check(Math.abs(fleetBusSize.x - busSize.x) < 0.05 && Math.abs(fleetBusSize.y - busSize.y) < 0.05, 'ambient London bus must keep the physical bus dimensions');
  await ambient.ready; // spacing must use adopted regional dimensions, not the smaller fallback
  const radii = traffic.map(v => { const s = bounds(v).getSize(new THREE.Vector3()); return Math.hypot(s.x, s.z) / 2; });
  const knots = fineMarks(stopMarks(pts), curve), routeSamples = Array.from({ length: 4001 }, (_, i) => curve.getPointAt(routeT(i / 4000, pts.length, knots)));
  // simulate 150 s at 30 fps: lanes, footprints, speed profile (zebra slow-down), finite positions
  const prev = traffic.map(v => v.position.clone()), prevVis = traffic.map(() => false), minD = [], maxD = [];
  traffic.forEach(() => { minD.push(1e9); maxD.push(0); });
  let frames = 0, overlap = 0, safetyCorrections = 0;
  for (let k = 0; k < 4500; k++) {
    ambient.update({ time: k / 30, t: 0.5, dt: 1 / 30 }); frames++;
    traffic.forEach((v, i) => {
      if (v.visible) {
        check([v.position.x, v.position.y, v.position.z].every(Number.isFinite), 'traffic positions must remain finite');
        if (k % 30 === 0) { const lateral = Math.min(...routeSamples.map(p => Math.hypot(v.position.x - p.x, v.position.z - p.z))); check(lateral > 1.4 && lateral < 2.1, `traffic must remain in its assigned road lane (${i} ${v.name} ${lateral.toFixed(2)} k=${k})`); }
        const delta = v.position.clone().sub(prev[i]), step = delta.length() * 30;
        const forward = delta.x * Math.cos(v.rotation.y) - delta.z * Math.sin(v.rotation.y);
        // Existing following-distance clamp can move a car backward when another car becomes active.
        if (prevVis[i] && forward < -1e-6) { check(-forward <= 3.5, 'backward safety correction stays within the following gap'); safetyCorrections++; }
        if (prevVis[i] && forward >= 0 && step < 40 && !(i === 0 || i === 2 || i === 12)) { minD[i] = Math.min(minD[i], step); maxD[i] = Math.max(maxD[i], step); } // relative vehicles are glued to the player
      }
      prev[i].copy(v.position); prevVis[i] = v.visible;
    });
    if (k % 10 === 0) for (let i = 0; i < traffic.length; i++) for (let j = i + 1; j < traffic.length; j++) {
      if (!traffic[i].visible || !traffic[j].visible || (i === 0 || i === 2 || i === 12) !== (j === 0 || j === 2 || j === 12)) continue; // same lane only (relative = player lane, rest = oncoming)
      if (Math.hypot(traffic[i].position.x - traffic[j].position.x, traffic[i].position.z - traffic[j].position.z) < (radii[i] + radii[j]) * 0.8) overlap++;
    }
  }
  check(overlap === 0, `vehicles must keep spacing (${overlap} overlapping samples)`);
  const slowed = maxD.filter((m, i) => m > 5 && minD[i] < m * 0.6).length;
  check(slowed >= 8, `vehicles must slow down for crossings (${slowed} did)`);
  check(Math.max(...maxD) < 16.5 && maxD.filter(m => m > 0).every(m => m > 8), `base speeds by type (${maxD.map(m => m.toFixed(1))})`);
  // reduced motion: static
  const sceneR = new THREE.Scene(), amR = createAmbient(sceneR, { curve, pts, stops, reducedMotion: true });
  amR.update({ time: 0, t: 0.5, dt: 0.016 }); const before = sceneR.children.slice(0, 20).map(c => c.position.clone());
  for (let k = 0; k < 100; k++) amR.update({ time: k, t: 0.5, dt: 0.5 });
  check(before.every((p, i) => p.distanceTo(sceneR.children[i].position) < 1e-9), 'reduced motion keeps traffic static');
  const a330 = buildVehicle('a330'), ab = bounds(a330).getSize(new THREE.Vector3());
  check(ab.x > 36 && ab.x < 42 && tris(a330) <= 5000 && a330.userData.shadow && a330.userData.nav && a330.userData.strobe, `A330 36-42 m, <=5k tris (${ab.x.toFixed(1)}, ${tris(a330)})`);
  return { pass: true, bus: [Number(busSize.x.toFixed(2)), Number(busSize.y.toFixed(2))], traffic: traffic.length, frames, safetyCorrections };
})()'''))
