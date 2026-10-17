import * as THREE from 'three';
import { blockMaterial } from './textures.js';
import { buildMeshes } from './voxel.js';
import { cloth } from './flags.js';
import { chimneys } from './houses.js';
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
  // chimney smoke: 4 cubes per chimney rise ~3 m, grow and fade, looped by per-instance phase
  const n = Math.min(chimneys.length / 3, 300) | 0;
  if (n) {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5), ph = new Float32Array(n * 4), m = new THREE.Matrix4();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT }, transparent: true, depthWrite: false,
      vertexShader: `uniform float uT; attribute float aPh; varying float vA;
void main(){ float f = fract(uT * 0.25 + aPh); vec3 c = instanceMatrix[3].xyz;
  c += vec3(f * 1.2 + sin(f * 6.0 + aPh * 20.0) * 0.2, f * 3.0, 0.0);
  vA = (1.0 - f) * smoothstep(0.0, 0.1, f) * 0.7;
  gl_Position = projectionMatrix * viewMatrix * vec4(c + position * (0.9 + f * 2.6), 1.0); }`,
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.9), vA); }',
    });
    const mesh = new THREE.InstancedMesh(geo, mat, n * 4);
    for (let i = 0; i < n * 4; i++) {
      const c = i >> 2; ph[i] = (i & 3) / 4 + ((c * 0.37) % 1) * 0.2;
      mesh.setMatrixAt(i, m.makeTranslation(chimneys[c * 3], chimneys[c * 3 + 1], chimneys[c * 3 + 2]));
    }
    geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    mesh.frustumCulled = false; mesh.renderOrder = 5; // ponytail: no culling; <=300 chimneys
    group.add(mesh);
  }
  return { group, uT };
}
