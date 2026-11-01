// POC: walking NPCs (one GLB, one shared rig, three walk clips) on the pavement beside the bus route.
// Opt-in with ?npc3d=1. Debug: ?npcnear=1 puts 24 of them 5-30 m ahead of the scroll point under a pavement-level camera (?npcshot=k aims at walker k). The sprite crowd, layout and scene stay as they are.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ROAD } from './layout.js';
import { crowdPlan } from './crowd.js'; // read only: the sprite crowd's people and paths

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
  // children (7-10 y), one in ~7: the pack's second armature (ChildRig) and its _C clips; a child's cadence is higher
  { name: 'NPC_KA', rig: 'child', height: 1.30, measured: 1.245, speed: 1.20 },
  { name: 'NPC_G', height: 1.66, measured: 1.806, speed: 1.06 },
  { name: 'NPC_H', height: 1.72, measured: 1.806, speed: 0.94 },
  { name: 'NPC_I', height: 1.74, measured: 1.806, speed: 1.02 },
  { name: 'NPC_J', height: 1.82, measured: 1.806, speed: 0.97 },
  { name: 'NPC_K', height: 1.68, measured: 1.806, speed: 1.03 },
  { name: 'NPC_L', height: 1.64, measured: 1.806, speed: 0.99 },
  { name: 'NPC_KB', rig: 'child', height: 1.38, measured: 1.245, speed: 1.25 },
  { name: 'NPC_O', height: 1.73, measured: 1.806, speed: 0.95 },
  { name: 'NPC_P', height: 1.70, measured: 1.806, speed: 1.05 },
  { name: 'NPC_Q', height: 1.90, measured: 1.806, speed: 1.01 },
  { name: 'NPC_R', height: 1.58, measured: 1.806, speed: 0.96 },
  { name: 'NPC_S', height: 1.84, measured: 1.806, speed: 1.04 },
  { name: 'NPC_T', height: 1.60, measured: 1.806, speed: 0.99 },
  { name: 'NPC_KC', rig: 'child', height: 1.22, measured: 1.245, speed: 1.15 },
];
const VARIANTS = NPC_VARIANTS;
// World unit = metre (ROAD is in metres). sprites.js scales each person to look.height, so a sprite body is 1.6-1.9 m tall.
// Lanes mirror crowd.js: inner and outer pavement, walking opposite ways on each side of the route.
const IN = ROAD.padIn + 0.4, OUT = ROAD.padIn + 1.05, LANES = [[IN, 1], [OUT, -1], [-IN, -1], [-OUT, 1]];
const CADENCE = 1.2; // playback rate before the variant scale: 1.29 s clips -> ~1.1 s gait cycle (~110 steps/min)
// m/s: stance-foot speed of each clip at timeScale 1 (Root static, feet planted; tools/npc gait retarget). The walk speed is
// this times the playback rate, so planted feet do not slide; walkers stroll at ~0.7-1.0 m/s. Each walker draws one clip.
const CLIP_SPEED = { NPC_Walk: 0.62, NPC_Walk2: 0.65, NPC_Walk3: 0.75, NPC_Walk_C: 0.417, NPC_Walk2_C: 0.438, NPC_Walk3_C: 0.433 }; // _C: the child rig (at its measured 1.245 m)
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

// a person = NPC_X (+ NPC_X_<asset> in the textured pack) under its own armature: the other rig and the other people are dropped
export function personTemplate(root, v, variants = VARIANTS) {
  const t = SkeletonUtils.clone(root), drop = [];
  const own = t.children.find((c) => c.getObjectByName(v.name));
  t.children.forEach((c) => { if (c !== own && c.isObject3D && c.children.some((k) => k.isBone)) drop.push(c); });
  t.traverse((o) => { if (variants.some((w) => w.name !== v.name && (o.name === w.name || o.name.startsWith(w.name + '_')))) drop.push(o); });
  drop.forEach((o) => o.removeFromParent());
  return t;
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

// With the 3D walkers on, the 2D sprite crowd (people.js: InstancedMeshes 'crowd' and 'crowd-shadow') is hidden entirely, so
// only one style of person shows. people.js keeps updating them (cheap); they are just not drawn.
function hideSprites(scene) {
  for (const name of ['crowd', 'crowd-shadow']) {
    const o = scene.getObjectByName(name);
    if (o) o.visible = false;
  }
}

// The 3D walkers follow the sprite crowd's own simulation (people.js, paths from crowd.js): the same 1000 people on the same lanes,
// loops and plazas at the same speeds; a pool of 3D bodies is given to the people nearest the camera (ahead weighs more than
// behind), so the city stays as populated as before and nobody pops in or out near the camera. The sprites are not drawn.
const FEMALE = new Set(['NPC_F', 'NPC_G', 'NPC_H', 'NPC_K', 'NPC_L', 'NPC_P', 'NPC_R', 'NPC_T', 'NPC_KA', 'NPC_KC']);
const CASTERS = 16; // walkers nearest the camera that cast sun shadows (desktop)
const PAVE_TOP = 0.17; // pavement slab top (city.js: bottom 0.07, 0.10 thick); the crowd's lanes run on it
export async function createNpc3d(scene, { curve, pts, stops, count = globalThis.innerWidth < 700 ? 28 : 56 }) { // ~7 draw calls per walker
  hideSprites(scene);
  const crowd = scene.getObjectByName('crowd');
  const plan = crowdPlan(stops, pts, 1017); // people.js seed: index i here is sprite i there
  const gltf = await new GLTFLoader().loadAsync(GLB);
  const clips = gltf.animations.filter((a) => a.name in CLIP_SPEED);
  // hair and brow cards: alpha-tested, not blended (blending sorted the cards against each other and against the sky/glass,
  // so strands flickered and showed the head through the hair); opaque cards also write depth and take shadows correctly
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) if (m.transparent && m.map) Object.assign(m, { transparent: false, alphaTest: 0.45, depthWrite: true });
  });
  const templates = VARIANTS.map((v) => personTemplate(gltf.scene, v));
  const rng = mulberry32(777);
  const kindOf = (v) => (v.rig === 'child' ? 'kid' : FEMALE.has(v.name) ? 'woman' : 'man');
  // the pool: as many of each kind as the crowd has (70% adults, half women; kids 30%: fewer here, our kids are 1.2-1.4 m)
  const kinds = { man: [], woman: [], kid: [] };
  VARIANTS.forEach((v, k) => kinds[kindOf(v)].push(k));
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const kind = i % 8 === 7 ? 'kid' : i % 2 ? 'woman' : 'man', list = kinds[kind], k = list[Math.floor(i / 2) % list.length], v = VARIANTS[k];
    const inst = shareSkeleton(SkeletonUtils.clone(templates[k]));
    const mixer = new THREE.AnimationMixer(inst);
    const mine = clips.filter((c) => c.name.endsWith('_C') === (v.rig === 'child')), clip = mine[Math.floor(rng() * mine.length)];
    const action = mixer.clipAction(clip);
    action.time = rng() * clip.duration;
    action.play();
    const sc = (v.height / v.measured) * (0.96 + 0.08 * rng()), wide = 0.94 + 0.12 * rng();
    inst.scale.set(sc * wide, sc, sc * wide);
    inst.visible = false;
    inst.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.frustumCulled = false; } });
    tintNpc(inst, mulberry32(1000 + i));
    scene.add(inst);
    walkers.push({ inst, mixer, action, kind, stride: CLIP_SPEED[clip.name] * sc, who: -1, x: 0, y: 0, z: 0, yaw: 0 });
  }
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), count);
  Object.assign(shadow, { name: 'npc3d-shadow', frustumCulled: false, renderOrder: 0 });
  scene.add(shadow);
  const dummy = new THREE.Object3D(), fwd = new THREE.Vector3();
  const A = crowd.instanceMatrix.array, I = crowd.geometry.attributes.aInfo.array, N = plan.length;
  const groundOf = (i) => plan[i].path.y ?? (plan[i].path.type === 'lane' ? PAVE_TOP : FEET);
  const owner = new Int32Array(N).fill(-1), score = new Float32Array(N), order = Array.from({ length: N }, (_, i) => i);
  let tick = 0;
  const assign = (cam) => { // nearest people (ahead of the camera counts 3x closer) get a body; a kept walker only leaves past 1.4x the cut
    cam.getWorldDirection(fwd);
    for (let i = 0; i < N; i++) {
      const a = i * 16;
      if (A[a] === 0) { score[i] = Infinity; continue; } // the sprite sim hides people far from the camera
      const dx = A[a + 12] - cam.position.x, dz = A[a + 14] - cam.position.z, d = Math.hypot(dx, dz);
      score[i] = d * (dx * fwd.x + dz * fwd.z < 0 ? 3 : 1);
    }
    order.sort((p, q) => score[p] - score[q]);
    const cut = score[order[Math.min(count, N) - 1]] * 1.4;
    for (const w of walkers) if (w.who >= 0 && !(score[w.who] <= cut)) { owner[w.who] = -1; w.who = -1; w.inst.visible = false; }
    // the nearest CASTERS walkers cast real sun shadows (the city's shadow map); the rest keep only the contact blob
    let c = 0;
    for (let r = 0; r < N && c < CASTERS; r++) { const n = owner[order[r]]; if (n >= 0) { walkers[n].cast = true; c++; } }
    for (let r = 0; r < Math.min(count, N); r++) {
      const i = order[r];
      if (owner[i] >= 0 || score[i] === Infinity) continue;
      const lk = plan[i].look.kind, want = lk === 'girl' || lk === 'boy' ? 'kid' : lk;
      const free = walkers.find((w) => w.who < 0 && w.kind === want) || walkers.find((w) => w.who < 0 && (w.kind === 'kid') === (want === 'kid'));
      if (!free) continue;
      free.who = i; owner[i] = walkers.indexOf(free);
      free.x = A[i * 16 + 12]; free.z = A[i * 16 + 14]; free.y = groundOf(i); free.yaw = Math.atan2(I[4 * i + 1], I[4 * i + 2]);
      free.inst.visible = true;
    }
    for (const w of walkers) { const on = !!w.cast && w.who >= 0; if (on !== w.casting) { w.casting = on; w.inst.traverse((o) => { if (o.isMesh) o.castShadow = on; }); } w.cast = false; }
  };
  return {
    update(f) {
      const dt = REDUCED ? 0 : f.dt;
      if (tick++ % 12 === 0) assign(f.camera);
      walkers.forEach((w, n) => {
        if (w.who < 0) { dummy.scale.setScalar(0); dummy.updateMatrix(); shadow.setMatrixAt(n, dummy.matrix); return; }
        const i = w.who, a = i * 16, fx = I[4 * i + 1], fz = I[4 * i + 2], sp = plan[i].look.speed;
        // the sprite sim slides each sprite back and forth a few cm per frame (planted-foot lock); the body walks at the person's
        // speed along its facing and is pulled gently onto the sprite's place, so it neither jitters nor drifts off its path
        w.x += fx * sp * dt; w.z += fz * sp * dt;
        const k = Math.min(1, dt * 2.5);
        w.x += (A[a + 12] - w.x) * k; w.z += (A[a + 14] - w.z) * k;
        if (Math.hypot(A[a + 12] - w.x, A[a + 14] - w.z) > 2) { w.x = A[a + 12]; w.z = A[a + 14]; } // a path jump (lane ends)
        let dy = Math.atan2(fx, fz) - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        w.yaw += dy * Math.min(1, dt * 8); // turns at path corners take ~0.3 s
        w.y = groundOf(i);
        w.action.timeScale = Math.min(1.75, sp / w.stride); // stride matches speed (no foot slide) up to a brisk 2.6 steps/s
        w.mixer.update(dt);
        w.inst.position.set(w.x, w.y, w.z);
        w.inst.rotation.y = w.yaw;
        dummy.position.set(w.x, w.y + 0.01, w.z); dummy.scale.setScalar(1); dummy.updateMatrix();
        shadow.setMatrixAt(n, dummy.matrix);
      });
      shadow.instanceMatrix.needsUpdate = true;
      if (NEAR) { // debug: eye-level camera 6 m behind walker ?npcshot=k (default 0), looking past it
        const w = walkers[SHOT % walkers.length];
        if (w.who >= 0) { f.camera.position.set(w.x - Math.sin(w.yaw) * 6 + Math.cos(w.yaw) * 1.5, w.y + 1.6, w.z - Math.cos(w.yaw) * 6 - Math.sin(w.yaw) * 1.5); f.camera.lookAt(w.x, w.y + 1.0, w.z); }
      }
    },
    dispose() {
      for (const w of walkers) scene.remove(w.inst);
      scene.remove(shadow);
    },
  };
}
