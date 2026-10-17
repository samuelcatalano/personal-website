import * as THREE from 'three';
import { blockMaterial } from './textures.js';
import { buildMeshes } from './voxel.js';
import { cloth } from './flags.js';
// Ambient motion, shader-driven by one shared time uniform (scene clock => static under reduced motion).
export function buildMotion() {
  const uT = { value: 0 }, group = new THREE.Group();
  // flag cloth: own meshes, sine wave in z growing with distance from the pole (aPole = pole x)
  for (const color of new Set(cloth.map((b) => b.color))) {
    const boxes = cloth.filter((b) => b.color === color), g = buildMeshes(boxes), mesh = g.children[0], base = mesh.material, mat = base.clone();
    mesh.geometry = mesh.geometry.clone();
    mesh.geometry.setAttribute('aPole', new THREE.InstancedBufferAttribute(Float32Array.from(boxes, (b) => b.px), 1));
    mat.customProgramCacheKey = () => 'flag';
    mat.onBeforeCompile = (sh) => {
      base.onBeforeCompile(sh); sh.uniforms.uT = uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; attribute float aPole;')
        .replace('#include <project_vertex>', `vec4 mp = instanceMatrix * vec4(transformed, 1.0);
mp.z += sin(mp.x * 2.2 - uT * 4.0) * 0.16 * (mp.x - aPole); mp.y += sin(mp.x * 1.3 - uT * 3.0) * 0.02 * (mp.x - aPole);
vec4 mvPosition = modelViewMatrix * mp; gl_Position = projectionMatrix * mvPosition;`);
    };
    mesh.material = mat; mesh.castShadow = false; mesh.frustumCulled = false; // ponytail: waving is outside the bounds; flags are few
    group.add(mesh);
  }
  return { group, uT };
}
