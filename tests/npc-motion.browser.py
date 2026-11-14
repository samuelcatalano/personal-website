# browser-harness < tests/npc-motion.browser.py
import json, os
tab = new_tab('http://localhost:8000/tests/fixtures/npc-stage.html?qa=1')
wait_for_load()
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True)
cdp('Network.setBypassServiceWorker',bypass=True)
result = js(r'''(async()=>{
 const T=await import('three'),{createNpc3d}=await import('../../js/world/npc3d.js'),{crowdPlan}=await import('../../js/world/crowd.js'),{stops}=await import('../../js/content.js'),L=await import('../../js/world/layout.js');
 const child=CHILD,dt=FRAME_DT,check=(ok,message)=>{if(!ok)throw Error(message);},pts=L.routePoints(stops.length),plan=crowdPlan(stops,pts,1017),id=plan.findIndex(p=>(child?['boy','girl'].includes(p.look.kind):p.look.kind==='man')&&p.path.type!=='idle'),count=plan.length;
 const people={visible:new Uint8Array(count),walkPace:new Float32Array(count).fill(1),route:{x:new Float32Array(count).fill(10000),z:new Float32Array(count).fill(10000),fx:new Float32Array(count),fz:new Float32Array(count).fill(1)}};
 people.visible[id]=1;people.route.x[id]=people.route.z[id]=0;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1.5,.1,300);camera.position.set(4,2,7);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 const actions=[],original=T.AnimationMixer.prototype.clipAction;
 T.AnimationMixer.prototype.clipAction=function(clip,...args){const action=original.call(this,clip,...args);actions.push({root:this.getRoot(),clip:clip.name,action});return action;};
 let npc;
 try{
  npc=await createNpc3d(scene,{people,pts,stops,count:child?4:1});
  const frame=()=>npc.update({camera,dt});frame();
  const chosen=actions.find(a=>a.root.visible&&a.clip.startsWith('NPC_Walk')),walk=chosen.action,body=chosen.root;
  // Simulation heading can look toward the bus; the moving body must follow its travel direction.
  people.route.fx[id]=1;people.route.fz[id]=0;
  for(let i=0;i<120;i++){people.route.z[id]+=.55*dt;frame();}
  const movingYaw=body.rotation.y;
  check(Math.abs(movingYaw)<.1,'moving pedestrian must not walk sideways while watching the bus');
  const stride={NPC_Walk:.621,NPC_Walk3:.592,NPC_Walk3_C:.418}[chosen.clip]*body.scale.z;
  check(Math.abs(walk.getEffectiveTimeScale()*stride-.55)<.05,'cadence follows measured displacement, not nominal route speed');
  people.walkPace[id]=0;
  let maxTurn=0;
  for(let i=0;i<150;i++){const old=body.rotation.y;frame();maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(body.rotation.y-old),Math.cos(body.rotation.y-old))));}
  const idle=actions.find(a=>a.root===body&&a.clip==='NPC_Idle')?.action;
  check(idle?.isRunning()&&idle.getEffectiveWeight()>.99,'stopped walker blends to a real standing pose');
  check(walk.getEffectiveWeight()<.01,'walking pose does not freeze mid-stride');
  check(maxTurn<=3*dt+.001,'stationary turn respects a human-scale angular speed');
  body.updateMatrixWorld(true);
  const bones=[];body.traverse(o=>{if(o.isBone)bones.push(o);});
  const bone=name=>bones.find(b=>b.name===name||(b.name.startsWith(name+'_')&&/^\d+$/.test(b.name.slice(name.length+1))));
  for(const side of ['l','r']){
   const drop=bone('foot_'+side).getWorldPosition(new T.Vector3()).y-bone('ball_'+side).getWorldPosition(new T.Vector3()).y;
   check(drop>.02*body.scale.y,`standing toes stay below the ankles: ${side} drop=${drop}`);
  }
  let merged;body.traverse(o=>{if(o.isSkinnedMesh&&o.userData.npcBody)merged=o;});
  const footIndex=[];const foot=merged.geometry.attributes._foot.array;for(let i=0;i<foot.length;i++)if(foot[i]>.5)footIndex.push(i);
  const vertices=footIndex.map(i=>body.worldToLocal(merged.localToWorld(merged.getVertexPosition(i,new T.Vector3()))));
  const mid=(Math.min(...vertices.map(v=>v.z))+Math.max(...vertices.map(v=>v.z)))/2;
  const heel=Math.min(...vertices.filter(v=>v.z<mid).map(v=>v.y)),toe=Math.min(...vertices.filter(v=>v.z>=mid).map(v=>v.y));
  check(Math.abs(toe-heel)<.025,`standing shoes must lie flat, heel/toe difference=${toe-heel}`);
  let maxWeightStep=0,previous=walk.getEffectiveWeight();
  for(let i=0;i<150;i++){
   people.route.z[id]+=.55*dt;people.walkPace[id]=1;frame();
   const weight=walk.getEffectiveWeight();maxWeightStep=Math.max(maxWeightStep,Math.abs(weight-previous));previous=weight;
  }
  check(maxWeightStep<.2,'walk restarts without a one-frame pose pop');
  check(walk.getEffectiveWeight()>.99,'walking fully resumes');
  check(!idle.isRunning(),'zero-weight idle stops evaluating after the transition');
  people.route.x[id]=400;camera.position.set(404,2,7);camera.lookAt(400,1,people.route.z[id]);camera.updateMatrixWorld();frame();
  check(body.visible&&Math.abs(body.position.x-400)<.001,'camera jump installs the new pool position immediately');
  check(Number.isFinite(walk.getEffectiveWeight())&&walk.getEffectiveTimeScale()<=1.76,'pool reassignment clears old velocity without a cadence spike');
  camera.position.set(400,2,people.route.z[id]+120);camera.lookAt(400,1,people.route.z[id]);camera.updateMatrixWorld();frame();
  const startTime=walk.time;let expected=0;
  for(let i=0;i<12;i++){people.route.z[id]+=.55*dt;frame();expected+=dt*walk.getEffectiveTimeScale();}
  const duration=walk.getClip().duration,advanced=(walk.time-startTime+duration)%duration;
  check(Math.abs(advanced-expected)<3*dt,'distant skeletal throttling preserves accumulated animation time');
  const result={rig:child?'child':'adult',fps:1/dt,movingYaw,maxTurnRadiansPerFrame:maxTurn,maxWeightStep,measuredStride:stride,standingHeelToeDifference:toe-heel};
  npc.dispose();return result;
 }finally{T.AnimationMixer.prototype.clipAction=original;}
})()'''.replace('CHILD','true' if os.environ.get('RIG')=='child' else 'false').replace('FRAME_DT',str(1/float(os.environ.get('FPS','60')))))
print(json.dumps(result))
