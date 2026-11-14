# Same-origin fixture, installed loader; live WebGL botanical/placement/LOD contracts.
print(js(r'''(async()=>{
 const T=await import('three'),{initGlbLoader}=await import('/js/world/glb-loader.js'),{createTrees}=await import('/js/world/trees.js');
 const r=new T.WebGLRenderer({antialias:true});r.setSize(200,200);initGlbLoader(r);
 const check=(ok,msg)=>{if(!ok)throw Error(msg)},placements=Array.from({length:90},(_,i)=>({x:i*8-360,z:-22+(i%3)*10,h:4,crown:3,base:.1}));
 const regions=['sp','london','glasgow'],regionAt=x=>regions[Math.round((x+360)/8)%3];
 const forest=await createTrees(placements,regionAt),batches=forest.userData.batches;
 const names=new Set(batches.map(b=>b.lods[0].name));
 check([...names].every(n=>n.includes('botanical-'))&&names.size>=5,'legacy single-family trees still active');
 const sources=new Set(),m=new T.Matrix4(),v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 for(const b of batches){
  check(b.lods.length===2&&b.proxy,'physical near/far models and foliage shadow proxy required');
  const mesh=b.lods[0],p=mesh.geometry.attributes.position,box=mesh.geometry.boundingBox;
  check(Math.abs(box.min.y)<.002&&Math.abs(box.max.y-1)<.002,'normalized tree feet/top');
  let radius=0;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
  for(let i=0;i<mesh.count;i++){
   const index=mesh.userData.sourceIndices[i],original=placements[index];check(!sources.has(index),'duplicate tree placement');sources.add(index);
   mesh.getMatrixAt(i,m);m.decompose(v,q,s);
   check(Math.abs(v.x-original.x)<.001&&Math.abs(v.z-original.z)<.001&&Math.abs(v.y-original.base-.02)<.001,'tree centre or root moved');
   check(radius*s.x<=original.crown/2+.003&&v.y+s.y<=original.base+6.6,'existing crown/landmark envelope changed');
  }
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  check(mats.some(m=>m.alphaTest>=.4&&m.side===T.DoubleSide&&m.depthWrite&&!m.transparent),'porous foliage must write alpha-clipped depth');
  check(mats.every(m=>m.metalness===0),'vegetation must not become fully metallic');
 }
 check(sources.size===placements.length,'tree population changed');
 const sample=batches[0],center=sample.bounds.getCenter(new T.Vector3());
 forest.userData.update({position:center});check(sample.level===0,'near detailed model missing');
 forest.userData.setShadowProxies(true);check(sample.proxy.visible,'near foliage does not cast detailed shadows');forest.userData.setShadowProxies(false);check(!sample.proxy.visible,'shadow proxies leak into colour pass');
 forest.userData.update({position:new T.Vector3(sample.bounds.max.x+180,center.y,center.z)});check(sample.level===1,'mid view loses physical branches too early');
 forest.userData.update({position:center.clone().add(new T.Vector3(1500,0,0))});check(sample.level===1&&sample.lods[1].geometry.attributes.position.count>1000,'far range must retain physical leaves and branches');
 const allowed={sp:['oak','plane','ipe'],london:['oak','plane','birch'],glasgow:['oak','plane','birch','spruce']},species=[];
 for(const batch of batches)for(const index of batch.lods[0].userData.sourceIndices){
  const region=regionAt(placements[index].x);check(allowed[region].some(kind=>batch.lods[0].name.includes('botanical-'+kind+'-')),'tree family ignores regional planting');
 }
 for(const region of regions)species.push({region,names:[...new Set(batches.filter(b=>b.lods[0].userData.sourceIndices.some(i=>regionAt(placements[i].x)===region)).map(b=>b.lods[0].name.split('-lod')[0]))]});
 const probe=new T.Scene(),camera=new T.OrthographicCamera(-4,4,6,-2,.1,100);camera.position.set(0,2,14);camera.lookAt(0,2,0);camera.updateMatrixWorld();
 r.setSize(256,256,false);r.setClearColor(0x000000,1);const image=document.createElement('canvas');image.width=image.height=256;const cx=image.getContext('2d',{willReadFrequently:true}),transitions=[];
 const light=new T.DirectionalLight(0xfff1d0,2.2),hemi=new T.HemisphereLight(0xcfe6ff,0x5c6e4a,1.2);light.position.set(22.5,40,20);
 const measure=()=>{r.render(probe,camera);cx.clearRect(0,0,256,256);cx.drawImage(r.domElement,0,0);const d=cx.getImageData(0,0,256,256).data;let coverage=0,sum=0;for(let i=0;i<d.length;i+=4){const luminance=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];if(luminance>3){coverage++;sum+=luminance;}}return {coverage,luminance:sum/Math.max(1,coverage)};};
 const checked=new Set();for(const batch of batches){
  const family=batch.lods[0].name.split('-lod')[0];if(checked.has(family))continue;checked.add(family);
  let radius=0;const p=batch.lods[0].geometry.attributes.position;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
  const width=3/(2*radius),fit=Math.max(1,2*radius)*1.16,lods=[batch.lods[0],batch.lods[1],batch.lods[1]].map((source,level)=>{
   const o=new T.InstancedMesh(source.geometry,source.material,1),matrix=new T.Matrix4().makeScale(width,5,width);o.setMatrixAt(0,matrix);o.computeBoundingSphere();probe.add(o);return o;
  });
  const modes={};for(const mode of ['flat','day']){
   const lights=mode==='flat'?[new T.AmbientLight(0xffffff,1)]:[light,hemi];lights.forEach(l=>probe.add(l));
   modes[mode]=lods.map((o,index)=>{lods.forEach((m,i)=>m.visible=i===index);return measure()});lights.forEach(l=>probe.remove(l));
   const values=modes[mode];check(values[2].luminance===values[1].luminance&&values[2].coverage===values[1].coverage,family+' '+mode+' far range changed physical material/geometry');
   check(Math.abs(values[1].luminance/values[0].luminance-1)<=.15,family+' '+mode+' near/mid brightness jumps: '+JSON.stringify(values));
   check(values[1].coverage/values[0].coverage>.75&&values[1].coverage/values[0].coverage<1.25,family+' mid canopy density jumps: '+JSON.stringify(values));
  }
  transitions.push({family,...modes});lods.forEach(o=>{probe.remove(o);o.dispose()});
 }
 check(!r.getContext().getError()&&r.info.programs.every(p=>p.diagnostics?.runnable!==false),'botanical shader compilation failed');
 const geometry=new Set();forest.traverse(o=>{if(o.isMesh)geometry.add(o.geometry)});let disposed=0;geometry.forEach(g=>g.addEventListener('dispose',()=>disposed++));
 forest.userData.dispose();forest.userData.dispose();check(disposed===geometry.size,'tree geometry is leaked/double-disposed');
 forest.userData.dispose();r.dispose();return {passed:true,trees:sources.size,variants:names.size,regional:species,transitions};
})()'''))
