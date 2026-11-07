import * as THREE from 'three';
import { SUN_DIR, untone } from './sky.js';
import { reflectionMode, detailTexture } from './water-math.js';
import { PALETTE as P } from './palette.js';
const DAY_SKY = new THREE.Color(0x8fc0e4), NIGHT_SKY = new THREE.Color(0x18203a);
// Owner tweakables: how strongly the water mirrors (stylised floor added to Fresnel), sun/moon glint strength, foam band width (m).
export const REFLECT_FLOOR = 0.16, GLINT = 1.0, FOAM_WIDTH = 1.4;
const RANGE = 420, REFLECT_LAYER = 5, MAX_PIERS = 12;
const vertexShader = /* glsl */`
#include <fog_pars_vertex>
uniform mat4 uTexMat;
varying vec3 vPos;
varying vec4 vRefl;
void main() {
vec4 wp = modelMatrix * vec4(position, 1.0);
vPos = wp.xyz;
vRefl = uTexMat * wp;
vec4 mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const fragmentShader = /* glsl */`
uniform float uTime, uNight, uRiverCenter, uHalfWidth, uRainMotion, uKey, uReflect, uPierN, uFloor, uFoamW;
uniform vec3 uSun;
uniform vec3 uDeep, uShallow, uBed, uGlint, uNightTint, uSky, uZen;
uniform vec4 uPiers[${MAX_PIERS}];
uniform sampler2D tDetail, tRefl;
uniform vec2 uReflTexel;
varying vec3 vPos;
varying vec4 vRefl;
#include <fog_pars_fragment>
// Long swell: a few travelling sines (domain-warped), short waves fade with distance: no moire.
vec2 waveSlope(vec2 p, float t, float dist) {
  vec2 s = vec2(0.0);
  p += 1.4 * vec2(sin(p.y * 0.37 + t * 0.13 + sin(p.x * 0.11)), sin(p.x * 0.29 - t * 0.11 + sin(p.y * 0.17)));
  for (int i = 0; i < 6; i++) {
    float fi = float(i), a = fi * 2.399 + 0.6, k = 0.32 * pow(1.4, fi), w = sqrt(9.8 * k) * 0.5;
    vec2 d = vec2(cos(a), sin(a));
    float amp = 0.06 / (1.0 + fi * 0.6) / (1.0 + dist * k * 0.02);
    s += d * amp * k * cos(dot(d, p) * k - t * w + fi * 1.7 + sin(dot(p, d.yx) * 0.21 + fi));
  }
  return s;
}
// Detail: three layers of the tileable slope map scrolling downstream (+x) at different scales/angles; mipmaps calm the far field.
vec2 detailSlope(vec2 p, float t) {
  vec2 a = texture2D(tDetail, p * 0.06 + vec2(t * 0.018, t * 0.004)).rg;
  vec2 b = texture2D(tDetail, mat2(0.8, -0.6, 0.6, 0.8) * p * 0.15 + vec2(t * 0.041, -t * 0.017)).rg;
  vec2 c = texture2D(tDetail, mat2(0.5, 0.87, -0.87, 0.5) * p * 0.34 + vec2(t * 0.063, t * 0.029)).rg;
  return (a - 0.5) * 0.075 + (b - 0.5) * 0.045 + (c - 0.5) * 0.025; // gentle: a river, not a sea
}
float boxDist(vec2 p, vec4 b) { vec2 q = abs(p - b.xy) - b.zw; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
void main() {
float across = (vPos.z - uRiverCenter) / uHalfWidth, shore = clamp(1.0 - abs(across), 0.0, 1.0);
vec3 v = normalize(cameraPosition - vPos);
float dist = length(cameraPosition - vPos), fade = 1.0 / (1.0 + dist * 0.012);
vec2 g = waveSlope(vPos.xz, uTime, dist) + detailSlope(vPos.xz, uTime) * (0.45 + 0.55 * fade);
if(uRainMotion>0.001){ // rain: local expanding rings, faded before their cell edge and at distance
  vec2 cell=floor(vPos.xz*.65),local=fract(vPos.xz*.65)-.5;
  float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
  float age=fract(uTime*.9+seed),radius=length(local);
  float delta=(radius-age*.6)*38.0;
  float ring=exp(-delta*delta)*(1.0-age)*(1.0-smoothstep(.36,.5,radius));
  g+=local/max(radius,.02)*sin(radius*54.0-age*32.0)*ring*uRainMotion*.09*fade;
}
vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
// Edges: banks and piers/boats (box distance field), in metres.
float pier = 1e3;
for (int i = 0; i < ${MAX_PIERS}; i++) { if (float(i) >= uPierN) break; pier = min(pier, boxDist(vPos.xz, uPiers[i])); }
float bank = shore * uHalfWidth, edge = min(bank, max(pier, 0.0));
// Fake depth: a channel ~3.5 m deep, lighter and translucent at the banks; light travels further at grazing views.
float depthM = 0.35 + 3.2 * (1.0 - across * across);
depthM *= smoothstep(0.0, 3.0, pier) * 0.7 + 0.3;
float path = depthM / max(v.y, 0.2);
vec3 absorb = exp(-path * vec3(0.62, 0.26, 0.32));
float bedNoise = texture2D(tDetail, (vPos.xz + n.xz * depthM * 1.6) * 0.045).b; // bed seen through the surface, bent by the normal
vec3 bed = uBed * (0.7 + 0.6 * bedNoise);
vec3 body = bed * absorb + mix(uShallow, uDeep, 0.35 + 0.65 * smoothstep(0.0, 0.6, shore)) * (1.0 - absorb);
body = mix(body, uNightTint, uNight * 0.85);
// Reflection: sky gradient with the banks reflected dark (fallback), then the planar reflection over it where it has content.
vec3 r = reflect(-v, n);
vec3 sky = mix(uSky * 1.08, uZen, smoothstep(0.02, 0.6, r.y));
float bankRefl = smoothstep(0.55, 1.0, abs(across + g.y * 0.6)) * (1.0 - uNight * 0.4);
sky = mix(sky, sky * 0.42, bankRefl);
sky = mix(sky, vec3(dot(sky, vec3(0.3, 0.45, 0.25))), 0.35); // river reflections read greyer than the sky itself
vec3 refl = sky;
if (uReflect > 0.0) {
  vec2 uv = vRefl.xy / vRefl.w + g * (0.08 + 0.18 * fade) * vec2(0.6, 1.0); // wobble with the waves
  vec2 o = uReflTexel * (1.0 + dist * 0.012); // blur grows with distance
  vec4 p = texture2D(tRefl, uv) * 0.4 + (texture2D(tRefl, uv + vec2(o.x, o.y)) + texture2D(tRefl, uv - vec2(o.x, o.y))
    + texture2D(tRefl, uv + vec2(-o.x, o.y * 2.0)) + texture2D(tRefl, uv + vec2(o.x, -o.y * 2.0))) * 0.15;
  p.rgb = mix(p.rgb, vec3(dot(p.rgb, vec3(0.3, 0.45, 0.25))), 0.2) * 0.85;
  refl = mix(sky, p.rgb / max(p.a, 0.001), clamp(p.a, 0.0, 1.0) * uReflect);
}
float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
vec3 c = mix(body, refl, clamp(fres * 1.1 + uFloor, 0.0, 0.9));
// Sun (day/sunset) or moon (night) glint toward the visible disc: broad sheen + tight sparkles on the steeper facets.
float sd = max(dot(r, uSun), 0.0);
c += uGlint * (pow(sd, 60.0) * 0.35 + pow(sd, 700.0) * 3.0 * fade) * uKey;
// Night: warm streaks of the city's lights stretched across the water from both banks (softer where the real reflection shows).
float wx = vPos.x + g.x * 9.0 + g.y * 4.0;
float cols = max(0.0, sin(wx * 1.31) * sin(wx * 0.377 + 1.3) * sin(wx * 0.161 + 4.1));
float streak = pow(cols, 5.0) * smoothstep(0.1, 0.95, abs(across)) * (0.7 + 0.3 * sin(vPos.z * 0.8 + g.x * 8.0 + uTime * 0.5));
c += vec3(1.0, 0.74, 0.42) * streak * uNight * (0.35 + 0.65 * fade) * (1.1 - 0.5 * uReflect);
// Wet contact line and foam where the water meets the banks, piers and boats; animated by the scrolling detail height.
c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.45, edge));
float fn = texture2D(tDetail, vPos.xz * 0.21 + vec2(uTime * 0.05, 0.0)).b, fn2 = texture2D(tDetail, vPos.xz * 0.53 - vec2(uTime * 0.09, -uTime * 0.03)).b;
float band = 1.0 - smoothstep(0.0, uFoamW * (0.6 + 0.8 * fn), edge);
float foam = smoothstep(0.35, 0.7, band * (0.55 + 0.9 * fn2));
float aa = smoothstep(0.15, 0.9, fwidth(edge)); // a sub-pixel band at distance turns into its average, never a crawling line
foam = mix(foam, band * 0.3, aa);
c = mix(c, vec3(0.86, 0.9, 0.9) * (1.0 - uNight * 0.75), foam * 0.55);
gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
let detailMap = null, detailUsers = 0;
function getDetail() {
  if (!detailMap) {
    const size = 128;
    detailMap = new THREE.DataTexture(detailTexture(size), size, size, THREE.RGBAFormat);
    Object.assign(detailMap, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, anisotropy: 4, needsUpdate: true });
  }
  detailUsers++;
  return detailMap;
}
const SUNSET = new THREE.Color(0xff9a50), SUN_GLINT = new THREE.Color(0xfff0c8), MOON_GLINT = new THREE.Color(0xc8d8ff);
export function createWater({ x0, x1, z, width, reducedMotion = false, piers = [], reflectRoots = [], bankPlots = [] }) {
  const Y = 0.1;
  const geo = new THREE.PlaneGeometry(x1 - x0, width).rotateX(-Math.PI / 2);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  rt.texture.generateMipmaps = false;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uRiverCenter:{value:z},uHalfWidth:{value:width/2}, uSun: { value: SUN_DIR.clone() }, uNight: { value: 0 },
      uRainMotion: { value: 0 }, uKey: { value: 1 }, uReflect: { value: 0 }, uFloor: { value: REFLECT_FLOOR }, uFoamW: { value: FOAM_WIDTH },
      uPierN: { value: 0 }, uPiers: { value: Array.from({ length: MAX_PIERS }, () => new THREE.Vector4()) },
      tDetail: { value: null }, tRefl: { value: null }, uTexMat: { value: new THREE.Matrix4() }, uReflTexel: { value: new THREE.Vector2(1, 1) },
      uDeep: { value: new THREE.Color(0x1d4448) }, uShallow: { value: new THREE.Color(0x4d706c) }, uBed: { value: new THREE.Color(0x6e6a4c) },
      uGlint: { value: new THREE.Color(0xfff0c8) }, uNightTint: { value: new THREE.Color(0x0a1330) }, uSky: { value: new THREE.Color(0xacc9d8) },
      uZen: { value: new THREE.Color(0x4a8fd2) },
    }]),
    vertexShader, fragmentShader, fog: true,
  });
  const u = mat.uniforms;
  u.tDetail.value = getDetail(); u.tRefl.value = rt.texture; // after merge: UniformsUtils.merge clones textures
  piers.slice(0, MAX_PIERS).forEach((p, i) => u.uPiers.value[i].set(p.x, p.z, p.hx, p.hz));
  u.uPierN.value = Math.min(piers.length, MAX_PIERS);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, Y, z);
  // Planar reflection (Reflector-style mirrored camera with an oblique near plane at the waterline, so no shader variants).
  const flag = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('reflect');
  const banks = bankPlots.filter(p => p.x >= x0 && p.x <= x1 && Math.abs(p.z - z) <= width / 2 + 65);
  let bankReflection;
  if (flag !== '0' && banks.length) {
    // ponytail: reflect lot envelopes in one draw; use full geometry only for the diagnostic.
    const bankGeometry = new THREE.BoxGeometry(1, 1, 1);
    bankReflection = new THREE.InstancedMesh(bankGeometry, new THREE.MeshLambertMaterial(), banks.length);
    bankReflection.name = 'river-bank-reflection';
    bankReflection.layers.set(REFLECT_LAYER);
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    banks.forEach((p, i) => {
      matrix.makeScale(p.width, p.height, p.depth).setPosition(p.x, p.height / 2, p.z);
      bankReflection.setMatrixAt(i, matrix);
      bankReflection.setColorAt(i, color.set(p.wall ?? (p.kind === 'office' ? P.steel : P.londonStock)));
    });
  }
  const mirror = new THREE.PerspectiveCamera(), frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), box = new THREE.Box3();
  const view = new THREE.Vector3(), target = new THREE.Vector3(), look = new THREE.Vector3(), rot = new THREE.Matrix4(), N = new THREE.Vector3(0, 1, 0);
  const clipPlane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4(), size = new THREE.Vector2(), clear = new THREE.Color();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  let tagFrame = 0, lastMode = 'off';
  const tag = (scene) => {
    for (const root of reflectRoots) root?.traverse((o) => o.layers.enable(REFLECT_LAYER));
    for (const o of scene.children) if (o.isLight) o.layers.enable(REFLECT_LAYER);
  };
  const inView = (camera) => {
    if (camera.position.y <= Y + 0.5) return false;
    box.min.set(Math.max(x0, camera.position.x - RANGE), Y - 0.5, z - width / 2);
    box.max.set(Math.min(x1, camera.position.x + RANGE), Y + 0.5, z + width / 2);
    if (box.min.x >= box.max.x) return false;
    frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return frustum.intersectsBox(box);
  };
  return {
    mesh, bankReflection,
    get reflectMode() { return lastMode; }, // read by QA probes
    update(time, night, mood, tier = 'high', skyColors, sunDir) {
      u.uTime.value = reducedMotion ? 0 : time;
      u.uNight.value = night;
      u.uSky.value.lerpColors(DAY_SKY, NIGHT_SKY, night);
      let cover = 0, rain = 0;
      if(mood){
        u.uSky.value.setRGB(...mood.hor,THREE.SRGBColorSpace).lerp(NIGHT_SKY,night);
        cover = THREE.MathUtils.smoothstep(mood.cover ?? 0, .48, .98); rain = Math.min(1, (mood.rain ?? 0) * 2);
      }
      // Glint: warm sun by day, orange at sunset, a cooler and weaker moon path at night; gone under overcast or rain.
      const sunset = Math.sin(Math.PI * night) ** 3, clearSky = (1 - cover) * (1 - rain);
      u.uGlint.value.copy(SUN_GLINT).lerp(SUNSET, sunset).lerp(MOON_GLINT, THREE.MathUtils.smoothstep(night, 0.55, 0.9));
      u.uKey.value = GLINT * clearSky * (night > 0.7 ? 0.45 : 1);
      if (sunDir) u.uSun.value.copy(sunDir);
      u.uRainMotion.value=reducedMotion||tier!=='high'?0:mood?.rain??0;
      untone(u.uSky.value);
      u.uZen.value.copy(u.uSky.value).multiplyScalar(.65);
      if(skyColors){u.uSky.value.copy(skyColors.hor);u.uZen.value.copy(skyColors.zen);}
    },
    // Call once per frame before the composer: renders the mirrored scene into a half-res target when the river is on screen.
    reflect(renderer, scene, camera, tier, skyObjects = []) {
      const mode = reflectionMode(tier, flag);
      camera.updateMatrixWorld();
      if (mode === 'off' || !inView(camera)) { u.uReflect.value = 0; lastMode = 'off'; return; }
      lastMode = mode;
      renderer.getDrawingBufferSize(size);
      const scale = tier === 'high' ? 0.5 : 0.25;
      const w = Math.max(1, Math.round(size.x * scale)), h = Math.max(1, Math.round(size.y * scale));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      u.uReflTexel.value.set(1 / w, 1 / h);
      if (mode === 'landmarks' && tagFrame++ % 120 === 0) tag(scene); // authored LODs arrive late: re-tag every ~2 s
      // Mirror the camera about y = Y (three.js Reflector maths).
      view.set(camera.position.x, Y, camera.position.z).sub(camera.position).reflect(N).negate().add(look.set(camera.position.x, Y, camera.position.z));
      rot.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(camera.position);
      target.set(camera.position.x, Y, camera.position.z).sub(look).reflect(N).negate().add(box.min.set(camera.position.x, Y, camera.position.z));
      mirror.position.copy(view);
      mirror.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
      mirror.lookAt(target);
      mirror.far = camera.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      mirror.projectionMatrix.elements[8] *= -1; // the mirrored view is flipped left-right: flip the panel's horizontal view offset with it
      u.uTexMat.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
      // Oblique near plane = the water plane: nothing below the surface reaches the reflection.
      clipPlane.setFromNormalAndCoplanarPoint(N, box.min.set(0, Y, 0)).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
      const e = mirror.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
      clip.multiplyScalar(2 / clip.dot(q));
      e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1; e[14] = clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
      if (mode === 'full') mirror.layers.mask = camera.layers.mask; else mirror.layers.set(REFLECT_LAYER);
      // Render: no water, no sky objects/background (the shader draws its own sky where alpha = 0), no shadow-map refresh.
      const bg = scene.background, auto = renderer.shadowMap.autoUpdate, prev = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      const shown = skyObjects.map((o) => o.visible);
      skyObjects.forEach((o) => { o.visible = false; });
      mesh.visible = false; scene.background = null; renderer.shadowMap.autoUpdate = false;
      renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, mirror);
      renderer.setRenderTarget(prev); renderer.setClearColor(clear, alpha);
      renderer.shadowMap.autoUpdate = auto; scene.background = bg; mesh.visible = true;
      skyObjects.forEach((o, i) => { o.visible = shown[i]; });
      u.uReflect.value = 1;
    },
    dispose() {
      geo.dispose(); mat.dispose(); rt.dispose();
      if (bankReflection) {
        bankReflection.dispose();
        bankReflection.geometry.dispose();
        bankReflection.material.dispose();
      }
      if (--detailUsers === 0) { detailMap.dispose(); detailMap = null; }
    },
  };
}
