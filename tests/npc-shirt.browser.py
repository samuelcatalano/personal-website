# Desktop, same-origin NPC fixture: probe the actual material shader with known atlas colours.
print(js(r'''(async()=>{
 const T=await import('three'),{loadReferenceNpcAssets}=await import('/js/world/reference-npc.js');
 const library=await loadReferenceNpcAssets(),actor=library.create(),body=actor.root.getObjectByName('Body');
 const renderer=new T.WebGLRenderer({antialias:false});renderer.setSize(64,16);renderer.outputColorSpace=T.LinearSRGBColorSpace;
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,.25,-.25,.1,10);camera.position.z=2;
 scene.add(new T.AmbientLight(0xffffff,Math.PI));
 const map=new T.DataTexture(new Uint8Array([28,28,30,255,55,55,58,255,255,255,255,255,180,145,125,255]),4,1);
 Object.assign(map,{colorSpace:T.SRGBColorSpace,minFilter:T.NearestFilter,magFilter:T.NearestFilter,needsUpdate:true});
 const material=new T.MeshStandardMaterial({map,roughness:1});material.onBeforeCompile=body.material[0].onBeforeCompile;
 const plane=new T.Mesh(new T.PlaneGeometry(2,.5),material);scene.add(plane);
 const target=new T.WebGLRenderTarget(64,16,{type:T.FloatType}),data=new Float32Array(64*16*4);
 let restY=0;
 const sample=(y,correct)=>{
  plane.geometry.translate(0,y-restY,0);restY=y;camera.position.y=y;camera.lookAt(0,y,0);
  material.onBeforeCompile=correct?body.material[0].onBeforeCompile:()=>{};material.customProgramCacheKey=()=>String(correct);material.needsUpdate=true;
  renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,16,data);
  return [8,24,40,56].map(x=>Array.from(data.slice((8*64+x)*4,(8*64+x)*4+3)));
 };
 try{
  const shirt=sample(1.2,true),raw=sample(1.2,false),legs=sample(.5,true),collar=sample(1.45,true);
  const gap=Math.abs(shirt[1][0]-shirt[0][0]);
  if(!(raw[2][0]>.8&&raw[0][0]>.001))throw Error('Probe must render the white print and dark cloth');
  if(!(gap<.012))throw Error('Dark atlas islands must share one cloth tone: '+JSON.stringify({gap,shirt,raw}));
  for(const index of [2,3])if(shirt[index].some((v,k)=>Math.abs(v-raw[index][k])>.001))throw Error('White print and skin must keep their colour');
  if(!(Math.abs(legs[1][0]-legs[0][0])>gap*2))throw Error('Correction must be confined to the shirt');
  if(!(Math.abs(collar[1][0]-collar[0][0])<.012))throw Error('Collar cloth must not retain an atlas band');
  return {pass:true,shirtIslandGap:gap,shirt,raw};
 }finally{actor.dispose();library.dispose();renderer.dispose();target.dispose();plane.geometry.dispose();material.dispose();map.dispose();}
})()'''))
