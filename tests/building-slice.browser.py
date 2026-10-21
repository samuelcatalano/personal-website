# browser-harness < tests/building-slice.browser.py (local preview)
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
  check(levels.size>4,'lit windows must have non-uniform interior emission');
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
