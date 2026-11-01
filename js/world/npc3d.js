// POC: walking NPCs (one GLB, one shared rig, three walk clips) on the pavement beside the bus route.
// Opt-in with ?npc3d=1. Debug: ?npcnear=1 puts 24 of them 5-30 m ahead of the scroll point under a pavement-level camera (?npcshot=k aims at walker k). The sprite crowd, layout and scene stay as they are.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ROAD } from './layout.js'; // read only: the sprite crowd's lane offsets

const GLB = new URL('../../assets/npc/npc_pack.glb', import.meta.url).href;
const NEAR = new URLSearchParams(location.search).has('npcnear'), SHOT = Number(new URLSearchParams(location.search).get('npcshot')) || 0; // debug only
const REDUCED = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // read once at load
export const NPC_VARIANTS = [ // height: metres; measured: the body height each mesh was built at; speed: scales the walk speed
  { name: 'NPC_A', height: 1.80, measured: 1.799, speed: 1.00 },
  { name: 'NPC_B', height: 1.72, measured: 1.813, speed: 1.08 },
  { name: 'NPC_C', height: 1.78, measured: 1.787, speed: 0.92 },
  { name: 'NPC_D', height: 1.86, measured: 1.806, speed: 1.04 },
  { name: 'NPC_E', height: 1.68, measured: 1.806, speed: 0.96 },
  { name: 'NPC_F', height: 1.62, measured: 1.806, speed: 0.98 },
  { name: 'NPC_G', height: 1.66, measured: 1.806, speed: 1.06 },
  { name: 'NPC_H', height: 1.72, measured: 1.806, speed: 0.94 },
  { name: 'NPC_I', height: 1.74, measured: 1.806, speed: 1.02 },
  { name: 'NPC_J', height: 1.82, measured: 1.806, speed: 0.97 },
  { name: 'NPC_K', height: 1.68, measured: 1.806, speed: 1.03 },
  { name: 'NPC_L', height: 1.64, measured: 1.806, speed: 0.99 },
  { name: 'NPC_O', height: 1.73, measured: 1.806, speed: 0.95 },
  { name: 'NPC_P', height: 1.70, measured: 1.806, speed: 1.05 },
  { name: 'NPC_Q', height: 1.90, measured: 1.806, speed: 1.01 },
  { name: 'NPC_R', height: 1.58, measured: 1.806, speed: 0.96 },
  { name: 'NPC_S', height: 1.84, measured: 1.806, speed: 1.04 },
  { name: 'NPC_T', height: 1.60, measured: 1.806, speed: 0.99 },
];
const VARIANTS = NPC_VARIANTS;
// World unit = metre (ROAD is in metres). sprites.js scales each person to look.height, so a sprite body is 1.6-1.9 m tall.
// Lanes mirror crowd.js: inner and outer pavement, walking opposite ways on each side of the route.
const IN = ROAD.padIn + 0.4, OUT = ROAD.padIn + 1.05, LANES = [[IN, 1], [OUT, -1], [-IN, -1], [-OUT, 1]];
const CADENCE = 1.2; // playback rate before the variant scale: 1.29 s clips -> ~1.1 s gait cycle (~110 steps/min)
// m/s: stance-foot speed of each clip at timeScale 1 (Root static, feet planted; tools/npc gait retarget). The walk speed is
// this times the playback rate, so planted feet do not slide; walkers stroll at ~0.7-1.0 m/s. Each walker draws one clip.
const CLIP_SPEED = { NPC_Walk: 0.62, NPC_Walk2: 0.65, NPC_Walk3: 0.75 };
const FEET = 0.02; // pavement top, as people.js
const BACK = 30, AHEAD = 90; // walkers live in a window along the route around the camera (m); the far walkers are recycled inside it
const PART_MEANS = new WeakMap(); // geometry -> mean luminance of [top, trousers, shoes, hair]

// Per-instance colour looks: the build tags every vertex with a part id (_part: 0 fixed, .25 top, .5 trousers, .75 shoes, 1 hair).
// A tinted part is repainted with the palette colour times its own vertex luminance over the part's mean, so shading, cuffs and
// hair gradients survive. Skin, eyes and fine detail stay as built. Each instance gets a cloned material (same draw calls, same program).
// street-crowd palette (reference: a "Walking People" crowd): mostly dark and neutral tops with a few warm accents,
// trousers mostly denim; repeated entries weight the draw
const TOPS = ['#2c2f36', '#3a3f47', '#1f2a3d', '#4a4f57', '#6b6f75', '#5a4636', '#7a2f2f', '#9c4a24', '#3f4a3a', '#55603f',
  '#8a8f96', '#2a3a52', '#6e5a4a', '#b8b2a6', '#c46a2c', '#4b2f3a', '#2e3b33', '#d9d4ca'];
const TROUSERS = ['#3d5878', '#4a6a8e', '#2f4562', '#5d7a9c', '#3d5878', '#262a31', '#2c3036', '#55595f', '#8a7a5e', '#4b4b3a', '#6f8aa8'];
const SHOES = ['#f0eee8', '#1b1b1d', '#2a2a2c', '#5a3a26', '#8a8a86', '#1b1b1d'];
const HAIRS = ['#14110f', '#1f1813', '#2f2018', '#3b2a1e', '#4e3626', '#6b4a30', '#8a6a44', '#b08d5c', '#7a3c22', '#8f8f8f'];
const KEEP = 0.08;
const DECOS = ['#e8e4da', '#1c1d21', '#b8452a', '#c9a24a', '#5b7fa6', '#8d9196', '#f2f0ea']; // chance that a part keeps the colour it was built with

// fabric grain without textures: value noise on the bind-pose position (metres). Trousers get a denim twill and mottling,
// tops a knit/fleece mottle with faint vertical ribs, hair fine strands; skin and the rest stay as built (k < 0).
const GRAIN = `
float gh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float gn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }
// bind pose (metres, y up, the body faces +z, arms out in an A-pose): chest ~ y 1.2-1.42, sleeves |x| > 0.21
vec3 decorate(vec3 c, vec3 p, vec4 d) {
  float ax = abs(p.x), lum = dot(c, vec3(0.2126, 0.7152, 0.0722)) / max(1e-3, dot(d.rgb, vec3(0.2126, 0.7152, 0.0722)));
  vec3 dk = d.rgb * clamp(lum, 0.6, 1.4); // the decoration keeps the cloth's shading
  float sleeve = smoothstep(0.195, 0.215, ax);
  int t = int(d.w + 0.5);
  if (t == 1) return mix(c, dk, (1.0 - sleeve) * step(1.21, p.y) * step(p.y, 1.29));
  if (t == 2) { float r = length(vec2(p.x + 0.055, p.y - 1.33)); return mix(c, dk, step(0.0, p.z) * (1.0 - sleeve) * (step(r, 0.032) - step(r, 0.022) + step(r, 0.012))); }
  if (t == 3) return mix(c, dk, sleeve);
  if (t == 4) return mix(c, dk, sleeve * step(abs(fract((p.y + p.x * 0.6) * 9.0) - 0.5), 0.07));
  return mix(c, dk, (1.0 - sleeve) * step(1.33, p.y));
}
// cloth relief (metres of height, bind pose): folds at the knees, ankles, elbows and waist, soft drape, hair strands.
// It bends the shading normal (screen-space derivatives, as three's bump map), so the folds catch the sun.
float fold(float u, float f, float ph, float c, float w) { // a band of folds around u = c: irregular spacing and depth
  float d = smoothstep(w, 0.0, abs(u - c));
  return d * sin(u * f + ph) * (0.55 + 0.9 * gn(vec3(u * f * 0.35, ph, c * 9.0)));
}
float relief(int k, vec3 p) {
  float n = gn(p * 6.0), m = gn(p * 17.0 + 3.1);
  if (k == 1) {
    float a = atan(p.z, abs(p.x) - 0.09); // angle around the leg: folds run diagonally, not as rings
    float ph = 7.0 * n + 2.2 * sin(a * 2.0 + 3.0 * m);
    return 0.0030 * fold(p.y, 85.0, ph, 0.50, 0.09) + 0.0036 * fold(p.y, 120.0, ph + 1.7, 0.16, 0.10)
      + 0.0018 * fold(p.y, 60.0, ph, 0.86, 0.07) + 0.0016 * gn(p * 13.0);
  }
  if (k == 0) {
    float ax = abs(p.x), sl = smoothstep(0.195, 0.215, ax);
    float s = dot(vec2(ax - 0.19, p.y - 1.45), vec2(0.55, -0.835)); // along the A-pose arm, from the shoulder
    float a = atan(p.z, dot(vec2(ax - 0.19, p.y - 1.45), vec2(0.835, 0.55)));
    float ph = 6.0 * n + 2.0 * sin(a * 2.0 + 3.0 * m);
    return sl * (0.0032 * fold(s, 80.0, ph, 0.30, 0.10) + 0.0024 * fold(s, 105.0, ph + 2.0, 0.55, 0.06))
      + (1.0 - sl) * (0.0022 * fold(p.y, 70.0, 6.0 * n + 2.0 * sin(atan(p.z, p.x) * 3.0), 0.99, 0.10)
      + 0.0016 * fold(p.y + 0.6 * ax, 45.0, 5.0 * m, 1.36, 0.06)) + 0.0024 * gn(p * 10.0);
  }
  if (k == 3) return 0.0007 * gn(p * vec3(320.0, 45.0, 320.0));
  return 0.0;
}
vec3 bumped(vec3 pos, vec3 nrm, float h, float fd) {
  vec3 sx = dFdx(pos), sy = dFdy(pos), r1 = cross(sy, nrm), r2 = cross(nrm, sx);
  float det = dot(sx, r1) * fd;
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * nrm - g);
}
float grain(int k, vec3 p) {
  if (k == 1) return 1.0 + 0.10 * (gn(p * 18.0) - 0.5) + 0.05 * (gn(p * 90.0) - 0.5) + 0.035 * sin((p.x + p.y + p.z * 1.7) * 900.0);
  if (k == 0) return 1.0 + 0.07 * (gn(p * 25.0) - 0.5) + 0.04 * (gn(p * 140.0) - 0.5) + 0.025 * sin(atan(p.x, p.y) * 160.0);
  if (k == 3) return 1.0 + 0.16 * (gn(p * vec3(260.0, 260.0, 30.0)) - 0.5);
  return 1.0;
}`;

// SkeletonUtils.clone gives every primitive of a person its own Skeleton copy over the same bones; one shared Skeleton is
// updated once per frame (WebGLRenderer checks skeleton.frame), so a 6-material walker pays for one set of bone matrices
export function shareSkeleton(inst) {
  let sk = null;
  inst.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (!sk) sk = o.skeleton;
    else if (o.skeleton.bones[0] === sk.bones[0]) o.skeleton = sk;
  });
  return inst;
}

export function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function partMeans(geo) {
  let m = PART_MEANS.get(geo);
  if (m) return m;
  const sum = [0, 0, 0, 0], n = [0, 0, 0, 0], col = geo.attributes.color, part = geo.attributes._part;
  for (let i = 0; i < col.count; i++) {
    const k = Math.round(part.getX(i) * 4) - 1;
    if (k < 0) continue;
    sum[k] += 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
    n[k]++;
  }
  m = new THREE.Vector4(...sum.map((v, k) => (n[k] ? v / n[k] : 1) || 1));
  PART_MEANS.set(geo, m);
  return m;
}

// give every mesh of `inst` its own tinted material; rng picks the palette entries
// textured pack (MakeHuman assets, one mesh NPC_X per person, materials mh_<type>_<asset>): per walker, the saturated cloth (tees, jackets, shirts)
// turns to another hue while the dull denim keeps its own; hair takes a natural colour by its luminance; skin and shoes stay
const TEE = ['#141416', '#f2f1ec', '#b3221d', '#e2b41e', '#2453a6', '#2f6b3a', '#e07a1f', '#c86b8a', '#5b6470', '#1d2b44',
  '#7a1f2b', '#6b4a2f', '#3aa0c8', '#8a3fa0', '#d9d2c0', '#3b3b3b']; // plain tees: black, white, red, yellow, blue, green, orange, pink...
function tintTextured(inst, rng) {
  const tee = new THREE.Color(TEE[Math.floor(rng() * TEE.length)]);
  const hue = rng() < 0.25 ? 0 : (rng() * 2 - 1) * Math.PI, gain = 0.7 + 0.35 * rng(), chroma = 0.25 + 0.6 * rng(); // muted street colours
  const hair = new THREE.Color(HAIRS[Math.floor(rng() * HAIRS.length)]);
  inst.traverse((o) => {
    if (!o.isMesh || !o.material.map) return;
    const m = o.material.name; // materials are named mh_<type>_<asset> by tools/npc/npc_mh_build.py
    const kind = /^mh_clothes_.*_plain$/.test(m) ? 'plain' : /^mh_clothes_(?!shoes)/.test(m) ? 'cloth' : /^mh_(hair|eyebrows)_/.test(m) ? 'hair' : '';
    if (!kind || (kind === 'cloth' && !hue) || (kind !== 'hair' && !o.geometry.attributes._part)) return;
    o.material = o.material.clone();
    o.material.onBeforeCompile = (sh) => {
      sh.uniforms.npcHue = { value: hue };
      sh.uniforms.npcGain = { value: gain };
      sh.uniforms.npcChroma = { value: chroma };
      sh.uniforms.npcHair = { value: hair };
      sh.uniforms.npcTee = { value: tee };
      if (kind !== 'hair') sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _part;\nvarying float vTop;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTop = step(_part, 0.3);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float npcHue;\nuniform float npcGain;\nuniform float npcChroma;\nuniform vec3 npcHair;\nuniform vec3 npcTee;' + (kind !== 'hair' ? '\nvarying float vTop;' : ''))
        .replace('#include <map_fragment>', kind === 'plain' ? `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 1e-4);
          float grey = (1.0 - smoothstep(0.05, 0.12, sat)) * smoothstep(0.35, 0.5, mx); // the build's plain grey (denim is bluer)
          diffuseColor.rgb = mix(c, npcTee * clamp(c.g / 0.6, 0.3, 1.25), max(vTop, grey)); } // plain grey tee -> colour` : kind === 'cloth' ? `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-4);
          vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c;
          float h = atan(yiq.z, yiq.y) + npcHue, ch = length(yiq.yz) * npcChroma;
          vec3 r = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * vec3(yiq.x * npcGain, ch * cos(h), ch * sin(h));
          diffuseColor.rgb = mix(c, max(r, 0.0), vTop * smoothstep(0.12, 0.30, sat)); }` : `#include <map_fragment>
        diffuseColor.rgb = npcHair * clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.30, 0.25, 2.2);`);
    };
    o.material.customProgramCacheKey = () => 'npc-' + kind;
  });
}

export function tintNpc(inst, rng) {
  if (inst.getObjectByProperty('isMesh', true)?.material.map) return tintTextured(inst, rng); // textured (MakeHuman) pack
  const pick = (list) => (rng() < KEEP ? new THREE.Vector4(0, 0, 0, 0) : (({ r, g, b }) => new THREE.Vector4(r, g, b, 1))(new THREE.Color(list[Math.floor(rng() * list.length)])));
  const tint = [pick(TOPS), pick(TROUSERS), pick(SHOES), pick(HAIRS)];
  // top decoration (street-crowd look): 0 plain, 1 chest band, 2 chest logo, 3 contrast sleeves, 4 sleeve stripes, 5 two-tone yoke
  const kind = rng() < 0.3 ? 0 : 1 + Math.floor(rng() * 5);
  const dc = new THREE.Color(DECOS[Math.floor(rng() * DECOS.length)]);
  const deco = new THREE.Vector4(dc.r, dc.g, dc.b, kind);
  inst.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes._part) return;
    const means = partMeans(o.geometry);
    o.material = o.material.clone();
    o.material.roughness = 0.92; // matte cloth: the default sheen read as plastic on light tops
    o.material.onBeforeCompile = (sh) => {
      sh.uniforms.tints = { value: tint };
      sh.uniforms.means = { value: means };
      sh.uniforms.deco = { value: deco };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _part;\nvarying float vPart;\nvarying vec3 vRest;')
        .replace('#include <color_vertex>', '#include <color_vertex>\nvPart = _part;\nvRest = position;'); // bind-pose position: the grain sticks to the cloth
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 tints[4];\nuniform vec4 deco;\nuniform vec4 means;\nvarying float vPart;\nvarying vec3 vRest;\n' + GRAIN)
        .replace('#include <color_fragment>', `#include <color_fragment>
        int k = int(floor(vPart * 4.0 + 0.5)) - 1;
        if (k >= 0 && tints[k].w > 0.5) {
          float lum = dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = tints[k].rgb * clamp(lum / means[k], 0.35, 2.2);
        }
        if (k == 0 && deco.w > 0.5) diffuseColor.rgb = decorate(diffuseColor.rgb, vRest, deco);
        diffuseColor.rgb *= grain(k, vRest);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { int kk = int(floor(vPart * 4.0 + 0.5)) - 1; if (kk >= 0) normal = bumped(-vViewPosition, normal, relief(kk, vRest) * 1.0, faceDirection); }`);
    };
  });
}

export async function createNpc3d(scene, { curve, count = NEAR ? 24 : (globalThis.innerWidth < 700 ? 16 : 32) }) { // ~7 draw calls per textured walker: fewer on phones
  const gltf = await new GLTFLoader().loadAsync(GLB);
  const clips = gltf.animations.filter((a) => a.name in CLIP_SPEED);
  // one template per variant: the shared armature plus only that variant's mesh
  const templates = VARIANTS.map((v) => {
    const t = SkeletonUtils.clone(gltf.scene);
    const drop = []; t.traverse((o) => { if (VARIANTS.some((w) => w.name !== v.name && (o.name === w.name || o.name.startsWith(w.name + '_')))) drop.push(o); }); drop.forEach((o) => o.removeFromParent()); // a person = NPC_X (+ NPC_X_<asset> in the textured pack)
    return t;
  });
  const L = curve.getLength(), rng = mulberry32(777);
  const [lo, hi] = NEAR ? [5, 30] : [-BACK, AHEAD]; // walker window, metres ahead of the camera along the route
  const wrap = (v) => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const k = i % VARIANTS.length, v = VARIANTS[k], [off, dir] = LANES[i % LANES.length];
    const inst = shareSkeleton(SkeletonUtils.clone(templates[k]));
    const mixer = new THREE.AnimationMixer(inst);
    const clip = clips[Math.floor(rng() * clips.length)];
    const ts = CADENCE * v.speed * (0.94 + 0.12 * rng()); // per-walker cadence
    const sc = (v.height / v.measured) * (0.96 + 0.08 * rng()), wide = 0.94 + 0.12 * rng(); // per-walker height ±4%, width ±6%
    const ws = CLIP_SPEED[clip.name] * ts * sc; // walk speed, m/s: the scaled stride matches it, so planted feet do not slide
    const action = mixer.clipAction(clip);
    action.timeScale = ts;
    action.time = rng() * clip.duration;
    action.play();
    inst.scale.set(sc * wide, sc, sc * wide);
    inst.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); // takes the building shadows; casting would add a shadow-pass per NPC
    tintNpc(inst, mulberry32(1000 + i)); // seeded: a refresh shows the same crowd
    scene.add(inst);
    walkers.push({ inst, mixer, off, dir, ws, x: null, jit: rng() });
  }
  // one blob per walker like the sprite crowd's (one draw call); hidden walkers get a zero scale
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), count);
  Object.assign(shadow, { name: 'npc3d-shadow', frustumCulled: false, renderOrder: 0 });
  scene.add(shadow);
  const dummy = new THREE.Object3D();
  return {
    update(f) {
      const here = Math.min(1, Math.max(0, f.progress)) * L; // the camera's place on the route (scroll progress), in metres
      const dt = REDUCED && !NEAR ? 0 : f.dt; // reduced motion: they stand still in place (frozen stride), as the sprite crowd does
      walkers.forEach((w, i) => {
        if (w.x === null) w.x = here + lo + w.jit * (hi - lo); // first frame: spread over the window
        w.x += w.dir * w.ws * dt; // absolute route position: the crowd stays put while the camera moves
        w.x = here + wrap(w.x - here); // recycle the walkers that leave the window inside it
        const inRoute = w.x >= 0 && w.x <= L; // past the route ends there is no pavement: hide, do not pile up at the ends
        w.inst.visible = inRoute;
        dummy.scale.setScalar(inRoute ? 1 : 0);
        if (inRoute) {
          w.mixer.update(dt);
          const u = w.x / L, p = curve.getPointAt(u), t = curve.getTangentAt(u);
          w.inst.position.set(p.x - t.z * w.off, FEET, p.z + t.x * w.off); // same side convention as people.js
          w.inst.rotation.y = Math.atan2(t.x * w.dir, t.z * w.dir); // the model walks along +Z; turn it onto the walking direction
          dummy.position.set(w.inst.position.x, FEET + 0.01, w.inst.position.z);
        }
        dummy.updateMatrix();
        shadow.setMatrixAt(i, dummy.matrix);
      });
      shadow.instanceMatrix.needsUpdate = true;
      if (NEAR) { // debug: pavement-level camera (eye 1.65 m) on the +side pavement, looking along the route at the walkers 5-30 m ahead; ?npcshot=k aims at walker k instead
        const a = curve.getPointAt(here / L), t = curve.getTangentAt(here / L), side = (IN + OUT) / 2;
        f.camera.position.set(a.x - t.z * side, 1.65, a.z + t.x * side);
        if (SHOT) { const w = walkers[SHOT % walkers.length]; f.camera.lookAt(w.inst.position.x, 1.0, w.inst.position.z); }
        else { const b = curve.getPointAt(Math.min(1, (here + 14) / L)); f.camera.lookAt(b.x - t.z * side, 1.0, b.z + t.x * side); }
      }
    },
    dispose() {
      for (const w of walkers) scene.remove(w.inst);
      scene.remove(shadow);
    },
  };
}
