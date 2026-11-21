# Desktop NPC fixture. A real click unlocks audio, then the actual mixer drives the 10 Hz sound driver.
import time
js("document.body.innerHTML='<button style=\"width:300px;height:100px\">Start audio test</button>'; window.__unlock=import('/js/audio/engine.js').then(e=>document.querySelector('button').onclick=()=>e.setEnabled(true));")
js('window.__unlock')
click_at_xy(100, 50)
js(r'''window.__samuelGreetingTest=(async()=>{
 const T=await import('three'),{buildFigure}=await import('/js/world/figure.js');
 const {audio,setEnabled}=await import('/js/audio/engine.js'),{createSound}=await import('/js/audio/index.js');
 const {stops}=await import('/js/content.js'),{stopMarks}=await import('/js/scroll.js'),{routePoints}=await import('/js/world/layout.js');
 const check=(v,m)=>{if(!v)throw Error(m)},g=audio(),original=g.c.createBufferSource.bind(g.c);let starts=0;
 g.c.createBufferSource=()=>{const source=original(),start=source.start.bind(source);source.start=(...args)=>{if(Math.abs(source.buffer?.duration-4.33068)<.01)starts++;start(...args);};return source;};
 const camera=new T.PerspectiveCamera(40,1,.1,1400);camera.position.set(0,3,100);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 let ready=false;const figure=buildFigure(()=>{ready=true});figure.userData.update(0,camera);
 const driver=createSound({stops,marks:stopMarks(routePoints(stops.length)),progress:()=>1,night:()=>false,world:()=>({routeS:11,samuelGreeting:figure.userData.greeting})});
 try{
  for(let i=0;i<200&&!ready;i++)await new Promise(r=>setTimeout(r,25));check(ready,'Actor must load');
  await new Promise(r=>setTimeout(r,500));check(starts===0,'Loading offscreen cannot speak');
  check(!document.hidden&&g.c.state==='running','Test needs a visible, unlocked audio context');
  camera.position.z=20;camera.updateMatrixWorld();figure.userData.update(0,camera);
  await new Promise(r=>setTimeout(r,150));check(starts===1,'The real driver must consume the entry cue');
  for(let i=0;i<76;i++){figure.userData.update(.1,camera);await new Promise(r=>setTimeout(r,100));}
  await new Promise(r=>setTimeout(r,150));check(starts===2,'Remaining stationary must speak again on the real Wave loop: '+JSON.stringify({starts,cue:figure.userData.greeting,error:driver.state.error,hidden:document.hidden,state:g.c.state}));
  setEnabled(false);await new Promise(r=>setTimeout(r,150));
  for(let i=0;i<76;i++){figure.userData.update(.1,camera);await new Promise(r=>setTimeout(r,100));}
  await new Promise(r=>setTimeout(r,250));check(starts===2,'Muted Wave loops cannot start speech');check(!driver.state.error,'Sound driver must not throw');
  return {pass:true,waves:figure.userData.greeting.sequence,recordings:starts,mutedLoopSkipped:true};
 }finally{setEnabled(false);figure.userData.dispose();g.c.createBufferSource=original;}
})().then(value=>window.__samuelGreetingResult=value,error=>window.__samuelGreetingResult={pass:false,error:String(error)});0''')
for _ in range(100):
    result=js('window.__samuelGreetingResult||null')
    if result is not None: break
    time.sleep(.5)
assert result and result.get('pass'), result
print(result)
