import * as THREE from 'three';
import { moonIllumination, celestialFrame, celestialVisibility, cloudNoise } from './weather-math.js';
export const EXPOSURE = 1.05; // renderer.toneMappingExposure, needed to undo ACES for the sky
// Every sky colour is authored as the colour we want ON SCREEN. The composer tone-maps the whole frame in OutputPass
// (toneMapped:false is ignored inside a render target), so we pre-invert ACES here or the sky washes out to white.
const IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777);
const OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
const INi = IN.clone().invert(), OUTi = OUT.clone().invert(), tmp = new THREE.Vector3();
export function untone(c) {
  tmp.set(c.r, c.g, c.b).clampScalar(0.001, 0.98).applyMatrix3(OUTi);
  const y = tmp.toArray().map((t) => {
    t = Math.min(0.98, Math.max(0.001, t));
    const a = 0.983729 * t - 1, b = 0.432951 * t - 0.0245786, k = 0.238081 * t + 0.000090537;
    return (-b - Math.sqrt(Math.max(b * b - 4 * a * k, 0))) / (2 * a);
  });
  tmp.fromArray(y).applyMatrix3(INi).multiplyScalar(0.6 / EXPOSURE);
  return c.setRGB(Math.max(0, tmp.x), Math.max(0, tmp.y), Math.max(0, tmp.z));
}
const C = (h) => new THREE.Color(h);
export const DAY = { zen: C(0x6fb1e8), hor: C(0xb9dcf5), cloud: C(0xf4f9ff), sun: 2.35, hemi: 1.3, light: C(0xfff0d0) }; // day fill: hemi lifted so cast shadows read lighter; sun unchanged to keep the golden sky
export const NIGHT = { zen: C(0x0b1530), hor: C(0x26386a), cloud: C(0x3b4668), sun: 0.40, hemi: 0.74, light: C(0xaec4ff) };
export const SUN_DIR = new THREE.Vector3(110, 45, 40).normalize(); // startup fallback; runtime key shares the framed astro's azimuth
const DIST = 1300; // just inside camera.far (1400), beyond every building
// Dome colour for a view direction and NDC y. Shared with the distant skyline so its silhouettes can dissolve into the exact sky behind them.
export const SKY_GLSL = `uniform vec3 uZen,uMid,uHor,uGlow,uSunDir; uniform float uClear,uCover;
vec3 skyDome(vec3 d,float ndcY){
  float h=smoothstep(.05,.98,ndcY);
  vec3 c=mix(uHor,uZen,h);
  c=mix(c,uMid,4.0*h*(1.0-h)*.28);
  float sd=max(dot(d,uSunDir),0.0);
  float lobe=pow(sd,12.0)*0.25+pow(sd,96.0)*0.48;
  c=mix(c,uGlow,lobe*uClear*h);
  return mix(c,mix(uMid,uGlow,uClear),pow(sd,5.0)*uCover*.09*h);
}`;
// Scene fog as aerial perspective instead of a linear veil: soft onset, capped so far buildings keep some colour,
// thinner with altitude, and a slightly bluer near haze that converges on the horizon colour far away.
// Cost: one extra varying and ~10 ALU per fogged fragment; no extra pass.
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth;\n varying float vFogHeight;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z;\n vFogHeight = ((mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix)).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor;\n varying float vFogDepth;\n varying float vFogHeight;\n #ifdef FOG_EXP2\n  uniform float fogDensity;\n #else\n  uniform float fogNear;\n  uniform float fogFar;\n #endif\n#endif';
const FOG_MAX = 0.72;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float fogT = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
 #else
  float fogT = clamp( ( vFogDepth - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 );
 #endif
 float fogFactor = ${FOG_MAX} * fogT * fogT * ( 3.0 - 2.0 * fogT ) * mix( 0.55, 1.0, exp( - max( vFogHeight, 0.0 ) / 60.0 ) );
 gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor * mix( vec3( 0.9, 0.96, 1.07 ), vec3( 1.0 ), fogT ), fogFactor );
#endif`;
function disc(draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sprite = (map, size) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: true, depthWrite: false, fog: false, toneMapped: false }));
  m.renderOrder = -8.5; // cloud alpha composites over astros, while opaque city geometry still depth-occludes them
  return m;
};
const LON = { zen: [0.435, 0.694, 0.91], hor: [0.725, 0.863, 0.961], cloud: [0.957, 0.976, 1], light: [1, 0.941, 0.816], sun: 1, hemi: 1, fogK: 1, cloudOp: 0, rs: 0, rl: 1, rg: 0 }; // default mood (== DAY)
export function createSky(scene, { hemi, sun, reducedMotion = false }) {
  let frame = celestialFrame(1280, 800);
  const lightDir = SUN_DIR.clone();
  const d1 = new THREE.Color(), day = (a, c = d1) => c.setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace); // mood sRGB triplet -> working colour
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uZen: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSunDir: { value: SUN_DIR.clone() }, uClear: { value: 1 }, uNight: { value: 0 }, uCover: { value: 0 } },
      vertexShader: 'varying vec3 vDir; varying vec4 vClip; void main(){ vDir = position; vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position=vClip; }',
      fragmentShader: `${SKY_GLSL} uniform float uNight; varying vec3 vDir; varying vec4 vClip;
        void main(){ gl_FragColor=vec4(skyDome(normalize(vDir),vClip.y/vClip.w),1.0); }`,
    }),
  );
  dome.renderOrder = -10; dome.frustumCulled = false;
  const u = dome.material.uniforms;
  const sunsetZen = C(0x67558b), sunsetHor = C(0xe6a68e), warmGlow = C(0xfdeec2), coolGlow = C(0x7c9ddc), cityHaze = C(0x584247);
  const authoredZen = new THREE.Color(), authoredHor = new THREE.Color(), authoredMid = new THREE.Color();
  const sunM = sprite(disc((g) => {
    const r=g.createRadialGradient(128,128,0,128,128,128);
    r.addColorStop(0,'#fff');r.addColorStop(.2,'#fff');r.addColorStop(.3,'rgba(255,255,255,.6)');r.addColorStop(.5,'rgba(255,255,255,.14)');r.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r;g.fillRect(0,0,256,256);
  }),100);
  sunM.name='weather-sun';
  const halo=sprite(disc(g=>{
    const r=g.createRadialGradient(128,128,0,128,128,128);
    r.addColorStop(0,'rgba(255,255,255,.25)');r.addColorStop(.14,'rgba(255,255,255,.13)');r.addColorStop(.4,'rgba(255,255,255,.035)');r.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r;g.fillRect(0,0,256,256);
  }),380);halo.material.blending=THREE.AdditiveBlending;halo.renderOrder=-8.6;
  // Always full, with broad maria and gentle limb shading; no astronomical API or repeating crater dots.
  const moonM=sprite(disc(g=>{
    const im=g.createImageData(256,256),maria=[[-.2,.16,.46,.3],[.1,.32,.3,.2],[.32,-.06,.3,.4],[-.12,-.42,.36,.14]];
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const px=(x-128)/100,py=(y-128)/100,r=Math.hypot(px,py),k=(y*256+x)*4;
      let shade=0;for(const [mx,my,rx,ry] of maria)shade+=Math.exp(-((px-mx)**2/rx**2+(py-my)**2/ry**2)*2)*.26;
      const grain=(Math.sin(px*27+Math.sin(py*19))*Math.sin(py*31+px*9))*.016;
      const v=Math.max(0,(1-shade+grain)*moonIllumination(px,py));
      im.data[k]=im.data[k+1]=im.data[k+2]=Math.round(v*255);im.data[k+3]=Math.round(Math.min(1,Math.max(0,(1-r)*40))*255);
    }g.putImageData(im,0,0);
  }),64);
  moonM.name='weather-moon';
  const sunDay=C(0xfff0d1),sunSet=C(0xf69350),moonTint=C(0xe1eaff);
  moonM.material.color.copy(untone(moonTint.clone()));
  scene.add(dome,sunM,moonM,halo);
  // Volumetric clouds: one BackSide shell around the camera, raymarched per sky pixel. Opaque city geometry is drawn first, so early-z rejects
  // every pixel behind a building; the distant skyline (-5) then blends over the finished cloud colour, so clouds continue behind the silhouettes.
  // The follow camera looks down, so the march does not use the real view ray (it barely rises above the horizon): it uses a virtual sky ray
  // built from the pixel's NDC (same composition rule as the dome gradient and the NDC-pinned sun/moon). Azimuth follows the camera yaw.
  // Cost per covered sky pixel: 32 primary steps x (1 coverage + 1 shape + 1 detail 3D fetch), plus 5 shape fetches toward the light on
  // occupied steps only; early exit when transmittance < 0.02. No extra pass and no extra render target.
  const noise = new THREE.Data3DTexture(cloudNoise(64), 64, 64, 64);
  Object.assign(noise, { format: THREE.RGFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, wrapR: THREE.RepeatWrapping, unpackAlignment: 1, needsUpdate: true });
  const cloudMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, // premultiplied
    uniforms: { ...u, uNoise: { value: noise }, uTop: { value: new THREE.Color() }, uBase: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uCity: { value: new THREE.Color() },
      uCoverage: { value: .4 }, uDeck: { value: 0 }, uRain: { value: 0 }, uFlash: { value: 0 }, uLightK: { value: 1 }, uNightK: { value: 0 },
      uWind: { value: new THREE.Vector3() }, uEye: { value: new THREE.Vector2() }, uYaw: { value: 0 }, uAspect: { value: 1.6 }, uFrame: { value: new THREE.Vector2(.58, .7) } },
    vertexShader: 'varying vec4 vClip; void main(){ vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vClip; }',
    fragmentShader: `${SKY_GLSL}
      uniform highp sampler3D uNoise; uniform vec3 uTop,uBase,uRim,uCity,uWind; uniform vec2 uEye,uFrame;
      uniform float uCoverage,uDeck,uRain,uFlash,uLightK,uNightK,uYaw,uAspect; varying vec4 vClip;
      // virtual sky ray for an NDC point: elevation ~0.7 deg near the horizon band up to ~25 deg at the top edge, azimuth from NDC x and the camera yaw
      vec3 skyRay(vec2 ndc){
        float t=clamp((ndc.y+.2)/1.2,0.0,1.0), el=.012+.42*t*t, hx=ndc.x*uAspect*.364;
        vec3 r=normalize(vec3(-hx,tan(el)*sqrt(1.0+hx*hx),1.0));
        float s=sin(uYaw),c=cos(uYaw); return vec3(c*r.x+s*r.z,r.y,-s*r.x+c*r.z);
      }
      float BASE, TOP;
      float coverAt(vec3 p){ return clamp(uCoverage+(texture(uNoise,vec3(p.xz/16000.0,.37)+uWind.xzy*.25).r-.5)*.7,0.0,1.0); }
      // flat condensation level (sharp 0..6% of the slab), rounded tops (shape threshold rises with height), Worley erosion on the edges
      float shapeAt(vec3 p,float cov,out float h){
        h=(p.y-BASE)/(TOP-BASE); if(h<0.0||h>1.0) return 0.0;
        float base=texture(uNoise,p/6000.0+uWind).r;
        float prof=smoothstep(0.0,.06,h)*(1.0-smoothstep(mix(.35,.75,uDeck),1.0,h));
        return clamp((base*prof-(1.0-cov))/max(cov,.05),0.0,1.0);
      }
      float hg(float c,float g){ float g2=g*g; return (1.0-g2)/pow(1.0+g2-2.0*g*c,1.5)*.0796; }
      void main(){
        vec2 ndc=vClip.xy/vClip.w;
        vec3 rd=skyRay(ndc), ld=skyRay(uFrame);
        BASE=mix(1500.0,700.0,uDeck); TOP=BASE+mix(1900.0,1500.0,uDeck);
        float t0=BASE/rd.y, t1=min(TOP/rd.y,t0+9000.0), dt=(t1-t0)/32.0;
        float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))); // static IGN start jitter: no TAA here, so no temporal noise
        vec3 eye=vec3(uEye.x,0.0,uEye.y), col=vec3(0.0); float T=1.0;
        float mu=dot(rd,ld), phase=mix(hg(mu,.45),hg(mu,-.2),.6)*12.57; // dual-lobe HG, ~1 on average: silver lining toward the light
        float ext=mix(.0065,.0085,uDeck)*(1.0+.35*uRain);
        for(int i=0;i<32;i++){
          vec3 p=eye+rd*(t0+(float(i)+ign)*dt);
          float cov=coverAt(p), h, d=shapeAt(p,cov,h);
          if(d<=0.0) continue;
          float det=texture(uNoise,p/800.0+uWind*3.0).g;
          float er=(1.0-det)*mix(.5,.3,h)*(1.0-d); d=clamp((d-er)/(1.0-er+1e-3)*1.8,0.0,1.0); // erode thin edges, keep cores
          if(d<=.002) continue;
          float od=0.0, hl;
          for(int k=1;k<=5;k++){ float s=float(k*k)*45.0; od+=shapeAt(p+ld*s,cov,hl)*float(2*k-1)*45.0; } // quadratic spacing reaches ~1.1 km
          float sunT=exp(-od*ext*1.5), powder=1.0-exp(-d*6.0);
          vec3 amb=mix(uBase*mix(.62,.9,uDeck),mix(uBase,uTop,.7),pow(h,.6)); // dark flat base, sky-lit top
          amb*=mix(1.0,.5+.5*sunT,.25+.75*uDeck); // self-shadowed ambient: thick parts of a grey deck read darker, so overcast keeps its mottling
          vec3 L=amb+mix(uTop,uRim,.35)*sunT*phase*mix(.55,1.0,powder)*uLightK*.85;
          L+=uCity*uNightK*(1.0-h)*(1.0-h)*.35; // warm city light from below on the undersides at night
          L+=uTop*uFlash*(1.0-h)*.6;
          L=min(L,uTop*1.06);
          float a=1.0-exp(-d*ext*dt);
          col+=T*L*a; T*=1.0-a;
          if(T<.02) break;
        }
        float alpha=(1.0-T)*(1.0-smoothstep(13000.0,30000.0,t0)); // below ~3 deg the march undersamples: hand the horizon to the dome haze
        col*=alpha/max(1.0-T,1e-4);
        // aerial perspective: far clouds near the horizon fade into the exact dome colour behind them, never a hard band
        float far=1.0-exp(-t0/26000.0);
        vec3 sky=skyDome(rd,ndc.y);
        col=mix(col,mix(uMid,uHor,.6)*alpha,uDeck*.2); // overcast: grey towards the horizon colour
        col=mix(col,sky*alpha,far*.85);
        gl_FragColor=vec4(col,alpha);
      }`,
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1250, 32, 16), cloudMat);
  clouds.name = 'weather-clouds'; clouds.renderOrder = -7; clouds.frustumCulled = false;
  scene.add(clouds);
  const camFwd = new THREE.Vector3();
  const LAYOUT=[.8,.85,1.2]; // cloud density per region sp/lon/gla (SP: fair-weather cumulus field, Glasgow packed)
  const smoothCover=c=>THREE.MathUtils.smoothstep(c,.65,1);
  const cloudBase=C(0x7e99b5),nightBase=C(0x1b2941),cloudRim=C(0xfed29a),cityGlow=C(0x9a6a4a);
  // sky band: the follow camera looks down, so the sun/moon/clouds are pinned to NDC points of the upper frame
  const at = (cam, x, y, d, out) => out.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(d).add(cam.position);
  const glow = [];
  scene.traverse((o) => { if (o.material?.userData?.glow) glow.push(o.material); });
  const pos=[],sizes=[],phases=[],tints=[];
  const hash=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  for(let i=0;i<420;i++){
    pos.push(hash(i*4)*2-1,.36+hash(i*4+1)*.64,0);
    sizes.push(1.1+hash(i*4+2)**5*2.2);phases.push(hash(i*4+3)*Math.PI*2);
    const tint=untone(C(i%13===0?0xdcb9a0:i%7===0?0xb4d0f4:0xd1d8e7));tints.push(tint.r,tint.g,tint.b);
  }
  const stars=new THREE.Points(new THREE.BufferGeometry()
    .setAttribute('position',new THREE.Float32BufferAttribute(pos,3))
    .setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1))
    .setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1))
    .setAttribute('aTint',new THREE.Float32BufferAttribute(tints,3)),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,toneMapped:false,
      uniforms:{uTime:{value:0},uOp:{value:0},uTwinkle:{value:reducedMotion?0:1},uDpr:{value:1}},
      vertexShader:`attribute float aSize,aPhase;attribute vec3 aTint;uniform float uDpr;varying float vPhase,vHeight;varying vec3 vTint;
        void main(){vPhase=aPhase;vTint=aTint;vHeight=position.y;gl_Position=vec4(position.xy,.99999,1.0);gl_PointSize=aSize*uDpr;}`,
      fragmentShader:`uniform float uTime,uOp,uTwinkle;varying float vPhase,vHeight;varying vec3 vTint;
        void main(){float r=length(gl_PointCoord-.5)*2.0;float a=(1.0-smoothstep(.15,1.0,r))*uOp*smoothstep(.36,.7,vHeight);a*=.88+.12*sin(uTime*.65+vPhase)*uTwinkle;gl_FragColor=vec4(vTint,a);}`,
    }));stars.name='weather-stars';
  stars.renderOrder=-9;stars.frustumCulled=false;scene.add(stars);
  const owned=[dome,sunM,moonM,halo,clouds,stars];
  let starTime=0;
  const place = (m, cam, x, y) => { at(cam, x, y, DIST, m.position); m.lookAt(cam.position); };
  return {
    track(m) { if (m?.userData?.glow) glow.push(m); }, // materials that arrive after createSky (async GLBs) join the night glow loop
    colors:{zen:u.uZen.value,hor:u.uHor.value},
    uniforms:u, // dome uniforms: the distant skyline mirrors them to blend into the sky behind it
    sunDir:lightDir,
    setViewport(width,height,headerBottom=0){frame=celestialFrame(width,height,headerBottom);},
    objects:owned, // hidden while the water's planar reflection renders (the shader draws its own sky)
    update(night, dt = 0, camPos = new THREE.Vector3(), cam, mood = LON, flash = 0) {
      cam?.updateMatrixWorld();
      const cover=mood.cover ?? Math.min(1,.18+mood.cloudOp+(mood.rain??0)*.8);
      const clear=celestialVisibility(cover,mood.rain??0);
      const dusk = Math.sin(Math.PI * night) ** 3, golden = (mood.rs ?? 0) * 0.32 * (1 - night), sunset = Math.max(dusk, golden); // São Paulo sits in late-afternoon light
      // Golden hour warms only the horizon and sun; the zenith stays saturated blue (only real dusk turns it violet).
      authoredZen.lerpColors(day(mood.zen, d1), NIGHT.zen, night).lerp(sunsetZen, dusk * .65 * clear);
      authoredHor.lerpColors(day(mood.hor, d1), NIGHT.hor, night).lerp(sunsetHor, Math.max(dusk * .75, golden * .3) * clear); // a salmon horizon under a blue zenith blends to lilac; golden warmth lives in the sun glow
      authoredHor.lerp(cityHaze,night*Math.max(0,mood.light[0]-mood.light[2])*(1-cover)*.5);
      authoredZen.multiplyScalar(1-night*(mood.rain??0)*.22);
      authoredHor.multiplyScalar(1-night*(mood.rain??0)*.18);
      authoredMid.lerpColors(authoredHor, authoredZen, .58);
      untone(u.uZen.value.copy(authoredZen));
      untone(u.uHor.value.copy(authoredHor));
      u.uMid.value.copy(untone(authoredMid));
      u.uGlow.value.lerpColors(warmGlow, coolGlow, night); untone(u.uGlow.value);
      u.uClear.value = clear; u.uNight.value = night; u.uCover.value=cover;
      scene.fog.color.copy(u.uHor.value); // already tone-inverted
      scene.background?.copy(scene.fog.color);
      scene.fog.near = (150 - 10 * night) * mood.fogK;
      scene.fog.far = (740 - 100 * night) * mood.fogK * (1 - .14 * (mood.rain ?? 0));
      const cu=cloudMat.uniforms, deckK=smoothCover(cover);
      cu.uTop.value.lerpColors(day(mood.cloud,d1),NIGHT.cloud,night);untone(cu.uTop.value);
      cu.uBase.value.lerpColors(cloudBase,nightBase,night);untone(cu.uBase.value);
      cu.uRim.value.lerpColors(cloudRim,coolGlow,night);untone(cu.uRim.value);
      untone(cu.uCity.value.copy(cityGlow));
      const w=[mood.rs??0,mood.rl??1,mood.rg??0], dens=w[0]*LAYOUT[0]+w[1]*LAYOUT[1]+w[2]*LAYOUT[2];
      cu.uCoverage.value=THREE.MathUtils.lerp(.26+(dens-.8)*.5+cover*.3,.8,deckK);
      cu.uDeck.value=deckK; cu.uRain.value=mood.rain??0;
      cu.uLightK.value=(1-deckK*.9)*(1-night*.45); // moonlight is the same key, dimmer; under a deck only a trace of direct light survives
      cu.uNightK.value=night;
      cu.uFlash.value=reducedMotion?0:flash;
      if(!reducedMotion)cu.uWind.value.x+=dt*.0028*(.65+(mood.wind??1)*.35),cu.uWind.value.z+=dt*.0009; // noise units/s (~12 m/s at the 4.2 km shape scale)
      dome.position.copy(camPos); stars.position.copy(camPos);
      if (cam) {
        clouds.position.copy(camPos);
        cam.getWorldDirection(camFwd);
        cu.uYaw.value=Math.atan2(camFwd.x,camFwd.z); cu.uEye.value.set(camPos.x,camPos.z); cu.uAspect.value=cam.aspect||1;
        cu.uFrame.value.set(frame[0],frame[1]);
        place(sunM, cam, ...frame); place(moonM, cam, ...frame);
        u.uSunDir.value.copy(sunM.position).sub(camPos).normalize();
        lightDir.set(u.uSunDir.value.x,.42,u.uSunDir.value.z).normalize(); // the miniature's composed sky needs an above-ground key, even when the camera looks down
        halo.position.copy(night>.5?moonM.position:sunM.position);halo.lookAt(cam.position);
      }
      sunM.material.color.lerpColors(sunDay,sunSet,sunset);untone(sunM.material.color);
      sunM.material.opacity=(1-night)*clear;sunM.visible=sunM.material.opacity>.005;
      moonM.material.opacity=night*clear;moonM.visible=moonM.material.opacity>.005;
      halo.material.color.lerpColors(sunM.material.color,moonM.material.color,night);
      halo.material.opacity=clear*.55*(1-night*.80);halo.visible=clear>.005;
      const ds = DAY.sun * mood.sun, dh = DAY.hemi * mood.hemi;
      sun.intensity = ds + (NIGHT.sun * (1-cover*.78) - ds) * night;
      sun.color.lerpColors(day(mood.light, d1), NIGHT.light, night);
      hemi.intensity = dh + (NIGHT.hemi + (mood.rain??0)*.16 - dh) * night + (reducedMotion?0:flash);
      if(!reducedMotion)starTime+=dt;
      stars.material.uniforms.uTime.value=starTime;
      stars.material.uniforms.uOp.value=Math.max(0,night*1.3-.3)*clear;
      stars.material.uniforms.uDpr.value=Math.min(globalThis.devicePixelRatio||1,cam?.aspect>1?1.5:1);
      stars.visible=stars.material.uniforms.uOp.value>.005;
      for (const m of glow) { if (m.userData.uNight) m.userData.uNight.value = night; m.emissive.copy(m.userData.glowColor ?? m.color).multiplyScalar(night * (m.userData.glowK ?? 1.6)); } // each light glows in its own colour; default 1.6 (was 2.2) keeps lit windows under the bloom glare
    },
    dispose(){
      const geometries=new Set(),materials=new Set(),maps=new Set();
      for(const root of owned){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){materials.add(o.material);if(o.material.map)maps.add(o.material.map);}});scene.remove(root);}
      for(const resource of [...geometries,...materials,...maps,noise])resource.dispose();
    },
  };
}
