# browser-harness < tests/hero-garden.browser.py (real route, pedestrian separation and garden geometry)
import time

tab=new_tab('about:blank')
activate_tab(tab if isinstance(tab,str) else tab.get('targetId',tab))
cdp('Network.enable')
cdp('Network.setCacheDisabled',cacheDisabled=True)
goto_url('http://localhost:8000/?qa=1&weather=clear')
wait_for_load()
result=js(r'''(async()=>{
 const T=await import('three'),{stops}=await import('./js/content.js'),L=await import('./js/world/layout.js');
 const {crowdPlan}=await import('./js/world/crowd.js'),{createPeople}=await import('./js/world/people.js');
 const {createHeroRealm}=await import('./js/world/hero-realm.js'),{buildParks}=await import('./js/world/parks.js');
 const pts=L.routePoints(stops.length),curve=L.routeCurve(T,pts),plan=crowdPlan(stops,pts,1017),garden=createHeroRealm();
 const ids=plan.flatMap((p,i)=>p.path.name?.startsWith('hero-garden-')?[i]:[]),trees=[];
 buildParks(()=>{},stops,pts,curve,[],(x,z,shape)=>{if(x>-293&&x<-273&&z>-24&&z<24)trees.push({x:x+283,z,...shape});},()=>{});
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 check(ids.length>=32&&trees.length===13,'populated garden keeps all thirteen trees');
 const lawns=[-5.6,5.6].flatMap(x=>[-13,13].map(z=>({x0:x-2.65,x1:x+2.65,z0:z-6.8,z1:z+6.8})));
 const clear=(x,z,q,r)=>Math.hypot(Math.max(0,q.x0-x,x-q.x1),Math.max(0,q.z0-z,z-q.z1))>=r;
 let minimumGap=Infinity;
 for(const reducedMotion of [false,true]){
  const people=createPeople({curve,pts,stops,reducedMotion});people.update(0,{x:-283,z:0});
  const initial=ids.map(i=>[people.route.x[i],people.route.z[i]]);
  for(let k=0;k<480;k++){
   people.update(.25,{x:-283,z:0});
   for(let a=0;a<ids.length;a++){
    const i=ids[a],x=people.route.x[i]+283,z=people.route.z[i],r=plan[i].look.height*.16;
    check(Math.abs(x)+r<1.8&&Math.abs(z)+r<24,'walkers stay on the existing central paving');
    for(const q of lawns)check(clear(x,z,q,r),'keep walkers off the lawns');
    for(const o of garden.userData.obstacles)check(clear(x,z,o.rect,r+.1),'clear '+o.kind);
    for(const t of trees)check(Math.hypot(x-t.x,z-t.z)>r+.3,'clear tree trunks');
    for(let b=0;b<a;b++)minimumGap=Math.min(minimumGap,Math.hypot(people.route.x[i]-people.route.x[ids[b]],people.route.z[i]-people.route.z[ids[b]]));
   }
  }
  const moved=ids.some((i,k)=>Math.hypot(people.route.x[i]-initial[k][0],people.route.z[i]-initial[k][1])>.1);
  check(moved!==reducedMotion,'respect reduced motion');
 }
 check(minimumGap>=.5,`pedestrians retain at least half a metre of separation (minimum ${minimumGap})`);
 garden.userData.dispose();
 return {pass:true,walkers:ids.length,trees:trees.length,seconds:120,reducedMotion:'checked',minimumGap};
})()''')
print(result)
