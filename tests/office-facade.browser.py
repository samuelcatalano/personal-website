# With the local preview open: browser-harness < tests/office-facade.browser.py
# Stop-5 office tower (block--183--37): approved geometry and envelope unchanged, shared architecture kept, and per-pane coordinates for recess shading on the glass.
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
result = js(r'''(async()=>{
const T=await import('three'),office=await import('./js/world/office-slice.js'),kit=await import('./js/world/building-kit.js'),mats=await import('./js/world/building-slice-materials.js'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js'),{buildCity}=await import('./js/world/city.js');
const check=(v,m)=>{if(!v)throw Error(m)},pts=routePoints(stops.length),plots=[];
buildCity(()=>{},stops,pts,routeCurve(T,pts),undefined,undefined,p=>plots.push(p));
check(office.OFFICE_LOT_ID==='block--183--37','approved office lot');
const p=plots.find(q=>q.id===office.OFFICE_LOT_ID);check(p&&p.kind==='office'&&p.width===11&&p.depth===11&&p.height===31.5,'approved descriptor');
const ref=office.createOfficeSlice(p),shared=mats.townhouseMaterials();
const city=kit.createCityBuildings(plots),group=city.getObjectByName(p.id);
check(group&&group.userData.archetype==='office-slice'&&group.children.length===3,'office slice replaces the lot in three buckets');
for(const [k,m] of group.children.entries()){
  const a=m.geometry.attributes.position,b=ref.children[k].geometry.attributes.position;
  check(a.count===b.count,'vertex count unchanged: '+m.name);
  for(let i=0;i<a.count;i++){
    if(Math.abs(a.getX(i)-b.getX(i))>1e-6||Math.abs(a.getY(i)-b.getY(i))>1e-6||Math.abs(a.getZ(i)-b.getZ(i))>1e-6)throw Error('geometry moved: '+m.name);
    if(Math.abs(a.getX(i))>p.width/2+1e-4||Math.abs(a.getZ(i))>p.depth/2+1e-4||a.getY(i)<-1e-6||a.getY(i)>p.height+1e-4)throw Error('outside the lot envelope: '+m.name);
  }
}
check(group.children[0].material===shared.architecture&&group.children[1].material===shared.architecture,'mass and trim keep the shared architecture material');
const glass=group.children[2],pos=glass.geometry.attributes.position,pane=glass.geometry.attributes.aPane;
check(pane&&pane.itemSize===3&&pane.count===pos.count,'pane-local coordinates on every glass vertex');
check(glass.material!==shared.glass&&glass.material.map===shared.glass.map&&glass.material.userData.glow===true,'office glass has its own material on the shared atlas');
const seedsAll=new Set();let panes=0;
for(let q=0;q<pos.count;q+=6){
  panes++;let a0=1,a1=0,b0=1,b1=0;const seeds=new Set();
  for(let i=q;i<q+6;i++){a0=Math.min(a0,pane.getX(i));a1=Math.max(a1,pane.getX(i));b0=Math.min(b0,pane.getY(i));b1=Math.max(b1,pane.getY(i));seeds.add(pane.getZ(i).toFixed(6));}
  check(a0>=-1e-6&&a1<=1+1e-6&&b0>=-1e-6&&b1<=1+1e-6,'pane coordinates stay in 0..1');
  check(a0<=1e-6&&a1>=1-1e-6&&b0<=1e-6&&b1>=1-1e-6,'pane coordinates span the whole pane');
  check(seeds.size===1,'one deterministic seed per pane');
  seedsAll.add([...seeds][0]);
}
check(panes>=20&&seedsAll.size>=panes*0.5,'per-pane variation is distinct across the facade');
const rebuilt=office.createOfficeSlice(p);check(rebuilt.children[2].geometry.attributes.position.count===pos.count,'same pane count on a rebuild');
return {pass:true,id:p.id,panes,distinctSeeds:seedsAll.size,materials:group.children.map(m=>m.material.name)};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
