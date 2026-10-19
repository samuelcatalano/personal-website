assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
result = js(r'''(async () => {
  const THREE = await import('three');
  const { createBuilding, createCityBuildings } = await import('./js/world/building-kit.js?test=' + Date.now());
  const kinds = ['terrace', 'shop', 'midrise', 'office', 'tower'];
  const buildings = kinds.map((kind, i) => createBuilding({ id: kind, kind, x: i * 24, z: 10, width: 12, depth: 10, height: kind === 'tower' ? 36 : 15 }));
  const meshes = g => { const out = []; g.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
  for (const [i, building] of buildings.entries()) {
    const p = { x: i * 24, z: 10, width: 12, depth: 10, height: kinds[i] === 'tower' ? 36 : 15 };
    const bounds = new THREE.Box3().setFromObject(building), size = bounds.getSize(new THREE.Vector3());
    if (Math.abs(bounds.min.y) > 1e-5 || Math.abs(bounds.max.y - p.height) > 1e-4 || Math.abs(bounds.min.x - (p.x - p.width / 2)) > 1e-4 || Math.abs(bounds.max.x - (p.x + p.width / 2)) > 1e-4 || Math.abs(bounds.min.z - (p.z - p.depth / 2)) > 1e-4 || Math.abs(bounds.max.z - (p.z + p.depth / 2)) > 1e-4 || size.y > p.height + 1e-4) throw Error('building bounds invalid: ' + kinds[i]);
    if (!meshes(building).some(mesh => mesh.isInstancedMesh)) throw Error('facade details are not instanced: ' + kinds[i]);
  }
  const allMeshes = buildings.flatMap(meshes);
  if (new Set(allMeshes.map(mesh => mesh.geometry)).size !== 1) throw Error('archetypes do not share box geometry');
  for (const name of ['window-glass', 'window-frame']) {
    const materials = buildings.map(g => meshes(g).find(mesh => mesh.material.name === name)?.material);
    if (materials.some(material => !material) || new Set(materials).size !== 1) throw Error('archetypes do not share ' + name + ' material');
  }
  const materialSignatures = buildings.map(g => meshes(g).map(m => m.material.name).sort().join('|'));
  if (new Set(materialSignatures).size !== kinds.length) throw Error('archetypes lack distinct material signatures');
  for (const building of buildings) {
    const pane = meshes(building).find(mesh => mesh.material.name === 'window-glass');
    const frame = meshes(building).find(mesh => mesh.material.name === 'window-frame');
    const paneMatrix = new THREE.Matrix4().fromArray(pane.instanceMatrix.array.slice(0, 16));
    const frameMatrix = new THREE.Matrix4().fromArray(frame.instanceMatrix.array.slice(0, 16));
    const panePosition = new THREE.Vector3(), paneScale = new THREE.Vector3();
    const framePosition = new THREE.Vector3(), frameScale = new THREE.Vector3();
    paneMatrix.decompose(panePosition, new THREE.Quaternion(), paneScale);
    frameMatrix.decompose(framePosition, new THREE.Quaternion(), frameScale);
    if (panePosition.z + paneScale.z / 2 <= framePosition.z + frameScale.z / 2) throw Error('window glass and frame faces are coplanar');
  }
  const profiles = buildings.map(g => meshes(g).filter(m => !m.isInstancedMesh).slice(2).map(m => m.scale.toArray().join(',')).join('|'));
  if (new Set(profiles).size !== kinds.length) throw Error('archetypes lack silhouette variation');
  const compact = kinds.map(kind => createBuilding({ kind, x: 0, z: 0, width: 2, depth: 1, height: 0.5 }));
  for (const [i, building] of compact.entries()) {
    const bounds = new THREE.Box3().setFromObject(building);
    if (Math.abs(bounds.min.y) > 1e-5 || Math.abs(bounds.max.y - 0.5) > 1e-4 || Math.abs(bounds.min.x + 1) > 1e-4 || Math.abs(bounds.max.x - 1) > 1e-4 || Math.abs(bounds.min.z + 0.5) > 1e-4 || Math.abs(bounds.max.z - 0.5) > 1e-4) throw Error('compact building bounds invalid: ' + kinds[i]);
  }
  const plots = Array.from({ length: 200 }, (_, i) => ({ id: `plot-${i}`, kind: kinds[i % kinds.length], x: (i % 20) * 14, z: Math.floor(i / 20) * 14, width: 12, depth: 10, height: 15 + (i % 5) }));
  const cityBuildings = createCityBuildings(plots), cityMeshes = meshes(cityBuildings);
  if (cityMeshes.length > 20 || cityMeshes.some(mesh => !mesh.isInstancedMesh)) throw Error('city buildings exceed 20 instanced draw objects');
  if (cityBuildings.userData.buildingCount !== 200 || kinds.some(kind => !cityBuildings.userData.kinds.includes(kind))) throw Error('city building metadata invalid');
  const cityBounds = new THREE.Box3().setFromObject(cityBuildings), expected = new THREE.Box3();
  for (const plot of plots) { expected.expandByPoint(new THREE.Vector3(plot.x - plot.width / 2, 0, plot.z - plot.depth / 2)); expected.expandByPoint(new THREE.Vector3(plot.x + plot.width / 2, plot.height, plot.z + plot.depth / 2)); }
  if (!cityBounds.min.equals(expected.min) || !cityBounds.max.equals(expected.max)) throw Error('city bounds do not match source plot extent');
  if (new Set(cityMeshes.map(mesh => mesh.geometry)).size !== 1 || new Set(cityMeshes.map(mesh => mesh.material)).size !== cityMeshes.length) throw Error('city resources are not shared per material');
  if (!cityMeshes.some(mesh => mesh.material.name === 'window-glass') || !cityMeshes.some(mesh => mesh.material.name === 'window-frame')) throw Error('facade details were not instanced');
  return { pass: true, kinds, drawMeshes: buildings.map(g => meshes(g).length), instances: buildings.map(g => meshes(g).filter(m => m.isInstancedMesh).reduce((n, m) => n + m.count, 0)) };
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
