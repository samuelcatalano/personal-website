print(js("""(async()=>{
 const THREE=await import('three'),{createRain}=await import('./js/world/rain.js');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1.6,1,1400);camera.position.set(10,20,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const mood={rain:1,fall:1.4,wind:1.1,storm:1};
 const rain=createRain(scene,{lamps:[[10,20]]});rain.update(5,camera,mood,1,'high',{x:0,y:0,z:0},0);
 const mesh=scene.getObjectByName('weather-rain');if(!mesh?.isMesh)throw Error('Layered ribbon rain missing');
 const high=mesh.geometry.drawRange.count;rain.update(5,camera,mood,1,'medium');const medium=mesh.geometry.drawRange.count;rain.update(5,camera,mood,1,'low');const low=mesh.geometry.drawRange.count;
 if(!(high>medium&&medium>low&&low>0))throw Error('Rain tier budget not reduced');
 const center=mesh.material.uniforms.uCenter.value;if(center.distanceTo(camera.position)>19)throw Error('Rain is not camera-following');
 if(mesh.material.uniforms.uLamps.value[0].x!==10)throw Error('Rain light positions do not match lamps');
 const beforeTravel=mesh.material.uniforms.uTravel.value.clone();rain.update(600,camera,{...mood,fall:.6,wind:.65},1,'high');const step=mesh.material.uniforms.uTravel.value.distanceTo(beforeTravel);if(step>.5)throw Error('Long visit or regional transition accelerates rain');
 const renderer=new THREE.WebGLRenderer();renderer.setSize(400,250);const target=new THREE.WebGLRenderTarget(400,250);renderer.setRenderTarget(target);renderer.render(scene,camera);if(renderer.info.render.calls!==1)throw Error('Rain must use one draw on every tier');const pixels=new Uint8Array(400*250*4);renderer.readRenderTargetPixels(target,0,0,400,250,pixels);if(!pixels.some((v,i)=>i%4!==3&&v>2))throw Error('Rain compiles but draws no visible pixels');target.dispose();renderer.setRenderTarget(null);if(renderer.info.programs.some(p=>p.diagnostics?.runnable===false))throw Error('Rain shader failed');
 const hdr=new THREE.WebGLRenderTarget(1080,675,{type:THREE.HalfFloatType,samples:4}),halfPixels=new Uint16Array(1080*675*4);renderer.setRenderTarget(hdr);for(const time of [601,601.03,601.07,601.12]){rain.update(time,camera,mood,0,'high');renderer.render(scene,camera);renderer.readRenderTargetPixels(hdr,0,0,1080,675,halfPixels);if(halfPixels.some(v=>(v&0x7c00)===0x7c00))throw Error('MSAA rain produces non-finite HDR pixels at '+time);}hdr.dispose();renderer.setRenderTarget(null);
 rain.update(5,camera,{...mood,rain:0});if(mesh.visible)throw Error('Dry weather still renders drops');rain.dispose();if(scene.getObjectByName('weather-rain'))throw Error('Rain resource leak');
 const still=createRain(scene,{reducedMotion:true});if(still.update(500,camera,mood,1,'high')!==0||scene.children.length)throw Error('Reduced-motion rain/lightning animated');
 renderer.dispose();return {rainShaders:true,tierBudgets:[high,medium,low],cameraFollowing:true,lampLighting:true,reducedMotion:true};
})()"""))
