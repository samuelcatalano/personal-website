# browser-harness < tests/townhouse-chunk.browser.py (local preview)
result = js(r'''(async()=>{
// Baseline renderer contracts; citywide.browser.py covers the rollout default.
const legacyCity=plots=>kit.createCityBuildings(plots,{rollout:false});
 const T=await import('three'), kit=await import('./js/world/building-kit.js');
 const slice=await import('./js/world/building-slice.js');
 const {stops}=await import('./js/content.js'), {routePoints,routeCurve}=await import('./js/world/layout.js'), {buildCity}=await import('./js/world/city.js');
 const check=(ok,message)=>{if(!ok)throw Error(message)}, ids=['block-827--54-0','block-827--54-1','block-827--54-2'];
 const pts=routePoints(stops.length),plots=[];buildCity(()=>{},stops,pts,routeCurve(T,pts),undefined,undefined,p=>plots.push(p));
 const selected=plots.filter(p=>ids.includes(p.id)),controls=plots.filter(p=>!ids.includes(p.id)&&!slice.EXPERIMENT_LOT_IDS.includes(p.id));
 check(selected.length===3,'all three real source lots must exist');
 const city=legacyCity(plots),chunk=city.getObjectByName('townhouse-benchmark-chunk');
 check(chunk,'three selected townhouses must enter one spatial chunk');
 check(JSON.stringify(chunk.userData.plotIds.slice().sort())===JSON.stringify(ids),'chunk must replace exactly the allowlisted IDs');
 check(city.userData.sliceCount===3,'three source lots must be removed from their old batches');
 const parts=chunk.children;check(parts.length===3&&parts.every(m=>m.isMesh&&!m.isInstancedMesh),'three houses must have exactly three active merged renderables');
 check(new Set(parts.map(m=>m.material)).size===2,'group must share exactly two materials');
 const maps=new Set;parts.forEach(m=>Object.values(m.material).forEach(v=>{if(v?.isTexture)maps.add(v)}));
 const bytes=[...maps].reduce((n,t)=>n+t.image.width*t.image.height*4*4/3,0);
 check(maps.size===4&&Math.abs(bytes/1024/1024-4.3333333)<.001,'four shared maps must retain 4.33 MiB');
 const expectedPlaster=[[1,1,1],[1,.97,.93],[.96,.985,1]];
 const triangles=parts.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);check(triangles<=3200,'three-house LOD0 triangle budget exceeded');
 check(parts[0].castShadow&&!parts[1].castShadow&&!parts[2].castShadow&&parts.every(m=>m.receiveShadow),'only merged mass may cast shadows');
 const families=new Set(chunk.userData.houses.map(h=>h.recipe.structural));check(families.size===2,'group must demonstrate two structural recipes');
 check(new Set(chunk.userData.houses.map(h=>h.recipe.palette)).size>=2,'group must demonstrate discreet palette variation');
 for(const m of parts){
  const a=m.geometry.attributes;for(const [name,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])check(a[name]?.itemSize===size&&a[name].count===a.position.count,`merge lost ${name}`);
  check(m.geometry.boundingBox&&m.geometry.boundingSphere&&m.frustumCulled,'merged batch needs real culling bounds');
  for(let i=0;i<a.position.count;i++){
   const world=new T.Vector3().fromBufferAttribute(a.position,i).add(chunk.position);
   const owners=selected.filter(p=>Math.abs(world.x-p.x)<=p.width/2+.0001&&Math.abs(world.z-p.z)<=p.depth/2+.0001&&world.y>=-.0001&&world.y<=p.height+.0001);
   check(owners.length===1,'merged vertex must remain inside exactly one original footprint and height');
   if(a.aSurface.getX(i)===0){const want=expectedPlaster[ids.indexOf(owners[0].id)];for(let k=0;k<3;k++)check(Math.abs(a.color.array[i*3+k]-want[k])<.00001,'palette must reach actual plaster vertices, not just recipe metadata');}
   const normal=new T.Vector3().fromBufferAttribute(a.normal,i);check(Math.abs(normal.length()-1)<.0001,'merge changed unit normals');
   check(Number.isInteger(a.aSurface.getX(i))&&a.aSurface.getX(i)>=0&&a.aSurface.getX(i)<=7,'merge corrupted atlas surface');
  }
  if(m!==parts[2])for(let i=0;i<a.position.count;i+=6){const d=new T.Vector3().fromBufferAttribute(a.position,i).distanceTo(new T.Vector3().fromBufferAttribute(a.position,i+1));const uv=new T.Vector2().fromBufferAttribute(a.uv,i).distanceTo(new T.Vector2().fromBufferAttribute(a.uv,i+1));check(Math.abs(d-uv)<.0001,'merge must preserve metric opaque UVs');}
 }
 const fingerprint=g=>{const rows=[];g.traverse(m=>{if(m.isMesh)rows.push({name:m.name,cast:m.castShadow,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,v])=>[k,Array.from(v.array)])),index:m.geometry.index?Array.from(m.geometry.index.array):null,instances:m.isInstancedMesh?Array.from(m.instanceMatrix.array):null,colors:m.instanceColor?Array.from(m.instanceColor.array):null});});return rows;};
 const repeated=slice.createTownhouseChunk(selected.slice().reverse());
 check(JSON.stringify(fingerprint(chunk))===JSON.stringify(fingerprint(repeated)),'chunk recipes, palettes and buffers must be deterministic independent of input order');
 check(parts.every((m,i)=>m.material===repeated.children[i].material),'repeat chunks must reuse the exact same materials');
 const controlCity=legacyCity(controls),oldPart=new T.Group();city.children.filter(c=>c!==chunk&&c.name!=='townhouse-experiment').forEach(c=>oldPart.add(c.clone()));
 check(JSON.stringify(fingerprint(oldPart))===JSON.stringify(fingerprint(controlCity)),'every unselected plot must remain byte-identical to the control builder');
 chunk.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(40,1.6,1,1400);camera.position.set(836,15,-25);
 const frustum=new T.Frustum(),projection=new T.Matrix4();
 const aim=z=>{camera.lookAt(836,5,z);camera.updateMatrixWorld(true);frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));};
 aim(-54.5);check(parts.every(m=>frustum.intersectsObject(m)),'all three batches must be visible from the row approach');
 aim(10);check(parts.every(m=>!frustum.intersectsObject(m)),'all three batches must cull when the camera faces away');
 for(const h of chunk.userData.houses){const door=h.openings.find(o=>o.type==='door');check(Math.sign(door.u)===(h.plotId===ids[1]?-1:1),'second structural recipe must mirror the actual entrance layout');check(h.recipe.floors===3&&h.recipe.roof==='gable','all recipes must preserve three floors and a gable roof');}
 const renamed={...selected[0],id:'independent-recipe',x:0,z:0};const independent=slice.createTownhouseSlice(renamed);check(independent.children.length===3,'architecture must work without any allowlisted ID');
 const mergedCounts=parts.map(m=>m.geometry.attributes.position.count),expected=[0,0,0];
 chunk.userData.houses.forEach(h=>{const plot=selected.find(p=>p.id===h.plotId);const house=slice.createTownhouseSlice(plot,h.recipe);house.children.forEach((m,i)=>{expected[i]+=m.geometry.attributes.position.count});});
 check(JSON.stringify(mergedCounts)===JSON.stringify(expected),'merge must include every house exactly once without dropping attributes/vertices');
 check(chunk.position.x===820&&chunk.position.z===-81,'selected lots must share the approved 32m cell origin');
 const bounds=new T.Box3().setFromObject(chunk);check(bounds.min.x>=820&&bounds.max.x<852&&bounds.min.z>=-81&&bounds.max.z<-49,'chunk must stay inside approved cell');
 return {pass:true,ids,renderables:3,triangles,materials:2,textures:4,textureMiB:bytes/1024/1024,recipes:chunk.userData.houses.map(h=>({id:h.plotId,...h.recipe})),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sourcePlots:plots.length};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
