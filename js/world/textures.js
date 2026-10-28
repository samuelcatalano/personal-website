import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
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
  noise.anisotropy = 4;
  noise.colorSpace = THREE.SRGBColorSpace;
  return noise;
}
const EDGE_W = 0.035, EDGE_DARK = 0.02, EDGE_HI = 0.015, EDGE_MIN = 0.1, EDGE_FULL = 0.4; // metres / fractions; effect fades in for faces EDGE_MIN..EDGE_FULL m
// Triplanar, world space: 1 tile = 1 m
const GRASS = new Set([P.grass, P.patch]);
export const surfaceNoiseTexture = noiseTexture;
export function blockMaterial(color, { glow = false, k = 2.2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, map: noiseTexture(), roughness: 0.9, metalness: 0 });
  const kind = GRASS.has(color) ? 1 : color === P.road ? 2 : 0; // 1 lawn, 2 asphalt: world-space tint noise
  mat.userData.glow = glow;
  if (kind === 2) { mat.userData.glow = true; mat.userData.glowColor = new THREE.Color('#1b2028'); mat.userData.glowK = 1; } // ponytail: flat moonlit lift on asphalt (sky.update drives emissive); no per-lamp light
  mat.userData.glowK = k; // night emissive multiplier, see sky.update
  mat.customProgramCacheKey = () => 'block' + glow + kind; // glow/non-glow differ by define only
  mat.onBeforeCompile = (sh) => {
    const common = '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec3 vLP; varying vec3 vLN; varying vec3 vSc; varying float vH;';
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
      .replace('#include <common>', common)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef STAGGER
totalEmissiveRadiance *= smoothstep(0.0, 0.1, uNight - (0.1 + 0.8 * vH) + 0.05); // each instance switches on at its own night level
#endif`)
      .replace('#include <map_fragment>', `
vec3 an = abs(vWN);
vec2 tuv = an.x > an.y && an.x > an.z ? vWP.zy : (an.y > an.z ? vWP.xz : vWP.xy);
diffuseColor *= texture2D(map, tuv);
#ifdef GROUND
  { // low-frequency variation breaks up large lawn/asphalt surfaces
  vec2 g = vWP.xz / 6.0, i = floor(g), f = fract(g); f *= f * (3.0 - 2.0 * f);
  vec4 h = fract(sin(vec4(dot(i, vec2(12.9898, 78.233)), dot(i + vec2(1.0, 0.0), vec2(12.9898, 78.233)), dot(i + vec2(0.0, 1.0), vec2(12.9898, 78.233)), dot(i + 1.0, vec2(12.9898, 78.233)))) * 43758.5453);
  float n = mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y) - 0.5;
  #if GROUND == 1
  diffuseColor.rgb *= 1.0 + 0.12 * n + vec3(0.1, 0.0, -0.1) * n;
  #else
  diffuseColor.rgb *= (1.0 + 0.2 * n) * mix(vec3(2.9, 2.4, 1.95), vec3(1.0), uNight); // lighter warm day asphalt; albedo unchanged at night
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
  };
  return mat;
}
