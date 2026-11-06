# browser-harness < tests/npc-idle.browser.py (real adult/child rig and existing GLB)
import os
import time
tab=new_tab('about:blank')
activate_tab(tab if isinstance(tab,str) else tab.get('targetId',tab))
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True)
cdp('Emulation.setEmulatedMedia',features=[{'name':'prefers-reduced-motion','value':'reduce' if os.environ.get('REDUCED')=='1' else 'no-preference'}])
goto_url('http://localhost:8000/?qa=1&weather=clear');wait_for_load()
deadline=time.monotonic()+30
while time.monotonic()<deadline:
    if js('document.body.classList.contains("world-ready")'):break
    time.sleep(.1)
result=js(r'''(async()=>{
 const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {createIdleClip}=await import('./js/world/npc-idle.js'),{personTemplate,NPC_VARIANTS,createNpc3d}=await import('./js/world/npc3d.js');
 const {createPeople}=await import('./js/world/people.js'),{stops}=await import('./js/content.js'),L=await import('./js/world/layout.js');
 const check=(ok,message)=>{if(!ok)throw Error(message);},gltf=await new GLTFLoader().loadAsync('./assets/npc/npc_pack.glb'),poses=[];
 for(const variant of [NPC_VARIANTS[0],NPC_VARIANTS[6]]){
  const root=personTemplate(gltf.scene,variant),bones=[];root.rotation.y=.7;root.traverse(o=>{if(o.isBone)bones.push(o);});
  const before=JSON.stringify(bones.map(b=>[b.position.toArray(),b.quaternion.toArray()])),clip=createIdleClip(root);
  check(before===JSON.stringify(bones.map(b=>[b.position.toArray(),b.quaternion.toArray()])),'pose generation leaves the pool body unchanged');
  const mixer=new T.AnimationMixer(root);mixer.clipAction(clip).play();mixer.update(0);root.updateMatrixWorld(true);
  const find=name=>bones.find(b=>b.name===name||(b.name.startsWith(name+'_')&&/^\d+$/.test(b.name.slice(name.length+1)))),point=name=>root.worldToLocal(find(name).getWorldPosition(new T.Vector3()));
  for(const side of ['l','r'])for(const [a,b]of [['thigh_','calf_'],['calf_','foot_'],['upperarm_','lowerarm_']])check(point(b+side).sub(point(a+side)).normalize().y<-.97,'relaxed upright limbs');
  const floor=Math.min(point('ball_l').y,point('ball_r').y),bounds=new T.Box3().setFromObject(root,true);
  check(floor>0&&floor<.2,'toe joints remain above their shoe soles');
  check(Math.abs(bounds.min.y)<1e-5,`shoe geometry stays in contact with the ground: ${variant.name} minY=${bounds.min.y}, toe=${floor}`);
  const chest=find('spine_03').quaternion.clone();mixer.update(2);check(chest.angleTo(find('spine_03').quaternion)>.007,'subtle breathing remains animated');
  poses.push({rig:variant.rig??'adult',floor,minY:bounds.min.y});mixer.stopAllAction();mixer.uncacheRoot(root);
 }
 const pts=L.routePoints(stops.length),curve=L.routeCurve(T,pts),people=createPeople({curve,pts,stops}),scene=new T.Scene(),actions=[];
 const original=T.AnimationMixer.prototype.clipAction;
 T.AnimationMixer.prototype.clipAction=function(clip,...args){const action=original.call(this,clip,...args);actions.push({root:this.getRoot(),clip:clip.name,action});return action;};
 let npc;
 try{
  npc=await createNpc3d(scene,{people,pts,stops,count:80});
  const frame=L.swapTunnelFrame(curve,stops),camera=new T.PerspectiveCamera(70,1.6,.1,1000);
  const move=(x,z)=>{camera.position.set(x,18,z+18);camera.lookAt(x,.5,z);camera.updateMatrixWorld();people.update(.1,camera.position);npc.update({camera,dt:.1});};
  move(frame.x,frame.z);
  const idle=actions.filter(a=>a.clip==='NPC_Idle'&&a.root.visible&&a.action.isRunning());
  check(idle.length===4,'both stationary pairs use the standing clip');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)check(idle.every(a=>a.action.time===0),'reduced motion installs a standing pose without advancing breathing');
  move(-283,0);
  const reused=idle.filter(a=>a.root.visible);
  check(reused.length>0&&reused.every(a=>!a.action.isRunning()),'reused bodies leave the idle clip when walking again');
  npc.dispose();return {pass:true,poses,idlePairs:idle.length/2,reusedWalkers:reused.length,reduced};
 }finally{T.AnimationMixer.prototype.clipAction=original;}
})()''')
print(result)
cdp('Emulation.setEmulatedMedia',features=[])
