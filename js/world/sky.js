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
const DAY = { zen: C(0x6fb1e8), hor: C(0xb9dcf5), cloud: C(0xf4f9ff), sun: 2.35, hemi: 1.15, light: C(0xfff0d0) };
const NIGHT = { zen: C(0x0b1530), hor: C(0x1d2b4f), cloud: C(0x3b4668), sun: 0.34, hemi: 0.48, light: C(0xaec4ff) };
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
const LON = { zen: [0.435, 0.694, 0.91], hor: [0.725, 0.863, 0.961], cloud: [0.957, 0.976, 1], light: [1, 0.941, 0.816], sun: 1, hemi: 1, fogK: 1, cloudOp: 0 }; // default mood (== DAY)
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
  const sunsetZen = C(0x67558b), sunsetHor = C(0xe6a68e), warmGlow = C(0xf7dfbd), coolGlow = C(0x7c9ddc);
  const authoredZen = new THREE.Color(), authoredHor = new THREE.Color(), authoredMid = new THREE.Color();
  const sunM = sprite(disc((g) => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, '#fff'); r.addColorStop(0.2, '#fff'); r.addColorStop(0.24, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  }), 400);
  sunM.material.color.copy(untone(C(0xfff0b8)));
  const moonM = sprite(disc((g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,160,185,0.55)';
    for (const [x, y, r] of [[100, 105, 18], [150, 95, 11], [140, 150, 22], [95, 155, 9], [170, 130, 7]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }), 110); // moon disc ≈ sun disc (sun disc is ~0.2 of its 400 sprite)
  moonM.material.color.copy(untone(C(0xe6e9f0)));
  scene.add(dome, sunM, moonM);
  // Feathered density billboards preserve the upper-frame composition with far fewer draws than sphere clusters.
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTop: { value: new THREE.Color() }, uBase: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uOp: { value: .8 }, uLayer: { value: 0 }, uCover: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform vec3 uTop,uBase,uRim; uniform float uOp,uLayer,uCover; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.57+noise(p*2.07+7.0)*.28+noise(p*4.13+19.0)*.15;}
      void main(){
        vec2 p=vUv;float n=fbm(p*5.0+vec2(3.0,7.0));
        float shape=1.0-length(vec2(p.x/.93,(p.y+.22)/.42));
        shape=max(shape,1.0-length((p-vec2(-.42,.02))/vec2(.34,.58)));
        shape=max(shape,1.0-length((p-vec2(.02,.18))/vec2(.42,.69)));
        shape=max(shape,1.0-length((p-vec2(.47,.02))/vec2(.33,.50)));
        float a=smoothstep(-.08,.23,shape+(n-.5)*.24);
        float light=smoothstep(-.50,.65,p.y+(n-.5)*.5);
        vec3 c=mix(uBase,uTop,light);
        c=mix(c,uRim,smoothstep(.65,.98,light)*.28);
        if(uLayer>0.5){
          float streak=fbm(vec2(p.x*3.0,p.y*17.0+p.x*2.0));
          a=smoothstep(.45,.75,streak)*pow(max(0.0,1.0-p.x*p.x),.7)*(1.0-smoothstep(.3,1.0,abs(p.y)));
          c=mix(uBase,uTop,.8);
        }
        if(uLayer>1.5){a=mix(.20,.98,smoothstep(.16,.78,n))*uCover;c=mix(uBase,uTop,n*.65);}
        gl_FragColor=vec4(c,a*uOp);
      }`,
  });
  const cirrusMat=cloudMat.clone(), deckMat=cloudMat.clone();
  cirrusMat.uniforms.uLayer.value=1; deckMat.uniforms.uLayer.value=2;
  const cloudGeo=new THREE.PlaneGeometry(1,1), clouds=new THREE.Group();
  for(let i=0;i<14;i++){
    const high=i>=10, c=new THREE.Mesh(cloudGeo,high?cirrusMat:cloudMat);
    c.scale.set(high?440:220+(i%3)*38,high?65:90+(i%4)*12,1);
    c.userData={x:((i*.61803398875)%1)*2.8-1.4,y:high?.92+(i%2)*.10:.57+((i*.381966)%1)*.37};
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
  const pos = [];
  for (let i = 0; i < 500; i++) { // upper hemisphere around the camera
    const a = Math.random() * Math.PI * 2, e = (0.12 + Math.random() * 0.88) * Math.PI / 2;
    pos.push(Math.cos(a) * Math.cos(e) * 1000, Math.sin(e) * 1000, Math.sin(a) * Math.cos(e) * 1000);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: untone(C(0xdde6ff)), size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false, toneMapped: false }),
  );
  stars.renderOrder = -9; stars.frustumCulled = false;
  scene.add(stars);
  const place = (m, cam, x, y) => { at(cam, x, y, DIST, m.position); m.lookAt(cam.position); };
  return {
    update(night, dt = 0, camPos = new THREE.Vector3(), cam, mood = LON) {
      cam?.updateMatrixWorld();
      const sunset = Math.sin(Math.PI * night) ** 3, clear = 1 - Math.min(1, mood.rain ?? 0);
      authoredZen.lerpColors(day(mood.zen, d1), NIGHT.zen, night).lerp(sunsetZen, sunset * .65 * clear);
      authoredHor.lerpColors(day(mood.hor, d1), NIGHT.hor, night).lerp(sunsetHor, sunset * .75 * clear);
      authoredMid.lerpColors(authoredHor, authoredZen, .58);
      untone(u.uZen.value.copy(authoredZen));
      untone(u.uHor.value.copy(authoredHor));
      u.uMid.value.copy(untone(authoredMid));
      u.uGlow.value.lerpColors(warmGlow, coolGlow, night); untone(u.uGlow.value);
      u.uClear.value = clear; u.uNight.value = night;
      scene.fog.color.copy(u.uHor.value); // already tone-inverted
      scene.background?.copy(scene.fog.color);
      scene.fog.near = (200 - 20 * night) * mood.fogK; scene.fog.far = (820 - 140 * night) * mood.fogK;
      const cover=mood.cover ?? Math.min(1,.18+mood.cloudOp+(mood.rain??0)*.8);
      for(const mat of [cloudMat,cirrusMat,deckMat]){
        const cu=mat.uniforms;
        cu.uTop.value.lerpColors(day(mood.cloud,d1),NIGHT.cloud,night);untone(cu.uTop.value);
        cu.uBase.value.lerpColors(cloudBase,nightBase,night);untone(cu.uBase.value);
        cu.uRim.value.lerpColors(cloudRim,coolGlow,night);untone(cu.uRim.value);
        cu.uOp.value=mat===cirrusMat?.32*(1-cover):.58+cover*.3;
        cu.uCover.value=smoothCover(cover);
      }
      deck.visible=cover>.65;
      dome.position.copy(camPos); stars.position.copy(camPos);
      if (cam) {
        const wide = cam.aspect > 1;
        for (const c of clouds.children) {
          const d = c.userData;
          if (!reducedMotion) d.x = d.x > 1.4 ? -1.4 : d.x + dt * 0.012;
          at(cam, d.x, d.y, 1250, c.position);
          c.lookAt(cam.position);
        }
        place(sunM, cam, wide ? 0.66 : 0.6, wide ? 0.8 : 0.78); place(moonM, cam, wide ? 0.66 : 0.6, wide ? 0.8 : 0.78);
        u.uSunDir.value.copy(sunM.position).sub(camPos).normalize();
        at(cam,0,.90,1200,deck.position);deck.lookAt(cam.position);
      }
      sunM.visible = night < 0.98; sunM.material.opacity = (1 - night) * Math.min(1, mood.sun) ** 2; // veiled by overcast
      moonM.visible = night > 0.02; moonM.material.opacity = night;
      const ds = DAY.sun * mood.sun, dh = DAY.hemi * mood.hemi;
      sun.intensity = ds + (NIGHT.sun - ds) * night;
      sun.color.lerpColors(day(mood.light, d1), NIGHT.light, night);
      hemi.intensity = dh + (NIGHT.hemi - dh) * night;
      stars.material.opacity = Math.max(0, night * 1.4 - 0.4);
      stars.visible = night > 0.3;
      for (const m of glow) { if (m.userData.uNight) m.userData.uNight.value = night; m.emissive.copy(m.userData.glowColor ?? m.color).multiplyScalar(night * (m.userData.glowK ?? 2.2)); } // each light glows in its own colour, bright enough to bloom
    },
  };
}
