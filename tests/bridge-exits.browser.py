# Desktop street geometry, actual traffic and occluded-recycling regression.
t=new_tab('http://localhost:8000/tests/fixtures/npc-stage.html');target=t if isinstance(t,str) else t['targetId'];wait_for_load()
try:
 cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
 print(js(r'''(async()=>{
  const T=await import('three'),{stops}=await import('/js/content.js'),L=await import('/js/world/layout.js');
  const {createUnderpass}=await import('/js/world/underpass.js'),{createUnderpassTraffic}=await import('/js/world/underpass-traffic.js');
  const {buildCity}=await import('/js/world/city.js'),plots=[];
  const check=(ok,msg)=>{if(!ok)throw Error(msg)},pts=L.routePoints(stops.length),curve=L.routeCurve(T,pts);
  const up=createUnderpass(curve,stops,{x0:L.riverStart(stops,pts),x1:L.riverEnd(stops,pts),z:L.RIVER_Z,width:22});
  buildCity(()=>{},stops,pts,curve,undefined,undefined,p=>plots.push(p));
  check(up.passes.every(p=>p.street?.curve),'Both far-bank exits need curved streets');
  const counts=[];up.group.updateMatrixWorld(true);
  for(const [i,p]of up.passes.entries()){
   const g=up.group.getObjectByName('underpass-'+i),s=p.street;
   check(g.children.length===7,'Street adds bridge render buckets');
   const a=s.curve.getPointAt(0),b=s.curve.getPointAt(1),t=s.curve.getTangentAt(0);
   check(Math.abs(a.x)<1e-6&&Math.abs(a.z-p.river.sigma*p.river.inAz)<1e-6,'Street misses the ramp');
   check(t.z*p.river.sigma>.999,'Street join changes direction abruptly');
   check(Math.abs(b.x-a.x)>10&&s.length>35,'Street does not turn behind the block');
   // Rear rows are outside the existing scene's river-approach lot removal zone.
   for(let k=0;k<=300;k++){
    const u=k/300,p=s.curve.getPointAt(u),t=s.curve.getTangentAt(u),half=2.8+.2*Math.max(0,1-u*s.length/6)+.62;
    for(const offset of [-half,0,half]){
     const q=p.clone().add(new T.Vector3(t.z*offset,0,-t.x*offset)).applyMatrix4(g.matrixWorld);
     const hit=plots.find(lot=>lot.z<=-96&&Math.abs(q.x-lot.x)<lot.width/2+.2&&Math.abs(q.z-lot.z)<lot.depth/2+.2);
     check(!hit,'Street paving clips rear lot '+hit?.id+' at '+u);
    }
   }
   counts.push(g.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0));
  }
  const traffic=createUnderpassTraffic(up.passes);await traffic.ready;
  const cars=traffic.group.children.flatMap(g=>g.children),previous=cars.map(c=>({x:c.position.x,z:c.position.z,visible:c.visible}));let wraps=0,turns=0,maxHalfLength=0;
  traffic.group.updateMatrixWorld(true);
  for(const c of cars){const inverse=c.matrixWorld.clone().invert(),bounds=new T.Box3();c.traverse(o=>{if(o.isMesh&&o.name!=='beam'){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().premultiply(inverse)))}});maxHalfLength=Math.max(maxHalfLength,Math.abs(bounds.min.x),Math.abs(bounds.max.x))}
  for(let step=0;step<700;step++){
   traffic.update(.1);
   cars.forEach((c,i)=>{
    const jump=Math.hypot(c.position.x-previous[i].x,c.position.z-previous[i].z);
    if(jump>2){check(!c.visible&&!previous[i].visible,'Traffic teleports while visible '+JSON.stringify({i,step,jump,before:previous[i],after:c.position.toArray()}));wraps++}
    if(Math.abs(c.position.x)>3&&c.visible){turns++;check(Math.abs(c.position.y-.12)<1e-5,'Car floats on the level street')}
    if(!c.visible)check(c.children.filter(o=>o.name==='beam').every(o=>!o.visible),'Hidden headlights remain visible');
    previous[i]={x:c.position.x,z:c.position.z,visible:c.visible};
   });
  }
  check(wraps>=16&&turns>100,'Moving fleet did not exercise both street loops');traffic.dispose();
  const still=createUnderpassTraffic(up.passes,{reducedMotion:true}),positions=still.group.children.flatMap(g=>g.children.map(c=>c.position.toArray()));still.update(30);
  check(JSON.stringify(positions)===JSON.stringify(still.group.children.flatMap(g=>g.children.map(c=>c.position.toArray()))),'Reduced motion moves traffic');still.dispose();
  up.group.userData.dispose();return{pass:true,bridges:2,triangles:counts,wraps,turns,maxHalfLength};
 })()'''))
finally:cdp('Target.closeTarget',targetId=target)
