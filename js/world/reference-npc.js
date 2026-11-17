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

// One albedo atlas per mesh: dark texels are hair or clothes, light ones skin. Rest-pose height splits the
// body's blacks into jeans and T-shirt (hem at ~0.83 m). Blacks get lifted and tinted in the albedo, no emissive:
// at ~75 px tall, hair, T-shirt and jeans only read as separate shapes if their values differ.
const LOOK = {
  Body: { skin: .7, lower: [.74, 1.25, [.93, .98, 1.12]], upper: [.93, .8, [1, 1, 1]], hem: .83 }, // washed denim, deep cotton
  Head: { skin: .7, lower: [.52, .75, [1.12, 1, .9]], upper: [.52, .75, [1.12, 1, .9]], hem: 0 }, // warm dark-brown hair glints
};
const MIP_BIAS = -.5; // The figure is minified ~8x; a sharper mip keeps folds and the logo without visible shimmer.
function tuneMaterial(mesh) {
  const look = LOOK[mesh.name];
  if (!look || new URLSearchParams(globalThis.location?.search).get('npclook') === '0') return; // ?npclook=0: raw GLB look for A/B
  const f = value => value.toFixed(3), v = ([r, g, b]) => `vec3(${f(r)}, ${f(g)}, ${f(b)})`;
  const [lowRough, lowLift, lowTint] = look.lower, [upRough, upLift, upTint] = look.upper;
  for (const map of [mesh.material.map, mesh.material.normalMap]) if (map) map.anisotropy = 8; // capped by the GPU
  mesh.material.customProgramCacheKey = () => `reference-${mesh.name}`;
  mesh.material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRestY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRestY;')
      .replace('#include <map_fragment>', `diffuseColor *= texture2D(map, vMapUv, ${f(MIP_BIAS)});
        float blackness = 1. - smoothstep(.03, .16, dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)));
        float upper = smoothstep(${f(look.hem - .02)}, ${f(look.hem + .02)}, vRestY);
        diffuseColor.rgb *= mix(vec3(1.), mix(${f(1 + lowLift)} * ${v(lowTint)}, ${f(1 + upLift)} * ${v(upTint)}, upper), blackness);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(${f(look.skin)}, mix(${f(lowRough)}, ${f(upRough)}, upper), blackness);`);
  };
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

// The atlas has dark and mid-dark texels on the forearms and hands (photo-bake leftovers: ~25% of forearm and ~38%
// of hand texels sit below skin luminance). The blackness lift treats dark texels as clothing, so they read as black
// stripes and a hand darker than the face. Repaint every forearm/hand texel below skin luminance with the lit skin tone.
// Elbow triangles shared with the sleeve (upperarm_*) split per texel at the sleeve hem's rest height: skin below,
// untouched sleeve above, so the T-shirt stays black. The atlas packs the arms in many small charts and the free space
// between them is dark; the ~16-32 texel mip blocks the minified figure samples pulled it in as a dark line along the
// forearm's UV seams. Every free texel nearest to a forearm chart is padded with that chart's edge colour (never over
// another chart). The raised hand catches the cool night sky light, so its texels get a slight warm tint (HAND_TINT).
const FOREARM_SKIN_MIN = 110, DARK_TEXEL_MAX = 110, UV_SEAM_SPAN = 64;
const SLEEVE_HEM = 1.19; // rest height (m) where elbow texels turn ~100% black; the T-shirt hem (LOOK.Body.hem) is .83
const HAND_TINT = [1, .995, .96];
const FOREARM_BONE = /^(lowerarm|hand|thumb|index|middle|ring|pinky)_/, HAND_BONE = /^(hand|thumb|index|middle|ring|pinky)_/;
function repaintForearmSkin(mesh) {
  const map = mesh.material.map, image = map?.image;
  const { geometry, skeleton } = mesh;
  if (!image?.width || !geometry.attributes.skinIndex) return;
  const uv = geometry.attributes.uv, position = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  const forearm = new Uint8Array(uv.count), hand = new Uint8Array(uv.count);
  for (let v = 0; v < uv.count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(v, k) > skinWeight.getComponent(v, best)) best = k;
    const name = skeleton.bones[skinIndex.getComponent(v, best)]?.name ?? '';
    forearm[v] = FOREARM_BONE.test(name) ? 1 : 0;
    hand[v] = HAND_BONE.test(name) ? 1 : 0;
  }
  const W = image.width, H = image.height;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, W, H), data = pixels.data;
  const mask = new Uint8Array(W * H); // 0 free, 1 other chart, 2 forearm/hand skin
  const handWeight = new Uint8Array(W * H);
  const index = geometry.index?.array ?? null, triangles = (index ? index.length : uv.count) / 3;
  for (let t = 0; t < triangles; t++) {
    const a = index ? index[3 * t] : 3 * t, b = index ? index[3 * t + 1] : 3 * t + 1, c = index ? index[3 * t + 2] : 3 * t + 2;
    const some = forearm[a] || forearm[b] || forearm[c];
    const ax = uv.getX(a) * W, ay = uv.getY(a) * H, bx = uv.getX(b) * W, by = uv.getY(b) * H, cx = uv.getX(c) * W, cy = uv.getY(c) * H;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x1 - x0 > UV_SEAM_SPAN || y1 - y0 > UV_SEAM_SPAN) continue; // triangles across a UV seam span the atlas: skip them
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    const ya = position.getY(a), yb = position.getY(b), yc = position.getY(c);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
      const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const i = y * W + x;
      const skin = some && l1 * ya + l2 * yb + l3 * yc < SLEEVE_HEM;
      mask[i] = Math.max(mask[i], skin ? 2 : 1);
      if (skin) handWeight[i] = Math.max(handWeight[i], Math.round(255 * Math.min(1, Math.max(0, l1 * hand[a] + l2 * hand[b] + l3 * hand[c]))));
    }
  }
  const lum = i => .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
  let r = 0, g = 0, bl = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] === 2 && lum(4 * i) >= FOREARM_SKIN_MIN) { r += data[4 * i]; g += data[4 * i + 1]; bl += data[4 * i + 2]; n++; }
  if (!n) return;
  const skin = [r / n, g / n, bl / n];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 2) continue;
    if (lum(4 * i) < DARK_TEXEL_MAX) for (let k = 0; k < 3; k++) data[4 * i + k] = skin[k];
    const w = handWeight[i] / 255;
    if (w) for (let k = 0; k < 3; k++) data[4 * i + k] *= 1 + (HAND_TINT[k] - 1) * w;
  }
  // Edge padding: breadth-first from every chart texel; a free texel copies its nearest chart texel when that is skin.
  const source = new Int32Array(W * H).fill(-1), queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { source[i] = i; queue[tail++] = i; }
  while (head < tail) {
    const i = queue[head++], x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= mask.length || source[j] >= 0) continue;
      source[j] = source[i]; queue[tail++] = j;
      if (mask[source[i]] === 2) for (let k = 0; k < 3; k++) data[4 * j + k] = data[4 * source[i] + k];
    }
  }
  ctx.putImageData(pixels, 0, 0);
  map.image = canvas;
  map.needsUpdate = true;
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
    meshes[0].forEach(tuneMaterial);
    meshes[0].forEach(mesh => { if (mesh.name === 'Body') repaintForearmSkin(mesh); });
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
