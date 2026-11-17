import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { streetEnvironment } from './streetscape-state.js';
let noise;
function noiseTexture() {
  if (noise) return noise;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  let s = 7;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    let v = 0.85 + 0.15 * (s / 4294967296);
    const n = Math.round(v * 255);
    g.fillStyle = `rgb(${n},${n},${n})`;
    g.fillRect(x, y, 1, 1);
  }
  noise = new THREE.CanvasTexture(c);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.anisotropy = 16; // three clamps to the GPU maximum
  noise.colorSpace = THREE.SRGBColorSpace;
  return noise;
}
let turf;
function turfTexture() {
  if(turf)return turf;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#c0c4b7';ctx.fillRect(0,0,512,512);
  let seed=73;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<22000;i++){
    const x=random()*512,y=random()*512,l=2+random()*13,shade=115+Math.floor(random()*118);
    ctx.strokeStyle=`rgb(${shade},${shade+3},${shade-5})`;ctx.lineWidth=.45+random()*.65;
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+(random()-.5)*7,y-l*.5,x+(random()-.5)*9,y-l);ctx.stroke();
  }
  turf=new THREE.CanvasTexture(canvas);turf.wrapS=turf.wrapT=THREE.RepeatWrapping;
  turf.colorSpace=THREE.SRGBColorSpace;turf.anisotropy=16;return turf;
}
const EDGE_W = 0.035, EDGE_DARK = 0.02, EDGE_HI = 0.015, EDGE_MIN = 0.1, EDGE_FULL = 0.4; // metres / fractions; effect fades in for faces EDGE_MIN..EDGE_FULL m
// Triplanar, world space: 1 tile = 1 m
const GRASS = new Set([P.grass, P.patch, P.hill]); // hill: the second park-lawn green (parks.js)
export const surfaceNoiseTexture = noiseTexture;
export function blockMaterial(color, { glow = false, k = 2.2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, map: GRASS.has(color)?turfTexture():noiseTexture(), roughness: 0.9, metalness: 0 });
  const kind = GRASS.has(color) ? 1 : color === P.road ? 2 : [P.pave, P.paverWarm].includes(color) ? 3 : 0; // world-space tint noise
  mat.userData.glow = glow;
  if (kind === 2) { mat.userData.glow = true; mat.userData.glowColor = new THREE.Color('#151412'); mat.userData.glowK = 1; } // ponytail: neutral-warm flat night lift (no blue cast) on asphalt (sky.update drives emissive); no per-lamp light
  mat.userData.glowK = k; // night emissive multiplier, see sky.update
  mat.customProgramCacheKey = () => 'block-streetscape-1' + glow + kind + (kind===1?'-botanical-turf-2':''); // glow/non-glow differ by define only
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uStreetRegions = streetEnvironment.regions;
    const common = '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec3 vLP; varying vec3 vLN; varying vec3 vSc; varying float vH;';
    // Lawn value noise / fBm, world space (fragment only; the vertex stage ignores unused functions).
    const lawnNoise = kind === 1 ? `
float lawnHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lawnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f *= f * (3.0 - 2.0 * f);
  return mix(mix(lawnHash(i), lawnHash(i + vec2(1.0, 0.0)), f.x), mix(lawnHash(i + vec2(0.0, 1.0)), lawnHash(i + 1.0), f.x), f.y); }
float lawnFbm(vec2 p){ return lawnNoise(p) * .5 + lawnNoise(p * 2.03 + 11.7) * .3 + lawnNoise(p * 4.11 + 27.3) * .2; }` : '';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', common)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
mat4 bm = modelMatrix;
#ifdef USE_INSTANCING
  bm *= instanceMatrix;
#endif
vWP = (bm * vec4(position, 1.0)).xyz;
vWN = normalize(mat3(bm) * normal);
#ifdef USE_INSTANCING
  vH = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453); // per-instance, stable (local, so moving parents don't reshuffle)
#else
  vH = 0.0;
#endif
vLP = position; vLN = normal; vSc = vec3(length(bm[0].xyz), length(bm[1].xyz), length(bm[2].xyz));`);
    if (kind) sh.fragmentShader = `#define GROUND ${kind}\n` + sh.fragmentShader;
    if (glow || kind === 2) sh.uniforms.uNight = mat.userData.uNight = { value: 0 };
    if (glow || kind === 2) sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader;
    if (glow) sh.fragmentShader = '#define STAGGER\n' + sh.fragmentShader;
    if (!glow) sh.fragmentShader = '#define VOXEL_EDGE\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', common + '\nuniform vec3 uStreetRegions;' + lawnNoise)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef STAGGER
totalEmissiveRadiance *= smoothstep(0.0, 0.1, uNight - (0.1 + 0.8 * vH) + 0.05); // each instance switches on at its own night level
#endif`)
      .replace('#include <map_fragment>', `
vec3 an = abs(vWN);
vec2 tuv = an.x > an.y && an.x > an.z ? vWP.zy : (an.y > an.z ? vWP.xz : vWP.xy);
#if defined(GROUND) && GROUND == 1
// two rotated scales of the 1 m turf tile: its repeat no longer prints a grid across a lawn
diffuseColor *= mix(texture2D(map, tuv), texture2D(map, mat2(.8, -.6, .6, .8) * tuv * .43 + .37), .5) * 1.06;
#else
diffuseColor *= texture2D(map, tuv);
#endif
#ifdef GROUND
  { // low-frequency variation breaks up large lawn/asphalt surfaces
  vec2 g = vWP.xz / 6.0, i = floor(g), f = fract(g); f *= f * (3.0 - 2.0 * f);
  vec4 h = fract(sin(vec4(dot(i, vec2(12.9898, 78.233)), dot(i + vec2(1.0, 0.0), vec2(12.9898, 78.233)), dot(i + vec2(0.0, 1.0), vec2(12.9898, 78.233)), dot(i + 1.0, vec2(12.9898, 78.233)))) * 43758.5453);
  float n = mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y) - 0.5;
  #if GROUND == 1
  // Real turf, seen from the follow camera: olive (not lime), clumped hue at ~2 m, sun-dried patches at ~11 m, clover/tuft speckle that fades
  // with the pixel footprint (no shimmer), mowing stripes along the bed, and thinned, worn margins with a kerb shadow line.
  float lawnFoot = max(length(dFdx(vWP.xz)), length(dFdy(vWP.xz))), lawnFine = 1.0 - smoothstep(.02, .14, lawnFoot);
  float clump = lawnFbm(vWP.xz * .45), field = lawnFbm(vWP.xz * .09 + 7.3), speck = lawnNoise(vWP.xz * 6.3);
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.30, .59, .11))), diffuseColor.rgb, .80); // turf is far less saturated than paint
  vec3 tint = mix(vec3(.88, 1.0, .70), vec3(.70, .87, .74), smoothstep(.38, .72, clump)); // olive -> deep blue-green clumps
  tint = mix(tint, vec3(1.14, 1.04, .62), smoothstep(.52, .82, field) * .55 + smoothstep(.25, .55, n) * .25); // dry, yellowed patches
  diffuseColor.rgb *= tint * (.86 + .30 * clump) * (1.0 + (speck - .5) * .26 * lawnFine);
  float turfEdge = min((.5 - abs(vLP.x)) * vSc.x, (.5 - abs(vLP.z)) * vSc.z);
  if (vWN.y > .5) {
    float acrossBed = vSc.x >= vSc.z ? vLP.z * vSc.z : vLP.x * vSc.x; // stripes run along the bed's long side
    float stripe = smoothstep(-.35, .35, sin(acrossBed * 2.86 + (lawnNoise(vWP.xz * .5) - .5) * .9)); // ~1.1 m mower passes, slightly wavering
    diffuseColor.rgb *= mix(.91, 1.07, stripe);
  }
  float wear = 1.0 - smoothstep(.05, .55, turfEdge + (lawnNoise(vWP.xz * 2.2) - .5) * .35); // irregular, not a ruled border
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, .93, .70), wear * .55);
  diffuseColor.rgb *= 1.0 - .20 * (1.0 - smoothstep(.0, .07, turfEdge));
  #elif GROUND == 2
  diffuseColor.rgb *= (1.0 + 0.2 * n) * mix(vec3(2.9, 2.4, 1.95), vec3(1.0), uNight); // lighter warm day asphalt; albedo unchanged at night
  #else
  diffuseColor.rgb *= 1.0 + 0.10 * n;
  if (vWN.y > 0.9) { // ponytail: faint 2.4 m slab joints on upward pavement; the street block below keeps its finer pattern
    vec2 jd = min(fract(vWP.xz / 2.4), 1.0 - fract(vWP.xz / 2.4)) * 2.4;
    vec2 jaa = max(fwidth(vWP.xz), vec2(0.001));
    diffuseColor.rgb *= 1.0 - 0.07 * (1.0 - smoothstep(0.01, 0.01 + max(jaa.x, jaa.y), min(jd.x, jd.y)));
  }
  if (vWN.y > 0.9 && vWP.y < 0.4) {
    float uk = smoothstep(uStreetRegions.x - 18.0, uStreetRegions.x + 18.0, vWP.x);
    float scot = smoothstep(uStreetRegions.y - 20.0, uStreetRegions.y + 20.0, vWP.x)
      * (1.0 - smoothstep(uStreetRegions.z - 20.0, uStreetRegions.z + 20.0, vWP.x));
    vec2 size = mix(vec2(0.7), vec2(0.9, 0.6), uk); size.x = mix(size.x, 1.2, scot);
    vec2 metric = vLP.xz * vSc.xz;
    vec2 tile = metric / size;
    tile.x += mod(floor(tile.y), 2.0) * 0.5 * uk;
    vec2 joint = min(fract(tile), 1.0 - fract(tile)) * size;
    vec2 aa = max(fwidth(metric), vec2(0.001));
    float seam = 1.0 - smoothstep(0.009, 0.009 + max(aa.x, aa.y), min(joint.x, joint.y));
    float detail = 1.0 - smoothstep(65.0, 145.0, distance(cameraPosition, vWP));
    float slab = fract(sin(dot(floor(tile), vec2(12.9898,78.233))) * 43758.5453);
    float edge = min((0.5 - abs(vLP.x)) * vSc.x, (0.5 - abs(vLP.z)) * vSc.z);
    float bounded = 1.0 - step(80.0, max(vSc.x, vSc.z));
    float band = (1.0 - smoothstep(0.16, 0.22, edge)) * bounded;
    float dirt = (1.0 - smoothstep(0.0, 0.13, edge)) * bounded;
    float mosaic = mod(floor(metric.x / 0.24) + floor(metric.y / 0.24), 2.0);
    vec3 regionTint = mix(vec3(1.02, 1.0, 0.97), vec3(0.97, 0.99, 1.03), uk);
    regionTint = mix(regionTint, vec3(0.92, 0.96, 1.0), scot);
    diffuseColor.rgb *= regionTint * (1.0 + detail * ((slab - 0.5) * 0.035 - seam * 0.12
      - band * (0.035 + (1.0 - uk) * mosaic * 0.08) - dirt * 0.07));
  }
  #endif
}
#endif
#ifdef VOXEL_EDGE
{ // distance (m) to nearest edge of this face of the unit box; ln marks the face axis, pushed out of the min
  vec3 ln = step(0.5, abs(vLN)), sc = vSc;
  vec3 d = vec3(0.5 - abs(vLP.x), min(vLP.y, 1.0 - vLP.y), 0.5 - abs(vLP.z)) * sc + ln * 99.0;
  float e = min(min(d.x, d.y), d.z), fs = min(min(sc.x + ln.x * 99.0, sc.y + ln.y * 99.0), sc.z + ln.z * 99.0);
  float t = (1.0 - smoothstep(0.0, ${EDGE_W.toFixed(3)}, e)) * smoothstep(${EDGE_MIN.toFixed(2)}, ${EDGE_FULL.toFixed(2)}, fs);
  diffuseColor.rgb *= vLN.y > 0.5 ? 1.0 + ${EDGE_HI.toFixed(3)} * t : 1.0 - ${EDGE_DARK.toFixed(3)} * t;
}
#endif`);
    if(kind===1)sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float turfFootprint=max(length(dFdx(vWP.xz)),length(dFdy(vWP.xz)));
      float turfDetail=1.0-smoothstep(.012,.10,turfFootprint);
      float turfHeight=texture2D(map,vWP.xz).g*.014;
      vec3 turfDx=dFdx(-vViewPosition),turfDy=dFdy(-vViewPosition);
      vec3 turfR1=cross(turfDy,normal),turfR2=cross(normal,turfDx);
      float turfDet=dot(turfDx,turfR1);
      normal=normalize(max(abs(turfDet),1e-8)*normal-sign(turfDet)*(dFdx(turfHeight)*turfR1+dFdy(turfHeight)*turfR2)*turfDetail);
    `);
  };
  return mat;
}
