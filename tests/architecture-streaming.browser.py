# Same-origin browser-harness fixture; no scene debug globals required.
result = js(r'''(async()=>{
 const T=await import('three'),r=await import('./js/world/city-rollout.js');
 const {addRoomCoordinates,townhouseMaterials,roomGlassMaterial}=await import('./js/world/building-slice-materials.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)},bytes=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);
 const plots=[
  {id:'stream-town',kind:'terrace',x:4,z:8,width:6,depth:9,height:12},
  {id:'stream-shop',kind:'shop',x:15,z:8,width:10,depth:10,height:8},
  {id:'stream-midrise',kind:'midrise',x:42,z:8,width:14,depth:12,height:24},
  {id:'stream-office',kind:'office',x:74,z:8,width:14,depth:13,height:28},
  {id:'stream-tower',kind:'tower',x:106,z:8,width:14,depth:13,height:48}
 ];
 const original=JSON.stringify(plots),city=r.createCityRollout(plots),chunks=city.children;
 const initial=chunks.map(c=>c.userData.lods[1]);let initialBytes=0,completeBytes=0;
 for(const c of chunks){
  const d=c.userData;check(d.lods.length===2&&d.lods[0]===d.lods[1],'Startup allocates a complete near copy');
  initialBytes+=d.lods[1].reduce((n,g)=>n+bytes(g),0);
  check(c.children.every((m,k)=>m.geometry===d.lods[1][k]&&m.material===(k===2?roomGlassMaterial():townhouseMaterials().architecture)),'Startup loses far geometry or material identity');
 }
 for(const p of plots){const h=r.building(p,r.classifyPlot(p),plots);addRoomCoordinates(h.children[2].geometry,p.x,p.z);for(const m of h.children){completeBytes+=bytes(m.geometry);m.geometry.dispose();}}
 check(initialBytes<completeBytes*.5,'Far startup allocation is not bounded below half complete-near allocation');
 check(JSON.stringify(plots)===original&&city.userData.plotIds.length===plots.length&&plots.every(p=>city.userData.plotIds.includes(p.id)),'Streaming mutates or drops source lots');
 // Nearest-first and one-cell budget, including several cells already within the near radius.
 const camera={position:new T.Vector3(108,2,8)},nearest=chunks.reduce((a,b)=>a.userData.bounds.distanceToPoint(camera.position)<b.userData.bounds.distanceToPoint(camera.position)?a:b);
 check(city.userData.update(camera)===true,'Near preparation does not request another reduced-motion frame');
 check(chunks.filter(c=>c.userData.lods[0]!==c.userData.lods[1]).length===1&&nearest.userData.lods[0]!==nearest.userData.lods[1],'Near builds exceed one update or ignore nearest-first order');
 for(let i=1;i<chunks.length;i++){city.userData.update(camera);check(chunks.filter(c=>c.userData.lods[0]!==c.userData.lods[1]).length===i+1,'Near build budget/starvation');}
 for(const c of chunks){
  const near=c.userData.lods[0],far=c.userData.lods[1];check(near[1].attributes.position.count>far[1].attributes.position.count,'Near detail never restores construction');
  check([...near[1].attributes.normal.array].some(v=>Math.abs(v)>.05&&Math.abs(v)<.95),'Near construction loses beveled profiles');
  check(near[2].attributes.aRoom?.array.some((v,i)=>i%4===3&&v>0),'Near glazing loses room attributes');
 }
 // Isolate hysteresis from neighbours and assert release only after swapping active meshes.
 const one=r.createCityRollout([plots[2]]),cell=one.children[0],d=cell.userData;
 const at=distance=>({position:new T.Vector3(d.bounds.max.x+distance,2,(d.bounds.min.z+d.bounds.max.z)/2)});
 one.userData.update(at(119));check(d.level===0&&cell.children.every((m,k)=>m.geometry===d.lods[0][k]),'Initial entry threshold');
 const first=d.lods[0],disposed=new Map(first.map(g=>[g,0]));
 first.forEach(g=>g.addEventListener('dispose',()=>{check(cell.children.every(m=>m.geometry!==g),'Disposed active near geometry');disposed.set(g,disposed.get(g)+1);}));
 one.userData.update(at(128));check(d.level===0,'Near exits before 129m');
 one.userData.update(at(130));check(d.level===1&&d.lods[0]===first,'Far switch eagerly discards reusable near');
 one.userData.update(at(112));check(d.level===1,'Far enters before 111m');
 one.userData.update(at(110));check(d.level===0,'Near fails to enter below 111m');
 one.userData.update(at(181));check(d.lods[0]===d.lods[1]&&[...disposed.values()].every(n=>n===1),'Eviction fails or disposes a near geometry twice');
 one.userData.update(at(110));check(d.lods[0]!==first&&d.lods[0]!==d.lods[1]&&d.level===0,'Evicted near fails to regenerate');
 const resident=new Set(one.children.flatMap(c=>c.userData.lods.flat())),released=new Map([...resident].map(g=>[g,0]));resident.forEach(g=>g.addEventListener('dispose',()=>released.set(g,released.get(g)+1)));
 one.userData.dispose();one.userData.dispose();one.userData.update(at(0));check([...released.values()].every(n=>n===1),'Teardown does not dedupe far aliases or updates after disposal');
 // Kits register a lazy near factory; loading alone never rebuilds distant chunks.
 const {upgradeFacadeKits}=await import('./js/world/facade-kit.js'),town=await import('./js/world/building-slice.js');
 await town.loadTownhouseKit();await Promise.resolve();
 const beforeKits=chunks.map(c=>c.userData.lods[0]),stats=await upgradeFacadeKits(city,plots);
 check(stats&&stats.chunks===0&&stats.buildMs===0,'Kit loading eagerly allocates near chunks');
 check(chunks.every((c,i)=>c.userData.lods[0]===beforeKits[i]&&typeof c.userData.nearFactory==='function'),'Loaded kits lose active procedural detail or skip factory registration');
 const mixed=chunks.find(c=>c.userData.plotIds.includes('stream-town')),mixedCamera={position:mixed.userData.bounds.getCenter(new T.Vector3())};
 city.userData.update(mixedCamera);check(stats.chunks===1,'Registered kit budget is not one chunk');
 check(mixed.userData.lods[0]!==beforeKits[chunks.indexOf(mixed)]&&mixed.userData.kit===mixed.userData.lods[0],'Mixed facade cell loses authored townhouse kit');
 check(mixed.userData.lods[0][2].attributes.aRoom.array.some((v,i)=>i%4===3&&v>0),'Loaded kit rebuild loses rooms');
 const expectedTown=town.modularGeometry(plots[0],r.rolloutRecipe(plots[0],'townhouse',plots),await town.loadTownhouseKit(),true);
 check(mixed.userData.lods[0][0].attributes.position.count>expectedTown[0].attributes.position.count,'Mixed-cell factory loses other buildings');expectedTown.forEach(g=>g.dispose());
 const farDisposals=new Map(initial.flat().map(g=>[g,0]));initial.flat().forEach(g=>g.addEventListener('dispose',()=>farDisposals.set(g,farDisposals.get(g)+1)));
 city.userData.dispose();city.userData.dispose();check([...farDisposals.values()].every(n=>n===1),'Far geometry disposed early or twice');
 const dead=r.createCityRollout(plots),pending=upgradeFacadeKits(dead,plots),deadGeometries=new Set(dead.children.flatMap(c=>c.userData.lods.flat()));dead.userData.dispose();await pending;dead.userData.update(camera);
 check(dead.children.every(c=>c.userData.lods.flat().every(g=>deadGeometries.has(g))&&!c.userData.nearFactory),'Disposed-before-kit-ready allocates or registers new geometry');
 // Failed parallel kit loads retain the procedural near path without allocating any replacement.
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),load=GLTFLoader.prototype.loadAsync,attempted=[];
 const fallback=r.createCityRollout(plots.slice(1));
 try{
  GLTFLoader.prototype.loadAsync=function(url){if(url.includes('/buildings/')&&url.includes('-kit.glb')){attempted.push(url);return Promise.reject(Error('Expected unavailable fixture kit'));}return load.call(this,url);};
  const failed=await upgradeFacadeKits(fallback,plots.slice(1));
  check(attempted.length===4&&failed.chunks===0&&fallback.children.every(c=>!c.userData.nearFactory),'Failed kits do not preserve procedural fallback');
  fallback.userData.update({position:fallback.children[0].userData.bounds.getCenter(new T.Vector3())});
  check(fallback.children.filter(c=>c.userData.lods[0]!==c.userData.lods[1]).length===1,'Procedural detail cannot build after failed kits');
 }finally{GLTFLoader.prototype.loadAsync=load;fallback.userData.dispose();}
 return {pass:true,lots:plots.length,chunks:chunks.length,initialMiB:initialBytes/1048576,completeNearMiB:completeBytes/1048576,startupRatio:initialBytes/completeBytes,kitBuilds:stats.chunks};
})()''')
print(result)
assert result and result.get('pass'), result
