import * as THREE from 'three';

let noise;
function noiseTexture() {
  if (noise) return noise;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  let s = 7; // tiny LCG: same texture every load
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    let v = 0.85 + 0.15 * (s / 4294967296);
    if (x === 0 || y === 0) v *= 0.93; // darker edge so blocks read as blocks
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

// Triplanar in world space (instanceMatrix included): 1 tile = 1 world unit whatever the box scale.
export function blockMaterial(color, { glow = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, map: noiseTexture(), roughness: 0.9, metalness: 0 });
  mat.userData.glow = glow;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        mat4 bm = modelMatrix;
        #ifdef USE_INSTANCING
          bm *= instanceMatrix;
        #endif
        vWP = (bm * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(bm) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <map_fragment>', `
        vec3 an = abs(vWN);
        vec2 tuv = an.x > an.y && an.x > an.z ? vWP.zy : (an.y > an.z ? vWP.xz : vWP.xy);
        diffuseColor *= texture2D(map, tuv);`);
  };
  return mat;
}
