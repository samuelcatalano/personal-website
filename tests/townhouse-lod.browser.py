cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True)
result=js(r'''(async()=>{
// Baseline renderer contracts; citywide.browser.py covers the rollout default.
const legacyCity=plots=>createCityBuildings(plots,{rollout:false});
const T=await import('three'),s=await import('./js/world/building-slice.js?removed-house='+Date.now()),{createCityBuildings}=await import('./js/world/building-kit.js?removed-house='+Date.now()),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js'),{buildCity}=await import('./js/world/city.js');
const check=(v,m)=>{if(!v)throw Error(m)},pts=routePoints(stops.length),plots=[];buildCity(()=>{},stops,pts,routeCurve(T,pts),undefined,undefined,p=>plots.push(p));
const ids=[...Array.from({length:5},(_,i)=>`block-679--80-${i}`),...Array.from({length:4},(_,i)=>`block-712--80-${i}`)],selected=plots.filter(p=>ids.includes(p.id));
check(selected.length===9&&selected.every(p=>p.width===6&&p.depth===9&&p.height===12),'descriptors diverge');
check(typeof s.createTownhouseExperiment==='function','missing two-chunk experiment');
const experiment=s.createTownhouseExperiment(selected,plots),chunks=experiment.children;
check(chunks.length===2&&chunks.every(c=>c.children.length===3),'two chunks, three stable meshes each');
const tri=g=>g.reduce((n,x)=>n+(x.index?.count||x.attributes.position.count)/3,0),mats=new Set,maps=new Set;
let t0=0,t1=0,bytes=0;const fingerprints=[];
for(let ci=0;ci<2;ci++){
const c=chunks[ci],d=c.userData;check(d.plotIds.length===4&&!d.plotIds.includes('block-679--80-0'),`removed riverfront house and four lots per chunk: ${d.plotIds}`);check(c.position.x===(ci?710:678)&&c.position.z===-96,'cell origins');
check(d.lods.length===2&&d.lods.every(gs=>gs.length===3),'six cached geometries per chunk');t0+=tri(d.lods[0]);t1+=tri(d.lods[1]);
const own=selected.filter(p=>d.plotIds.includes(p.id));
check(d.lods[0][0].boundingBox.equals(d.lods[1][0].boundingBox),'mass/roof silhouette bounds');check(Array.from(d.lods[0][2].attributes.position.array).join()===Array.from(d.lods[1][2].attributes.position.array).join(),'glass and window placement preserved');
for(const gs of d.lods)for(let k=0;k<3;k++){const g=gs[k],a=g.attributes;check(g.boundingBox&&g.boundingSphere,'bounds');for(const [key,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])check(a[key]?.itemSize===size&&a[key].count===a.position.count,`attribute ${key}`);bytes+=Object.values(a).reduce((n,v)=>n+v.array.byteLength,0);for(let i=0;i<a.normal.count;i++){check(Math.abs(new T.Vector3().fromBufferAttribute(a.normal,i).length()-1)<.0001,'unit normals');check(Number.isInteger(a.aSurface.getX(i))&&a.aSurface.getX(i)>=0&&a.aSurface.getX(i)<=7,'atlas surface');}if(k!==2)for(let i=0;i<a.position.count;i+=6){const pos=new T.Vector3().fromBufferAttribute(a.position,i).distanceTo(new T.Vector3().fromBufferAttribute(a.position,i+1)),uv=new T.Vector2().fromBufferAttribute(a.uv,i).distanceTo(new T.Vector2().fromBufferAttribute(a.uv,i+1));check(Math.abs(pos-uv)<.0001,'metric UVs');}for(let i=0;i<a.position.count;i++){const p=new T.Vector3().fromBufferAttribute(a.position,i).add(c.position);check(own.some(o=>Math.abs(p.x-o.x)<=3.0001&&Math.abs(p.z-o.z)<=4.5001&&p.y>=-.0001&&p.y<=12.0001),'footprint/height');}}
c.children.forEach((m,k)=>{check(m.isMesh&&!m.isInstancedMesh&&m.frustumCulled,'mesh policy');check(m.castShadow===(k===0),'shadow flags');mats.add(m.material);Object.values(m.material).forEach(v=>{if(v?.isTexture)maps.add(v)});});
const meshes=c.children.slice(),origin=new T.Vector3(d.bounds.max.x,5,d.bounds.max.z);
const at=x=>{const cam={position:origin.clone().add(new T.Vector3(x,0,0))};experiment.userData.update(cam);return d.level;};
d.level=null;check(at(120)===1,'initial far threshold');check(at(100)===0,'initial near');check(at(129)===0&&at(130)===1,'leave threshold');for(const v of [120,112,128,111])check(at(v)===1,'no flapping');check(at(110)===0,'return threshold');
for(let k=0;k<3;k++)check(c.children[k]===meshes[k]&&meshes[k].geometry===d.lods[0][k],'stable geometry swap');
fingerprints.push(d.houses.map(h=>[h.plotId,h.recipe.structural,h.recipe.palette,h.recipe.exposedWest]));
}
check(t0<=6700&&t1<=3500&&t1<=t0*.6,'triangle reduction/budget');check(mats.size===2&&maps.size===4,'shared resources');check(bytes<=1.5*1024*1024,'resident buffer budget');
const city=legacyCity(plots);check(city.children.filter(c=>c.name==='townhouse-experiment').length===1,'integrated exactly once');
const control=city.getObjectByName('townhouse-benchmark-chunk');check(control.children.every(m=>mats.has(m.material)),'same material objects as control');check([...maps].reduce((n,t)=>n+t.image.width*t.image.height*4*4/3,0)<4.334*1024*1024,'texture memory');
const baseline=legacyCity(plots.filter(p=>!ids.includes(p.id)));
const fp=o=>{const rows=[];o.traverse(m=>{if(m.isMesh)rows.push({name:m.name,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,v])=>[k,Array.from(v.array)])),instances:m.instanceMatrix?Array.from(m.instanceMatrix.array):null,colors:m.instanceColor?Array.from(m.instanceColor.array):null})});return rows;};
const other=new T.Group();city.children.filter(c=>c.name!=='townhouse-experiment').forEach(c=>other.add(c.clone()));check(JSON.stringify(fp(other))===JSON.stringify(fp(baseline)),'control and all unrelated plot buffers unchanged');
experiment.userData.update({position:new T.Vector3(706,10,-60)});const reversed=s.createTownhouseExperiment(selected.slice().reverse(),plots);reversed.userData.update({position:new T.Vector3(706,10,-60)});check(JSON.stringify(fp(experiment))===JSON.stringify(fp(reversed)),'deterministic merged buffers');reversed.userData.dispose();
const adjacent=[{id:'left',x:709,z:-80,width:6,depth:9,height:12},{id:'right',x:715,z:-80,width:6,depth:9,height:12}];check(!s.townhouseRecipe(adjacent[1],adjacent).exposedWest,'cross-chunk architectural neighbor');
let invalid=false;try{s.createTownhouseExperiment(selected.map((p,i)=>i? p:{...p,height:6}),plots)}catch(e){invalid=e instanceof TypeError}check(invalid,'reject descriptor drift');
let disposed=0;chunks.forEach(c=>c.userData.lods.flat().forEach(g=>g.addEventListener('dispose',()=>disposed++)));experiment.userData.dispose();check(disposed===12,'dispose all active/inactive geometries');experiment.userData.dispose();check(disposed===12,'idempotent disposal');
return {pass:true,ids,triangles:[t0,t1],reduction:1-t1/t0,bytes,materials:mats.size,textures:maps.size,fingerprints};})()''')
print(result)
assert isinstance(result,dict) and result.get('pass'),result
