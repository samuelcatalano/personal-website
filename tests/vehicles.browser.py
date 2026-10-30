# With the local preview open in browser-harness:
# browser-harness < tests/vehicles.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildBus } = await import('./js/world/bus.js');
  const { createAmbient } = await import('./js/world/ambient.js?regional-bus-transition-test-17');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve, swapAt, heroVehicleAt, secondaryBusAssetAt } = await import('./js/world/layout.js');
  const { createHeroGroup, applyHeroPose } = await import('./js/world/scene.js');
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
  check(tris(mini) <= 10000, `procedural Mini fallback ≤ 10k tris (${tris(mini)})`);
  const assets = await import('./js/world/vehicle-assets.js?fleet-finish-test-2');
  const fleetCatalog = await assets.loadFleetCatalog(), fleetModel = fleetCatalog[0], fleetA = new THREE.Group(), fleetB = new THREE.Group();
  await Promise.all([assets.upgradeFleet(fleetA, fleetModel, { body: '#142b4a' }), assets.upgradeFleet(fleetB, fleetModel, { body: '#a31d2a' })]);
  const fleetPaints = root => { const found = []; root.traverse(o => { if (o.isMesh && fleetModel.paintMaterials.includes(o.material.name)) found.push(o.material); }); return found; };
  const paintA = fleetPaints(fleetA), paintB = fleetPaints(fleetB);
  const priorNight = document.body.classList.contains('theme-night');
  assets.updateVehicleEnv(0); const paintDayReflection = paintA[0]?.envMapIntensity;
  assets.updateVehicleEnv(1); const paintNightReflection = paintA[0]?.envMapIntensity;
  assets.updateVehicleEnv(priorNight ? 1 : 0);
  check(paintA.length > 0 && paintA.every(m => m.name === fleetModel.paintMaterials[0] && m.color.getHexString() === '142b4a' && m.metalness <= 0.15 && m.clearcoat <= 0.4 && m.clearcoatRoughness >= 0.14) && paintB.length > 0 && paintB.every(m => m.color.getHexString() === 'a31d2a' && m.metalness <= 0.15 && m.clearcoat <= 0.4 && m.clearcoatRoughness >= 0.14 && !paintA.includes(m)) && paintDayReflection > paintNightReflection, 'fleet paint keeps authored roles, subdued automotive clearcoat, per-instance colour and day/night reflections');
  const authoredMini = await assets.loadVehicleAsset('mini');
  check(authoredMini, 'authored Mini GLB loads');
  let authoredMiniTris = 0; authoredMini.traverse(m => { if (m.isMesh) authoredMiniTris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; });
  check(authoredMiniTris >= 900000, `Mini defaults to the full-resolution source GLB (${authoredMiniTris} tris)`);
  for (const name of ['FL', 'FR', 'RL', 'RR']) {
    const wheel = authoredMini.getObjectByName(name); let tyreTris = 0;
    wheel?.traverse(m => { if (m.isMesh && m.material.name === 'CarTrim') tyreTris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; });
    check(tyreTris >= 5000, `${name} tire keeps 96-segment tread geometry (${tyreTris} tris)`);
  }
  const miniA = new THREE.Group(), miniB = new THREE.Group();
  await Promise.all([assets.upgradeMini(miniA), assets.upgradeMini(miniB)]);
  const glassOf = (root) => { const found = []; root.traverse(o => { if (o.isMesh && o.material?.transparent) found.push(o.material); }); return found; };
  const glass = glassOf(miniA), glassB = glassOf(miniB);
  check(glass.length > 0 && glassB.length > 0 && glass.every(m => m === glass[0]) && glassB.every(m => m === glass[0]), 'Mini glass uses one shared runtime material');
  check(glass[0].transparent && glass[0].opacity > 0.65 && glass[0].opacity < 0.8 && glass[0].color.b > glass[0].color.r, 'Mini glass has a dark smoky tint and visible cabin');
  assets.updateVehicleEnv(0);
  const dayReflection = glass[0].envMapIntensity;
  check(dayReflection === glass[0].userData.envDay, 'Mini glass starts reflection check in day state');
  assets.updateVehicleEnv(1);
  check(glass[0].envMapIntensity >= 0.12 && glass[0].envMapIntensity < dayReflection, 'Mini glass reflections dim with night environment');
  assets.updateVehicleEnv(priorNight ? 1 : 0);
  const { buildVehicle } = await import('./js/world/vehicles.js');
  const saoPaulo = await assets.loadVehicleAsset('sao-paulo');
  check(saoPaulo, 'São Paulo hero GLB loads through the cached vehicle loader');
  let spSourceTris = 0, spSourceMeshes = 0, spMetalTris = 0;
  saoPaulo.traverse(o => { if (o.isMesh) { const n = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; spSourceMeshes++; spSourceTris += n; if (o.material.name === 'BusMetal') spMetalTris += n; } });
  check(spSourceMeshes <= 10 && spSourceTris >= 8000 && spSourceTris <= 35000, `São Paulo authored bus stays within the 35k budget, one mesh per role (${spSourceMeshes} meshes, ${spSourceTris} tris)`);
  check(spMetalTris >= 300, `São Paulo rims, roof units and trim plates use the metallic role (${spMetalTris} tris)`);
  const spA = buildVehicle('glasgow', { hero: true }), spB = buildVehicle('glasgow', { hero: true });
  await Promise.all([assets.upgradeBus(spA, 'sao-paulo', { hero: false, asset: 'sao-paulo' }), assets.upgradeBus(spB, 'sao-paulo', { hero: false, asset: 'sao-paulo' })]);
  let spMetalMaterial; spA.traverse(o => { if (o.isMesh && o.userData.role === 'BusMetal') spMetalMaterial = o.material; });
  check(spMetalMaterial?.color.getHexString() === 'd8dadc', `São Paulo articulation uses the light chrome runtime finish (${spMetalMaterial?.color.getHexString()})`);
  const spBox = bounds(spA), spSize = spBox.getSize(new THREE.Vector3()), spWheels = spA.userData.wheels;
  check(Math.abs(spBox.min.y) < 0.01 && Math.abs(spSize.x - 16.758) < 0.08 && Math.abs(spSize.y - 3.101) < 0.08 && Math.abs(spSize.z - 2.70) < 0.08, `São Paulo GLB keeps its grounded source dimensions (${spSize.toArray().map(v => v.toFixed(2))})`);
  check(spA.userData.length > 16.7 && spA.userData.front > 8.3 && spA.userData.dimensions.length === 3 && spA.userData.beamAnchors.front.every(p => p[0] === spBox.max.x) && spA.userData.beamAnchors.rear.every(p => p[0] === spBox.min.x), 'São Paulo metadata and front/rear beam anchors come from GLB bounds');
  check(spWheels.length === 4 && spWheels.map(w => w.name).join(',') === 'FL-FR,ML-MR,RL-RR,TL-TR' && spWheels.every(w => w.children.some(m => m.isMesh && m.geometry.index?.count) && w.userData.radius === 0.52), 'empty FL/FR, ML/MR, RL/RR and TL/TR markers split the tyres into four spinning axle groups (rear tandem)');
  const spTraffic = buildVehicle('glasgow', { hero: true });
  await assets.upgradeBus(spTraffic, 'sao-paulo', { hero: false, asset: 'sao-paulo' });
  check(spTraffic.userData.visualAsset === 'sao-paulo' && spTraffic.userData.wheels.length === 4 && spTraffic.userData.length > 16.7 && spTraffic.userData.dimensions[1] > 3, 'São Paulo full-resolution traffic model uses axle markers and measured bounds');
  const spTris = (root) => { let n = 0; root.traverse(o => { if (o.isMesh && o.name !== 'beam') n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; }); return n; };
  let spRuntimeMeshes = 0; spA.traverse(o => { if (o.isMesh && o.name !== 'beam') spRuntimeMeshes++; });
  const spRuntimeTriangles = spTris(spA);
  check(spRuntimeMeshes <= 20 && spRuntimeTriangles >= spSourceTris && spRuntimeTriangles <= spSourceTris + 240, `São Paulo extracted hero keeps the source triangles (plus the static tyre discs) within 20 draw calls (${spRuntimeMeshes} meshes, ${spRuntimeTriangles} tris)`);
  assets.rollWheels(spWheels, 2);
  check(spWheels.every(w => Math.abs(w.rotation.z + 2 / 0.52) < 1e-9), 'positive local X travel rolls the contact patch backward around local Z');
  assets.rollWheels(spWheels, -2);
  check(spWheels.every(w => Math.abs(w.rotation.z) < 1e-9), 'reverse route distance unwinds São Paulo axle rotation');
  const spBody = [], spBodyB = [];
  spA.traverse(o => { if (o.isMesh && o.userData.role === 'BusBody') spBody.push(o.material); });
  spB.traverse(o => { if (o.isMesh && o.userData.role === 'BusBody') spBodyB.push(o.material); });
  check(spBody.length && spBody.every(m => m === spBody[0]) && spBodyB.some(m => m === spBody[0]), 'São Paulo body uses the existing shared semantic bus material');
  const fallback = buildVehicle('glasgow', { hero: true }), fallbackMeshes = fallback.children.length;
  await assets.upgradeBus(fallback, 'sao-paulo', { hero: false, asset: 'missing' });
  check(fallback.children.length === fallbackMeshes && fallback.userData.length > 10 && fallback.userData.visualAsset === undefined, 'missing regional GLB leaves the procedural vehicle fallback intact');
  const swap = swapAt(stops), archIn = 0.7, archOut = 0.8, eps = 1e-8;
  const heroCandidates = { mini: buildVehicle('mini', { hero: true }), london: buildVehicle('london', { hero: true }), glasgow: buildVehicle('glasgow', { hero: true }) };
  const candidates = Object.values(heroCandidates), heroPose = createHeroGroup(candidates);
  const routePosition = new THREE.Vector3(12, 0, -5), lateral = new THREE.Vector3(0, 0, 2.6), heading = 0.4;
  applyHeroPose(heroPose, routePosition, lateral, heading);
  const pose = routePosition.clone().add(lateral);
  const selected = (t) => heroVehicleAt(t, swap, archIn, archOut, heroCandidates);
  check(selected(swap - eps) === heroCandidates.mini, 'initial and returning Brazil keep the primary Mini');
  const outboundAtSwap = selected(swap), outboundAtArch = selected(archIn), outboundAfterArch = selected(archOut);
  check(outboundAtSwap === heroCandidates.london && outboundAtArch === heroCandidates.glasgow && outboundAfterArch === heroCandidates.london, 'outbound route remains Mini → London → Glasgow → London');
  check(selected(swap - eps) === heroCandidates.mini && selected(swap) === heroCandidates.london, 'the primary returns to Mini below swapAt and becomes London at the exact forward trigger');
  check(secondaryBusAssetAt(swap + eps, swap) === 'bus' && secondaryBusAssetAt(swap, swap) === 'bus' && secondaryBusAssetAt(swap - eps, swap) === 'sao-paulo', 'secondary London bus changes to the São Paulo model only after crossing below swapAt');
  check(secondaryBusAssetAt(0.1, swap) === 'sao-paulo' && secondaryBusAssetAt(swap, swap) === 'bus', 'secondary bus selection stays regional through Brazil and London');
  check(selected(archIn - eps) === heroCandidates.london && selected(archIn) === heroCandidates.glasgow && selected(archOut) === heroCandidates.london, 'Glasgow is selected only inside the UK underpass interval');
  heroPose.updateMatrixWorld(true);
  check(candidates.every(v => v.parent === heroPose && v.getWorldPosition(new THREE.Vector3()).distanceTo(pose) < 1e-9) && heroPose.position.equals(pose) && heroPose.rotation.y === heading, 'all scene-built selector candidates inherit the shared route position and heading');
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
  const regionalBus = scene.getObjectByName('regional-bus');
  check(regionalBus?.userData.regionBus && regionalBus.userData.length > 10, 'one independent secondary bus is assigned to regional model transitions');
  check(traffic.length === 20 && traffic.every(v => v.userData.length > 3), 'expected 20 traffic vehicles (12 London + 4 Glasgow + 4 Sao Paulo)');
  const count = (n) => traffic.filter(v => v.name === n).length;
  check(count('london') === 1 && count('regional-bus') === 1 && count('glasgow') === 2 && count('cab') === 4 && count('mini') === 3, 'fleet: one regional London bus, one other London bus, 2 Glasgow buses, 4 cabs, 3 Minis');
  const fleetBusSize = bounds(traffic[0]).getSize(new THREE.Vector3());
  check(Math.abs(fleetBusSize.x - busSize.x) < 0.05 && Math.abs(fleetBusSize.y - busSize.y) < 0.05, 'ambient London bus must keep the physical bus dimensions');
  await ambient.ready; // spacing must use adopted regional dimensions, not the smaller fallback
  const radii = traffic.map(v => { const s = bounds(v).getSize(new THREE.Vector3()); return Math.hypot(s.x, s.z) / 2; });
  const knots = fineMarks(stopMarks(pts), curve), routeSamples = Array.from({ length: 4001 }, (_, i) => curve.getPointAt(routeT(i / 4000, pts.length, knots)));
  check(regionalBus.userData.regionAsset === 'bus' && regionalBus.userData.visualAsset === 'bus' && secondaryBusAssetAt(routeT(0.35, pts.length, knots), swap) === 'bus', 'visible secondary London bus starts with the London GLB on the UK side');
  const transitionScene = new THREE.Scene(), transitionAmbient = createAmbient(transitionScene, { curve, pts, stops }), transitionBus = transitionScene.getObjectByName('regional-bus');
  await transitionAmbient.ready;
  const wheelPhase = 2.2;
  transitionAmbient.update({ time: 0, t: 0.1, dt: 0 }); // player is in Brazil; the bus itself is still just on the UK side
  check(transitionScene.children.filter(v => ['london', 'glasgow', 'regional-bus'].includes(v.name)).every(v => !v.visible) && transitionBus.userData.visualAsset === 'bus' && transitionBus.userData.regionTransitions === undefined, 'UK buses stay hidden from the Brazil scene until the regional bus itself crosses the border');
  transitionBus.userData.wheels.forEach(w => { w.rotation.z = wheelPhase; });
  let regionalSwapChecked = false;
  for (let k = 0; k < 80 && !regionalSwapChecked; k++) {
    transitionAmbient.update({ time: k / 2, t: 0.1, dt: 0.5 });
    const expectedWheelPhase = transitionBus.userData.wheels[0]?.rotation.z, positionAtAdoption = transitionBus.position.clone(), headingAtAdoption = transitionBus.rotation.y;
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    if (transitionBus.userData.visualAsset === 'sao-paulo') {
      check(transitionBus.userData.regionAsset === 'sao-paulo' && transitionBus.userData.wheels.every(w => Math.abs(w.rotation.z - expectedWheelPhase) < 1e-9), `São Paulo adoption preserves the secondary bus wheel phase (${expectedWheelPhase} → ${transitionBus.userData.wheels.map(w => w.rotation.z)})`);
      check(transitionBus.position.distanceTo(positionAtAdoption) < 1e-9 && transitionBus.rotation.y === headingAtAdoption, 'secondary bus adoption preserves its live position and heading');
      regionalSwapChecked = true;
    }
  }
  check(regionalSwapChecked, 'secondary London bus crossed below swapAt and adopted São Paulo while the player remained in Brazil');
  for (let k = 0; k < 120 && !transitionBus.visible; k++) {
    transitionAmbient.update({ time: 60 + k / 2, t: 0.1, dt: 0.5 });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  }
  check(transitionBus.visible && hexes(transitionBus).has('0a8f3c') && !hexes(transitionBus).has('c9252b'), `visible regional traffic uses the São Paulo livery after the model swap (visible=${transitionBus.visible}, colors=${[...hexes(transitionBus)]})`);
  const sharedBus = await assets.loadVehicleAsset('bus');
  let sharedBusTris = 0; sharedBus.traverse(m => { if (m.isMesh) sharedBusTris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; });
  check(sharedBusTris > 8000, `shared authored London/Glasgow GLB stays above 8k triangles (${sharedBusTris})`);
  const busTireTris = ['FL', 'FR', 'RL', 'RR'].map(name => { let n = 0; sharedBus.getObjectByName(name)?.traverse(m => { if (m.isMesh && m.material.name === 'BusRubber') n += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; }); return n; });
  check(busTireTris.every(n => n >= 800), `London/Glasgow tires use the higher-resolution grooved meshes (${busTireTris})`);
  const busRimRatios = ['FL', 'FR', 'RL', 'RR'].map(name => { let rim=0, tyre=0; sharedBus.getObjectByName(name)?.traverse(m => { if (!m.isMesh || !m.geometry.attributes.position) return; const p=m.geometry.attributes.position; let r=0; for(let i=0;i<p.count;i++) r=Math.max(r,Math.hypot(p.getX(i),p.getZ(i))); if(m.material.name==='BusWheel') rim=Math.max(rim,r); if(m.material.name==='BusRubber') tyre=Math.max(tyre,r); }); return rim/tyre; });
  check(busRimRatios.every(r => r > 0.45 && r < 0.62), `steel dishes stay within the tire face so a substantial rubber sidewall reads (${busRimRatios})`);
  sharedBus.updateMatrixWorld(true); const busSide = new THREE.Box3().setFromObject(sharedBus.getObjectByName('BusBody'));
  const wheelSides = ['FL', 'FR', 'RL', 'RR'].map(name => new THREE.Box3().setFromObject(sharedBus.getObjectByName(name)));
  check(wheelSides[0].min.z < busSide.min.z - 0.01 && wheelSides[1].max.z > busSide.max.z + 0.01 && wheelSides[2].min.z < busSide.min.z - 0.01 && wheelSides[3].max.z > busSide.max.z + 0.01, 'bus wheel faces must sit outside the hull skirt');
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
        if (prevVis[i] && forward < -1e-6) { check(-forward <= 3.5, `backward safety correction stays within the following gap (${i} ${v.name} ${(-forward).toFixed(2)}m at frame ${k}; ${prev[i].toArray()} -> ${v.position.toArray()}; ${v.userData.regionAsset}/${v.userData.visualAsset})`); safetyCorrections++; }
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
  await new Promise(resolve => setTimeout(resolve, 0)); // resolve any cached region-model adoption after the traffic simulation
  for (let k = 0; k < 60; k++) ambient.update({ time: 150 + k / 30, t: 0.5, dt: 1 / 30 });
  await new Promise(resolve => setTimeout(resolve, 0));
  check(regionalBus.userData.regionTransitions >= 1, 'secondary bus crossed a region boundary and changed its model');
  let regionalNearest = 0, regionalNearestD = Infinity;
  routeSamples.forEach((p, i) => { const d = Math.hypot(regionalBus.position.x - p.x, regionalBus.position.z - p.z); if (d < regionalNearestD) { regionalNearestD = d; regionalNearest = i; } });
  const regionalStartT = routeT(regionalNearest / 4000, pts.length, knots);
  const regionalAsset = secondaryBusAssetAt(regionalStartT, swap);
  check(regionalBus.userData.regionAsset === regionalAsset && regionalBus.userData.visualAsset === (regionalAsset === 'sao-paulo' ? 'sao-paulo' : 'bus'), `secondary bus model follows its exact route region (${regionalAsset} at ${regionalStartT.toFixed(3)})`);
  for (let k = 0; k < 60; k++) ambient.update({ time: 150 + k / 30, t: 0.5, dt: 1 / 30 }); // let a border model fade finish
  let nearest = 0, nearestD = Infinity;
  routeSamples.forEach((p, i) => { const d = Math.hypot(regionalBus.position.x - p.x, regionalBus.position.z - p.z); if (d < nearestD) { nearestD = d; nearest = i; } });
  const regionalT = routeT(nearest / 4000, pts.length, knots);
  check(regionalBus.userData.regionAsset === secondaryBusAssetAt(regionalT, swap), `secondary bus model follows its exact route region (${regionalBus.userData.regionAsset} at ${regionalT.toFixed(3)})`);
  // reduced motion: static
  const sceneR = new THREE.Scene(), amR = createAmbient(sceneR, { curve, pts, stops, reducedMotion: true });
  amR.update({ time: 0, t: 0.5, dt: 0.016 }); const before = sceneR.children.slice(0, 20).map(c => c.position.clone());
  for (let k = 0; k < 100; k++) amR.update({ time: k, t: 0.5, dt: 0.5 });
  check(before.every((p, i) => p.distanceTo(sceneR.children[i].position) < 1e-9), 'reduced motion keeps traffic static');
  const a330 = buildVehicle('a330'), ab = bounds(a330).getSize(new THREE.Vector3());
  check(ab.x > 36 && ab.x < 42 && tris(a330) <= 5000 && a330.userData.shadow && a330.userData.nav && a330.userData.strobe, `A330 36-42 m, <=5k tris (${ab.x.toFixed(1)}, ${tris(a330)})`);
  return { pass: true, bus: [Number(busSize.x.toFixed(2)), Number(busSize.y.toFixed(2))], traffic: traffic.length, frames, safetyCorrections };
})()'''))

goto_url('http://localhost:8000/?glb=processed&test=processed-asset-opt-in')
wait_for_load()
print(js(r'''(async()=>{
  const A=await import('./js/world/vehicle-assets.js?processed-opt-in-test');
  const g=await A.loadVehicleAsset('mini');let tris=0;
  g.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3});
  if(tris!==324297)throw Error(`?glb=processed must opt into the reduced Mini (${tris} tris)`);
  return {processedOptIn:true,triangles:tris};
})()'''))
