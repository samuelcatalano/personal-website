# Real facade shader: grain direction must stay fixed in world space as the camera orbits.
result = js(r'''(async()=>{
 const T=await import('three'),{townhouseMaterials,preservedSurfaceMaterials}=await import('./js/world/building-slice-materials.js');
 const renderer=new T.WebGLRenderer({antialias:false}),target=new T.WebGLRenderTarget(65,65,{type:T.FloatType});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-.01,.01,.01,-.01,.1,20),pixel=new Float32Array(4);
 const geometry=new T.PlaneGeometry(4,4),count=geometry.attributes.position.count;
 geometry.setAttribute('aSurface',new T.Float32BufferAttribute(Array(count).fill(0),1));
 geometry.setAttribute('color',new T.Float32BufferAttribute(Array(count*3).fill(1),3));
 renderer.setSize(65,65);renderer.setRenderTarget(target);
 const sources=[townhouseMaterials().architecture,preservedSurfaceMaterials().architecture,townhouseMaterials({landmark:true}).architecture];
 const normals=[[0,0,1],[1,0,0],[0,1,0],[0,-1,0],[.00001,1,.00001],[.6,.8,0]],angles=[0,-60,60,85];
 let maxDrift=0,minGrain=Infinity;
 try {
  for(const source of sources){
   // Remove atlas normals to isolate the actual procedural grain, retaining its production compile hook.
   const material=source.clone();material.map=material.normalMap=material.roughnessMap=material.metalnessMap=null;
   material.onBeforeCompile=shader=>{source.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    'outgoingLight=inverseTransformDirection(normal,viewMatrix)*0.5+0.5;\n#include <opaque_fragment>');};
   const mesh=new T.Mesh(geometry,material);mesh.position.set(.213,1.147,.319);scene.add(mesh);
   for(const values of normals){
    const n=new T.Vector3(...values).normalize(),tangent=new T.Vector3().crossVectors(Math.abs(n.y)<.99?new T.Vector3(0,1,0):new T.Vector3(0,0,1),n).normalize();
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);
    const samples=angles.map(angle=>{
     const a=angle*Math.PI/180;camera.position.copy(mesh.position).addScaledVector(n,4*Math.cos(a)).addScaledVector(tangent,4*Math.sin(a));
     camera.up.copy(new T.Vector3().crossVectors(n,tangent));camera.lookAt(mesh.position);renderer.render(scene,camera);
     renderer.readRenderTargetPixels(target,32,32,1,1,pixel);
     if(pixel[3]<.99||!Array.from(pixel).every(Number.isFinite))throw Error('Facade grain produced invalid/empty pixels');
     return new T.Vector3(pixel[0]*2-1,pixel[1]*2-1,pixel[2]*2-1);
    });
    for(const sample of samples){
     maxDrift=Math.max(maxDrift,sample.distanceTo(samples[0]));
     if(Math.abs(sample.length()-1)>.001)throw Error('Facade grain normal is not finite and unit length');
    }
    minGrain=Math.min(minGrain,samples[0].distanceTo(n));
   }
   scene.remove(mesh);material.dispose();
  }
  if(maxDrift>.002)throw Error('Facade grain rotates with camera: world-normal drift '+maxDrift);
  if(minGrain<.0001)throw Error('Facade grain vanished on a tested surface: '+minGrain);
  if(renderer.info.programs.some(p=>p.diagnostics?.runnable===false)||renderer.getContext().getError()!==0)throw Error('Facade grain shader failed');
  return {pass:true,materials:sources.length,surfaces:normals.length,views:angles.length,maxDrift,minGrain};
 } finally {geometry.dispose();target.dispose();renderer.dispose();}
})()''')
assert result and result.get('pass'), result
print(result)
