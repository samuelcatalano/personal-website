# Same-origin fixture via browser-harness. Botanical shape/normal/ground anchoring contract.
print(js(r'''(async()=>{
 const T=await import('three'),{createPlantGeometry}=await import('/js/world/plant-mesh.js'),{buildMeshes,createBoxes}=await import('/js/world/voxel.js'),{PALETTE:P}=await import('/js/world/palette.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)},stats=[];
 for(const kind of ['grass','shrub','hedge','flower']){
  const g=createPlantGeometry(kind),again=createPlantGeometry(kind),p=g.attributes.position,n=g.attributes.normal,b=g.boundingBox;
  check(p.count>=(kind==='grass'?300:kind==='flower'?500:1000),kind+' still uses coarse primitives');
  check(b.min.x>=-.50001&&b.max.x<=.50001&&b.min.z>=-.50001&&b.max.z<=.50001&&Math.abs(b.min.y)<.00001&&b.max.y<=1.00001,kind+' escapes original plant envelope');
  check(p.array.every((v,i)=>Number.isFinite(v)&&v===again.attributes.position.array[i]),kind+' is not deterministic/finite');
  for(let i=0;i<n.count;i++)check(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001,kind+' has invalid normals');
  const shades=new Set();for(let i=0;i<g.attributes.color.count;i++)shades.add(g.attributes.color.getY(i).toFixed(3));check(shades.size>10,kind+' lacks per-leaf depth variation');
  stats.push({kind,triangles:p.count/3});g.dispose();again.dispose();
 }
 const boxes=createBoxes();boxes.add(0,0,0,8,.1,8,P.grass);const world=buildMeshes(boxes.list,{grass:true}),grass=world.children.find(o=>o.userData.plantKind==='grass');
 check(grass&&grass.receiveShadow,'grass ignores building/tree shadows');
 check(grass.material.side===T.DoubleSide&&grass.material.metalness===0,'leaf materials must be nonmetal and visible from both sides');
 return {passed:true,stats,grassInstances:grass.count};})()'''))
