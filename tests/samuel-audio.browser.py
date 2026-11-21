# Desktop, same-origin fixture: real asset, repeated playback and shared-graph headroom.
print(js(r'''(async()=>{
 const {buildGraph,BUSES}=await import('/js/audio/engine.js');
 const {BUS,audioState}=await import('/js/audio/state.js');
 const {createBeds}=await import('/js/audio/voices/beds.js');
 const {createStadium}=await import('/js/audio/voices/stadium.js');
 const {createSamuelVoice}=await import('/js/audio/voices/samuel.js');
 const check=(v,m)=>{if(!v)throw Error(m)};
 const render=async(mix=false,mute=false)=>{
  const c=new OfflineAudioContext(1,44100*13,44100),g=buildGraph(c,mute?0:1);
  for(const k of BUSES)g.bus[k].gain.value=BUS[k];
  const voice=createSamuelVoice(g),buffer=await voice.ready;
  check(buffer&&Math.abs(buffer.duration-4.330667)<.1,'Owner recording must decode and fit inside the 7.5-second wave');
  if(mix){
   const state=audioState({s:11,world:true,wind:1.1,rain:1,crowd:1,wembley:1,rs:0,rl:0,rg:1,night:0});
   createBeds(g)(state);const crowd=createStadium(g);await crowd.ready;crowd.update(state.stadium);
  }
  voice.update({sequence:1,visible:true,elapsed:0},true);
  const next=c.suspend(7.5).then(()=>{voice.update({sequence:2,visible:true,elapsed:0},true);return c.resume();});
  const result=await c.startRendering();await next;
  const data=result.getChannelData(0),rms=(from,to)=>{let sum=0;for(let i=from*44100;i<to*44100;i++)sum+=data[i]**2;return Math.sqrt(sum/((to-from)*44100));};
  let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));
  return {duration:buffer.duration,peak,peakDb:20*Math.log10(peak),first:rms(0,4.4),gap:rms(4.5,7.4),second:rms(7.6,11.9)};
 };
 const solo=await render(),muted=await render(false,true),mix=await render(true);
 check(solo.first>.005&&solo.second>.005&&solo.gap===0,'Each wave must speak once with silence between recordings');
 check(muted.peak===0,'The existing master mute must silence Samuel');
 check(mix.peak<.891,'Greeting and rainy city mix must stay below -1 dBFS');
 return {pass:true,solo,muted,mix};
})()'''))
