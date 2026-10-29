# Run inside browser-harness against the local preview (fresh cache-disabled tab). Office + tower kit contract.
result=js(r'''(async()=>{
const T=await import('three'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js'),{buildCity}=await import('./js/world/city.js');
const {classifyPlot,rolloutRecipe}=await import('./js/world/city-rollout.js'),{officeOverlay,towerOverlay}=await import('./js/world/hirise-kit.js'),{loadKit}=await import('./js/world/kit-loader.js'),{enabledKits,selectKitLots}=await import('./js/world/facade-kit.js');
const check=(v,m)=>{if(!v)throw Error(m)},pts=routePoints(stops.length),plots=[];buildCity(()=>{},stops,pts,routeCurve(T,pts),undefined,undefined,p=>plots.push(p));
const [office,tower]=await Promise.all([loadKit(new URL('./assets/processed/buildings/office-kit.glb?v=1',location.href).href),loadKit(new URL('./assets/processed/buildings/tower-kit.glb?v=1',location.href).href)]);
check(office.size===21&&tower.size===18,'module counts '+office.size+'/'+tower.size);
check(enabledKits('?kits=0').length===0&&enabledKits('').length===4&&enabledKits('?kits=office,tower').join()==='office,tower','kits flag');
const rollout=plots.filter(p=>p.id!=='frontage-gap-olm-135--1--9'&&classifyPlot(p)),sel=selectKitLots(rollout);
let tris=0,n=0;const stats={office:0,tower:0};
for(const [kind,list,kit,fn]of [['office',sel.offices,office,officeOverlay],['tower',sel.towers,tower,towerOverlay]]){
 for(const p of list){const r=rolloutRecipe(p,kind,plots),rr=kind==='office'?{...r,rooftop:false}:{...r,crown:4},acc=fn(p,rr,kit,p.id.length*2654435761>>>0);stats[kind]++;
  acc.forEach((b,k)=>{const a=b.position;tris+=a.length/9;for(let i=0;i<a.length;i+=3){
   check(Math.abs(a[i])<=p.width/2+1e-4&&Math.abs(a[i+2])<=p.depth/2+1e-4,kind+' '+p.id+' footprint '+a[i]+','+a[i+2]);
   check(a[i+1]>=0&&a[i+1]<=p.height+1e-4,kind+' '+p.id+' height '+a[i+1]+' > '+p.height);}
   check(b.aSurface.every(Number.isFinite),'surfaces');});}}
return {pass:true,stats,tris};})()''')
print(result)
assert isinstance(result,dict) and result.get('pass'),result
