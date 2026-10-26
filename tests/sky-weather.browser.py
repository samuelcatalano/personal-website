# Run against local preview using browser-harness. Tests real shader compilation and sky state.
print(js("""(async()=>{
 const THREE=await import('three'),{createSky}=await import('./js/world/sky.js'),{createMood}=await import('./js/world/mood.js'),{stops}=await import('./js/content.js');
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,1,1000);
 const hemi=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight(),cam=new THREE.PerspectiveCamera(40,1.6,1,1400);
 cam.position.set(10,20,30);cam.lookAt(0,0,0);cam.updateMatrixWorld();scene.add(hemi,sun);
 const sky=createSky(scene,{hemi,sun,reducedMotion:true});
 const mood=createMood(stops)(.3);const rainy={...mood,rain:1,cover:1,storm:1};
 sky.update(0,0,cam.position,cam,rainy);
 const dome=scene.children.find(o=>o.material?.uniforms?.uZen);
 if(!dome.material.uniforms.uHor.value.equals(scene.fog.color))throw Error('Sky/fog seam colour mismatch');
 const sunDisc=scene.getObjectByName('weather-sun'),moon=scene.getObjectByName('weather-moon');
 if(!sunDisc||!moon)throw Error('Missing celestial state');
 for(const night of [0,.5,1]){sky.update(night,0,cam.position,cam,rainy);if(sunDisc.visible||moon.visible)throw Error('Rain exposes sun/moon');}
 const stars=scene.getObjectByName('weather-stars');if(stars.visible)throw Error('Stars visible under overcast');
 const renderer=new THREE.WebGLRenderer();renderer.setSize(400,250);renderer.render(scene,cam);
 if(renderer.info.programs.some(p=>p.diagnostics?.runnable===false))throw Error('Sky shader failed');
 const cloudy={...mood,cover:.9,rain:0};sky.update(1,0,cam.position,cam,cloudy);if(moon.material.opacity>.1)throw Error('Moon not veiled by cover');
 const clouds=scene.getObjectByName('weather-clouds');const positions=clouds.children.map(c=>c.position.toArray().join());
 sky.update(1,10,cam.position,cam,cloudy);if(positions.some((p,i)=>p!==clouds.children[i].position.toArray().join()))throw Error('Reduced motion cloud drift');
 const t=stars.material.uniforms.uTime.value;sky.update(1,10,cam.position,cam,{...mood,cover:0,rain:0});if(stars.material.uniforms.uTime.value!==t)throw Error('Reduced motion twinkle');
 renderer.render(scene,cam);if(renderer.info.programs.some(p=>p.diagnostics?.runnable===false))throw Error('Clear sky/star shader failed');
 scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.dispose();
 return {celestialOcclusion:true,fogSeam:true,staticClouds:true,staticStars:true,shaders:true};
})()"""))
