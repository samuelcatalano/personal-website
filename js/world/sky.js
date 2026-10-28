import * as THREE from 'three';
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
const DAY = { zen: C(0x6fb1e8), hor: C(0xb9dcf5), cloud: C(0xf4f9ff), sun: 2.35, hemi: 1.08, light: C(0xfff0d0) };
const NIGHT = { zen: C(0x0b1530), hor: C(0x1d2b4f), cloud: C(0x3b4668), sun: 0.40, hemi: 0.60, light: C(0xaec4ff) };
export const SUN_DIR = new THREE.Vector3(110, 45, 40).normalize(); // directional light + sun + moon share this direction
const DIST = 1300; // just inside camera.far (1400), beyond every building
function disc(draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sprite = (map, size) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: true, depthWrite: false, fog: false, toneMapped: false }));
  m.renderOrder = 1000;
  return m;
};
const LON = { zen: [0.435, 0.694, 0.91], hor: [0.725, 0.863, 0.961], cloud: [0.957, 0.976, 1], light: [1, 0.941, 0.816], sun: 1, hemi: 1, fogK: 1, cloudOp: 0, rs: 0, rl: 1, rg: 0 }; // default mood (== DAY)
export function createSky(scene, { hemi, sun, reducedMotion = false }) {
  const d1 = new THREE.Color(), day = (a, c = d1) => c.setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace); // mood sRGB triplet -> working colour
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uZen: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSunDir: { value: SUN_DIR.clone() }, uClear: { value: 1 }, uNight: { value: 0 } },
      vertexShader: 'varying vec3 vDir; varying vec4 vClip; void main(){ vDir = position; vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position=vClip; }',
      fragmentShader: `uniform vec3 uZen,uMid,uHor,uGlow,uSunDir; uniform float uClear,uNight; varying vec3 vDir; varying vec4 vClip;
        void main(){
          vec3 d=normalize(vDir); float h=max(0.0,(vClip.y/vClip.w-.18)*.4);
          vec3 c=mix(uHor,uMid,smoothstep(0.0,0.07,h));
          c=mix(c,uZen,smoothstep(0.025,0.24,h));
          float sd=max(dot(d,uSunDir),0.0);
          float lobe=pow(sd,12.0)*0.25+pow(sd,96.0)*0.48;
          c=mix(c,uGlow,lobe*uClear*smoothstep(0.0,0.07,h));
          gl_FragColor=vec4(c,1.0);
        }`,
    }),
  );
  dome.renderOrder = -10; dome.frustumCulled = false;
  const u = dome.material.uniforms;
  const sunsetZen = C(0x67558b), sunsetHor = C(0xe6a68e), warmGlow = C(0xf7dfbd), coolGlow = C(0x7c9ddc), cityHaze = C(0x584247);
  const authoredZen = new THREE.Color(), authoredHor = new THREE.Color(), authoredMid = new THREE.Color();
  const sunM = sprite(disc((g) => {
    const r=g.createRadialGradient(128,128,0,128,128,128);
    r.addColorStop(0,'#fff');r.addColorStop(.49,'#fff');r.addColorStop(.52,'rgba(255,255,255,.2)');r.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r;g.fillRect(0,0,256,256);
  }),150);
  sunM.name='weather-sun';
  const halo=sprite(disc(g=>{
    const r=g.createRadialGradient(128,128,0,128,128,128);
    r.addColorStop(0,'rgba(255,255,255,.25)');r.addColorStop(.14,'rgba(255,255,255,.13)');r.addColorStop(.4,'rgba(255,255,255,.035)');r.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r;g.fillRect(0,0,256,256);
  }),500);halo.material.blending=THREE.AdditiveBlending;halo.renderOrder=997;
  // Smooth broad maria and limb shading, always a full disc; no discrete crater dots.
  const moonM=sprite(disc(g=>{
    const im=g.createImageData(256,256),maria=[[-.25,.22,.38,.28],[.18,.4,.3,.3],[.34,-.12,.31,.4],[-.31,-.35,.28,.22]];
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const px=(x-128)/100,py=(y-128)/100,r=Math.hypot(px,py),k=(y*256+x)*4;
      let shade=0;for(const [mx,my,rx,ry] of maria)shade+=Math.exp(-((px-mx)**2/rx**2+(py-my)**2/ry**2)*2)*.26;
      const grain=(Math.sin(px*27+Math.sin(py*19))*Math.sin(py*31+px*9))*.016;
      const v=Math.max(0,(1-shade+grain)*(.70+.30*Math.sqrt(Math.max(0,1-r*r))));
      im.data[k]=im.data[k+1]=im.data[k+2]=Math.round(v*255);im.data[k+3]=Math.round(Math.min(1,Math.max(0,(1-r)*90))*255);
    }g.putImageData(im,0,0);
  }),100);
  moonM.name='weather-moon';
  const sunDay=C(0xfff0d1),sunSet=C(0xf69350),moonTint=C(0xe1eaff);
  moonM.material.color.copy(untone(moonTint.clone()));
  scene.add(dome,sunM,moonM,halo);
  // Feathered density billboards preserve the upper-frame composition with far fewer draws than sphere clusters.
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTop: { value: new THREE.Color() }, uBase: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uOp: { value: .8 }, uLayer: { value: 0 }, uCover: { value: 0 }, uFlash: { value: 0 }, uSeed: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform vec3 uTop,uBase,uRim; uniform float uOp,uLayer,uCover,uFlash,uSeed,uFade; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.57+noise(p*2.07+7.0)*.28+noise(p*4.13+19.0)*.15;}
      void main(){
        vec2 p=vUv;float a;vec3 c;
        if(uLayer>1.5){
          float n=fbm(p*5.0+vec2(3.0,7.0));
          a=mix(.72,.98,smoothstep(.16,.78,n))*uCover;c=mix(uBase,uTop,n*.65);
          c+=uTop*uFlash*exp(-dot(p-vec2(.28,.2),p-vec2(.28,.2))*12.0);
        }else if(uLayer>0.5){
          float streak=fbm(vec2(p.x*3.0,p.y*17.0+p.x*2.0));
          a=smoothstep(.45,.75,streak)*pow(max(0.0,1.0-p.x*p.x),.7)*(1.0-smoothstep(.3,1.0,abs(p.y)));
          c=mix(uBase,uTop,.8);
        }else{
          float n=fbm(p*5.0+vec2(3.0,7.0)+uSeed*23.0);
          vec4 j=fract(uSeed*vec4(7.31,3.17,5.53,11.7))-.5; // per-cloud blob jitter: every cloud gets its own silhouette
          float shape=1.0-length(vec2(p.x/(.93+j.x*.3),(p.y+.22)/(.42+j.y*.12)));
          shape=max(shape,1.0-length((p-vec2(-.42+j.z*.3,.02))/vec2(.34,.58+j.w*.3)));
          shape=max(shape,1.0-length((p-vec2(.02+j.w*.3,.18))/vec2(.42,.69+j.x*.3)));
          shape=max(shape,1.0-length((p-vec2(.47+j.y*.2,.02))/vec2(.33,.50+j.z*.3)));
          a=smoothstep(-.08,.23,shape+(n-.5)*.24);
          float light=smoothstep(-.50,.65,p.y+(n-.5)*.5);
          c=mix(uBase,uTop,light);c=mix(c,uRim,smoothstep(.65,.98,light)*.28);
        }
        gl_FragColor=vec4(c,a*uOp*uFade);
      }`,
  });
  const cirrusMat=cloudMat.clone(), deckMat=cloudMat.clone();
  cirrusMat.uniforms.uLayer.value=1; deckMat.uniforms.uLayer.value=2;
  const cloudGeo=new THREE.PlaneGeometry(1,1), clouds=new THREE.Group();clouds.name='weather-clouds';
  // Seeded per-cloud layouts, one per region (SP scattered, London broken, Glasgow packed); the update blends them so clouds glide between stops.
  const rnd=(i,k)=>{const n=Math.sin(i*91.7+k*47.3+1.3)*43758.5453;return n-Math.floor(n);};
  const LAYOUT=[[0,.5],[0,.85],[0,1.2]]; // cloud density per region sp/lon/gla
  for(let i=0;i<20;i++){
    const high=i>=14, m=high?cirrusMat:Object.assign(cloudMat.clone(),{uniforms:{...cloudMat.uniforms,uSeed:{value:rnd(i,0)},uFade:{value:1}}});
    const c=new THREE.Mesh(cloudGeo,m);
    const reg=[0,1,2].map(r=>({x:rnd(i,r*3+1)*2.9-1.45,y:high?.9+rnd(i,r*3+2)*.14:.5+rnd(i,r*3+2)*.45,k:.7+rnd(i,r*3+3)*(r==2?.9:.8)}));
    c.userData={reg,rank:rnd(i,20),speed:.007+rnd(i,21)*.012,drift:0,high};
    c.renderOrder=high?-8:-7;c.frustumCulled=false;clouds.add(c);
  }
  const deck=new THREE.Mesh(cloudGeo,deckMat);deck.scale.set(3200,650,1);deck.renderOrder=-6;deck.frustumCulled=false;
  scene.add(clouds,deck);
  const smoothCover=c=>THREE.MathUtils.smoothstep(c,.65,1);
  const cloudBase=C(0x7e99b5),nightBase=C(0x1b2941),cloudRim=C(0xfed29a);
  // sky band: the follow camera looks down, so the sun/moon/clouds are pinned to NDC points of the upper frame
  const at = (cam, x, y, d, out) => out.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(d).add(cam.position);
  const glow = [];
  scene.traverse((o) => { if (o.material?.userData?.glow) glow.push(o.material); });
  const pos=[],sizes=[],phases=[],tints=[];
  const hash=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  for(let i=0;i<420;i++){
    pos.push(hash(i*4)*2-1,.36+hash(i*4+1)*.64,0);
    sizes.push(.7+hash(i*4+2)**5*2.0);phases.push(hash(i*4+3)*Math.PI*2);
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
        void main(){float r=length(gl_PointCoord-.5)*2.0;float a=(1.0-smoothstep(.15,1.0,r))*uOp*smoothstep(.36,.72,vHeight);a*=.80+.20*sin(uTime*.65+vPhase)*uTwinkle;gl_FragColor=vec4(vTint,a);}`,
    }));stars.name='weather-stars';
  stars.renderOrder=-9;stars.frustumCulled=false;scene.add(stars);
  const owned=[dome,sunM,moonM,halo,clouds,deck,stars];
  let starTime=0;
  const place = (m, cam, x, y) => { at(cam, x, y, DIST, m.position); m.lookAt(cam.position); };
  return {
    colors:{zen:u.uZen.value,hor:u.uHor.value},
    update(night, dt = 0, camPos = new THREE.Vector3(), cam, mood = LON, flash = 0) {
      cam?.updateMatrixWorld();
      const cover=mood.cover ?? Math.min(1,.18+mood.cloudOp+(mood.rain??0)*.8);
      const veil=1-THREE.MathUtils.smoothstep(cover,.48,.98),clear=veil*(1-Math.min(1,(mood.rain??0)*2));
      const sunset = Math.sin(Math.PI * night) ** 3;
      authoredZen.lerpColors(day(mood.zen, d1), NIGHT.zen, night).lerp(sunsetZen, sunset * .65 * clear);
      authoredHor.lerpColors(day(mood.hor, d1), NIGHT.hor, night).lerp(sunsetHor, sunset * .75 * clear);
      authoredHor.lerp(cityHaze,night*Math.max(0,mood.light[0]-mood.light[2])*(1-cover)*.5);
      authoredZen.multiplyScalar(1-night*(mood.rain??0)*.22);
      authoredHor.multiplyScalar(1-night*(mood.rain??0)*.18);
      authoredMid.lerpColors(authoredHor, authoredZen, .58);
      untone(u.uZen.value.copy(authoredZen));
      untone(u.uHor.value.copy(authoredHor));
      u.uMid.value.copy(untone(authoredMid));
      u.uGlow.value.lerpColors(warmGlow, coolGlow, night); untone(u.uGlow.value);
      u.uClear.value = clear; u.uNight.value = night;
      scene.fog.color.copy(u.uHor.value); // already tone-inverted
      scene.background?.copy(scene.fog.color);
      scene.fog.near = (200 - 20 * night) * mood.fogK; scene.fog.far = (820 - 140 * night) * mood.fogK;
      for(const mat of [cloudMat,cirrusMat,deckMat]){
        const cu=mat.uniforms;
        cu.uTop.value.lerpColors(day(mood.cloud,d1),NIGHT.cloud,night);untone(cu.uTop.value);
        cu.uBase.value.lerpColors(cloudBase,nightBase,night);untone(cu.uBase.value);
        cu.uRim.value.lerpColors(cloudRim,coolGlow,night);untone(cu.uRim.value);
        cu.uOp.value=mat===cirrusMat?.32*(1-cover):.58+cover*.3;
        cu.uCover.value=smoothCover(cover);
        cu.uFlash.value=reducedMotion?0:flash;
      }
      deck.visible=cover>.65;
      dome.position.copy(camPos); stars.position.copy(camPos);
      if (cam) {
        const wide = cam.aspect > 1;
        const w=[mood.rs??0,mood.rl??1,mood.rg??0], dens=w[0]*LAYOUT[0][1]+w[1]*LAYOUT[1][1]+w[2]*LAYOUT[2][1];
        for (const c of clouds.children) {
          const d = c.userData;
          let x=0,y=0,k=0;for(let r=0;r<3;r++){x+=d.reg[r].x*w[r];y+=d.reg[r].y*w[r];k+=d.reg[r].k*w[r];}
          if(!reducedMotion)d.drift+=dt*d.speed;
          x=((x+d.drift+1.6)%3.2+3.2)%3.2-1.6;
          if(d.high){c.visible=cirrusMat.uniforms.uOp.value>.001;c.scale.set(440*k,65*k,1);}
          else{c.material.uniforms.uFade.value=THREE.MathUtils.smoothstep(dens,d.rank*.9,d.rank*.9+.2);c.visible=c.material.uniforms.uFade.value>.005;c.scale.set((220+d.rank*60)*k,(90+d.rank*30)*k,1);}
          at(cam, x, y, 1250, c.position);
          c.lookAt(cam.position);
        }
        place(sunM, cam, wide ? 0.66 : 0.6, wide ? 0.8 : 0.78); place(moonM, cam, wide ? 0.66 : 0.6, wide ? 0.8 : 0.78);
        u.uSunDir.value.copy(sunM.position).sub(camPos).normalize();
        at(cam,0,.90,1200,deck.position);deck.lookAt(cam.position);
        halo.position.copy(night>.5?moonM.position:sunM.position);halo.lookAt(cam.position);
      }
      sunM.material.color.lerpColors(sunDay,sunSet,sunset);untone(sunM.material.color);
      sunM.material.opacity=(1-night)*clear;sunM.visible=sunM.material.opacity>.005;
      moonM.material.opacity=night*clear;moonM.visible=moonM.material.opacity>.005;
      halo.material.color.lerpColors(sunM.material.color,moonM.material.color,night);
      halo.material.opacity=clear*(1-night*.75);halo.visible=clear>.005;
      const ds = DAY.sun * mood.sun, dh = DAY.hemi * mood.hemi;
      sun.intensity = ds + (NIGHT.sun * (1-cover*.78) - ds) * night;
      sun.color.lerpColors(day(mood.light, d1), NIGHT.light, night);
      hemi.intensity = dh + (NIGHT.hemi + (mood.rain??0)*.16 - dh) * night + (reducedMotion?0:flash);
      if(!reducedMotion)starTime+=dt;
      stars.material.uniforms.uTime.value=starTime;
      stars.material.uniforms.uOp.value=Math.max(0,night*1.4-.4)*clear;
      stars.material.uniforms.uDpr.value=Math.min(globalThis.devicePixelRatio||1,cam?.aspect>1?1.5:1);
      stars.visible=stars.material.uniforms.uOp.value>.005;
      for (const m of glow) { if (m.userData.uNight) m.userData.uNight.value = night; m.emissive.copy(m.userData.glowColor ?? m.color).multiplyScalar(night * (m.userData.glowK ?? 2.2)); } // each light glows in its own colour, bright enough to bloom
    },
    dispose(){
      const geometries=new Set(),materials=new Set(),maps=new Set();
      for(const root of owned){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){materials.add(o.material);if(o.material.map)maps.add(o.material.map);}});scene.remove(root);}
      for(const resource of [...geometries,...materials,...maps])resource.dispose();
    },
  };
}
