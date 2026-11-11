# browser-harness < tests/npc-behavior.browser.py
import json
new_tab('http://localhost:8000/tests/fixtures/npc-stage.html');wait_for_load()
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True)
print(js(r'''(async()=>{
 const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{personTemplate,NPC_VARIANTS}=await import('../../js/world/npc3d.js'),{createIdleClip}=await import('../../js/world/npc-idle.js'),{createNpcPose}=await import('../../js/world/npc-pose.js');
 const check=(ok,message)=>{if(!ok)throw Error(message);},asset=await new GLTFLoader().loadAsync('../../assets/npc/npc_pack.glb'),results=[];
 for(const variant of [NPC_VARIANTS[0],NPC_VARIANTS[6]]){
  const root=personTemplate(asset.scene,variant),clip=createIdleClip(root),mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.play();mixer.update(0);
  const pose=createNpcPose(root,clip),bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});
  const bone=name=>bones.find(b=>b.name===name||(b.name.startsWith(name+'_')&&/^\d+$/.test(b.name.slice(name.length+1))));
  const rest=bone('head').quaternion.clone();pose.reset(0);
  const frame=(extra={})=>{pose.restore();mixer.update(1/60);root.updateMatrixWorld(true);pose.update({dt:1/60,ground:0,speed:0,yaw:root.rotation.y,gaitWeight:0,turnRate:0,contact:true,bus:new T.Vector3(4,1,8),people:[],landmarks:[],...extra});root.updateMatrixWorld(true);};
  const finger=bone('index_01_l'),fingerRest=finger.quaternion.clone();
  let maxLook=0,minShift=Infinity,maxShift=-Infinity,maxFinger=0;
  for(let i=0;i<900;i++){frame();maxLook=Math.max(maxLook,rest.angleTo(bone('head').quaternion));maxFinger=Math.max(maxFinger,fingerRest.angleTo(finger.quaternion));const x=bone('pelvis').getWorldPosition(new T.Vector3()).x;minShift=Math.min(minShift,x);maxShift=Math.max(maxShift,x);}
  check(maxLook>.05&&maxLook<.7,'head briefly watches the bus within a natural neck limit');
  check(maxShift-minShift>.005&&maxShift-minShift<.05,'standing weight shifts remain subtle');
  check(maxFinger>.005&&maxFinger<.08,'fingers relax subtly instead of staying rigid');
  check(root.rotation.y===0,'gaze never rotates the whole body');
  for(const id of [1,2]){
    pose.restore();pose.reset(id);
    const point=new T.Vector3(4,1,8),extra={bus:null,people:id===1?[{who:99,x:4,z:8,inst:{position:point}}]:[],landmarks:id===2?[point]:[]};
    for(let i=0;i<60;i++)frame(extra);
    check(Math.abs(pose.state.lookYaw)>.05,id===1?'gaze tracks a nearby person':'gaze tracks a landmark');
    for(let i=0;i<240;i++)frame(extra);
    check(Math.abs(pose.state.lookYaw)<.01,'attention ends and the head returns forward');
  }
  const armAngles=[];
  for(const id of [0,1,2]){pose.restore();pose.reset(id);action.reset().play();mixer.update(.3);const arm=bone('upperarm_l');arm.quaternion.fromArray(clip.tracks.find(t=>t.name===arm.name+'.quaternion').values).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.3));const before=arm.quaternion.clone();pose.update({dt:1/60,ground:0,speed:.6,yaw:0,gaitWeight:1,turnRate:0,contact:false,people:[],landmarks:[]});armAngles.push(before.angleTo(arm.quaternion));}
  check(new Set(armAngles.map(a=>a.toFixed(3))).size===3,'profiles produce distinct upper-body movement');
  check(armAngles.every(a=>a>.02&&a<.13),'profiles preserve the walking swing instead of replacing it with the standing pose');
  pose.restore();pose.reset(0);action.reset().play();mixer.update(0);
  for(let i=0;i<20;i++)frame({bus:null});
  const foot=bone('foot_l'),planted=foot.getWorldPosition(new T.Vector3());
  for(let i=0;i<12;i++){root.position.z+=.001;frame({bus:null});}
  const slip=foot.getWorldPosition(new T.Vector3()).distanceTo(planted);
  check(slip<.006,`planted foot stays in place while the body shifts: ${slip}`);
  let lift=0;const floor=foot.getWorldPosition(new T.Vector3()).y;
  for(let i=0;i<60;i++){root.rotation.y+=.012;frame({bus:null,turnRate:.72});lift=Math.max(lift,foot.getWorldPosition(new T.Vector3()).y-floor);}
  check(pose.feet.state.steps>0&&lift>.015,'turning lifts and repositions a supporting foot');
  for(const b of bones){check(b.quaternion.toArray().every(Number.isFinite),'IK and poses keep all joint rotations finite');check(Math.abs(b.quaternion.lengthSq()-1)<.001,'all joint rotations stay normalized');}
  pose.restore();pose.reset(999);check(pose.feet.state.contacts===0,'pool reuse clears planted-foot anchors');
  pose.reset(0);for(let i=0;i<60;i++)frame();pose.suspend();
  check(pose.state.lookYaw===0&&pose.feet.state.contacts===0,'distance deactivation clears gaze and contact before a smooth return');
  check(bone('head').quaternion.angleTo(rest)<.005,'distance deactivation restores the unmodified head pose');
  results.push({rig:variant.rig??'adult',maxLook,weightShift:maxShift-minShift,footSlip:slip,turnLift:lift,profiles:armAngles});
  mixer.stopAllAction();mixer.uncacheRoot(root);
 }
 return results;
})()'''))
