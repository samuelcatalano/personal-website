import * as THREE from 'three';
import { LANDMARKS, stopIndex, RIVER_Z } from './layout.js';
import { PALETTE as P } from './palette.js';
import { GLASS_REFLECTION } from './glass-reflection.js';

// Finish only the existing visible landmark envelopes, retaining all shared batches.
export function polishLandmarkMaterials(world,stops,pts){
  const x=key=>pts[stopIndex(stops,LANDMARKS[key])].x;
  const bounds=[new THREE.Vector4(x('wembley')-21,x('wembley')+21,RIVER_Z-40,RIVER_Z-12),new THREE.Vector4(x('bigben')-4,x('bigben')+38,RIVER_Z-21,RIVER_Z-11),new THREE.Vector4(x('masp')-21,x('masp')+21,RIVER_Z-25,RIVER_Z-11)];
  const finishes=new Map([[P.cream,[.64,.04,0]],[P.arch,[.34,.4,0]],[P.sand,[.82,0,0]],[P.sandd,[.82,0,0]],[P.slate,[.55,.05,0]],[P.gilt,[.3,.55,0]],[P.masp,[.4,.28,0]],[P.concrete,[.74,0,0]],[P.glass,[.18,.05,1]]]);
  const materials=new Set();world.traverse(o=>{if(o.material)materials.add(o.material)});let count=0;
  for(const material of materials){
    const finish=finishes.get('#'+material.color?.getHexString());if(!finish||material.userData.landmarkFinish)continue;
    material.userData.uLandmarkNight={value:0};
    const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=shader=>{
      before(shader);shader.uniforms.uLandmarkNight=material.userData.uLandmarkNight;shader.uniforms.uLandmarkBounds={value:bounds};shader.uniforms.uLandmarkFinish={value:new THREE.Vector3(...finish)};
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uLandmarkNight;uniform vec4 uLandmarkBounds[3];uniform vec3 uLandmarkFinish;\n${GLASS_REFLECTION}\nfloat landmarkMask(vec3 p){float m=0.0;for(int i=0;i<3;i++){vec4 b=uLandmarkBounds[i];m=max(m,step(b.x,p.x)*step(p.x,b.y)*step(b.z,p.z)*step(p.z,b.w));}return m;}`)
        .replace('diffuseColor.rgb *= vLN.y', 't *= 1.0-landmarkMask(vWP)*0.65;\ndiffuseColor.rgb *= vLN.y')
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,uLandmarkFinish.x,landmarkMask(vWP));')
        .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,uLandmarkFinish.y,landmarkMask(vWP));')
        .replace('#include <opaque_fragment>',`float lm=landmarkMask(vWP);
          float finishSheen=0.04+0.08*pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
          outgoingLight+=vec3(0.10,0.12,0.13)*finishSheen*lm*(1.0-uLandmarkFinish.z)*(1.0-uLandmarkNight*.8);
          vec3 lr=inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix);
          outgoingLight=mix(outgoingLight,glassReflection(lr,uLandmarkNight),lm*uLandmarkFinish.z*0.45);
          #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>key()+'-landmark-finish-v1';material.userData.landmarkFinish=true;material.needsUpdate=true;count++;
  }
  const animated=[...materials].filter(m=>m.userData.uLandmarkNight);
  world.userData.updateLandmarkNight=night=>{for(const m of animated)m.userData.uLandmarkNight.value=night;};
  return count;
}
