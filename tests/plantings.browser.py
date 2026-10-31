# browser-harness < tests/plantings.browser.py (local preview)
tab=new_tab('about:blank');activate_tab(tab);cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);goto_url('http://localhost:8000/');wait_for_load()
print(js(r'''(async () => {
  const T = await import('three');
  const { createBoxes, buildMeshes } = await import('./js/world/voxel.js');
  const { createPlantGeometry } = await import('./js/world/plant-mesh.js');
  const { buildCity } = await import('./js/world/city.js');
  const { buildParks } = await import('./js/world/parks.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const check = (ok, msg) => { if (!ok) throw Error(msg); };
  const pts = routePoints(stops.length), curve = routeCurve(T, pts), fallback = [];
  buildCity((...box) => fallback.push(box), stops, pts, curve);
  const boxes = createBoxes();
  buildCity(boxes.add, stops, pts, curve);
  const plants = boxes.list.filter(b => b.plant), ordinary = boxes.list.filter(b => !b.plant);
  const kinds = ['flower', 'shrub', 'hedge'];
  check(kinds.every(kind => plants.some(p => p.plant === kind)), 'parks emit flower, shrub and hedge instances');
  check(plants.every(p => p.h < 1 && p.y + p.h <= 1), 'low planting stays below 1 m');
  const parkLegacy = [], parkBoxes = createBoxes();
  buildParks((...box) => parkLegacy.push(box), stops, pts, curve, []);
  buildParks(parkBoxes.add, stops, pts, curve, []);
  const parkCenters = new Map();
  for (const p of parkBoxes.list.filter(b => b.plant)) { const key = JSON.stringify([p.x,p.y,p.z]); parkCenters.set(key, (parkCenters.get(key) ?? 0) + 1); }
  for (const b of parkLegacy) { const key = JSON.stringify(b.slice(0,3)), count = parkCenters.get(key) ?? 0; if (count) parkCenters.set(key, count - 1); }
  check([...parkCenters.values()].every(count => count === 0), 'each park plant replaces an existing planting box');
  check(plants.length > parkBoxes.list.filter(b => b.plant).length, 'city forwards additive country pocket-garden planting');

  const centers = new Map();
  for (const p of plants) { const key = JSON.stringify([p.x,p.y,p.z]); centers.set(key, (centers.get(key) ?? 0) + 1); }
  const expected = [];
  for (const b of fallback) {
    const key = JSON.stringify(b.slice(0,3)), count = centers.get(key) ?? 0;
    if (count) centers.set(key, count - 1); else expected.push(b);
  }
  check(JSON.stringify(ordinary.map(b => [b.x,b.y,b.z,b.w,b.h,b.d,b.color,b.ry ?? 0])) === JSON.stringify(expected.map(b => [b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7] ?? 0])), 'ordinary box records and yaw remain unchanged');

  const group = buildMeshes(boxes.list), repeated = buildMeshes(boxes.list), plantMeshes = group.children.filter(m => m.userData.plantKind), boxMeshes = group.children.filter(m => !m.userData.plantKind);
  check(group.userData.list.length === ordinary.length && group.userData.list.every(b => !b.plant), 'box test list remains box-only');
  check(plantMeshes.length === kinds.length && new Set(plantMeshes.map(m => m.userData.plantKind)).size === kinds.length, 'one instanced batch per plant kind');
  check(new Set(plantMeshes.map(m => m.geometry)).size === kinds.length && new Set(plantMeshes.map(m => m.material)).size === kinds.length, 'one shared geometry and material per plant kind');
  check(boxMeshes.length === new Set(expected.map(b => b[6])).size && boxMeshes.reduce((n,m) => n + m.count, 0) === ordinary.length, 'ordinary box batches retain their color counts');
  for (const kind of kinds) {
    const a = plantMeshes.find(m => m.userData.plantKind === kind), b = repeated.children.find(m => m.userData.plantKind === kind), geometry = createPlantGeometry(kind);
    const bounds = geometry.boundingBox;
    check(bounds.min.x >= -0.5-1e-5 && bounds.max.x <= 0.5+1e-5 && bounds.min.z >= -0.5-1e-5 && bounds.max.z <= 0.5+1e-5 && Math.abs(bounds.min.y) < 1e-5 && bounds.max.y <= 1+1e-5, `${kind} normalized ground-origin bounds`);
    check(a.count === plants.filter(p => p.plant === kind).length && a.instanceColor?.count === a.count, `${kind} uses tinted plant instances`);
    check(a.geometry === b.geometry && a.material === b.material && a.geometry !== geometry, `${kind} uses cached shared geometry and material`);
    geometry.dispose();
  }

  const byColor = new Map();
  for (const b of expected) (byColor.get(b[6]) ?? byColor.set(b[6], []).get(b[6])).push(b);
  const m = new T.Matrix4(), want = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), up = new T.Vector3(0,1,0);
  for (const mesh of boxMeshes) {
    const color = `#${mesh.material.color.getHexString()}`, records = byColor.get(color) ?? [];
    check(mesh.count === records.length, `box batch count remains unchanged for ${color}`);
    records.forEach((b,i) => {
      want.compose(p.set(b[0],b[1],b[2]), b[7] ? q.setFromAxisAngle(up,b[7]) : q.identity(), s.set(b[3],b[4],b[5]));
      mesh.getMatrixAt(i,m);
      check(m.elements.every((v,j) => Math.abs(v-want.elements[j]) < 1e-4), `box batch transform/yaw remains unchanged for ${color}`);
    });
  }
  return { pass:true, plants:plants.length, parkPlants:parkBoxes.list.filter(b => b.plant).length, plantBatches:plantMeshes.length, boxBatches:boxMeshes.length, boxes:ordinary.length };
})()'''))
