# Actual curved route, source envelopes and bounded construction for the new lots.
result=js(r'''(async()=>{
 const T=await import('three'),{buildCity}=await import('./js/world/city.js'),{stops}=await import('./js/content.js');
 const {routePoints,routeCurve,underpassFrames,riverStart,riverEnd}=await import('./js/world/layout.js');
 const {createCityBuildings}=await import('./js/world/building-kit.js'),{classifyPlot}=await import('./js/world/city-rollout.js');
 const check=(ok,m)=>{if(!ok)throw Error(m)},pts=routePoints(stops.length),curve=routeCurve(T,pts),all=[];
 buildCity(()=>{},stops,pts,curve,()=>{},undefined,p=>all.push(p));
 const plots=all.filter(p=>p.id.startsWith('urban-infill-'));
 check(plots.length===27&&plots.every(p=>classifyPlot(p)),'all surveyed lots use the existing modern families');
 for(const p of plots){
  for(let i=0;i<=1200;i++){
   const q=curve.getPointAt(i/1200),dx=Math.max(Math.abs(q.x-p.x)-p.width/2,0),dz=Math.max(Math.abs(q.z-p.z)-p.depth/2,0);
   check(Math.hypot(dx,dz)>=9,'curved road/sidewalk clearance '+p.id);
  }
  check(!(p.x>riverStart(stops,pts)-6&&p.x<riverEnd(stops,pts)+6&&p.z+p.depth/2>-64&&p.z-p.depth/2<-26),'river corridor '+p.id);
  for(const u of underpassFrames(curve,stops)){
   const a=(p.x-u.x)*u.tx+(p.z-u.z)*u.tz,c=-(p.x-u.x)*u.tz+(p.z-u.z)*u.tx;
   check(!(Math.abs(a)<18+p.width/2&&Math.abs(c)<80+p.depth/2),'bridge circulation '+p.id);
  }
 }
 const cities=[true,false].map(rollout=>createCityBuildings(plots,{rollout,kits:false})),city=cities[0].getObjectByName('citywide-architecture');
 let vertices=0,nearTriangles=0,initialBytes=0,materials=new Set();
 try{
  check(city.userData.plotIds.length===27&&city.children.every(c=>c.children.length===3),'shared chunk buckets');
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
