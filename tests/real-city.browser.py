# browser-harness < tests/real-city.browser.py (local preview)
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
result = js(r'''(async () => {
  const T = await import('three');
  const { buildRealCity } = await import('./js/world/real-city.js?pilot='+Date.now());
  const { buildCity } = await import('./js/world/city.js?pilot-street='+Date.now());
  const { stops } = await import('./js/content.js');
  const { ROAD, routePoints, routeCurve, towerX, isWembleyBenchmark } = await import('./js/world/layout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const { createRoadMarks } = await import('./js/world/roadmarks.js');
  const assertPilotStreetSeparatesRoadwayFromContinuousPedestrianPaths = (additions, plots, curve, safeStart, safeEnd, bridgeX) => {
    const minX = Math.min(...plots.map(p => p.x - p.width / 2)), maxX = Math.max(...plots.map(p => p.x + p.width / 2));
    const inPilot = ([x,,z,w,,d]) => x + w / 2 >= minX && x - w / 2 <= maxX && Math.abs(z - curve.getPointAt(0.5).z) < 30;
    const local = additions.filter(inPilot).filter(([, , ,w,,d]) => w < 50 && d < 50);
    const curbs = local.filter(([,y,,w,h,d]) => h >= 0.08 && h <= 0.18 && Math.max(w,d) <= 1 && Math.min(w,d) >= 0.15 && y < 0.2);
    // lane markings are curve-following ribbons in roadmarks.js (2026-10-21); count dash quads in the pilot span
    const marks = window.__roadMarks, mp = marks.geometry.getAttribute('position');
    const mc = marks.geometry.getAttribute('color'), yellow = new T.Color('#e9b93a'), initialClearEnd = curve.getPointAt(12.4 / curve.getLength()).x - 0.2;
    for (let i = 0; i < mp.count; i++) {
      if (Math.abs(mc.getX(i) - yellow.r) + Math.abs(mc.getY(i) - yellow.g) + Math.abs(mc.getZ(i) - yellow.b) > 1e-5) continue;
      check(mp.getX(i) >= initialClearEnd, 'yellow centre marks must start after the initial zebra buffer');
    }
    let stripes = []; for (let i = 0; i < mp.count; i += 6) { const x = mp.getX(i), z = mp.getZ(i); if (x >= minX && x <= maxX && Math.abs(z - curve.getPointAt(0.5).z) < 30) stripes.push(i); }
    const crosses = local.filter(([,y,,w,h,d,c]) => c === '#e6dcc4' && h <= 0.06 && Math.max(w,d) > 8 && Math.min(w,d) < 0.7);
    const variationPatches = additions.filter(([,y,,w,h,d,c]) => c === '#d8cfb8' && y > 0.1 && h < 0.01 && w >= 0.4 && w <= 0.6 && d >= 0.4 && d <= 0.6);
    const basePavement = additions.filter(([,y,,w,h,d]) => Math.abs(y+0.02)<1e-5 && Math.abs(h-0.12)<1e-5 && Math.min(w,d)>=0.89 && Math.max(w,d)<=2);
    const pilotOnly = additions.filter(([,y,,w,h,d,c]) =>
      c === '#7d7468' && Math.abs(h-0.1)<1e-5 && Math.abs(Math.max(w,d)-0.72)<1e-5 && Math.abs(Math.min(w,d)-0.16)<1e-5 ||
      c === '#d8cfb8' && y > 0.1 && h < 0.01 && w >= 0.4 && w <= 0.6 && d >= 0.4 && d <= 0.6 ||
      c === '#e6dcc4' && Math.abs(h-0.02)<1e-5 && Math.max(w,d)>8 && Math.min(w,d)<0.7);
    const paths = additions.filter(([,y,,w,h,d]) => Math.abs(y+0.02)<1e-5 && Math.abs(h-0.12)<1e-5 && Math.min(w,d)>=0.89 && Math.max(w,d)<=2);
    const localPaths = local.filter(([,y,,w,h,d]) => Math.abs(y+0.02)<1e-5 && Math.abs(h-0.12)<1e-5 && Math.min(w,d)>=0.89 && Math.max(w,d)<=2);
    const pathContinuity = [];
    for (let i = 0; i <= 12; i++) {
      const targetX = minX + (maxX - minX) * i / 12;
      const u = Array.from({length: 101}, (_,j) => j / 100).reduce((best,v) => Math.abs(curve.getPointAt(v).x-targetX) < Math.abs(curve.getPointAt(best).x-targetX) ? v : best, 0);
      const p = curve.getPointAt(u), t = curve.getTangentAt(u), nx = -t.z, nz = t.x;
      const nearby = [-1,1].every(side => paths.some(([x,,z]) => Math.hypot(x - (p.x + nx * side * (ROAD.padIn + ROAD.padOut) / 2), z - (p.z + nz * side * (ROAD.padIn + ROAD.padOut) / 2)) < 2));
      pathContinuity.push(nearby);
    }
    check(curbs.length >= 4, 'pilot street needs low curb geometry on both sides');
    check(stripes.length >= 3, 'pilot street needs restrained lane markings');
    check(crosses.length >= 8, 'pilot street needs two crossing sets');
    check(variationPatches.length >= 4, 'pilot pavement needs small inset variation patches');
    check(basePavement.length && basePavement.every(box => box[6] === '#9b9b99'), 'sidewalk tiles must share one material');
    check(variationPatches.every(box => box[1]+box[4] < 0.13 && box[4] < 0.01 && basePavement.some(p => Math.abs(box[0]-p[0])+box[3]/2 <= p[3]/2 && Math.abs(box[2]-p[2])+box[5]/2 <= p[5]/2)), 'pavement variation must stay shallow and fully on the walkable path');
    check(pilotOnly.length > 0, 'pilot street details must exist');
    check(pilotOnly.every(([x,, ,w,,d]) => x-w/2 >= safeStart && x+w/2 <= safeEnd), 'pilot-only details must stay inside the safe street segment');
    check(pilotOnly.every(([x,, ,w,,d]) => x+w/2 <= bridgeX-20 || x-w/2 >= bridgeX+20), 'pilot-only details must stay outside the Tower Bridge span');
    check(pathContinuity.every(Boolean), 'pilot pedestrian paths must stay continuous through the block');
    for (const p of plots) for (const [x,,z,w,,d] of local) check(Math.abs(x-p.x) > (w+p.width)/2 || Math.abs(z-p.z) > (d+p.depth)/2, 'street detail intersects a pilot building');
    const routeDistance = ([x,,z]) => Math.min(...Array.from({length: 101}, (_,i) => { const q=curve.getPointAt(i/100); return Math.hypot(x-q.x,z-q.z); }));
    check(curbs.every(box => box[4] <= 0.12 && routeDistance(box) > 3.1), 'curbs must stay outside the vehicle envelope');
    check(localPaths.every(box => routeDistance(box) > 5), 'pedestrian path must remain clear of the vehicle envelope');
    check(crosses.every(([, , , ,h]) => h <= 0.03), 'crossings must stay flush with the roadway');
    return { name: 'pilot street separates roadway from continuous pedestrian paths', curbs: curbs.length, laneMarks: stripes.length, crossings: crosses.length, pavementPatches: variationPatches.length, pathContinuity };
  };
  const meshes = g => { const m = []; g.traverse(o => { if (o.isMesh) m.push(o); }); return m; };
  const fits = (g, p) => {
    const b = new T.Box3().setFromObject(g), s = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
    check(s.x > 0 && s.y > 0 && s.z > 0, 'empty plot '+p.id);
    check(s.x <= p.width+1e-5 && s.z <= p.depth+1e-5 && s.y <= p.height+1e-5, 'model exceeds plot '+p.id);
    check(Math.abs(c.x-p.x)<1e-5 && Math.abs(c.z-p.z)<1e-5 && Math.abs(b.min.y)<1e-5, 'model origin/grounding incorrect '+p.id);
    check(Math.abs(Math.max(s.x/p.width,s.y/p.height,s.z/p.depth)-1)<1e-5, 'model does not fill its limiting dimension');
  };
  const pts = routePoints(stops.length), plots = [], architecturePlots = [], street = [], curve = routeCurve(T,pts);
  buildCity((...box) => street.push(box), stops, pts, curve, undefined, p => plots.push(p), p => architecturePlots.push(p));
  window.__roadMarks = createRoadMarks(curve, stops, (await import('./js/world/bays.js')).parkingBays(curve, pts, stops));
  const bridgeX = towerX(stops, pts), safeStart = pts[stops.findIndex(s => s.id === 'olm')].x + 12, safeEnd = bridgeX - 20;
  const streetDetails = assertPilotStreetSeparatesRoadwayFromContinuousPedestrianPaths(street, plots, curve, safeStart, safeEnd, bridgeX);
  const glbRequestsBefore = performance.getEntriesByType('resource').filter(e => /\.glb(?:$|[?#])/i.test(e.name)).length;
  const errors = [], onError = e => errors.push(e.message), originalConsoleError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); originalConsoleError(...args); };
  addEventListener('error', onError);
  try {
    const city = await buildRealCity(architecturePlots,{rollout:false});
    const benchmarkPlots = architecturePlots.filter(isWembleyBenchmark);
    check(city.userData.buildingCount === architecturePlots.length && architecturePlots.length >= 480, `expected the citywide architecture plots: ${city.userData.buildingCount}/${architecturePlots.length}`);
    check(city.userData.benchmarkCount === benchmarkPlots.length && benchmarkPlots.length > 20, 'Wembley benchmark must be isolated to existing lots');
    check(['terrace','midrise','office'].every(k => city.userData.benchmarkKinds.includes(k)), 'Wembley benchmark needs three visible architecture archetypes');
    check(city.name === 'real-city-pilot', 'scene integration name changed');
    check(city.userData.kinds.sort().join(',') === 'midrise,office,shop,terrace', 'expected the city architecture kinds');
    const slice = city.getObjectByName('townhouse-benchmark-chunk');
    check(slice?.userData.plotIds.join(',') === 'block-827--54-0,block-827--54-1,block-827--54-2' && meshes(slice).length === 3 && city.userData.sliceCount === 3, 'only the three selected lots may share the three chunk renderables');
    const batches = city.children.filter(m=>m!==slice&&m.name!=='townhouse-experiment'&&!['midrise-slice','office-slice','tower-slice','hero-zone-architecture','shop-slice','shop-integration'].includes(m.userData.archetype));
    check(city.children.length <= 24 + (city.getObjectByName('hero-shopfronts') ? 1 : 0) + (city.getObjectByName('hero-final-frontages') ? 1 : 0) + (city.getObjectByName('hero-background-cleanup') ? 1 : 0) + (city.getObjectByName('hero-adjacent-region') ? 1 : 0) && batches.every(m=>m.isInstancedMesh || m.material.name === 'benchmark-facade-family'), 'city buildings must remain batched within the added draw-call budget');
    batches.forEach(m => check(m.isInstancedMesh ? m.count > 0 : m.geometry.getAttribute('color'), 'empty architecture batch'));
    let duplicateRejected=false;try{await buildRealCity([...architecturePlots,...architecturePlots],{rollout:false});}catch(e){duplicateRejected=e instanceof TypeError;}check(duplicateRejected,'duplicate benchmark lots must be rejected');
    const original = meshes(city).filter(m=>m.parent!==slice&&!m.parent.name.startsWith('townhouse-chunk-')&&!['midrise-slice','office-slice','tower-slice','hero-zone-architecture','shop-slice','shop-integration'].includes(m.parent.userData.archetype));
    check(original.length && original.filter(m => !m.isInstancedMesh).length === 1 && original.filter(m => !m.isInstancedMesh)[0].material.name === 'benchmark-facade-family', 'benchmark bodies must share one baked facade mesh');
    check(new Set(original.map(m=>m.geometry)).size > 1 && new Set(original.map(m=>m.geometry)).size <= 6, 'Wembley must add only shared archetype geometries');
    check(new Set(original.map(m=>`${m.geometry.uuid}:${m.material.uuid}`)).size === original.length, 'city does not batch by shared geometry/material');
    const benchmarkBodies = original.filter(m => m.material.name === 'benchmark-facade-family');
    check(benchmarkBodies.length === 1 && benchmarkBodies[0].material.vertexColors && benchmarkBodies[0].geometry.getAttribute('color') && benchmarkBodies[0].castShadow && benchmarkBodies[0].receiveShadow, 'benchmark facades must share colored geometry and cast shadows');
    check(!original.some(m => m.material.name === 'benchmark-architectural-details'), 'benchmark details must not add a separate draw batch');
    const colorAttr = benchmarkBodies[0].geometry.getAttribute('color');
    const hasColor = hex => { const target = new T.Color(hex); for (let i=0;i<colorAttr.count;i++) if (Math.abs(colorAttr.getX(i)-target.r)<1e-5 && Math.abs(colorAttr.getY(i)-target.g)<1e-5 && Math.abs(colorAttr.getZ(i)-target.b)<1e-5) return true; return false; };
    check(['#78aebf','#e5d8bd','#493d34'].every(hasColor), 'window, frame and door colors must be baked into the facade mesh');
    const assets = performance.getEntriesByType('resource').filter(e => /\.glb(?:$|[?#])/i.test(e.name));
    check(assets.length === glbRequestsBefore, 'procedural integration issued GLB requests: '+assets.slice(glbRequestsBefore).map(e=>e.name).join(', '));
    check(errors.length===0, 'uncaught browser errors: '+errors.join(', '));
    return {pass:true, name:'procedural pilot buildings fit their plots and share instanced resources', street:streetDetails, plots:architecturePlots.length, kinds:city.userData.kinds, sharedMeshes:original.length, glbRequests:assets.length-glbRequestsBefore, errors};
  } finally {
    console.error = originalConsoleError;
    removeEventListener('error', onError);
  }
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
