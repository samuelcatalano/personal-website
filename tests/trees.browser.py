# browser-harness < tests/trees.browser.py (local preview)
print(js(r'''(async () => {
  const T = await import('three');
  const { createTrees } = await import('./js/world/trees.js');
  const { buildCity } = await import('./js/world/city.js');
  const { buildLandmarks } = await import('./js/world/landmarks.js');
  const { PALETTE: P } = await import('./js/world/palette.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const { isWembleyBenchmark } = await import('./js/world/layout.js');
  const { stops } = await import('./js/content.js');
  const { walkPaths } = await import('./js/world/crowd.js');
  const pts = routePoints(stops.length), placements = [], boxes = [];
  const collect = (x,z,shape) => placements.push({x,z,...shape});
  const add = (...b) => boxes.push(b);
  buildCity(add, stops, pts, routeCurve(T,pts), collect);
  buildLandmarks(add, stops, pts, collect);
  let expected = 0;
  const countTrunk = (...b) => { if (b[6] === P.trunk) expected++; };
  const countTree = () => expected++;
  buildCity(countTrunk, stops, pts, routeCurve(T,pts), countTree); buildLandmarks(countTrunk, stops, pts, countTree);
  const mesh = await createTrees(placements), check = (ok, msg) => { if (!ok) throw Error(msg); };
  const canopies = mesh.children.filter(o => o.name.startsWith('trees-canopy-')), trunks = mesh.children.filter(o => o.name.startsWith('trees-trunk-'));
  const newTrees = placements.filter(p => isWembleyBenchmark({x:p.x,z:p.z,width:p.crown*2,depth:p.crown*2}));
  const total = canopies.reduce((n,c) => n + c.count, 0);
  check(mesh.isGroup && canopies.length >= 2 && trunks.length === canopies.length && mesh.children.length <= 64 && [...canopies, ...trunks].every(m => m.frustumCulled && m.boundingSphere), 'trees stay in few spatially chunked, frustum-culled instanced batches');
  check(total === placements.length && total === expected, 'one canopy instance per placement');
  check(!boxes.some(b => b[6] === P.trunk), 'voxel trees remain');
  check(mesh.children.every(o => o.name === 'tree-understory' || (o.castShadow && o.receiveShadow)), 'foliage shadows must remain enabled');
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), scale = new T.Vector3(), heights = new Set(), tints = new Set();
  const stats = {tris: 0};
  for (const c of canopies) {
    check(c.instanceColor, 'canopy leaf tint');
    for (const a of c.instanceColor.array) tints.add(a.toFixed(2));
    stats.tris += c.geometry.attributes.position.count / 3 * c.count;
    const box = c.geometry.boundingBox, idx = c.userData.sourceIndices;
    check(box.max.y <= 1 + 1e-4 && Math.max(Math.hypot(box.max.x, box.max.z), Math.hypot(box.min.x, box.min.z)) <= Math.SQRT2 + 1e-4, 'canopy unit bounds');
    for (let k = 0; k < c.count; k++) {
      const original = placements[idx[k]];
      c.getMatrixAt(k, m); m.decompose(p, q, scale);
      check(Math.abs(p.x-original.x)<1e-4 && Math.abs(p.z-original.z)<1e-4, 'tree position changed');
      let r = 0; const pos = c.geometry.attributes.position; // true horizontal reach under instance rotation/scale
      const e = new T.Euler().setFromQuaternion(q);
      for (let i = 0; i < pos.count; i += 1) { const v = new T.Vector3().fromBufferAttribute(pos, i).multiply(scale).applyQuaternion(q); r = Math.max(r, Math.hypot(v.x, v.z)); }
      check(r <= original.crown/2 + 1e-4, 'crown grows into paths');
      const top = p.y + scale.y * box.max.y;
      check(top <= Math.min((original.base ?? .1)+6.6, (original.h+.65)*1.45+.4+(original.base ?? .1)), 'tree grows above landmark clearance'); // North Star canopy cap (2026-10-21)
      check(p.y - scale.y >= 0.5 && p.y >= 0, 'canopy sinks to the ground');
      heights.add(top.toFixed(2));
    }
  }
  trunks.forEach((t, k) => check(t.count === canopies[k].count && t.name.split('-').pop() === canopies[k].name.split('-').pop() && t.instanceColor, 'trunk matches canopy')); // paired per type per chunk
  check(heights.size>3 && tints.size>3 && newTrees.length>=3, 'trees need varied heights and tints');
  check(stats.tris < 250000, 'tree triangle budget '+stats.tris);
  let samples = 0;
  for (const path of walkPaths(stops,pts).filter(p => p.type !== 'lane')) {
    const {x0,x1,z0,z1}=path.rect;
    const lo=path.type === 'loop' ? .6 : .35;
    const hi=path.type === 'loop' ? 1.6 : Math.max(.35,Math.min(6,(Math.min(x1-x0,z1-z0)-1)/2));
    const near=placements.filter(p => p.x+p.crown/2>x0 && p.x-p.crown/2<x1 && p.z+p.crown/2>z0 && p.z-p.crown/2<z1);
    const probe=(x,z) => {
      samples++;
      check(!near.some(p => Math.hypot(x-p.x,z-p.z)<p.crown/2+.22), 'tree canopy enters walking path '+path.name);
    };
    for(const inset of [lo,(lo+hi)/2,hi]) {
      for(let x=x0+inset;x<x1-inset;x+=.4) {probe(x,z0+inset);probe(x,z1-inset);}
      for(let z=z0+inset;z<z1-inset;z+=.4) {probe(x0+inset,z);probe(x1-inset,z);}
    }
  }
  mesh.userData.dispose(); mesh.userData.dispose();
  return {pass:true, trees:placements.length, benchmarkTrees:newTrees.length, heights:heights.size, drawBatches:mesh.children.length, tris:stats.tris, pathSamples:samples};
})()'''))
