import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// NPC body merge: each pedestrian's textured body parts become one skinned mesh (one draw call).
// Diffuse maps (1024 and 512 px) and normal maps (256 px) go into texture arrays, one layer per map, so UVs stay as authored, repeats included.
// Per vertex: layers, size class, part kind (1 plain, 2 cloth, 3 hair, 0 none), roughness, alpha cut-out and normal-map flag.
// Eyes and brows stay separate: they are switched by distance (draw-call LOD).
const ATTRS = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight', '_layer', '_big', '_nlayer', '_nflag', '_part', '_kind', '_rough', '_cut'];
const SIZES = [1024, 512], NORMAL_SIZE = 256;
let bodyTextures = null; // { big, small, normal }: shared by every body material; read by installBodyTint
const isFine = (name) => /^mh_(eyes|eyebrows)_/.test(name);
const kindOf = (name, hasPart) => /^mh_clothes_.*_plain$/.test(name) ? (hasPart ? 1 : 0) : /^mh_clothes_(?!shoes)/.test(name) ? (hasPart ? 2 : 0) : /^mh_(hair|eyebrows)_/.test(name) ? 3 : 0;
const sizeOf = (map) => (map.image.width === map.image.height && SIZES.includes(map.image.width) ? map.image.width : 0);
// Normal maps are used only in the form the build produces (256 px, normalScale (1, -1)); anything else keeps its own material.
const normalOk = (m) => !m.normalMap || (m.normalMap.image.width === NORMAL_SIZE && m.normalMap.image.height === NORMAL_SIZE && m.normalScale.x === 1 && m.normalScale.y === -1);
const mergeable = (o) => o.isSkinnedMesh && o.material.map && sizeOf(o.material.map) && normalOk(o.material) && !isFine(o.material.name)
  && o.material.side === THREE.DoubleSide && !o.material.transparent && o.material.metalness === 0;
// One texture array: layer i holds maps[i], row 0 = the image's top row (GLTF uv convention, no flip).
function layersOf(maps, size, colorSpace) {
  if (!maps.length) { const t = new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1); t.colorSpace = colorSpace; return t; }
  const data = new Uint8Array(size * size * 4 * maps.length), canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  maps.forEach((map, layer) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(map.image, 0, 0, size, size);
    data.set(ctx.getImageData(0, 0, size, size).data, layer * size * size * 4);
  });
  const tex = new THREE.DataArrayTexture(data, size, size, maps.length);
  Object.assign(tex, { colorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, needsUpdate: true });
  return tex;
}
// Merges the mergeable skinned parts of every template into one body mesh per variant. Mutates the templates in place.
export function buildNpcBodyAtlas(templates) {
  if (typeof document === 'undefined') return;
  const plans = templates.map((root) => { const parts = []; root.traverse((o) => { if (mergeable(o)) parts.push(o); }); return parts; });
  const lists = { 1024: [], 512: [] }, normals = [];
  for (const parts of plans) for (const o of parts) {
    const list = lists[sizeOf(o.material.map)];
    if (!list.includes(o.material.map)) list.push(o.material.map);
    if (o.material.normalMap && !normals.includes(o.material.normalMap)) normals.push(o.material.normalMap);
  }
  if (!lists[1024].length && !lists[512].length) return;
  bodyTextures = {
    big: layersOf(lists[1024], 1024, THREE.SRGBColorSpace),
    small: layersOf(lists[512], 512, THREE.SRGBColorSpace),
    normal: layersOf(normals, NORMAL_SIZE, THREE.NoColorSpace), // normal data is linear
  };
  // A 1x1 map only switches on the uv attribute and the tint detection in npc3d.js; the real textures come from the arrays.
  const placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const bodyMaterial = new THREE.MeshStandardMaterial({ map: placeholder, side: THREE.DoubleSide, roughness: 0.85 });
  bodyMaterial.name = 'npc-body';
  templates.forEach((_root, t) => {
    const parts = plans[t];
    if (parts.length < 2) return;
    const first = parts[0], sameBones = (p) => p.skeleton.bones.length === first.skeleton.bones.length && p.skeleton.bones.every((b, i) => b === first.skeleton.bones[i]);
    // each primitive carries its own Skeleton object over the same bones: the skin indices agree only if the bone lists match
    if (!parts.every((p) => p.parent === first.parent && p.matrix.equals(first.matrix) && p.bindMatrix.equals(first.bindMatrix) && sameBones(p))) return;
    const geometries = parts.map((o) => {
      const g = o.geometry.clone(), n = g.attributes.position.count, s = sizeOf(o.material.map), nmap = o.material.normalMap;
      const layer = lists[s].indexOf(o.material.map);
      const part = g.attributes._part ? g.attributes._part.array : new Float32Array(n);
      g.setAttribute('_layer', new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1));
      g.setAttribute('_big', new THREE.BufferAttribute(new Float32Array(n).fill(s === 1024 ? 1 : 0), 1));
      g.setAttribute('_nlayer', new THREE.BufferAttribute(new Float32Array(n).fill(nmap ? normals.indexOf(nmap) : 0), 1));
      g.setAttribute('_nflag', new THREE.BufferAttribute(new Float32Array(n).fill(nmap ? 1 : 0), 1));
      g.setAttribute('_part', new THREE.BufferAttribute(Float32Array.from(part), 1));
      g.setAttribute('_kind', new THREE.BufferAttribute(new Float32Array(n).fill(kindOf(o.material.name, !!g.attributes._part)), 1));
      g.setAttribute('_rough', new THREE.BufferAttribute(new Float32Array(n).fill(o.material.roughness), 1));
      g.setAttribute('_cut', new THREE.BufferAttribute(new Float32Array(n).fill(o.material.alphaTest), 1));
      for (const name of Object.keys(g.attributes)) if (!ATTRS.includes(name)) g.deleteAttribute(name);
      g.clearGroups();
      return g;
    });
    const merged = mergeGeometries(geometries, false);
    if (!merged) return; // mixed index layout: keep the parts as they are
    const body = new THREE.SkinnedMesh(merged, bodyMaterial);
    body.name = 'npc-body';
    body.userData.npcBody = true;
    body.position.copy(first.position); body.quaternion.copy(first.quaternion); body.scale.copy(first.scale);
    body.bind(first.skeleton, first.bindMatrix);
    first.parent.add(body);
    parts.forEach((p) => p.removeFromParent());
  });
}
// Frees the shared pedestrian texture arrays. Call once when the world is disposed, after the walkers are gone.
export function disposeNpcBodyAtlas() {
  if (!bodyTextures) return;
  bodyTextures.big.dispose(); bodyTextures.small.dispose(); bodyTextures.normal.dispose();
  bodyTextures = null;
}
// Per-walker tint for the merged body: the colour rules of the per-mesh tint in npc3d.js, chosen per vertex by kind.
export function installBodyTint(mesh, { tee, hue, gain, chroma, hair }) {
  mesh.material = mesh.material.clone();
  mesh.material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uTexBig: { value: bodyTextures.big }, uTexSmall: { value: bodyTextures.small }, uTexNormal: { value: bodyTextures.normal },
      npcHue: { value: hue }, npcGain: { value: gain }, npcChroma: { value: chroma }, npcHair: { value: hair }, npcTee: { value: tee },
      npcClothOn: { value: hue !== 0 ? 1 : 0 }, // a cloth tint with hue 0 is left alone, as before
    });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _layer;\nattribute float _big;\nattribute float _nlayer;\nattribute float _nflag;\nattribute float _part;\nattribute float _kind;\nattribute float _rough;\nattribute float _cut;\nvarying vec2 vNpcUv;\nvarying float vLayer;\nvarying float vBig;\nvarying float vNormLayer;\nvarying float vNormFlag;\nvarying float vTop;\nvarying float vKind;\nvarying float vRough;\nvarying float vCut;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvNpcUv = uv;\nvLayer = _layer;\nvBig = _big;\nvNormLayer = _nlayer;\nvNormFlag = _nflag;\nvTop = step(_part, 0.3);\nvKind = _kind;\nvRough = _rough;\nvCut = _cut;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2DArray uTexBig;\nuniform sampler2DArray uTexSmall;\nuniform sampler2DArray uTexNormal;\nuniform float npcHue;\nuniform float npcGain;\nuniform float npcChroma;\nuniform vec3 npcHair;\nuniform vec3 npcTee;\nuniform float npcClothOn;\nvarying vec2 vNpcUv;\nvarying float vLayer;\nvarying float vBig;\nvarying float vNormLayer;\nvarying float vNormFlag;\nvarying float vTop;\nvarying float vKind;\nvarying float vRough;\nvarying float vCut;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRough;')
      .replace('#include <alphatest_fragment>', 'if (diffuseColor.a < vCut) discard;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    if (vNormFlag > 0.5) { // tangent frame from screen derivatives (the build has no tangents), as three does for a normal map
      vec3 npcMapN = texture(uTexNormal, vec3(vNpcUv, vNormLayer)).xyz * 2.0 - 1.0;
      npcMapN.xy *= vec2(1.0, -1.0);
      vec3 npcQ0 = dFdx(-vViewPosition), npcQ1 = dFdy(-vViewPosition);
      vec2 npcSt0 = dFdx(vNpcUv), npcSt1 = dFdy(vNpcUv);
      vec3 npcP1 = cross(npcQ1, normal), npcP0 = cross(normal, npcQ0);
      vec3 npcT = npcP1 * npcSt0.x + npcP0 * npcSt1.x, npcB = npcP1 * npcSt0.y + npcP0 * npcSt1.y;
      float npcS = inversesqrt(max(max(dot(npcT, npcT), dot(npcB, npcB)), 1e-12));
      normal = normalize(mat3(npcT * npcS, npcB * npcS, normal) * npcMapN);
    }`)
      .replace('#include <map_fragment>', `vec4 npcTex = mix(texture(uTexSmall, vec3(vNpcUv, vLayer)), texture(uTexBig, vec3(vNpcUv, vLayer)), vBig);
    diffuseColor *= npcTex;
    { int kd = int(floor(vKind + 0.5));
      if (kd == 1) { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 1e-4);
        float grey = (1.0 - smoothstep(0.05, 0.12, sat)) * smoothstep(0.35, 0.5, mx);
        diffuseColor.rgb = mix(c, npcTee * clamp(c.g / 0.6, 0.3, 1.25), max(vTop, grey)); }
      else if (kd == 2 && npcClothOn > 0.5) { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-4);
        vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c;
        float h = atan(yiq.z, yiq.y) + npcHue, ch = length(yiq.yz) * npcChroma;
        vec3 r = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * vec3(yiq.x * npcGain, ch * cos(h), ch * sin(h));
        diffuseColor.rgb = mix(c, max(r, 0.0), vTop * smoothstep(0.12, 0.30, sat)); }
      else if (kd == 3) { diffuseColor.rgb = npcHair * clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.30, 0.25, 2.2); } }`);
  };
  mesh.material.customProgramCacheKey = () => 'npc-body-v3';
}
