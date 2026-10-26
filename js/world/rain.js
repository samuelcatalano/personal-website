import * as THREE from 'three';
import { createLightning } from './weather.js';
// Three interleaved depth layers in one draw. Ribbons provide stable subpixel width on every GPU.
export function createRain(scene, { reducedMotion = false, lamps = [] } = {}) {
  const lightning = createLightning({ reducedMotion });
  if (reducedMotion) return { update() { return 0; } };
  const count = 1080, base = [], corners = [], seeds = [];
  const hash = i => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  for (let i = 0; i < count; i++) for (const [side, end] of [[-1,0],[-1,1],[1,0],[1,0],[-1,1],[1,1]]) {
    base.push(hash(i*3)*200,hash(i*3+1)*70,hash(i*3+2)*200);
    corners.push(side,end); seeds.push(hash(i+5000),i%3);
  }
  const geometry = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(base,3))
    .setAttribute('aCorner', new THREE.Float32BufferAttribute(corners,2))
    .setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds,2));
  const uniforms = {
    uTime:{value:0},uTravel:{value:new THREE.Vector3()},uCenter:{value:new THREE.Vector3()},uForward:{value:new THREE.Vector3()},uRain:{value:0},
    uFall:{value:1},uWind:{value:1},uNight:{value:0},uBus:{value:new THREE.Vector3()},uHeading:{value:new THREE.Vector2(1,0)},
    uLamps:{value:Array.from({length:4},()=>new THREE.Vector3(0,-1000,0))},uResolution:{value:900},
  };
  const material = new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide,
    uniforms,
    vertexShader: `attribute vec2 aCorner,aSeed;uniform float uTime,uFall,uWind,uResolution;uniform vec3 uTravel,uCenter,uForward;varying vec3 vWorld;varying vec2 vCorner;varying float vSeed,vDepth;
      void main(){
        float layer=aSeed.y;vec3 box=vec3(36.0+layer*34.0,42.0+layer*8.0,36.0+layer*34.0);
        vec3 center=uCenter+uForward*layer*16.0;
        float baseSpeed=17.0+layer*2.0+aSeed.x*10.0,speed=baseSpeed*uFall;
        vec3 velocity=vec3((2.0+sin(uTime*.31)*1.5)*uWind,-speed,sin(uTime*.17)*uWind);
        vec3 drift=vec3(uTravel.x,-baseSpeed*uTravel.y,uTravel.z);
        vec3 p=mod(position+drift-center+box*.5,box)-box*.5+center;
        p-=normalize(velocity)*(.55+aSeed.x*.8)*(1.7-layer*.45)*uFall*aCorner.y;
        vWorld=p;vCorner=aCorner;vSeed=aSeed.x;
        vec4 mv=viewMatrix*vec4(p,1.0);vDepth=-mv.z;
        float width=(.009+aSeed.x*.006)*(1.5-layer*.35);
        mv.x+=aCorner.x*max(width,-mv.z/uResolution*.35);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform float uRain,uNight;uniform vec3 uCenter,uLamps[4],uBus;uniform vec2 uHeading;
      varying vec3 vWorld;varying vec2 vCorner;varying float vSeed,vDepth;
      void main(){
        float lamp=0.0;for(int i=0;i<4;i++){vec3 d=vWorld-uLamps[i];lamp+=exp(-dot(d.xz,d.xz)*.065)*exp(-abs(d.y)*.35);}
        vec2 toDrop=vWorld.xz-uBus.xz;float beam=pow(max(dot(normalize(toDrop+vec2(.001)),uHeading),0.0),16.0)*exp(-length(toDrop)*.10);
        float light=uNight*(lamp*.7+beam*.7);
        float a=(.20+vSeed*.22+light*.30)*uRain;
        a*=pow(1.0-vCorner.y,1.2)*(1.0-smoothstep(.4,1.0,abs(vCorner.x)));
        a*=smoothstep(.1,1.8,vWorld.y)*(1.0-smoothstep(70.0,135.0,vDepth));
        // ponytail: background brightness is approximated by drop elevation, upgrade only with an already available depth/colour buffer.
        a*=mix(1.0,.25,smoothstep(uCenter.y+4.0,uCenter.y+20.0,vWorld.y));
        gl_FragColor=vec4(mix(vec3(.34,.46,.58),vec3(.95,.79,.52),clamp(light,0.0,1.0)),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const rain = new THREE.Mesh(geometry,material);rain.name='weather-rain';rain.frustumCulled=false;rain.renderOrder=998;rain.visible=false;
  scene.add(rain);
  const direction=new THREE.Vector3(),nearest=Array(4).fill(Infinity);
  let lastTime;
  return {
    update(time,camera,mood,night=0,tier='high',bus={x:0,y:0,z:0},heading=0) {
      const amount=mood.rain;
      const dt=lastTime===undefined?0:Math.max(0,Math.min(.1,time-lastTime));lastTime=time;
      const flash=lightning(time,amount,mood.storm??0);
      rain.visible=amount>.01;
      if(!rain.visible)return flash;
      geometry.setDrawRange(0,(tier==='high'?1080:tier==='medium'?450:210)*6);
      camera.getWorldDirection(direction);
      uniforms.uCenter.value.copy(camera.position).addScaledVector(direction,18);
      uniforms.uForward.value.copy(direction);uniforms.uTime.value=time;uniforms.uRain.value=amount;
      uniforms.uFall.value=mood.fall??1;uniforms.uWind.value=mood.wind??1;uniforms.uNight.value=night;
      uniforms.uTravel.value.x+=(2+Math.sin(time*.31)*1.5)*uniforms.uWind.value*dt;
      uniforms.uTravel.value.y+=uniforms.uFall.value*dt;
      uniforms.uTravel.value.z+=Math.sin(time*.17)*uniforms.uWind.value*dt;
      uniforms.uResolution.value=innerHeight;uniforms.uBus.value.copy(bus);uniforms.uHeading.value.set(Math.cos(heading),-Math.sin(heading));
      nearest.fill(Infinity);for(const p of uniforms.uLamps.value)p.set(0,-1000,0);
      for(const [x,z] of lamps){
        const d=(x-camera.position.x)**2+(z-camera.position.z)**2;
        for(let i=0;i<4;i++)if(d<nearest[i]){for(let j=3;j>i;j--){nearest[j]=nearest[j-1];uniforms.uLamps.value[j].copy(uniforms.uLamps.value[j-1]);}nearest[i]=d;uniforms.uLamps.value[i].set(x,3.5,z);break;}
      }
      return flash;
    },
    dispose(){scene.remove(rain);geometry.dispose();material.dispose();},
  };
}
