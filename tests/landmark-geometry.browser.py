# browser-harness < tests/landmark-geometry.browser.py
result=js(r'''(async()=>{
 const T=await import('three'),{buildLandmarks}=await import('./js/world/landmarks.js'),{stops}=await import('./js/content.js'),{routePoints,LANDMARKS,stopIndex,RIVER_Z}=await import('./js/world/layout.js'),{townhouseMaterials}=await import('./js/world/building-slice-materials.js');
 const pts=routePoints(stops.length),boxes=[],parts=buildLandmarks((...b)=>boxes.push(b),stops,pts),mats=townhouseMaterials(),metrics={};
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};let lightTris=0,lightMeshes=0;const lightMats=new Set(),washMats=new Set();
 for(const [name,key,dx,z0,z1,height,limit] of [['wembley','wembley',[-20.7,20.7],-84.5,-57.5,35.4,12000],['bigben','bigben',[-3.1,37],-65,-56.4,34,8000],['masp','masp',[-20,20],-69.5,-56.5,15.6,3000],['se','se',[-16,16],-70.5,-52,39.5,8000],['estaiada','estaiada',[-16,16],-75,-15,47,4000],['towerbridge','towerbridge',[-8,8],-63,-26,36,8000]]){
  const g=parts.details.getObjectByName(name+'-geometry');check(g,'Missing modernized '+name+' geometry');
  const x=LANDMARKS[key]?pts[stopIndex(stops,LANDMARKS[key])].x:g.position.x,b=new T.Box3().setFromObject(g),meshes=[];g.traverse(o=>{if(o.isMesh)meshes.push(o)});
  const lights=meshes.filter(m=>m.name.includes('-lights')),washes=meshes.filter(m=>m.name.endsWith('-wash'));check(meshes.length-lights.length-washes.length<=3,name+' exceeds three geometry buckets');check(lights.length<=2&&washes.length<=1,name+' light mesh budget');
  check(b.min.x>=x+dx[0]-.02&&b.max.x<=x+dx[1]+.02&&b.min.z>=z0-.02&&b.max.z<=z1+.02&&b.min.y>=(name==='towerbridge'?-1.02:-.02)&&b.max.y<=height+.02,name+' escaped original envelope '+JSON.stringify(b));
  let triangles=0;for(const m of meshes){if(m.name.includes('-lights')||m.name.endsWith('-wash'))continue;check([mats.architecture,mats.glass].includes(m.material),'New landmark material');for(const a of ['position','normal','uv','color','aSurface'])check(m.geometry.attributes[a],name+' missing '+a);check(Object.values(m.geometry.attributes).every(a=>a.array.every(Number.isFinite)),name+' non-finite attributes');check(m.geometry.boundingBox&&m.geometry.boundingSphere,'Missing bounds');triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}
  check(triangles<=limit,name+' triangle budget');
  for(const m of meshes.filter(m=>m.name.includes('-lights')||m.name.endsWith('-wash'))){check(!m.castShadow,name+' light mesh casts shadow');check(m.geometry.attributes.color,'light mesh needs vertex colour');check(Object.values(m.geometry.attributes).every(a=>a.array.every(Number.isFinite)),name+' light non-finite');(m.name.endsWith('-wash')?washMats:lightMats).add(m.material);if(m.name.includes('-lights'))lightMeshes++;lightTris+=m.geometry.attributes.position.count/3;}
  if(['wembley','estaiada','towerbridge'].includes(name))check(lights.length>=1,name+' has no emissive light mesh');metrics[name]={renderables:meshes.length,triangles,bounds:{min:b.min.toArray(),max:b.max.toArray()}};
 }
 {const rg=parts.details.getObjectByName('riverside-geometry');check(rg,'riverside geometry');let rl=0;rg.traverse(o=>{if(o.isMesh&&o.name.includes('-lights')){rl++;check(!o.castShadow,'riverside light shadow');lightMats.add(o.material);lightMeshes++;lightTris+=o.geometry.attributes.position.count/3;}else if(o.isMesh&&o.name.endsWith('-wash')){washMats.add(o.material);lightTris+=o.geometry.attributes.position.count/3;}});check(rl>=1&&rl<=2,'riverside needs 1-2 light meshes');
  check(lightMats.size<=2&&washMats.size<=1,'light materials not shared '+lightMats.size+'/'+washMats.size);check(lightMeshes<=8,'light mesh total '+lightMeshes);check(lightTris<=6000,'light triangle budget '+lightTris);metrics.lights={meshes:lightMeshes,triangles:lightTris,materials:lightMats.size,wash:washMats.size};
  const eb=parts.eye.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0)+parts.details.getObjectByName('eyeframe-geometry').children.reduce((n,m)=>n+(m.geometry.attributes.position.count)/3,0);check(eb<=4000,'Eye triangle budget '+eb);metrics.eye={triangles:eb};
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
