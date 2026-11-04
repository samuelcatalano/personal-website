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
  const cv=document.createElement('canvas'),atlasImg=impostor.map.image;cv.width=atlasImg.width;cv.height=atlasImg.height;const ctx2=cv.getContext('2d',{willReadFrequently:true});ctx2.drawImage(atlasImg,0,0);
  const px=ctx2.getImageData(0,0,cv.width,cv.height).data,AW=cv.width,AH=cv.height,isLeaf=(x,y)=>{const i=(y*AW+x)*4;return px[i+3]>=250&&px[i+1]>px[i]+3;};
  let minCol=AW,maxCol=-1,lowRow=-1;for(let y=0;y<AH;y++)for(let x=0;x<AW;x++)if(px[(y*AW+x)*4+3]>=77){minCol=Math.min(minCol,x);maxCol=Math.max(maxCol,x);lowRow=Math.max(lowRow,y);}
  for(const b of batches){const uv=b.lods[2].geometry.attributes.uv;let lo=1,hi=0;for(let i=0;i<uv.count;i++){lo=Math.min(lo,uv.getX(i));hi=Math.max(hi,uv.getX(i));}check(lo*AW<=minCol+.5&&hi*AW>=maxCol+.5,`impostor samples columns ${(lo*AW).toFixed(1)}-${(hi*AW).toFixed(1)} but the crown spans ${minCol}-${maxCol}`);}
  const faces=(eye)=>{let n=0;for(const b of batches){if(b.level!==2)continue;const m=b.lods[2];for(let k=0;k<m.count;k++){m.getMatrixAt(k,matrix);const e=matrix.elements,nl=Math.hypot(e[8],e[10]),ux=eye.x-e[12],uz=eye.z-e[14],ul=Math.hypot(ux,uz);n++;check(nl>0&&ul>0&&(e[8]*ux+e[10]*uz)/(nl*ul)>=Math.cos(Math.PI/36),`impostor ${k} misses the camera by more than 5 degrees`);}}return n;};
  let facing=0;for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){const ctr=sample.bounds.getCenter(new T.Vector3()),eye=new T.Vector3(ctr.x+dx*400,1.6,ctr.z+dz*400);group.userData.update({position:eye});facing+=faces(eye);}
  check(facing>0,'impostors are selected at far range for the facing check');
  const footFrac=(AH-1-lowRow)/AH,p2=new T.Vector3(),q2=new T.Quaternion(),s2=new T.Vector3();
  for(const b of batches)for(let k=0;k<b.lods[2].count;k++){b.lods[0].getMatrixAt(k,matrix);matrix.decompose(position,rotation,scale);const h0=scale.y;b.lods[2].getMatrixAt(k,matrix);matrix.decompose(p2,q2,s2);const rise=footFrac*s2.y;check(Math.abs(position.y-p2.y)<1e-4&&rise<=.02*h0+1e-4,`impostor trunk foot sits ${rise.toFixed(3)} m above the base (tree ${h0.toFixed(2)} m tall)`);}
  const solo=await createTrees([{x:0,z:0,h:4,crown:3,base:.1}]),soloBatch=solo.userData.batches[0],soloScene=new T.Scene(),soloCam=new T.PerspectiveCamera(40,1,.5,500);
  soloScene.add(solo);solo.children.filter(c=>c.name==='tree-understory').forEach(c=>c.visible=false);soloCam.position.set(0,3,14);soloCam.lookAt(0,3,0);soloCam.updateMatrixWorld();
  renderer.setSize(256,256,false);const shotCv=document.createElement('canvas');shotCv.width=256;shotCv.height=256;const shotCx=shotCv.getContext('2d',{willReadFrequently:true});
  const brightness=()=>{renderer.render(soloScene,soloCam);shotCx.clearRect(0,0,256,256);shotCx.drawImage(renderer.domElement,0,0);const d=shotCx.getImageData(0,0,256,256).data;let n=0,s=0;for(let i=0;i<d.length;i+=4){const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];if(l>3){n++;s+=l;}}return n?s/n:0;};
  const sun=new T.DirectionalLight(0xfff1d0,2.2),hemi=new T.HemisphereLight(0xcfe6ff,0x5c6e4a,1.2);sun.position.set(22.5,40,20);
  const lightsFor=(lights)=>{soloScene.children.filter(c=>c.isLight).forEach(l=>soloScene.remove(l));lights.forEach(l=>soloScene.add(l));return [0,1,2].map((L)=>{soloBatch.lods.forEach((m,i)=>{m.visible=i===L;});return brightness();});};
  const [, lod1Runtime, lod2Runtime]=lightsFor([sun,hemi]),[, lod1Flat, lod2Flat]=lightsFor([new T.AmbientLight(0xffffff,1)]);
  check(Math.abs(lod2Runtime/lod1Runtime-1)<=.15,`impostor is ${(lod2Runtime/lod1Runtime).toFixed(2)} times LOD1 brightness under runtime-like light`);
  check(Math.abs(lod2Flat/lod1Flat-1)<=.15,`impostor albedo is ${(lod2Flat/lod1Flat).toFixed(2)} times LOD1 under flat light (baked light still in atlas)`);
  solo.userData.dispose();
  const leafCut=sample.lods[0].material.find((m)=>m.alphaTest>0);
  check(Math.abs(impostor.alphaTest-leafCut.alphaTest)<1e-4,`impostor cutoff ${impostor.alphaTest} differs from leaf cutoff ${leafCut.alphaTest}`);
  check(typeof group.userData.dispose==='function','vegetation owns teardown');group.userData.dispose();renderer.dispose();
  return {pass:true,trees:total,variants:[...variants],chunks:batches.length,atlas:'128x128'};
})()'''))
