print(js("""(async()=>{
 const THREE=await import('three'),{createWater}=await import('./js/world/water.js');
 const rainy={hor:[.53,.58,.62],rain:1,cover:1};const water=createWater({x0:0,x1:20,z:0,width:10});
 const exactSky={zen:new THREE.Color(.1,.2,.3),hor:new THREE.Color(.3,.2,.1)};water.update(3,0,rainy,'high',exactSky);const u=water.mesh.material.uniforms;
 if(!u.uSky.value.equals(exactSky.hor)||!u.uZen.value.equals(exactSky.zen))throw Error('River and dome palette mismatch');
 if(u.uRainMotion.value!==1||u.uKey.value!==0)throw Error('Rain must ripple water and hide sun sparkle');
 water.update(4,1,rainy,'medium');if(u.uRainMotion.value!==0)throw Error('Medium water rain animation not disabled');
 const still=createWater({x0:0,x1:20,z:0,width:10,reducedMotion:true});still.update(8,1,rainy,'high');if(still.mesh.material.uniforms.uRainMotion.value!==0)throw Error('Reduced-motion water ripples');
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,20,200);scene.add(water.mesh);
 const camera=new THREE.PerspectiveCamera(40,1,1,500);camera.position.set(10,15,15);camera.lookAt(10,0,0);
 const renderer=new THREE.WebGLRenderer();renderer.setSize(128,128);const target=new THREE.WebGLRenderTarget(128,128,{type:THREE.FloatType});renderer.setRenderTarget(target);const pixels=new Float32Array(128*128*4);for(const time of [0,.3,1,2,3,4]){water.update(time,0,rainy,'high');renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,128,128,pixels);if(!pixels.every(Number.isFinite))throw Error('Rain water produces non-finite HDR pixels at '+time);}target.dispose();renderer.setRenderTarget(null);
 if(renderer.info.programs.some(p=>p.diagnostics?.runnable===false))throw Error('Rain water shader failed');
 water.update(4,0,{...rainy,rain:0,cover:0},'high');if(u.uKey.value!==1||u.uRainMotion.value!==0)throw Error('Clear water state not restored');
 water.mesh.geometry.dispose();water.mesh.material.dispose();still.mesh.geometry.dispose();still.mesh.material.dispose();renderer.dispose();return {riverRings:true,stormReflection:true,reducedMotion:true,tierBudget:true,shader:true};
})()"""))
