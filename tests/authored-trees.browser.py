tab=new_tab('about:blank');activate_tab(tab);cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);goto_url('http://localhost:8000/');wait_for_load()
print(js(r'''(async()=>{
  const T=await import('three'),{initGlbLoader}=await import('./js/world/glb-loader.js');
  const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas')});initGlbLoader(renderer);
  const {createTrees}=await import('./js/world/trees.js'),check=(v,m)=>{if(!v)throw Error(m)};
  const placements=Array.from({length:200},(_,i)=>({x:i*8-800,z:-22,h:4,crown:3,base:.1}));
  const group=await createTrees(placements),batches=group.userData.batches;
  check(group.name==='trees'&&batches.length>0,'authored tree group created');
  check(batches.every(b=>b.lods.length===3&&b.lods.every(m=>m.isInstancedMesh&&m.frustumCulled&&m.boundingSphere)),'three instanced LODs per spatial batch');
  const detailed=batches.flatMap(b=>[b.lods[0]]),total=detailed.reduce((n,m)=>n+m.count,0),variants=new Set(detailed.map(m=>m.name.split('-lod')[0]));
  check(total===placements.length&&variants.size===1,'all existing placements use the full-canopy authored tree');
  check([...variants].every(name=>name.endsWith('realistic-tree')),`only the full-canopy tree is loaded: ${[...variants]}`);
  const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
  for(const mesh of detailed){
    const geometry=mesh.geometry,box=geometry.boundingBox,p=geometry.attributes.position;
    check(box.min.y>=-.001&&Math.abs(box.max.y-1)<.002,'normalized feet-to-crown geometry bounds');
    let radius=0;for(let j=0;j<p.count;j++)radius=Math.max(radius,Math.hypot(p.getX(j),p.getZ(j)));
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
      const original=placements[mesh.userData.sourceIndices[i]];
      check(Math.abs(position.x-original.x)<.001&&Math.abs(position.z-original.z)<.001,'authored trees keep existing positions');
      check(Math.abs(position.y-original.base-.02)<.001&&radius*scale.x<=original.crown/2+.002,'tree stays on base and within original crown footprint');
      check(position.y+scale.y<=Math.min(original.base+6.6,(original.h+.65)*1.45+.4+original.base)+.01,'tree remains below existing landmark clearance cap');
    }
  }
  const masks=detailed.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]).filter(m=>m.alphaTest>=.4&&!m.transparent);
  check(masks.length>0,'foliage uses depth-writing alpha masks');
  const sample=batches[0],center=sample.bounds.getCenter(new T.Vector3());
  group.userData.update({position:center});check(sample.level===0&&sample.lods[0].visible,'near chunk selects LOD0');
  group.userData.update({position:center.add(new T.Vector3(1000,0,0))});check(sample.level===2&&sample.lods[2].visible,'far chunk selects impostors');
  const impostor=sample.lods[2].material;check(impostor.map?.image?.width===128,'single-silhouette impostor atlas loaded');
  check(typeof group.userData.dispose==='function','vegetation owns teardown');group.userData.dispose();renderer.dispose();
  return {pass:true,trees:total,variants:[...variants],chunks:batches.length,atlas:'128x128'};
})()'''))
