# Desktop, same-origin fixture. Actual actor, animation mixer, camera and reduced motion.
print(js(r'''(async()=>{
 const T=await import('three'),{buildFigure}=await import('/js/world/figure.js');
 const check=(v,m)=>{if(!v)throw Error(m)};
 const camera=new T.PerspectiveCamera(40,1,.1,1400);camera.position.set(0,3,100);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 const make=async(reducedMotion=false)=>{
  let ready=false;const f=buildFigure(()=>{ready=true},{reducedMotion});f.updateMatrixWorld(true);f.userData.update(0,camera);
  for(let i=0;i<200&&!ready;i++)await new Promise(r=>setTimeout(r,25));
  check(ready&&!f.getObjectByName('memoji').visible,'Real Samuel must load');return f;
 };
 const figure=await make();
 try{
  const cue=figure.userData.greeting;check(cue&&cue.sequence===0&&!cue.visible,'Loading at a distance must not greet');
  camera.position.set(0,3,20);camera.lookAt(0,1,0);camera.updateMatrixWorld();figure.userData.update(0,camera);
  check(cue.sequence===1&&cue.visible&&cue.elapsed===0,'First visible encounter must begin with a wave/greeting');
  for(let i=0;i<74;i++)figure.userData.update(.1,camera);
  check(cue.sequence===1,'No timer may emit before the real animation loops');
  figure.userData.update(.2,camera);check(cue.sequence===2&&cue.elapsed<.2,'Mixer loop must emit the next greeting');
  camera.lookAt(0,3,100);camera.updateMatrixWorld();figure.userData.update(.1,camera);
  check(!cue.visible,'Looking away must end the encounter');
  for(let i=0;i<80;i++)figure.userData.update(.1,camera);
  check(cue.sequence===2,'Offscreen animation must not emit greetings');
  camera.lookAt(0,1,0);camera.updateMatrixWorld();figure.userData.update(0,camera);
  check(cue.sequence===3&&cue.elapsed===0,'Re-entry must restart one greeting and wave');
  const held=cue.sequence;for(let i=0;i<100;i++)figure.userData.update(0,camera);
  check(cue.sequence===held,'Paused animation cannot repeat the greeting');
 }finally{figure.userData.dispose();}
 camera.position.set(0,3,100);camera.lookAt(0,1,0);camera.updateMatrixWorld();const still=await make(true);
 try{
  camera.position.z=20;camera.updateMatrixWorld();still.userData.update(0,camera);
  check(still.userData.greeting.sequence===1,'Reduced motion must greet on entry');
  for(let i=0;i<200;i++)still.userData.update(.1,camera);
  check(still.userData.greeting.sequence===1,'Static raised hand cannot emit repeating speech');
 }finally{still.userData.dispose();}
 return {pass:true,normalGreetings:3,reducedMotionGreetings:1};
})()'''))
