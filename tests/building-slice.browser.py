# browser-harness < tests/building-slice.browser.py (local preview)
import time
result = js(r'''(async () => {
// Baseline renderer contracts; citywide.browser.py covers the rollout default.
const legacyCity=plots=>kit.createCityBuildings(plots,{rollout:false});
  const T = await import('three');
  const kit = await import('./js/world/building-kit.js');
  const target = { id:'block-827--54-0', kind:'terrace', x:830.137430839939, z:-54.5, width:6, depth:9, height:12 };
  const other = { ...target, id:'control-neighbor', x:836.137430839939 };
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const city = legacyCity([target, other]);
  const { createTownhouseSlice } = await import('./js/world/building-slice.js');
  const slice = createTownhouseSlice(target);
  check(slice, 'selected existing lot must receive the townhouse slice');
  const meshes = g => { const a=[];g.traverse(o=>{if(o.isMesh)a.push(o)});return a; };
  const parts = meshes(slice), bounds = new T.Box3().setFromObject(slice);
  check(parts.length <= 3 && parts.length > 1, 'slice must separate opaque, trim and glass within three renderables');
  check(bounds.min.x >= target.x-3-1e-4 && bounds.max.x <= target.x+3+1e-4 && bounds.min.z >= -59-1e-4 && bounds.max.z <= -50+1e-4 && bounds.min.y >= -1e-4 && bounds.max.y <= 12+1e-4, 'slice must fit the original 6x9x12 footprint');
  const triangleCount = parts.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0);
  check(triangleCount <= 1132, 'polish must not exceed the approved 1132 triangles');
  check(new Set(parts.map(p=>p.geometry)).size <= 4 && new Set(parts.map(p=>p.material)).size <= 2, 'slice exceeds geometry/material budget');
  check(parts.filter(p=>p.castShadow).length===1 && !parts.find(p=>p.name==='slice-glass').castShadow, 'glass and small details must not cast shadows');
  const maps=new Set();for(const p of parts)for(const v of Object.values(p.material))if(v?.isTexture)maps.add(v);
  check(maps.size>=3 && maps.size<=4, 'slice must share at most four procedural maps');
  const textureBytes=[...maps].reduce((n,t)=>n+t.image.width*t.image.height*4*4/3,0);
  check(textureBytes<=4.334*1024*1024, 'texture memory with mipmaps must stay below 5 MiB');
  check(parts.find(p=>p.name==='slice-mass').material.normalMap && parts.find(p=>p.name==='slice-mass').material.roughnessMap, 'architecture needs normal and roughness information');
  check(parts.every(m=>m.geometry.attributes.uv && m.geometry.attributes.aSurface), 'all slice surfaces need metric UVs and material-family selection');
  for(const m of parts.filter(m=>m.name!=='slice-glass')) {
    const {position,uv}=m.geometry.attributes;
    for(let i=0;i<position.count;i+=6) {
      const length=new T.Vector3().fromBufferAttribute(position,i).distanceTo(new T.Vector3().fromBufferAttribute(position,i+1));
      const uvLength=new T.Vector2().fromBufferAttribute(uv,i).distanceTo(new T.Vector2().fromBufferAttribute(uv,i+1));
      check(Math.abs(length-uvLength)<1e-4, 'opaque surface UV scale must be metric, including sloping roofing');
    }
  }
  const opening=slice.userData.openings.find(o=>o.face==='front'&&o.type==='window');
  const front=slice.userData.front, ray=new T.Raycaster(new T.Vector3(target.x+opening.u, opening.y, target.z+front+1),new T.Vector3(0,0,-1));
  slice.updateMatrixWorld(true);
  const glassHit=ray.intersectObject(parts.find(p=>p.name==='slice-glass'))[0];
  check(glassHit && Math.abs(glassHit.point.z-(target.z+front-.2))<1e-4, 'window must have a shallow visible glass reveal of 0.20m');
  check(!ray.intersectObject(parts.find(p=>p.name==='slice-mass')).some(h=>h.distance<glassHit.distance), 'opaque wall must not cover the glass');
  const roofJointY=9.2+(11.52-9.2)*(1-2.8/2.98)-.02;
  const roofJointRay=new T.Raycaster(new T.Vector3(target.x+2.8,roofJointY,target.z+front+1),new T.Vector3(0,0,-1));
  const jointHit=roofJointRay.intersectObject(parts.find(p=>p.name==='slice-mass'))[0];
  check(jointHit && Math.abs(jointHit.point.z-(target.z+front))<1e-4, 'gable must close the front wall up to the overhanging roof plane');
  const door=slice.userData.openings.find(o=>o.type==='door');
  check(Math.abs(door.w-.95)<1e-5 && Math.abs(door.h-2.2)<1e-5, 'entrance must have human dimensions');
  const side=slice.userData.openings.filter(o=>o.face==='west');
  check(side.filter(o=>o.y<3.2).length===1 && side.filter(o=>o.y>3.2).length===4, 'side facade must have one ground window and two vertically aligned upper pairs');
  const roofMesh=parts.find(p=>p.name==='slice-mass'), attrs=roofMesh.geometry.attributes;
  for(let i=0;i<attrs.position.count;i+=6)if(attrs.aSurface.getX(i)===2 && Math.abs(attrs.normal.getX(i))>.1&&attrs.normal.getY(i)>.1){
    const a=new T.Vector3().fromBufferAttribute(attrs.position,i),b=new T.Vector3().fromBufferAttribute(attrs.position,i+2);
    check(Math.abs(attrs.uv.getY(i)-attrs.uv.getY(i+2))>1 && Math.abs(a.y-b.y)>1,'roof courses must run parallel to ridge, with row coordinate across the slope');
    check(Math.abs(attrs.uv.getY(i+1)-attrs.uv.getY(i+2))<1e-4,'roof row coordinate must stay constant along ridge');
  }
  const glassUV=parts.find(p=>p.name==='slice-glass').geometry.attributes.uv;
  const windowSamples=[];for(let i=0;i<glassUV.count;i+=6)windowSamples.push([glassUV.getX(i),glassUV.getY(i)].join(','));
  check(new Set(windowSamples).size>=4,'glass interiors/reflections must not repeat the same sample in every window');
  const glassMat=parts.find(p=>p.name==='slice-glass').material;
  const emission=glassMat.emissiveMap.image.getContext('2d').getImageData(0,0,256,256).data;
  const levels=new Set();for(let i=0;i<emission.length;i+=4)if(emission[i]>0)levels.add(emission[i]);
  check(levels.size>0&&levels.size<=4,'lit windows must glow uniformly per pane (no sub-pane grain)');
  const albedo=glassMat.map.image.getContext('2d').getImageData(0,0,512,512).data;
  for(let y=260;y<512;y+=19)for(let c=0;c<3;c++)check(albedo[(y*512+0)*4+c]===albedo[(y*512+120)*4+c],'plaster map must wrap seamlessly without a large repeating edge');
  const rebuilt=createTownhouseSlice(target);
  check(parts.every((m,i)=>Array.from(m.geometry.attributes.position.array).join()===Array.from(meshes(rebuilt)[i].geometry.attributes.position.array).join()), 'slice generation must be deterministic');
  check(parts.every((m,i)=>m.material===meshes(rebuilt)[i].material), 'repeat builds must share materials/textures');
  const alternate=createTownhouseSlice({...target,id:'unrelated',x:0,z:0,width:7});
  check(alternate.userData.openings.find(o=>o.type==='door').w===.95, 'recipe must work independently of ID and keep human scale');
  const remaining=city.getObjectByName('wembley-benchmark-facades'), control=legacyCity([other]).getObjectByName('wembley-benchmark-facades');
  check(remaining.userData.buildingCount===1 && Array.from(remaining.geometry.attributes.position.array).join()===Array.from(control.geometry.attributes.position.array).join(), 'selected lot must be removed from old batch without changing its neighbor');
  check(!legacyCity([other]).getObjectByName('townhouse-benchmark-chunk'), 'unselected lots must remain controls');
  return {pass:true,renderables:parts.length,triangles:triangleCount,geometries:new Set(parts.map(p=>p.geometry)).size,materials:new Set(parts.map(p=>p.material)).size,textures:maps.size,textureMiB:textureBytes/1024/1024,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result

started = js(r'''(async()=>{
const T=await import('three'),s=await import('./js/world/building-slice.js?success-kit='+Date.now()),{SURFACE}=await import('./js/world/building-slice-materials.js'),{createTownhouseChunk}=await import('./js/world/building-slice.js'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js'),{buildCity}=await import('./js/world/city.js');
const points=routePoints(stops.length),plots=[];buildCity(()=>{},stops,points,routeCurve(T,points),undefined,undefined,p=>plots.push(p));
const pilots=plots.filter(p=>s.EXPERIMENT_LOT_IDS.includes(p.id)),controlPlots=plots.filter(p=>p.id.startsWith('block-827--54-'));
const controlHash=g=>{let h=2166136261;for(const m of g.children)for(const n of m.geometry.attributes.position.array)h=Math.imul(h^Math.round(n*1e5),16777619);return h>>>0;},controlBefore=controlHash(createTownhouseChunk(controlPlots));
window.__townhouseTask2={T,SURFACE,s,plots,pilots,controlPlots,controlBefore};
return {pilots:pilots.length};
})()''')
print(started)
assert started['pilots'] == 9, started
cdp('Network.enable')
cdp('Network.setBlockedURLs', urls=['*townhouse-kit.glb*'])
failed = js(r'''(async()=>{const q=window.__townhouseTask2,s=await import('./js/world/building-slice.js?failed-kit='+Date.now()),g=s.createTownhouseExperiment(q.pilots,q.plots);q.failed=g;q.failedFallback=g.children.map(c=>c.userData.lods[0].slice());return {chunks:g.children.length}})()''')
print(failed)
time.sleep(0.5)
cdp('Network.setBlockedURLs', urls=[])
started = js(r'''(()=>{const q=window.__townhouseTask2,{s,pilots,plots}=q,late=s.createTownhouseExperiment(pilots,plots),lateFallback=late.children.map(c=>c.userData.lods[0].slice());late.userData.dispose();const experiment=s.createTownhouseExperiment(pilots,plots),fallback=experiment.children.map(c=>c.userData.lods[0].slice());Object.assign(q,{late,lateFallback,experiment,fallback});return {chunks:experiment.children.length,renderables:experiment.children.map(c=>c.children.length),fallbackVertices:fallback.map(gs=>gs.map(g=>g.attributes.position.count))}})()''')
print(started)
assert started['chunks'] == 2 and started['renderables'] == [3, 3], started
ready = False
for _ in range(40):
    ready = js(r'''(()=>{const q=window.__townhouseTask2;return q.experiment.children.every((c,i)=>c.userData.lods[0].some((g,k)=>g!==q.fallback[i][k]))})()''')
    if ready:
        break
    time.sleep(0.25)
assert ready, 'successful GLB load did not adopt modules'

adopted = js(r'''(()=>{
const q=window.__townhouseTask2,{T,SURFACE,experiment,fallback,late,lateFallback,failed,failedFallback}=q,check=(v,m)=>{if(!v)throw Error(m)};
check(experiment.children.every((c,i)=>c.userData.lods[0].some((g,k)=>g!==fallback[i][k])),'successful GLB load must replace pilot LOD0 geometry');
check(experiment.children.every((c,i)=>c.children.length===3&&c.userData.lods[0].every((g,k)=>g.attributes.position.count>fallback[i][k].attributes.position.count)),'authored modules must fill the three existing buckets');
check(experiment.children.some(c=>c.userData.plotIds.includes('block-679--80-0'))&&experiment.children.map(c=>c.userData.plotIds.length).join(',')==='5,4','Glasgow townhouse pilot stays intact');
let expectedLitWindows=0;
for(const plot of q.pilots){const recipe=q.s.townhouseRecipe(plot,q.plots),openings=q.s.createTownhouseSlice(plot,recipe).userData.openings,indices={front:0,west:0};for(const o of openings){const index=indices[o.face]++;if(o.type==='window'&&(index+(o.face==='front'?1:0)+recipe.windowSeed)%3===0)expectedLitWindows++;}}
const litGlassVertices=experiment.children.reduce((sum,c)=>sum+c.userData.lods[0][2].attributes.aSurface.array.filter(surface=>surface===SURFACE.litGlass).length,0);
check(litGlassVertices===expectedLitWindows*132,`modular lit-glass panes must follow the existing deterministic window formula (${expectedLitWindows} panes)`);
check(failed.children.every((c,i)=>c.userData.lods[0].every((g,k)=>g===failedFallback[i][k])),'failed load must retain procedural fallback');
check(late.children.every((c,i)=>c.userData.lods[0].every((g,k)=>g===lateFallback[i][k])),'late completion after disposal must keep fallback geometry');
const bounds=new T.Box3().setFromObject(experiment);check(bounds.min.y>=0&&bounds.max.y<=12&&bounds.min.x>=678&&bounds.max.x<=742&&bounds.min.z>=-84.5&&bounds.max.z<=-75.5,'module bounds must stay grounded within the pilot lots');
experiment.userData.update({position:new T.Vector3(706,10,-80)});check(experiment.children.every(c=>c.userData.level===0),'near camera must select LOD0');
experiment.userData.update({position:new T.Vector3(900,10,-80)});check(experiment.children.every(c=>c.userData.level===1),'far camera must select LOD1');
experiment.userData.update({position:new T.Vector3(706,10,-80)});check(experiment.children.every(c=>c.userData.level===0),'near return must select LOD0');
const reversed=q.s.createTownhouseExperiment(q.pilots.slice().reverse(),q.plots);q.reversed=reversed;
return {bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},lods:experiment.children.map(c=>c.userData.level),adopted:experiment.children.map(c=>c.userData.lods[0].map(g=>g.attributes.position.count))};
})()''')
print(adopted)
time.sleep(0.5)

deterministic = js(r'''(()=>{
const q=window.__townhouseTask2,{experiment,reversed,T,controlPlots,failed,late}=q,check=(v,m)=>{if(!v)throw Error(m)};
check(reversed.children.every((c,i)=>c.userData.lods[0].some((g,k)=>g!==q.fallback[i][k])),'shuffled input must adopt kit modules');
const hash=group=>{let h=2166136261;for(const c of group.children)for(const g of c.userData.lods[0])for(const a of [g.attributes.position.array,g.attributes.aSurface.array])for(const n of a)h=Math.imul(h^Math.round(n*1e5),16777619);return h>>>0;};
check(hash(experiment)===hash(reversed),'module assignment must be deterministic after shuffling lots');
const control=q.s.createTownhouseChunk(controlPlots);let after=2166136261;for(const m of control.children)for(const n of m.geometry.attributes.position.array)after=Math.imul(after^Math.round(n*1e5),16777619);after>>>=0;check(after===q.controlBefore,'three-lot control must remain unchanged');
failed.userData.dispose();late.userData.dispose();experiment.userData.dispose();reversed.userData.dispose();
return {pass:true,determinismHash:hash(experiment),controlHash:after};
})()''')
print(deterministic)
assert deterministic.get('pass'), deterministic
