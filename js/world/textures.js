import * as THREE from 'three';
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
    if (x === 0 || y === 0) v *= 0.93;
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
const EDGE_W = 0.08, EDGE_DARK = 0.12, EDGE_HI = 0.05, EDGE_MIN = 0.1, EDGE_FULL = 0.4; // metres / fractions; effect fades in for faces EDGE_MIN..EDGE_FULL m
// Triplanar, world space: 1 tile = 1 m
export function blockMaterial(color, { glow = false, k = 2.2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, map: noiseTexture(), roughness: 0.9, metalness: 0 });
  mat.userData.glow = glow;
  mat.userData.glowK = k; // night emissive multiplier, see sky.update
  mat.customProgramCacheKey = () => 'block' + glow; // glow/non-glow differ by define only
  mat.onBeforeCompile = (sh) => {
    const common = '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec3 vLP; varying vec3 vLN; varying vec3 vSc;';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', common)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
mat4 bm = modelMatrix;
#ifdef USE_INSTANCING
  bm *= instanceMatrix;
#endif
vWP = (bm * vec4(position, 1.0)).xyz;
vWN = normalize(mat3(bm) * normal);
vLP = position; vLN = normal; vSc = vec3(length(bm[0].xyz), length(bm[1].xyz), length(bm[2].xyz));`);
    if (!glow) sh.fragmentShader = '#define VOXEL_EDGE\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', common)
      .replace('#include <map_fragment>', `
vec3 an = abs(vWN);
vec2 tuv = an.x > an.y && an.x > an.z ? vWP.zy : (an.y > an.z ? vWP.xz : vWP.xy);
diffuseColor *= texture2D(map, tuv);
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
