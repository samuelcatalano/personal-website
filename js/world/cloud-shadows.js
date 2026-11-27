import * as THREE from 'three';
import { buildCloudNoise } from './cloud-shadow-field.js';

const SIZE = 128;
const CLOUD_GLSL = `
  float cloudLuma = texture2D(uCloudMap, vCloudWorld.xz * 0.0038 + uCloudShift).r;
  float cloudEdge = 1.0 - uCloudCover * 0.70;
  float cloudMask = smoothstep(cloudEdge - 0.15, cloudEdge + 0.15, cloudLuma);
  float cloudFade = smoothstep(0.16, 0.76, uCloudCover) * (1.0 - uCloudNight);
  diffuseColor.rgb *= 1.0 - cloudMask * cloudFade * 0.18;`;

export function createCloudShadows(scene) {
  const texture = new THREE.DataTexture(buildCloudNoise(SIZE), SIZE, SIZE, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  const uniforms = {
    uCloudMap: { value: texture }, uCloudShift: { value: new THREE.Vector2() },
    uCloudCover: { value: 0 }, uCloudNight: { value: 0 },
  };
  const materials = new Set();
  scene.traverse(object => {
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material?.isMeshStandardMaterial || materials.has(material)) continue;
      materials.add(material);
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey;
      material.onBeforeCompile = function(shader, renderer) {
        compile.call(this, shader, renderer);
        if (!shader.vertexShader.includes('#include <worldpos_vertex>') || !shader.fragmentShader.includes('#include <color_fragment>')) return;
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorld;');
        shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCloudWorld = worldPosition.xyz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uCloudMap;\nuniform vec2 uCloudShift;\nuniform float uCloudCover;\nuniform float uCloudNight;\nvarying vec3 vCloudWorld;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${CLOUD_GLSL}`);
      };
      material.customProgramCacheKey = function() { return `${cacheKey.call(this)}|cloud-shadows-v1`; };
      material.needsUpdate = true;
    }
  });
  return {
    update(time, night, cover, wind = 0) {
      const speed = THREE.MathUtils.clamp(wind ?? 0, 0, 1.5);
      uniforms.uCloudShift.value.set(time * (0.0015 + speed * 0.0025), -time * (0.0007 + speed * 0.0012));
      uniforms.uCloudCover.value = THREE.MathUtils.clamp(cover ?? 0, 0, 1);
      uniforms.uCloudNight.value = THREE.MathUtils.clamp(night ?? 0, 0, 1);
    },
    dispose() { texture.dispose(); },
    materialCount: materials.size,
  };
}
