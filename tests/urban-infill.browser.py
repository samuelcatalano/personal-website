# Actual curved route, source envelopes and bounded construction for the new lots.
result=js(r'''(async()=>{
 const T=await import('three'),{buildCity}=await import('./js/world/city.js'),{stops}=await import('./js/content.js');
 const {routePoints,routeCurve,underpassFrames,UNDERPASS,riverStart,riverEnd}=await import('./js/world/layout.js');
 const {createCityBuildings}=await import('./js/world/building-kit.js'),{classifyPlot}=await import('./js/world/city-rollout.js');
 const check=(ok,m)=>{if(!ok)throw Error(m)},pts=routePoints(stops.length),curve=routeCurve(T,pts),all=[],trees=[],boxes=[];
 buildCity((...b)=>boxes.push(b),stops,pts,curve,(x,z,shape)=>trees.push({x,z,...shape}),undefined,p=>all.push(p));
 const {ARCHITECTURE_LAYOUT_OFFSETS}=await import('./js/world/layout-data.js');
 const pocketSources={
  'block-713--43-3':[773.6271433031652,-43.09061256479842,6,9,9],
  'block-713--43-4':[779.6271433031652,-43.09061256479842,6,9,9],
  'block-746--47':[794.1684200223535,-46.823959783945206,16,11,16],
  'frontage-gap-glasgow-585--1-0':[625,-4.619970992765651,9,7,12],
  'gap-47--98-0':[84,-97.52750330851623,6,8,9],
  'wembley-side--34--64':[801,-64,10,10,24],
  'wembley-side--48--68':[787,-68,10,10,30],
 };
 check(Object.keys(ARCHITECTURE_LAYOUT_OFFSETS).length===7,'exactly seven authorized pocket corrections');
 for(const [id,[x,z,w,d,h]] of Object.entries(pocketSources)){
  const p=all.find(p=>p.id===id),o=ARCHITECTURE_LAYOUT_OFFSETS[id];
  check(p&&o&&Math.abs(p.x-x-o.dx)<1e-9&&Math.abs(p.z-z-o.dz)<1e-9,'actual curved-route pocket pose '+id);
  check(p.width===w&&p.depth===d&&p.height===h,'preserved pocket dimensions '+id);
 }
 const bounds=p=>[p.x-p.width/2,p.x+p.width/2,p.z-p.depth/2,p.z+p.depth/2];
 const hit=(a,b,e=0)=>a[0]<b[1]+e&&b[0]-e<a[1]&&a[2]<b[3]+e&&b[2]-e<a[3];
 const added=all.filter(p=>p.id.startsWith('urban-infill-glasgow-front-house-')||p.id==='urban-infill-glasgow-square-house-0'||p.id.startsWith('urban-infill-glasgow-east-flat-')||p.id.startsWith('urban-infill-glasgow-lower-')||p.id.startsWith('urban-infill-glasgow-outline-')||p.id.startsWith('urban-infill-district-')||p.id.startsWith('urban-infill-gaps-')||p.id.startsWith('urban-infill-stadium-east-'));
 check(added.length===692,'all authorized Glasgow, neighbourhood, gap and stadium-side additions');
 const {walkPaths}=await import('./js/world/crowd.js');
 for(const p of added){
  for(const q of all)if(p!==q)check(!hit(bounds(p),bounds(q),1.5),'existing lot clearance '+p.id+' / '+q.id);
  for(const t of trees)check(!hit(bounds(p),[t.x,t.x,t.z,t.z],(t.crown||3)/2+.5),'tree clearance '+p.id);
  for(const b of boxes)if(b[1]+b[4]>.35)check(!hit(bounds(p),[b[0]-b[3]/2,b[0]+b[3]/2,b[2]-b[5]/2,b[2]+b[5]/2],.5),'prop clearance '+p.id);
  for(const {rect:r} of walkPaths(stops,pts))if(r)check(!hit(bounds(p),[r.x0,r.x1,r.z0,r.z1],.5),'pedestrian clearance '+p.id);
 }
 const plots=all.filter(p=>p.id.startsWith('urban-infill-'));
 check(plots.length===719&&plots.every(p=>classifyPlot(p)),'all surveyed lots use the existing modern families');
 for(const p of plots){
  for(let i=0;i<=1200;i++){
   const q=curve.getPointAt(i/1200),dx=Math.max(Math.abs(q.x-p.x)-p.width/2,0),dz=Math.max(Math.abs(q.z-p.z)-p.depth/2,0);
   check(Math.hypot(dx,dz)>=9,'curved road/sidewalk clearance '+p.id);
  }
  check(!(p.x>riverStart(stops,pts)-6&&p.x<riverEnd(stops,pts)+6&&p.z+p.depth/2>-64&&p.z-p.depth/2<-26),'river corridor '+p.id);
  for(const u of underpassFrames(curve,stops)){
   const a=(p.x-u.x)*u.tx+(p.z-u.z)*u.tz,c=-(p.x-u.x)*u.tz+(p.z-u.z)*u.tx;
   // The owner-marked bridge pockets reopen only their oversized reserve, retaining 2 m to the actual embankment.
   const bridgeSide=p.id.startsWith('urban-infill-glasgow-outline-bridge-side-')||p.id.startsWith('urban-infill-gaps-core-');
   const halfA=(Math.abs(u.tx)*p.width+Math.abs(u.tz)*p.depth)/2,halfC=(Math.abs(u.tz)*p.width+Math.abs(u.tx)*p.depth)/2;
   check(bridgeSide?!(Math.abs(a)<UNDERPASS.base+2+halfA&&Math.abs(c)<UNDERPASS.end+3+halfC):!(Math.abs(a)<18+p.width/2&&Math.abs(c)<80+p.depth/2),'bridge circulation '+p.id);
  }
 }
 const cities=[true,false].map(rollout=>createCityBuildings(plots,{rollout,kits:false})),city=cities[0].getObjectByName('citywide-architecture');
 let vertices=0,nearTriangles=0,initialBytes=0,materials=new Set();
 try{
  check(city.userData.plotIds.length===719&&city.children.every(c=>c.children.length===3),'shared chunk buckets');
  for(const c of city.children)for(const g of new Set(c.userData.lods.flat()))initialBytes+=Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);
  for(const cell of city.children){
   const camera={position:cell.userData.bounds.getCenter(new T.Vector3())};city.userData.update(camera);
   check(cell.userData.near,'new near cell prepared');
   const own=plots.filter(p=>cell.userData.plotIds.includes(p.id));
   for(const g of new Set(cell.userData.lods.flat())){
    const a=g.attributes.position,n=g.attributes.normal;vertices+=a.count;
    for(let i=0;i<a.count;i++){
     const x=a.getX(i)+cell.position.x,y=a.getY(i),z=a.getZ(i)+cell.position.z;
     check([x,y,z,n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite),'finite infill attributes');
     check(own.some(p=>Math.abs(x-p.x)<=p.width/2+.001&&Math.abs(z-p.z)<=p.depth/2+.001&&y>=-.001&&y<=p.height+.001),'infill envelope '+cell.name);
    }
   }
   cell.children.forEach(m=>{nearTriangles+=m.geometry.attributes.position.count/3;materials.add(m.material)});
  }
  let fallbackMeshes=0;cities[1].traverse(o=>{if(o.isMesh)fallbackMeshes++});check(fallbackMeshes>0,'diagnostic fallback retained');
  check(materials.size===2,'no material proliferation');
  return{pass:true,newLots:plots.length,totalLots:all.length,chunks:city.children.length,meshes:city.children.length*3,vertices,nearTriangles,initialMiB:initialBytes/1048576,materials:materials.size,fallbackMeshes};
 }finally{cities.forEach(c=>c.userData.dispose?.())}
})()''')
print(result)
assert result and result.get('pass'),result
