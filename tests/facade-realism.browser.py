# Run after navigation to the local site, through browser-harness.
result = js(r'''(async()=>{
  const T=await import('three'), town=await import('./js/world/building-slice.js'), mid=await import('./js/world/midrise-slice.js');
  const {createBuilding}=await import('./js/world/building-kit.js');
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const plot={id:'facade-house',kind:'terrace',x:0,z:0,width:6,depth:9,height:12};
  const recipe=town.townhouseRecipe(plot), house=town.createTownhouseSlice(plot,recipe);
  const faces=new Set(house.userData.openings.map(o=>o.face));
  check(['front','back','west','east'].every(f=>faces.has(f)),'standalone house has openings on every exposed face');
  const neighbors=[plot,{...plot,id:'east',x:6},{...plot,id:'west',x:-6},{...plot,id:'rear',z:-9}];
  const joined=town.createTownhouseSlice(plot,town.townhouseRecipe(plot,neighbors));
  check(joined.userData.openings.every(o=>o.face==='front'),'true party walls have no windows');
  const glass=house.children[2];house.updateMatrixWorld(true);
  for(const face of ['back','east','west']){
    const o=house.userData.openings.find(o=>o.face===face),side=face==='east'?1:-1;
    const origin=face==='back'?new T.Vector3(-o.u+.15,o.y+.2,-6):new T.Vector3(side*5,o.y+.2,o.u+.15);
    const dir=face==='back'?new T.Vector3(0,0,1):new T.Vector3(-side,0,0),ray=new T.Raycaster(origin,dir);
    const hit=ray.intersectObject(glass)[0];check(hit,'exposed '+face+' pane is raycastable from outdoors');
    check(!ray.intersectObject(house.children[0]).some(h=>h.distance<hit.distance-1e-5),'wall does not cover '+face+' glass');
  }
  for(const face of ['front','back','east','west'])for(const u of [-2.7,-1.8,0,1.8,2.7])for(const y of [.2,.5,3.0,3.3,6.3,8.9]){
    if(house.userData.openings.some(o=>o.face===face&&Math.abs(u-o.u)<o.w/2+.02&&Math.abs(y-o.y)<o.h/2+.02))continue;
    const alongZ=face==='front'||face==='back',side=face==='front'||face==='east'?1:-1;
    const origin=alongZ?new T.Vector3(face==='back'?-u:u,y,side*8):new T.Vector3(side*6,y,u);
    const ray=new T.Raycaster(origin,alongZ?new T.Vector3(0,0,-side):new T.Vector3(-side,0,0));
    check(ray.intersectObject(house.children[0]).length>0,'optimized '+face+' wall span remains closed');
  }
  const far=town.createTownhouseSlice(plot,recipe,1);
  check(JSON.stringify([...glass.geometry.attributes.position.array])===JSON.stringify([...far.children[2].geometry.attributes.position.array]),'LOD preserves pane placement');
  const m=mid.createMidriseSlice({id:'facade-midrise',kind:'midrise',x:0,z:0,width:14,depth:12,height:24});
  check(m.userData.openings.some(o=>o.face==='back'),'midrise rear has real openings');
  const {rolloutRecipe,createCityRollout}=await import('./js/world/city-rollout.js');
  const mp={id:'rear-midrise',kind:'midrise',x:0,z:0,width:14,depth:12,height:24},mn={...mp,id:'rear-neighbor',z:-12};
  const mr=rolloutRecipe(mp,'midrise',[mp,mn]);
  check(!mid.createMidriseSlice(mp,mr).userData.openings.some(o=>o.face==='back'),'midrise party wall has no windows');
  const sp={id:'kit-room-test',kind:'shop',x:0,z:0,width:10,depth:10,height:8},rollout=createCityRollout([sp]);
  const {upgradeFacadeKits}=await import('./js/world/facade-kit.js');await upgradeFacadeKits(rollout,[sp]);
  const kg=rollout.children[0].children[2].geometry,room=kg.attributes.aRoom;
  check(room&&room.count===kg.attributes.position.count&&room.array.some((n,i)=>i%4===3&&n>0),'authored rebuild retains valid room coordinates');
  rollout.userData.dispose();
  const legacy=createBuilding({id:'legacy-facade',kind:'terrace',x:0,z:0,width:6,depth:9,height:10});legacy.updateMatrixWorld(true);
  const panes=legacy.children.find(m=>m.material.name==='window-glass'), matrix=new T.Matrix4();panes.getMatrixAt(0,matrix);
  const point=new T.Vector3().setFromMatrixPosition(matrix);point.x+=.15;point.y+=.20;
  const ray=new T.Raycaster(new T.Vector3(point.x,point.y,8),new T.Vector3(0,0,-1)),hit=ray.intersectObject(panes)[0];
  check(hit,'legacy glass visible');
  check(!ray.intersectObjects(legacy.children.filter(m=>m.material.name.startsWith('terrace-'))).some(h=>h.distance<hit.distance),'legacy wall does not hide glass');
  const {createOfficeSlice}=await import('./js/world/office-slice.js');
  const office=createOfficeSlice({id:'corner-office',kind:'office',x:0,z:0,width:14,depth:13,height:28});office.updateMatrixWorld(true);
  for(const y of [1,8,16])for(const x of [-6.9,6.9]){
    const ray=new T.Raycaster(new T.Vector3(x,y,12),new T.Vector3(0,0,-1));
    check(ray.intersectObject(office.children[0]).length>0,'projecting office corner is closed');
  }
  const {east}=await import('./js/world/layout.js');
  const nine=town.EXPERIMENT_LOT_IDS.map((id,i)=>({...plot,id,x:east(i<5?681+i*6:713+(i-5)*6),z:-80}));
  const experiment=town.createTownhouseExperiment(nine,nine);
  check(experiment.children.length===2,'4096-vertex reusable scratch fits both nine-house chunks');
  experiment.userData.dispose();
  const tri=g=>g.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0);
  return {pass:true,faces:[...faces],houseTriangles:[tri(house),tri(far)],midriseTriangles:tri(m),materials:new Set(house.children.map(m=>m.material)).size};
})()''')
print(result)
assert result['pass'], result
