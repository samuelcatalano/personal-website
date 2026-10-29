# BU_CDP_URL=http://127.0.0.1:9340 browser-harness < tests/regional-fleet.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
 const THREE = await import('three'), A = await import('./js/world/vehicle-assets.js');
 const check = (v,m) => {if(!v) throw Error(m)};
 check(typeof A.loadFleetCatalog === 'function', 'cached regional fleet catalog is available');
 const catalog = await A.loadFleetCatalog(); check(catalog.length === 6, 'all six catalog models');
 check(A.loadFleetCatalog() === A.loadFleetCatalog(), 'catalog promise cached');
 const selected = ['br','uk'].flatMap(region => Array.from({length:6},(_,i) => A.regionalFleetModel(catalog,region,i)?.id).filter(Boolean));
 check(new Set(selected).size===6, 'deterministic selection exercises every regional model');
 check(!A.regionalFleetModel([], 'br', 0), 'missing catalog keeps fallback');
 for (const m of catalog) {
  const src = await A.loadVehicleAsset(m.id); check(src && src === await A.loadVehicleAsset(m.id), m.id+' loads once');
  const a = new THREE.Group(), b = new THREE.Group();
  await Promise.all([A.upgradeFleet(a,m,{body:'#142b4a'}), A.upgradeFleet(b,m,{body:'#a31d2a'})]);
  const meshes = o => {const r=[];o.traverse(x=>{if(x.isMesh)r.push(x)});return r};
  const am=meshes(a), bm=meshes(b), names=[...new Set(am.map(x=>x.material.name))].sort();
  check(JSON.stringify(names)===JSON.stringify([...m.materials].sort()) && a.userData.wheels.length===2 && a.userData.wheels.every(w=>w.children.length>0&&w.children.every(x=>x.material.isMaterial)), m.id+' source materials and two spinning axles');
  if(m.id==='honda-hr-v')check(am.some(x=>x.material.name.endsWith('Calipers'))&&a.userData.wheels.every(w=>w.children.every(x=>!x.material.name.endsWith('Calipers'))),'Honda brake calipers stay on the body');
  check(am.every((x,i)=>x.geometry===bm[i].geometry), 'shared source geometry '+m.id);
  const paintA=am.filter(x=>m.paintMaterials.includes(x.material.name)),paintB=bm.filter(x=>m.paintMaterials.includes(x.material.name));
  check(paintA.length>0&&paintA.every(x=>x.material.color.getHexString()==='142b4a'&&x.material.metalness>=.7)&&paintB.every(x=>x.material.color.getHexString()==='a31d2a'&&x.material!==paintA.find(y=>y.material.name===x.material.name)?.material), 'isolated metallic per-car paint '+m.id);
  check(am.filter(x=>!m.paintMaterials.includes(x.material.name)).every((x,i)=>x.material===bm.filter(y=>!m.paintMaterials.includes(y.material.name))[i]?.material), 'shared nonpaint materials '+m.id);
  const box=new THREE.Box3().setFromObject(a), size=box.getSize(new THREE.Vector3());
  check(Math.abs(size.x-m.dimensions.length)<.03 && Math.abs(box.min.y)<.02 && Math.abs(size.y-m.dimensions.height)<.04, 'metre bounds '+m.id);
  check(a.userData.length===m.dimensions.length && a.userData.front>0 && a.userData.beamY>0, 'physical metadata '+m.id);
  check(am.every(x=>x.frustumCulled), 'standard culling '+m.id);
 }
 const {createAmbient}=await import('./js/world/ambient.js'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js');
 const pts=routePoints(stops.length),curve=routeCurve(THREE,pts),scene=new THREE.Scene();
 const ambient=createAmbient(scene,{pts,curve,stops}), traffic=scene.children.slice(0,20), minis=traffic.filter(x=>x.name==='mini');
 const cream=new Set(['f1ead9','efe7d6']);
 const exclusive=()=>check(minis.every(x=>{let ok=true;x.traverse(o=>{if(o.isMesh&&o.material?.color&&cream.has(o.material.color.getHexString()))ok=false});return ok}), 'ambient cream Mini excluded');
 exclusive(); await ambient.ready;exclusive();
 const cars=traffic.filter(x=>x.userData.fleetModel);check(cars.length===9,'nine regional traffic slots');
 check(cars.every(x=>catalog.find(m=>m.id===x.userData.fleetModel).region.includes(traffic.indexOf(x)>=16?'br':'uk')),'regional selection');
 const colors=new Set(['151a20','b9bec5','a31d2a','142b4a','173b2d']);
 check(cars.every(x=>{const m=catalog.find(y=>y.id===x.userData.fleetModel);let paint=[];x.traverse(o=>{if(o.isMesh&&m.paintMaterials.includes(o.material.name))paint.push(o.material)});return paint.length&&paint.every(p=>colors.has(p.color.getHexString())&&p.metalness>=.7)}),'metallic palette without pink');
 const before=traffic.map(x=>x.position.clone());for(let i=0;i<120;i++)ambient.update({time:i/30,t:.5,dt:1/30});
 check(traffic.some((x,i)=>x.visible&&x.position.distanceTo(before[i])>1),'traffic moves');
 {const roll=x=>x.userData.wheels?.length===2&&x.userData.wheels.every(w=>Math.abs(w.rotation.z)>0.5),moved=traffic.filter((x,i)=>x.visible&&x.position.distanceTo(before[i])>1);check(moved.filter(x=>x.userData.fleetModel).every(roll)&&moved.some(x=>!x.userData.fleetModel&&roll(x)),'ambient vehicles roll their wheels');}
 check(cars.every(x=>x.children.filter(c=>c.name==='beam').length===2),'beam ownership retained');
 check(cars.every(x=>{const model=catalog.find(m=>m.id===x.userData.fleetModel),[pool,tail]=x.children.filter(c=>c.name==='beam');return Math.abs(pool.position.x-(x.userData.front-.3))<1e-6&&tail.position.x===model.beamAnchors.rear[0][0]&&tail.children.every((lamp,j)=>lamp.position.z===model.beamAnchors.rear[j][2])&&typeof tail.userData.swell==='function'}),'measured beam anchors and brake behavior retained');
 check(traffic.some(x=>!x.visible)&&traffic.some(x=>x.visible),'regional visibility rules retained');
 ambient.dispose();
 const lateScene=new THREE.Scene(),late=createAmbient(lateScene,{pts,curve,stops});late.dispose();await late.ready;
 check(lateScene.children.slice(0,20).every(x=>!x.children.some(c=>c.name.endsWith('-glb'))),'disposed ambient rejects late adoption');
 return {pass:true,models:catalog.length,slots:cars.length};
})()'''))

# Fresh module/cache and real request failures: fallback must retain its noncream palette.
try:
    cdp('Network.enable')
    cdp('Network.setBlockedURLs', urls=['*assets/vehicles/*.glb'])
    cdp('Page.reload', ignoreCache=True)
    import time
    time.sleep(0.3)
    wait_for_load()
    print(js(r'''(async()=>{
      const THREE=await import('three'),{createAmbient}=await import('./js/world/ambient.js'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js');
      const scene=new THREE.Scene(),pts=routePoints(stops.length),ambient=createAmbient(scene,{pts,curve:routeCurve(THREE,pts),stops});
      const traffic=scene.children.slice(0,20),before=traffic.map(v=>v.children.slice());
      await ambient.ready;
      if(!traffic.every((v,i)=>v.children.every((c,j)=>c===before[i][j])))throw Error('failed GLBs must retain procedural children');
      const minis=traffic.filter(v=>v.name==='mini');
      for(const v of minis)v.traverse(o=>{if(o.isMesh&&o.material?.color&&['f1ead9','efe7d6'].includes(o.material.color.getHexString()))throw Error('cream fallback on failed request')});
      ambient.dispose();return {failureFallback:true,minis:minis.length};
    })()'''))
finally:
    cdp('Network.setBlockedURLs',urls=[])
    cdp('Page.reload',ignoreCache=True)
    time.sleep(0.3)
    wait_for_load()
