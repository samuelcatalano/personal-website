import * as THREE from 'three';
import { LANDMARKS, stopIndex, RIVER_Z, copan, glasgowSites } from './layout.js';
import { PALETTE as P } from './palette.js';
import { GLASS_REFLECTION } from './glass-reflection.js';

// Finish only the existing visible landmark envelopes, retaining all shared batches.
export function polishLandmarkMaterials(world,stops,pts,env){
  const x=key=>pts[stopIndex(stops,LANDMARKS[key])].x;
  const g=pts[stopIndex(stops,LANDMARKS.glasgow)],sites=glasgowSites(stops,pts),cp=copan(stops,pts);
  const bounds=[
    new THREE.Vector4(x('wembley')-21,x('wembley')+21,RIVER_Z-40,RIVER_Z-12),
    new THREE.Vector4(x('bigben')-4,x('bigben')+38,RIVER_Z-21,RIVER_Z-11),
    new THREE.Vector4(x('masp')-21,x('masp')+21,RIVER_Z-25,RIVER_Z-11),
    new THREE.Vector4(cp.x-cp.len/2-cp.depth/2-.3,cp.x+cp.len/2+cp.depth/2+.3,cp.z-cp.amp-cp.depth/2-.3,cp.z+cp.amp+cp.depth/2+.3),
    new THREE.Vector4(x('se')-16,x('se')+16,RIVER_Z-25.5,RIVER_Z-7),
    new THREE.Vector4(g.x-16,g.x+16,g.z-44,g.z-35),
    new THREE.Vector4(sites.museum.x-16,sites.museum.x+16,sites.museum.z-8,sites.museum.z+8),
    new THREE.Vector4(sites.uni.x-37,sites.uni.x+37,sites.uni.z-8,sites.uni.z+8),
  ];
  const finishes=new Map([[P.cream,[.64,.04,0]],[P.arch,[.34,.4,0]],[P.sand,[.82,0,0]],[P.sandd,[.82,0,0]],[P.slate,[.55,.05,0]],[P.gilt,[.3,.55,0]],[P.masp,[.4,.28,0]],[P.concrete,[.74,0,0]],[P.glass,[.18,.05,1]]]);
  const materials=new Set();world.traverse(o=>{if(o.material)materials.add(o.material)});let count=0;
  for(const material of materials){
    const finish=finishes.get('#'+material.color?.getHexString());if(!finish||material.userData.landmarkFinish)continue;
    material.userData.uLandmarkNight={value:0};
    if(env&&!finish[2])env.register(material,{k:finish[1]>0.2?0.8:0.35});
    const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=shader=>{
      before(shader);shader.uniforms.uLandmarkNight=material.userData.uLandmarkNight;shader.uniforms.uLandmarkBounds={value:bounds};shader.uniforms.uLandmarkFinish={value:new THREE.Vector3(...finish)};
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uLandmarkNight;uniform vec4 uLandmarkBounds[8];uniform vec3 uLandmarkFinish;\n${GLASS_REFLECTION}\nfloat landmarkMask(vec3 p){float m=0.0;for(int i=0;i<8;i++){vec4 b=uLandmarkBounds[i];m=max(m,step(b.x,p.x)*step(p.x,b.y)*step(b.z,p.z)*step(p.z,b.w));}return m;}`)
        .replace('diffuseColor.rgb *= vLN.y', 't *= 1.0-landmarkMask(vWP)*0.65;\ndiffuseColor.rgb *= vLN.y')
        .replace('#include <lights_fragment_maps>','vec3 lmRad=radiance,lmIrr=iblIrradiance;\n#include <lights_fragment_maps>\nfloat lmEnv=landmarkMask(vWP);radiance=mix(lmRad,radiance,lmEnv);iblIrradiance=mix(lmIrr,iblIrradiance,lmEnv);')
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
// Night strips glow at glowColor * glowK * vertex brightness (sky.js). Cool strips use glowK 3.2, so pylon, deck and roof edges
// reach luminance ~2.6 and bloom past the 0.95 threshold in post.js (white strokes). Scale this landmark's own strip vertices
// instead of the shared strip material, so the city and the other landmarks keep their values.
export function capStripGlow(group,glowK=.9){
  group.traverse(o=>{
    if(!o.isMesh||!o.name.endsWith('-lightsCool'))return;
    const k=Math.min(1,glowK/o.material.userData.glowK),c=o.geometry.attributes.color;
    for(let i=0;i<c.array.length;i++)c.array[i]*=k;
    c.needsUpdate=true;
  });
  return group;
}
// London Eye: the rim and pods were emissive at 1.0-1.2x their pale colour and clipped to white at night. Night keeps the rim
// lit and gives the pods a dark glass body with a warm glow; in rain the rim is darkened to read against the overcast sky.
const EYE_WET=new THREE.Color('#5b6b7a'),EYE_GLASS=new THREE.Color('#6f8294');
export function finishLondonEye(wheel,{rain=0}={}){
  const rim=wheel.getObjectByName('eye-rim'),pods=wheel.getObjectByName('eye-pods');
  rim.material.userData.glowK=.45;
  rim.material.color.lerp(EYE_WET,Math.min(1,2*rain));
  const glass=new THREE.MeshStandardMaterial({color:EYE_GLASS,roughness:.25,metalness:.15});
  glass.userData.glow=true;glass.userData.glowColor=new THREE.Color(P.eyePod);glass.userData.glowK=.3; // ponytail: no separate emissive core mesh, extra pod instances breach the Eye triangle budget (tests/landmark-geometry.browser.py)
  pods.material.dispose();pods.material=glass;
  return wheel;
}
