# With the local preview open in browser-harness: browser-harness < tests/urban-roads.browser.py
# Checks merged road surface geometry across a 160 m frustum chunk boundary.
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const T = await import('three');
  const worldModule = path => new URL(`/js/world/${path}`, location.origin).href;
  const { createUrbanRoadMeshes, roadCoverageBoxes, roadGrassPlots, sampleRoadAnchors, subtractRect } = await import(`${worldModule(`urban-road-mesh.js?fixture=${Date.now()}`)}`);
  const { PALETTE } = await import(worldModule('palette.js'));
  const rects = [
    { x: 159, z: 10, w: 12, d: 4, kind: 'road', region: 'test' },
    { x: 150, z: 20, w: 8, d: 2, kind: 'sidewalk', region: 'test' },
  ];
  const group = createUrbanRoadMeshes(rects), check = (ok, m) => { if (!ok) throw Error(m); };
  check(group.children.length === 3, 'split road at x=160 while preserving sidewalk kind');
  const area = geometry => {
    const p = geometry.attributes.position, idx = geometry.index, point = i => new T.Vector3().fromBufferAttribute(p, idx ? idx.getX(i) : i);
    let total = 0, count = idx ? idx.count : p.count;
    for (let i = 0; i < count; i += 3) total += point(i + 1).sub(point(i)).cross(point(i + 2).sub(point(i))).length() / 2;
    return total;
  };
  const totalArea = group.children.reduce((s, m) => s + area(m.geometry), 0);
  check(Math.abs(totalArea - 64) < 0.01, 'surface area preserved across chunk split: ' + totalArea);
  const materials = new Set(group.children.map(m => m.material));
  check(materials.size === 2, 'one shared material per conceptual surface');
  for (const mesh of group.children) {
    mesh.geometry.computeBoundingBox();
    check(mesh.geometry.attributes.normal && [...mesh.geometry.attributes.normal.array].every((_, i) => i % 3 !== 1 || mesh.geometry.attributes.normal.array[i] > .99), 'surface normals point up');
    check(mesh.castShadow === false && mesh.receiveShadow === true, 'surface shadow flags');
  }
  const boxes = roadCoverageBoxes(rects), plots = roadGrassPlots(rects);
  check(boxes.length === 2 && boxes[0].w === 12 && boxes[1].d === 2 && boxes[0].h > .22, 'prop obstacle footprints preserve source extents');
  check(plots.length === 2 && plots[0].width === 12 && plots[0].depth === 4, 'grass blockers preserve source extents');
  const roadBoxes = [
    { x: 0, z: 0, y: -.18, h: .24, w: 13.1, d: 13.1, color: PALETTE.road },
    { x: 100, z: -30, y: -.18, h: .24, w: 84, d: 4.6, ry: Math.PI / 4, color: PALETTE.road },
  ];
  const anchors = sampleRoadAnchors(roadBoxes);
  check(anchors.length === 18, 'square asphalt gets one anchor and long asphalt is sampled');
  for (const a of anchors) {
    const b = a.x > 50 ? roadBoxes[1] : roadBoxes[0], c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
    for (const dx of [-a.width / 2, a.width / 2]) for (const dz of [-a.width / 2, a.width / 2]) {
      const wx = a.x + dx, wz = a.z + dz, lx = c * (wx - b.x) - s * (wz - b.z), lz = s * (wx - b.x) + c * (wz - b.z);
      check(Math.abs(lx) <= b.w / 2 + .001 && Math.abs(lz) <= b.d / 2 + .001, 'anchor square stays inside source asphalt footprint');
    }
  }
  const outer = { x0: -8.5, x1: 8.5, z0: -36, z1: 36 }, portWidth = 4.5;
  let protectedRects = [outer];
  for (let z = 31.5; z <= 42; z += portWidth / 2) {
    const port = { x0: -portWidth / 2, x1: portWidth / 2, z0: z - portWidth / 2, z1: z + portWidth / 2 };
    protectedRects = protectedRects.flatMap(r => subtractRect(r, port));
  }
  const blocked = (x, z) => protectedRects.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  for (let z = 31.5; z <= 42; z += .5) check(!blocked(0, z), 'street width port stays continuous from terminal to outside reservation');
  check(blocked(0, 0), 'underpass center remains protected');
  check(blocked(2.8, 33), 'underpass sidewall remains protected outside the 4.5 m port');
  let disposed = 0;
  for (const mesh of group.children) { const dispose = mesh.geometry.dispose.bind(mesh.geometry); mesh.geometry.dispose = () => { disposed++; dispose(); }; }
  for (const material of materials) { const dispose = material.dispose.bind(material); material.dispose = () => { disposed++; dispose(); }; }
  group.userData.dispose(); group.userData.dispose();
  check(disposed === group.children.length + materials.size, 'owned resources disposed once');
  return { pass: true, meshes: group.children.length, materials: materials.size, surfaceArea: totalArea, disposed };
})()'''))
