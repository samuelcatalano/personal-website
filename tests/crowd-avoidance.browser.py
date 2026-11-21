# browser-harness < tests/crowd-avoidance.browser.py (desktop, real 1,000-person plan)
# Exercises the production scene geometry as well as crowd continuity and body clearance.
import json, os, time
tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab['targetId'])
wait_for_load()
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
goto_url('http://localhost:8000/?qa=1&nosw&weather=clear&crowd-behavior=test');wait_for_load()
for _ in range(160):
 if js('!!window.__qaPedestrians'):break
 time.sleep(.3)
else:raise AssertionError('production pedestrian space did not start')
source = r'''(async()=>{
 const T=await import('three'),L=await import('/js/world/layout.js'),{stops}=await import('/js/content.js'),{crowdPlan}=await import('/js/world/crowd.js');
 const pts=L.routePoints(stops.length),curve=L.routeCurve(T,pts),plan=crowdPlan(stops,pts,1017),results=[];
 const {createPeople}=await import('/js/world/people.js?avoidance='+Date.now());
 const space=window.__qaPedestrians.space;
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 check(plan.length===1000,'preserve the full crowd');
 for(const cam of [{x:460,z:-20},{x:-125,z:-38},{x:110,z:-18},{x:-283,z:0}]) {
 const p=createPeople({curve,pts,stops,space}),metrics={cam,min:99,bodyOverlaps:0,maxStep:0,unsafe:0,recoveries:0,worst:null,jump:null};
 window.probeMetrics=metrics;
 const ranges=plan.map(()=>({x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity,samples:0}));
 for(let k=0;k<900;k++){
 if(k%25===0)await new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve();};c.port2.postMessage(0);});
 window.probeProgress={cam,step:k};
 const bx=p.route.x.slice(),bz=p.route.z.slice();p.update(.1,cam);if(k<20)continue;
 const cells=new Map();
 for(let i=0;i<plan.length;i++){
 const x=p.route.x[i],z=p.route.z[i];if(Math.hypot(x-cam.x,z-cam.z)>100||!p.visible[i])continue;
 const r=ranges[i];r.x0=Math.min(r.x0,x);r.x1=Math.max(r.x1,x);r.z0=Math.min(r.z0,z);r.z1=Math.max(r.z1,z);r.samples++;
 const step=Math.hypot(x-bx[i],z-bz[i]);if(step>metrics.maxStep){metrics.maxStep=step;metrics.jump={id:i,name:plan[i].path.name,type:plan[i].path.type,second:k/10};}
 if(!space.allows(x,z,.16*plan[i].look.height)){
 metrics.unsafe++;metrics.unsafeExample??={id:i,path:plan[i].path,second:k/10,x,z,why:space.reason(x,z,.16*plan[i].look.height),state:{...p.behavior[i]}};
 }
 const cx=Math.floor(x),cz=Math.floor(z);
 for(let a=cx-1;a<=cx+1;a++)for(let b=cz-1;b<=cz+1;b++)for(const j of cells.get(`${a},${b}`)||[]){
 const d=Math.hypot(x-p.route.x[j],z-p.route.z[j]);if(d<metrics.min){metrics.min=d;metrics.worst={i,j,names:[plan[i].path.name||'lane',plan[j].path.name||'lane'],second:k/10,positions:[x,z,p.route.x[j],p.route.z[j]],states:[{...p.behavior[i]},{...p.behavior[j]}]};}if(d<.5)metrics.bodyOverlaps++;
 }
 const key=`${cx},${cz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
 }
 }
 metrics.stalled=ranges.flatMap((r,i)=>r.samples>600&&plan[i].path.type!=='idle'&&Math.hypot(r.x1-r.x0,r.z1-r.z0)<.5?[{id:i,path:plan[i].path.name||'lane',range:Math.hypot(r.x1-r.x0,r.z1-r.z0),state:p.behavior[i]}]:[]);
 metrics.recoveries=p.behavior.reduce((n,s)=>n+s.recoveries,0);
 check(metrics.stalled.length===0,`stalled pedestrians ${JSON.stringify(metrics.stalled)}`);
 check(metrics.unsafe===0,`unsafe terrain samples ${JSON.stringify(metrics)}`);
 check(metrics.min>=.6,`body clearance ${JSON.stringify(metrics)}`);
 check(metrics.maxStep<.25,`contact jump ${metrics.maxStep} near ${cam.x}`);
 results.push(metrics);
 }
 return {pass:true,count:plan.length,secondsPerRegion:90,regions:results};
})()'''
js("window.probeDone=null;window.probeError=null;void "+source+".then(r=>window.probeDone=r).catch(e=>window.probeError=String(e)); 'started'")
for _ in range(480):
 time.sleep(.5)
 try:result=js('({result:window.probeDone,error:window.probeError})')
 except RuntimeError as e:
  if 'timed out' in str(e):continue
  raise
 if result.get('error'): raise AssertionError(result['error'])
 if result.get('result') is not None:
  result=result['result'];break
else:raise AssertionError('probe timed out')
if os.environ.get('OUT'):
 os.makedirs(os.environ['OUT'],exist_ok=True)
 open(os.path.join(os.environ['OUT'],'crowd-avoidance.json'),'w').write(json.dumps(result,indent=2))
print(result)
