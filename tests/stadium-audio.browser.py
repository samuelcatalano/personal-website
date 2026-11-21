# Desktop, same-origin page. Real MP3 decoding and OfflineAudioContext rendering.
print(js(r'''(async()=>{
 const {buildGraph,BUSES}=await import('/js/audio/engine.js');
 const {audioState,BUS}=await import('/js/audio/state.js');
 const {createBeds}=await import('/js/audio/voices/beds.js');
 const {createStadium}=await import('/js/audio/voices/stadium.js');
 const check=(v,m)=>{if(!v)throw Error(m)};
 const render=async(level,mute=false,city=false)=>{
  const c=new OfflineAudioContext(1,44100*5,44100),g=buildGraph(c,mute?0:1);
  for(const k of BUSES)g.bus[k].gain.value=BUS[k];
  const stadium=createStadium(g),source=await stadium.ready;
  check(source?.loop&&Math.abs(source.buffer.duration-30)<.1,'Local crowd asset must decode as a reusable 30-second loop');
  stadium.update(level);
  if(city){const s=audioState({s:8,world:true,wind:1.1,rain:1,crowd:1,wembley:1,rs:0,rl:1,night:0});createBeds(g)(s);}
  const buffer=await c.startRendering(),data=buffer.getChannelData(0);let peak=0,sum=0;
  for(let i=44100;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));sum+=data[i]**2;}
  return {peak,rms:Math.sqrt(sum/(data.length-44100))};
 };
 const solo=await render(.24),away=await render(0),muted=await render(.24,true),mix=await render(.24,false,true);
 check(solo.rms>.003&&solo.peak<.891,'Crowd must be audible without clipping');
 check(away.peak===0&&muted.peak===0,'Distance and master mute must silence the sample');
 check(mix.peak<.891,'The rainy London mix must remain below -1 dBFS');
 const fetchBefore=globalThis.fetch;
 try{
  for(const kind of ['http','decode']){
   globalThis.fetch=async()=>new Response(kind==='http'?'Not found':new Uint8Array([0,1,2]),{status:kind==='http'?404:200});
   const c=new OfflineAudioContext(1,128,44100),voice=createStadium(buildGraph(c));
   check(await voice.ready===null,kind+' failure must resolve silently');voice.update(.24);
  }
 }finally{globalThis.fetch=fetchBefore;}
 return {pass:true,solo,away,muted,mix};
})()'''))
