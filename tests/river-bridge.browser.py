# browser-harness < tests/river-bridge.browser.py (local preview)
print(js(r'''(async () => {
  const T = await import('three'), { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const { createUnderpass, deckHeight, H, END, CLEARANCE } = await import('./js/world/underpass.js');
  const { RIVER_WIDTH, DECK_T, BOAT_TOP } = await import('./js/world/underwater-profile.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const pts = L.routePoints(stops.length), curve = L.routeCurve(T, pts);
  const up = createUnderpass(curve, stops, { x0:L.riverStart(stops,pts), x1:L.riverEnd(stops,pts), z:L.RIVER_Z, width:22 });
  const lamps = up.group.getObjectByName('street-lamps'), glass = lamps.getObjectByName('lamp-uk-glass');
  let lights = 0; up.group.traverse(o => { if (o.isLight) lights++; });
  check(lights === 0, 'bridge lamps must not introduce dynamic lights');
  check(up.passes.length === 2 && up.passes.every(p => p.river), 'both crossings span the river');
  check(CLEARANCE >= 5.8, 'bus arch clearance preserved');
  const ray = new T.Raycaster(), matrix = new T.Matrix4();
  up.group.updateMatrixWorld(true);
  for (const [i, pass] of up.passes.entries()) {
    const g = up.group.getObjectByName('underpass-' + i), river = pass.river;
    for (let az = 0; az <= river.bankAz + RIVER_WIDTH; az += 0.5) {
      check(deckHeight(river.sigma * az, river) === H, `flat deck bridge ${i} at ${az}`);
      const origin = new T.Vector3(1.5, 50, river.sigma * az).applyMatrix4(g.matrixWorld);
      ray.set(origin, new T.Vector3(0,-1,0));
      const hit = ray.intersectObjects(g.children).find(h => Math.abs(h.point.y - (H + 0.12)) < 0.001);
      check(!!hit, `actual road mesh bridge ${i} at ${az}`);
    }
    for (const side of [-1, 1]) for (const az of [12, END - 0.1, END + 0.1, river.bankAz - 0.1]) {
      const origin = new T.Vector3(side * 12, 3, river.sigma * az).applyMatrix4(g.matrixWorld);
      const direction = new T.Vector3(-side, 0, 0).transformDirection(g.matrixWorld);
      ray.set(origin, direction);
      const hit = ray.intersectObjects(g.children)[0];
      check(!!hit, 'continuous approach wall');
      const parapetOrigin = new T.Vector3(side * 12, H + 0.6, river.sigma * az).applyMatrix4(g.matrixWorld);
      ray.set(parapetOrigin, direction);
      check(ray.intersectObjects(g.children).length > 0, `continuous parapet bridge ${i}, side ${side}, at ${az}`);
      const local = g.worldToLocal(hit.point.clone());
      check(Math.abs(local.x - side * 3.6) < 0.001, `uniform vertical wall bridge ${i}, side ${side}, at ${az}`);
    }

    for (const side of [-1, 1]) for (const az of [0, 8.9, 9.1, 12, END - 0.1, END + 0.1]) {
      const direction = new T.Vector3(-side,0,0).transformDirection(g.matrixWorld);
      ray.set(new T.Vector3(side*6, H+0.96, river.sigma*az).applyMatrix4(g.matrixWorld), direction);
      const hit = ray.intersectObjects(g.children)[0];
      check(!!hit, 'parapet cap exists');
      const p = g.worldToLocal(hit.point.clone());
      check(Math.abs(p.x-side*3.65)<0.001, `aligned cap ${i}/${side}/${az}: ${p.x}`);
    }

    for (let az = river.bankAz + RIVER_WIDTH; az <= river.inAz; az += 0.5) {
      ray.set(new T.Vector3(1.5,50,river.sigma*az).applyMatrix4(g.matrixWorld), new T.Vector3(0,-1,0));
      const hit = ray.intersectObjects(g.children).find(h => Math.abs(h.point.y - (deckHeight(river.sigma*az,river)+0.12)) < 0.02);
      check(!!hit, `extended exit road bridge ${i}, at ${az}`);
    }
    check(deckHeight(-river.sigma * END, river) === 0, 'land entry reaches ground');
    check(deckHeight(river.sigma * river.inAz, river) === 0, 'far exit reaches ground');
    check(H + 0.12 - DECK_T - BOAT_TOP > 4, 'boats retain over four metres of headroom');
  }
  for (let i = 0; i < glass.count; i++) {
    glass.getMatrixAt(i, matrix);
    const position = new T.Vector3().setFromMatrixPosition(matrix);
    const pass = up.passes.find(p => Math.abs((position.x-p.x)*p.tx + (position.z-p.z)*p.tz) < 4);
    check(!!pass, 'lamp is on a bridge parapet');
    const az = -(position.x-pass.x)*pass.tz + (position.z-pass.z)*pass.tx;
    const h = deckHeight(az, pass.river);
    check(position.y >= h + 0.7 && position.y <= h + 1.01, 'lamp base follows parapet height');
    check(Math.abs(new T.Vector3().setFromMatrixScale(matrix).y - 0.38) < 1e-6, 'low lamp scale');
  }
  const pools = up.group.getObjectByName('lamp-pools');
  check(pools && pools.count > 0 && pools.count < glass.count, 'only bridge deck pools, no duplicated city lamps');
  const poolPosition = new T.Vector3();
  pools.getMatrixAt(0, matrix); poolPosition.setFromMatrixPosition(matrix);
  check(Math.abs(poolPosition.y - (H + 0.15)) < 1e-6, 'light pools follow elevated road');
  up.group.userData.setNight(1);
  check(pools.visible && pools.material.opacity > 0, 'night spill enabled');
  check(glass.material.emissive.r > 0.5 && lamps.getObjectByName('lamp-halos').visible, 'night emits warm light');
  up.group.userData.setNight(0);
  check(!pools.visible, 'day spill disabled');
  check(glass.material.emissive.r === 0 && !lamps.getObjectByName('lamp-halos').visible, 'day switches emission off');
  const result = { pass:true, bridges:up.passes.length, lamps:glass.count, dynamicLights:lights, deck:H };
  up.group.userData.dispose(); return result;
})()'''))
