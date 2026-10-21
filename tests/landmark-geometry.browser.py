# browser-harness < tests/landmark-geometry.browser.py
result=js(r'''(async()=>{
 const T=await import('three'),{buildLandmarks}=await import('./js/world/landmarks.js'),{stops}=await import('./js/content.js'),{routePoints,LANDMARKS,stopIndex,RIVER_Z}=await import('./js/world/layout.js'),{townhouseMaterials}=await import('./js/world/building-slice-materials.js');
 const pts=routePoints(stops.length),boxes=[],parts=buildLandmarks((...b)=>boxes.push(b),stops,pts),mats=townhouseMaterials(),metrics={};
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 for(const [name,key,dx,z0,z1,height,limit] of [['wembley','wembley',[-20.7,20.7],-84.5,-57.5,35.4,12000],['bigben','bigben',[-3.1,37],-65,-57,34,8000],['masp','masp',[-20,20],-69.5,-56.5,15.6,3000]]){
  const g=parts.details.getObjectByName(name+'-geometry');check(g,'Missing modernized '+name+' geometry');
  const x=pts[stopIndex(stops,LANDMARKS[key])].x,b=new T.Box3().setFromObject(g),meshes=[];g.traverse(o=>{if(o.isMesh)meshes.push(o)});
  check(meshes.length<=3,name+' exceeds three geometry buckets');
  check(b.min.x>=x+dx[0]-.02&&b.max.x<=x+dx[1]+.02&&b.min.z>=z0-.02&&b.max.z<=z1+.02&&b.min.y>=-.02&&b.max.y<=height+.02,name+' escaped original envelope '+JSON.stringify(b));
  let triangles=0;for(const m of meshes){check([mats.architecture,mats.glass].includes(m.material),'New landmark material');for(const a of ['position','normal','uv','color','aSurface'])check(m.geometry.attributes[a],name+' missing '+a);check(Object.values(m.geometry.attributes).every(a=>a.array.every(Number.isFinite)),name+' non-finite attributes');check(m.geometry.boundingBox&&m.geometry.boundingSphere,'Missing bounds');triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}
  check(triangles<=limit,name+' triangle budget');metrics[name]={renderables:meshes.length,triangles,bounds:{min:b.min.toArray(),max:b.max.toArray()}};
 }
 parts.details.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(pts[stopIndex(stops,LANDMARKS.masp)].x,4,-50),new T.Vector3(0,0,-1));
 check(ray.intersectObject(parts.details.getObjectByName('masp-geometry'),true).length===0,'MASP central free span obstructed');
 ray.ray.origin.y=10;check(ray.intersectObject(parts.details.getObjectByName('masp-geometry'),true).length>0,'MASP suspended body missing above free span');
 check(parts.details.getObjectByName('bigben-four-clock-faces')?.count===4,'Four existing clocks retained');
 check(!boxes.some(([x,y,z,w,h,d])=>z===RIVER_Z-16&&w===34&&h===10&&d===8),'Legacy Parliament duplicated');
 check(!boxes.some(([x,y,z,w,h,d])=>z===RIVER_Z-18&&w===34&&h===6&&d===10),'Legacy MASP duplicated');
 return {pass:true,metrics};
})()''')
print(result)
