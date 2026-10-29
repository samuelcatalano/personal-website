assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
 const T = await import('three'), A = await import('./js/world/vehicle-assets.js?wheel-shape=1');
 const results = [];
 for (const m of await A.loadFleetCatalog()) {
  const car = new T.Group(); await A.upgradeFleet(car, m);
  for (const w of car.userData.wheels) {
   const extents = [];
   for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    w.rotation.z = angle; car.updateMatrixWorld(true);
    const b = new T.Box3(), v = new T.Vector3();
    w.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position,ix=o.geometry.index;for(let j=0;j<(ix?.count??p.count);j++)b.expandByPoint(v.fromBufferAttribute(p,ix?ix.getX(j):j).applyMatrix4(o.matrixWorld));}});
    extents.push([b.min.x-w.position.x,b.max.x-w.position.x,b.min.y-w.position.y,b.max.y-w.position.y]);
   }
   const wobble = Math.max(...[0,1,2,3].map(i => Math.max(...extents.map(e=>e[i]))-Math.min(...extents.map(e=>e[i]))));
   results.push({model:m.id,wobble});
   if(wobble>.035)throw Error(m.id+' wheel deforms while rotating: '+wobble+'m');
  }
 }
 return results;
})()'''))
