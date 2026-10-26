# Open local preview, then: browser-harness < tests/wellington.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
 const T = await import('three');
 const a = await import('./js/world/wellington-asset.js').catch(() => null);
 const check = (ok, msg) => { if (!ok) throw Error(msg); };
 check(a?.loadWellingtonAsset && a?.upgradeWellington, 'Wellington cached loader and guarded upgrade exist');
 const p = a.loadWellingtonAsset(); check(p === a.loadWellingtonAsset(), 'one cached source promise');
 const src = await p; check(src, 'production GLB loads');
 const meshes = []; src.traverse(o => { if(o.isMesh) meshes.push(o); });
 check(meshes.length === 3, 'three semantic renderables');
 const b = new T.Box3().setFromObject(src), size = b.getSize(new T.Vector3());
 check(Math.abs(b.min.y) < .005 && Math.abs(size.z - 3) < .01 && Math.abs(b.min.x + 2.9) < .01 && b.max.x > 2.9 && b.max.x < 3.25 && Math.abs(b.max.y - 7.90) < .04, `preserved footprint and taller traffic cone ${size.toArray()}`);
 const triangles = meshes.reduce((n,m) => n+(m.geometry.index?.count ?? m.geometry.attributes.position.count)/3,0);
 check(triangles < 18000, `controlled silhouette budget: ${triangles}`);
 for(const m of meshes) {
  const {position,normal}=m.geometry.attributes; check(normal?.count===position.count && m.material.emissive.getHex()===0,'normals and no emission');
  for(let i=0;i<normal.count;i++) check(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<.01, 'unit normals');
 }
 const cone=src.getObjectByName('WellingtonCone'),coneBounds=new T.Box3().setFromObject(cone),coneSize=coneBounds.getSize(new T.Vector3()),colors=cone.geometry.attributes.color;
 check(colors, 'cone vertex bands preserved');
 check(coneSize.y>coneSize.x*1.1&&coneSize.y<coneSize.x*1.3,'restrained taller, narrower traffic cone');
 let rubber=false,white=false;for(let i=0;i<colors.count;i++){rubber ||= colors.getX(i)<.05&&colors.getY(i)<.05&&colors.getZ(i)<.05;white ||= colors.getX(i)>.8&&colors.getY(i)>.8&&colors.getZ(i)>.8;}
 check(rubber&&white,'rubber foot and reflective band');
 const {createWellington} = await import('./js/world/landmark-geometry.js');
 const first=createWellington(12,34), second=createWellington(22,44);
 const fallback=[...first.children]; let disposed=0; fallback.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));
 await Promise.all([a.upgradeWellington(first,()=>false),a.upgradeWellington(second,()=>false)]);
 check(first.children.length===1 && first.children[0].name==='wellington-glb' && disposed===fallback.length,'replace and release fallback geometry');
 check(first.position.equals(new T.Vector3(12,0,34)) && first.scale.equals(new T.Vector3(1,1,1)), 'placement unchanged');
 const g1=first.children[0],g2=second.children[0]; check(g1!==g2,'independent instance roots');
 let sharedDisposed=0; meshes.forEach(m=>{m.geometry.addEventListener('dispose',()=>sharedDisposed++);m.material.addEventListener('dispose',()=>sharedDisposed++);});
 first.userData.dispose(); check(first.children.length===0 && sharedDisposed===0 && g2.children.length===3,'world does not dispose cached resources');
 const late=createWellington(0,0), children=[...late.children]; let disposedWorld=false, resolveLate;
 const delayed=new Promise(resolve=>{resolveLate=resolve;}); const upgrading=a.upgradeWellington(late,()=>disposedWorld,delayed);
 disposedWorld=true; resolveLate(src); await upgrading;
 check(late.children.every((m,i)=>m===children[i]), 'disposed world ignores late source');
 const failure=createWellington(0,0), original=[...failure.children]; await a.upgradeWellington(failure,()=>false,Promise.resolve(null));
 check(failure.children.every((m,i)=>m===original[i]), 'failed source leaves fallback');
 second.userData.dispose(); late.userData.dispose(); failure.userData.dispose();
 return {passed:true,triangles,renderables:meshes.length,materials:new Set(meshes.map(m=>m.material)).size,bounds:[b.min.toArray(),b.max.toArray()]};
})()'''))
