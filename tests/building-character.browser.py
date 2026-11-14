# Local same-origin fixture; checks production assembly rather than shader strings.
assert page_info()['url'].startswith('http://localhost:')
print(js(r'''(async()=>{
 const T=await import('three'),{building}=await import('/js/world/city-rollout.js'),{finishArchitecture}=await import('/js/world/building-finish.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const kinds=['townhouse','shop','midrise','office','tower'],results=[];
 for(const [index,kind]of kinds.entries()){
  const p={id:`character-${kind}`,kind:kind==='townhouse'?'terrace':kind,x:0,z:0,width:kind==='townhouse'?8:12,depth:10,height:[11,8,18,25,48][index],region:index%2?'paulista':'glasgow'};
  const near=building(p,kind,[p]),far=building(p,kind,[p],1);
  for(const group of [near,far])for(const mesh of group.children){
   const a=mesh.geometry.attributes;
   check(a.aBuilding?.count===a.position.count,`${kind}: identity missing from a bucket or LOD`);
   check(a.aBuilding.normalized&&a.aBuilding.array instanceof Uint16Array,`${kind}: metadata must stay packed`);
   for(let i=0;i<a.aBuilding.count;i++)check(a.aBuilding.getX(i)===a.aBuilding.getX(0),`${kind}: seed drifts inside one property`);
  }
  check(near.children[0].geometry.attributes.aBuilding.getX(0)===far.children[0].geometry.attributes.aBuilding.getX(0),`${kind}: LOD changes identity`);
  const count=near.children[1].geometry.attributes.position.count,identity=near.children[0].geometry.attributes.aBuilding.array.slice();
  const details=near.children[1].geometry.userData.propertyDetails;
  check(details&&details.curtains<=2&&details.wallPatches<=2&&details.roofServices<=2,`${kind}: detail budget is not bounded`);
  if(kind==='townhouse')check(details.curtains>0,'House has no selective inhabited finish');
  finishArchitecture(near.children.map(m=>m.geometry),p,kind,near.userData.recipe);
  check(near.children[1].geometry.attributes.position.count===count,`${kind}: repeated finish adds detail`);
  check(identity.every((v,i)=>v===near.children[0].geometry.attributes.aBuilding.array[i]),`${kind}: repeated finish retints identity`);
  const glass=near.children[2].geometry.attributes,occupation=new Set();
  for(let q=0;q+5<glass.position.count;q+=6){
   const value=glass.aBuilding.getZ(q);occupation.add(value);
   for(let j=1;j<6;j++)check(glass.aBuilding.getZ(q+j)===value,`${kind}: light changes inside one pane`);
  }
  check(occupation.size>1,`${kind}: every room has the same occupancy`);
  const trim=near.children[1].geometry;
  for(let i=trim.userData.constructionStart;i<trim.attributes.position.count;i++){
   const a=trim.attributes.position;
   check(Math.abs(a.getX(i))<=p.width/2&&Math.abs(a.getZ(i))<=p.depth/2&&a.getY(i)>=0&&a.getY(i)<=p.height,`${kind}: detail leaves envelope`);
  }
  results.push({kind,trimVertices:count,occupancyGroups:occupation.size,details});
  for(const group of [near,far])group.children.forEach(m=>m.geometry.dispose());
 }
 check(results.some(r=>r.details.roofServices>0),'No existing roof received a service finish');
 const p={id:'character-shop',kind:'midrise',x:0,z:0,width:8,depth:8,height:10};
 const blank=neighbors=>{
  const mass=new T.BoxGeometry(7.6,9.6,7.6).toNonIndexed().translate(0,4.8,0),n=mass.attributes.position.count;
  mass.setAttribute('aSurface',new T.Float32BufferAttribute(new Float32Array(n),1));mass.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(n*3).fill(1),3));
  const empty=()=>{const g=new T.BufferGeometry();for(const [name,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])g.setAttribute(name,new T.Float32BufferAttribute([],size));return g;};
  return finishArchitecture([mass,empty(),empty()],p,'midrise',{},0,neighbors);
 };
 const free=blank([p]),blocked=blank([[8,0],[-8,0],[0,8],[0,-8]].map(([x,z],i)=>({...p,id:`touch-${i}`,x,z})));
 check(free[1].userData.propertyDetails.wallPatches===2&&free[1].attributes.position.count>0,'Exposed wall never receives its repair finish');
 check(blocked[1].userData.propertyDetails.wallPatches===0&&blocked[1].attributes.position.count===0,'Shared wall receives decoration');
 [...free,...blocked].forEach(g=>g.dispose());
 const {loadKit}=await import('/js/world/kit-loader.js'),{accumulators,place,geometryOf}=await import('/js/world/kit-place.js');
 for(const [kitName,module,surface]of [['midrise','canopy_glass_02',6],['tower','rail_glass_02',6],['shop','signboard_lightbox_04',5]]){
  const kit=await loadKit(`/assets/processed/buildings/${kitName}-kit.glb?v=1`),acc=accumulators();
  place(acc,kit,module,0,3,0,1,1,1,{mass:4,trim:3,glass:surface});
  const pane=geometryOf(acc[2]);check(pane?.attributes.position.count>0,`${module}: missing real fixture glass`);
  const empty=()=>{const g=new T.BufferGeometry();for(const [name,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])g.setAttribute(name,new T.Float32BufferAttribute([],size));return g;};
  const geometry=finishArchitecture([empty(),empty(),pane],{...p,width:12,depth:12,height:20},'office');
  const a=geometry[2].attributes.aBuilding;
  for(let i=0;i<a.count;i++)check(a.getW(i)===0&&a.getZ(i)===0,`${module}: exterior glass receives occupied-room light`);
  check(geometry[2].attributes.aSurface.getX(0)===surface,`${module}: original glass/emission role changed`);
  geometry.forEach(g=>g.dispose());
 }
 return {pass:true,results};
})()'''))
