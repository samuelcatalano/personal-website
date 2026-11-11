# MOBILE=1 browser-harness < tests/npc-behavior-budget.browser.py
import os
new_tab('http://localhost:8000/tests/fixtures/npc-stage.html?qa=1');wait_for_load()
mobile=os.environ.get('MOBILE')=='1'
cdp('Emulation.setDeviceMetricsOverride',width=375 if mobile else 1280,height=812 if mobile else 800,deviceScaleFactor=1,mobile=mobile)
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True)
try:
 print(js(r'''(async()=>{
  const T=await import('three'),{createNpc3d}=await import('../../js/world/npc3d.js'),{crowdPlan}=await import('../../js/world/crowd.js'),{stops}=await import('../../js/content.js'),L=await import('../../js/world/layout.js');
  const pts=L.routePoints(stops.length),plan=crowdPlan(stops,pts,1017),N=plan.length,people={visible:new Uint8Array(N),walkPace:new Float32Array(N).fill(1),route:{x:new Float32Array(N).fill(10000),z:new Float32Array(N).fill(10000),fx:new Float32Array(N),fz:new Float32Array(N).fill(1)}};
  for(let i=0;i<48;i++){people.visible[i]=1;people.route.x[i]=(i%12-6)*2;people.route.z[i]=Math.floor(i/12)*2;}
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1.5,.1,300);camera.position.set(0,36,64);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  const npc=await createNpc3d(scene,{people,pts,stops,count:48});npc.update({camera,dt:1/60,bus:new T.Vector3(0,0,5)});
  const rows=__npcDiagnostics.snapshot(),poses=rows.filter(r=>r.motion),contacts=rows.filter(r=>r.motion?.contact),narrow=innerWidth<700;
  if(!poses.length||poses.length>(narrow?12:24))throw Error('normal orbit camera must activate a bounded expressive population');
  if(!contacts.length||contacts.length>(narrow?4:8))throw Error('normal orbit camera must activate a bounded foot-contact population');
  npc.dispose();return {viewport:innerWidth,poses:poses.length,contacts:contacts.length,orbitCameraDistance:64};
 })()'''))
finally:cdp('Emulation.clearDeviceMetricsOverride')
