// One reference archetype. Every instance shares geometry/maps; each owns one skeleton and mixer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const PARTS = ['Body', 'Head', 'ReferenceEyes'];
const DISTANCES = [14, 32, 100];
export function referenceLod(distance, previous = 0) {
  let level = previous;
  while (level < 3 && distance > DISTANCES[level] * 1.1) level++;
  while (level > 0 && distance < DISTANCES[level - 1] * .9) level--;
  return level;
}

function disposeMaterials(root) {
  const materials = new Set(), textures = new Set();
  root.traverse(o => {
    for (const material of [o.material].flat().filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  materials.forEach(m => m.dispose());
  textures.forEach(t => { t.dispose(); t.source?.data?.close?.(); });
}

export async function loadReferenceNpcAssets({ levels = [0] } = {}) {
  const loader = new GLTFLoader();
  const assets = [];
  try {
    // Keep completed loads available for cleanup if another LOD fails.
    const results = await Promise.allSettled(levels.map(async level => {
      const gltf = await loader.loadAsync(new URL(`../../assets/npc/reference/npc_lod${level}.glb`, import.meta.url).href);
      assets[level] = gltf;
      return gltf;
    }));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    const meshes = assets.map(asset => PARTS.map(name => asset.scene.getObjectByName(name)));
    if (meshes.some(level => level.some(mesh => !mesh?.isSkinnedMesh))) throw new Error('Reference NPC has missing skinned parts');
    const rig = assets[0].scene.getObjectByName('ReferenceRig');
    const stride = Number(rig?.userData.walk_speed_mps), height = Number(rig?.userData.height_m);
    if (!(stride > .1 && stride < 2 && height > 1 && height < 2.5)) throw new Error('Reference NPC has invalid calibration');
    const skeleton = meshes[0][0].skeleton;
    for (const level of meshes) for (const mesh of level) {
      if (mesh.skeleton.bones.length !== skeleton.bones.length || mesh.skeleton.bones.some((bone, i) => bone.name !== skeleton.bones[i].name)) {
        throw new Error('Reference NPC LOD joint order differs');
      }
      if (mesh.skeleton.boneInverses.some((matrix, i) => matrix.elements.some((v, j) => Math.abs(v - skeleton.boneInverses[i].elements[j]) > 1e-5))) {
        throw new Error('Reference NPC LOD bind pose differs');
      }
    }
    const idle = assets[0].animations.find(clip => clip.name === 'Idle');
    const walk = assets[0].animations.find(clip => clip.name === 'Walk');
    const wave = assets[0].animations.find(clip => clip.name === 'Wave');
    if (!idle || !walk) throw new Error('Reference NPC needs Idle and Walk clips');
    const geometries = meshes.map(level => level.map(mesh => mesh.geometry));
    // Lower LODs retain the same UV atlases; use LOD0's three materials in every level.
    assets.slice(1).forEach(asset => disposeMaterials(asset.scene));
    let disposed = false;
    return {
      stride, height,
      create() {
        if (disposed) throw new Error('Reference NPC assets were disposed');
        const root = SkeletonUtils.clone(assets[0].scene);
        const parts = PARTS.map(name => root.getObjectByName(name));
        const shared = parts[0].skeleton;
        parts.forEach(mesh => { mesh.skeleton = shared; mesh.frustumCulled = false; mesh.receiveShadow = true; });
        const mixer = new THREE.AnimationMixer(root);
        const action = mixer.clipAction(walk).play(), idleAction = mixer.clipAction(idle);
        mixer.setTime(0);
        let level = -1, moving = true;
        const instance = {
          root, mixer, action, stride, height,
          setDistance(distance) {
            const next = referenceLod(distance, Math.max(0, level));
            root.visible = next < 3;
            if (next !== level && next < geometries.length) parts.forEach((mesh, i) => { mesh.geometry = geometries[next][i]; });
            level = next;
            return level;
          },
          setSpeed(speed) {
            const next = speed > .025;
            if (next !== moving) {
              const from = moving ? action : idleAction, to = next ? action : idleAction;
              to.reset().play();
              from.crossFadeTo(to, .25, false);
              moving = next;
            }
            action.timeScale = Math.min(1.76, Math.max(0, speed / stride));
          },
          wave() {
            if (!wave) return;
            mixer.clipAction(wave).reset().play();
            (moving ? action : idleAction).crossFadeTo(mixer.clipAction(wave), .25, false);
          },
          dispose() {
            mixer.stopAllAction();
            mixer.uncacheRoot(root);
            shared.dispose();
            root.removeFromParent();
          },
          get level() { return level; },
        };
        instance.setDistance(0);
        return instance;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        new Set(geometries.flat()).forEach(geometry => geometry.dispose());
        disposeMaterials(assets[0].scene);
      },
    };
  } catch (error) {
    const geometries = new Set();
    for (const asset of assets.filter(Boolean)) {
      asset.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
      disposeMaterials(asset.scene);
    }
    geometries.forEach(geometry => geometry.dispose());
    throw error;
  }
}
