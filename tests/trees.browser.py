# browser-harness < tests/trees.browser.py (local preview)
tab=new_tab('about:blank');activate_tab(tab);cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);goto_url('http://localhost:8000/');wait_for_load()
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
  const batches = mesh.userData.batches;
  check(batches?.length && batches.every(b => b.lods.length===3 && b.lods[0].canopy && b.lods[1].canopy && b.lods[2].impostor), 'tree chunks expose detailed, simplified and impostor LODs');
  const canopies = batches.flatMap(b => [b.lods[0].canopy]), trunks = batches.flatMap(b => [b.lods[0].trunk]);
  const newTrees = placements.filter(p => isWembleyBenchmark({x:p.x,z:p.z,width:p.crown*2,depth:p.crown*2}));
  const total = canopies.reduce((n,c) => n + c.count, 0);
  check(mesh.isGroup && batches.length >= 2 && batches.length <= 64 && canopies.length === batches.length && trunks.length === canopies.length && [...canopies, ...trunks,...batches.map(b=>b.lods[2].impostor)].every(m => m.frustumCulled && m.boundingSphere), 'trees stay in spatially chunked, frustum-culled instanced batches');
  check(total === placements.length && total === expected, 'one canopy instance per placement');
  check(batches.every(b=>b.lods[0].canopy.count===b.lods[1].canopy.count&&b.lods[1].canopy.count===b.lods[2].impostor.count&&b.lods[2].impostor.geometry.attributes.position.count===4),'each tree remains represented at every LOD');
  const center=b=>b.bounds.getCenter(new T.Vector3());mesh.userData.update({position:center(batches[0])});check(batches[0].level===0,'near tree chunk selects detailed LOD');mesh.userData.update({position:center(batches[0]).add(new T.Vector3(1000,0,0))});check(batches[0].level===2,'far tree chunk selects billboard impostor');mesh.userData.update({position:center(batches[0])});check(batches[0].level===0,'near return restores detailed tree geometry');
  check(!boxes.some(b => b[6] === P.trunk), 'voxel trees remain');
  check(batches.every(b=>[...Object.values(b.lods[0]),...Object.values(b.lods[1])].every(m=>m.castShadow&&m.receiveShadow)&&!b.lods[2].impostor.castShadow&&!b.lods[2].impostor.receiveShadow), 'near foliage shadows remain enabled without billboard shadow planes');
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
  const reducedTris=batches.reduce((n,b)=>n+b.lods[1].canopy.geometry.attributes.position.count/3*b.lods[1].canopy.count,0);
  check(stats.tris>reducedTris,'LOD1 reduces canopy detail without constraining the authored LOD0 triangle count');
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
