import * as THREE from 'three';

const ATLAS_URL = new URL('../../assets/trees/park-atlas.png', import.meta.url);
const SPRITES = [[74, 647, 570, 585], [746, 646, 422, 586]];

function useAtlasRect(material, key) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = aRect.xy + vMapUv * aRect.zw;');
  };
  material.customProgramCacheKey = () => key;
}

export async function createTrees(placements) {
  const texture = await new THREE.TextureLoader().loadAsync(ATLAS_URL.href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.35, side: THREE.DoubleSide });
  const depthMaterial = new THREE.MeshDepthMaterial({ map: texture, alphaTest: 0.35, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  useAtlasRect(material, 'tree-atlas-lambert-v1');
  useAtlasRect(depthMaterial, 'tree-atlas-depth-v1');

  const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const rects = new THREE.InstancedBufferAttribute(new Float32Array(placements.length * 4), 4);
  geometry.setAttribute('aRect', rects);
  const trees = new THREE.InstancedMesh(geometry, material, placements.length);
  trees.name = 'trees';
  trees.castShadow = trees.receiveShadow = true;
  trees.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trees.customDepthMaterial = depthMaterial;
  trees.frustumCulled = false;

  const transforms = placements.map(({ x, z, h, crown, base = 0.1 }, i) => {
    const [sx, sy, sw, sh] = SPRITES[i % SPRITES.length];
    rects.setXYZW(i, sx / texture.image.width, 1 - (sy + sh) / texture.image.height, sw / texture.image.width, sh / texture.image.height);
    const variation = 0.78 + (Math.sin(i * 12.9898 + 78.233) * 0.5 + 0.5) * 0.22;
    const visibleHeight = Math.min(4.2, h + 1.1) * variation;
    const height = visibleHeight * sh / (sh - 16);
    return { x, z, y: base + 0.02 - height * 8 / sh, width: crown, height };
  });

  const object = new THREE.Object3D();
  const setTree = (i, yaw = 0) => {
    const { x, z, y, width, height } = transforms[i];
    object.position.set(x, y, z);
    object.rotation.set(0, yaw, 0);
    object.scale.set(width, height, 1);
    object.updateMatrix();
    trees.setMatrixAt(i, object.matrix);
  };
  transforms.forEach((_, i) => setTree(i));
  rects.needsUpdate = true;
  trees.instanceMatrix.needsUpdate = true;
  trees.userData.update = (camera) => {
    transforms.forEach(({ x, z }, i) => setTree(i, Math.atan2(camera.position.x - x, camera.position.z - z)));
    trees.instanceMatrix.needsUpdate = true;
  };
  return trees;
}
