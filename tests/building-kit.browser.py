assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
result = js(r'''(async () => {
  const THREE = await import('three');
  const { createBuilding } = await import('./js/world/building-kit.js');
  const kinds = ['terrace', 'shop', 'midrise', 'office', 'tower'];
  const buildings = kinds.map((kind, i) => createBuilding({ id: kind, kind, x: i * 24, z: 10, width: 12, depth: 10, height: kind === 'tower' ? 36 : 15 }));
  const meshes = g => { const out = []; g.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
  for (const [i, building] of buildings.entries()) {
    const p = { x: i * 24, z: 10, width: 12, depth: 10, height: kinds[i] === 'tower' ? 36 : 15 };
    const bounds = new THREE.Box3().setFromObject(building), size = bounds.getSize(new THREE.Vector3());
    if (Math.abs(bounds.min.y) > 1e-5 || Math.abs(bounds.max.y - p.height) > 1e-4 || Math.abs(bounds.min.x - (p.x - p.width / 2)) > 1e-4 || Math.abs(bounds.max.x - (p.x + p.width / 2)) > 1e-4 || Math.abs(bounds.min.z - (p.z - p.depth / 2)) > 1e-4 || Math.abs(bounds.max.z - (p.z + p.depth / 2)) > 1e-4 || size.y > p.height + 1e-4) throw Error('building bounds invalid: ' + kinds[i]);
    if (!meshes(building).some(mesh => mesh.isInstancedMesh)) throw Error('facade details are not instanced: ' + kinds[i]);
  }
  if (new Set(buildings.map(g => meshes(g).map(m => m.material.name).sort().join('|'))).size < 3) throw Error('archetypes lack material variation');
  const profiles = buildings.map(g => meshes(g).filter(m => !m.isInstancedMesh).slice(2).map(m => m.scale.toArray().join(',')).join('|'));
  if (new Set(profiles).size !== kinds.length) throw Error('archetypes lack silhouette variation');
  const compact = kinds.map(kind => createBuilding({ kind, x: 0, z: 0, width: 2, depth: 1, height: 0.5 }));
  for (const [i, building] of compact.entries()) {
    const bounds = new THREE.Box3().setFromObject(building);
    if (Math.abs(bounds.min.y) > 1e-5 || Math.abs(bounds.max.y - 0.5) > 1e-4 || Math.abs(bounds.min.x + 1) > 1e-4 || Math.abs(bounds.max.x - 1) > 1e-4 || Math.abs(bounds.min.z + 0.5) > 1e-4 || Math.abs(bounds.max.z - 0.5) > 1e-4) throw Error('compact building bounds invalid: ' + kinds[i]);
  }
  return { pass: true, kinds, drawMeshes: buildings.map(g => meshes(g).length), instances: buildings.map(g => meshes(g).filter(m => m.isInstancedMesh).reduce((n, m) => n + m.count, 0)) };
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
