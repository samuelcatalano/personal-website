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
  Body: { skin: .7, lower: [1, 1.25, [.93, .98, 1.12]], upper: [1, .8, [1, 1, 1]], hem: .83 }, // washed denim, deep cotton: matte, so the sun's grazing glints do not read as beige patches
  Head: { skin: .7, lower: [.52, 1.4, [1.14, 1, .86]], upper: [.52, 1.4, [1.14, 1, .86]], hem: 0 }, // chestnut hair and beard: the photos read mid-brown with caramel glints, not black
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
    // Dark cloth never reads brighter than a dim grey: the warm sunset glints on the trousers and shirt become beige patches.
    // Skin (blackness 0) is untouched.
    if (mesh.name === 'Body') shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `gl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb, vec3(.2)), blackness * .85);\n#include <dithering_fragment>`);
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

// The photographed pose baked directional shadows into separate arm UV charts.
const FOREARM_SKIN_MIN = 110, UV_SEAM_SPAN = 64;
const SLEEVE_HEM = 1.19;
const HAND_TINT = [1, .995, .96];
const FOREARM_BONE = /^(lowerarm|hand|thumb|index|middle|ring|pinky)_/, HAND_BONE = /^(hand|thumb|index|middle|ring|pinky)_/;
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;

function balanceSkinTexel(data, i, skin, weight, hand) {
  const original = luminance(data[i], data[i + 1], data[i + 2]);
  const base = luminance(skin[0], skin[1], skin[2]);
  const detail = Math.min(48, Math.max(-42, original - base)) * .22;
  for (let k = 0; k < 3; k++) {
    const chroma = data[i + k] - original - (skin[k] - base);
    const target = (skin[k] + detail + chroma * .08) * (1 + (HAND_TINT[k] - 1) * hand);
    data[i + k] += (target - data[i + k]) * weight;
  }
}

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
  const skinWeightByPixel = new Uint8Array(W * H);
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
      const rise = (SLEEVE_HEM - (l1 * ya + l2 * yb + l3 * yc)) / .014;
      const amount = some ? Math.max(0, Math.min(1, rise)) : 0;
      mask[i] = Math.max(mask[i], amount > 0 ? 2 : 1);
      if (amount > 0) {
        skinWeightByPixel[i] = Math.max(skinWeightByPixel[i], Math.round(255 * amount * amount * (3 - 2 * amount)));
        handWeight[i] = Math.max(handWeight[i], Math.round(255 * Math.min(1, Math.max(0, l1 * hand[a] + l2 * hand[b] + l3 * hand[c]))));
      }
    }
  }
  const lum = i => luminance(data[i], data[i + 1], data[i + 2]);
  let r = 0, g = 0, bl = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (skinWeightByPixel[i] === 255 && lum(4 * i) >= FOREARM_SKIN_MIN) { r += data[4 * i]; g += data[4 * i + 1]; bl += data[4 * i + 2]; n++; }
  if (!n) return;
  const skin = [r / n, g / n, bl / n];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 2) continue;
    balanceSkinTexel(data, 4 * i, skin, skinWeightByPixel[i] / 255, handWeight[i] / 255);
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
// Reference sneakers: the foot triangles at the bottom of the shoe become a plain white midsole material,
// a second index group on the same Body geometry. Feet sink about 2 cm into the ground (figure.js pool note),
// so the band is cut at rest y < SOLE_TOP. ponytail: sole only; the orange heel tab (2-3 px) is skipped.
const SOLE_TOP = .05, FOOT_BONE = /^(foot|ball)_/;
function splitSoles(geometry, skeleton) {
  const index = geometry.index.array, position = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  const foot = new Uint8Array(position.count);
  for (let v = 0; v < position.count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(v, k) > skinWeight.getComponent(v, best)) best = k;
    foot[v] = FOOT_BONE.test(skeleton.bones[skinIndex.getComponent(v, best)]?.name ?? '') ? 1 : 0;
  }
  const body = [], sole = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const low = foot[a] && foot[b] && foot[c] && position.getY(a) + position.getY(b) + position.getY(c) < 3 * SOLE_TOP;
    (low ? sole : body).push(a, b, c);
  }
  geometry.setIndex([...body, ...sole]);
  geometry.clearGroups();
  geometry.addGroup(0, body.length, 0);
  geometry.addGroup(body.length, sole.length, 1);
}

// Jeans slimmer from the knee down: the jeans vertices between the shoe cuff and the knee are pulled toward each leg's
// axis (knee joint to ankle joint, rest pose), TAPER narrower at the cuff. Thigh and shoes stay as they are.
const TAPER = .22, CUFF_Y = .165;
function taperJeans(mesh) {
  const { geometry, skeleton } = mesh;
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal;
  const joint = name => {
    const i = skeleton.bones.findIndex(b => b.name === name);
    return i < 0 ? null : skeleton.boneInverses[i].clone().invert().elements;
  };
  const knee = [joint('calf_l'), joint('calf_r')], ankle = [joint('foot_l'), joint('foot_r')];
  if (!knee[0] || !knee[1] || !ankle[0] || !ankle[1]) return;
  const kneeY = knee[0][13];
  const before = Float32Array.from(nrm.array), touched = new Uint8Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const y = pos.getY(v);
    if (y < CUFF_Y || y > kneeY) continue;
    const side = pos.getX(v) >= 0 ? 0 : 1; // the bone named calf_l sits at +x in the rest pose
    const t = (y - ankle[side][13]) / (kneeY - ankle[side][13]); // 0 at the ankle joint, 1 at the knee
    const cx = ankle[side][12] + (knee[side][12] - ankle[side][12]) * t, cz = ankle[side][14] + (knee[side][14] - ankle[side][14]) * t;
    const u = (kneeY - y) / (kneeY - CUFF_Y); // 0 at the knee, 1 at the cuff
    const f = 1 - TAPER * u * u * (3 - 2 * u);
    pos.setX(v, cx + (pos.getX(v) - cx) * f);
    pos.setZ(v, cz + (pos.getZ(v) - cz) * f);
    touched[v] = 1;
  }
  // Normals: recompute, keep only the tapered vertices' new values; everything else keeps the GLB's normals.
  geometry.computeVertexNormals();
  for (let v = 0; v < pos.count; v++) if (!touched[v]) for (let k = 0; k < 3; k++) nrm.array[3 * v + k] = before[3 * v + k];
  pos.needsUpdate = true; nrm.needsUpdate = true;
}

// Jeans and sneakers, from the reference photos. The atlas has both as near-flat black (luminance 20-37 of 255), so each
// texel keeps its baked fold shading and gets a denim twill and wash, or a knit grain for the upper. The orange heel loop
// from the photos goes on the back collar. Sole band stays on its own material (splitSoles).
// Bases sit above the shader's black-lift threshold (luminance ~40), so the charcoal reads as it is, not lifted to grey.
const DENIM = [36, 38, 42], KNIT = [34, 35, 38], HEEL_TAB = [226, 92, 32], STITCH = [198, 98, 42];
// Back pockets, from the photos: outline a few mm inside the pocket, dashed orange thread. Metres, rest pose.
const POCKET = { x0: .045, x1: .125, y0: .69, y1: .812, inset: .008, tol: .0011, dash: .006 };
function onPocketStitch(xs, y, z) {
  const { x0, x1, y0, y1, inset, tol, dash } = POCKET;
  if (z > -.12 || xs < x0 || xs > x1 || y < y0 || y > y1) return false;
  const u0 = x0 + inset, u1 = x1 - inset, v0 = y0 + inset, v1 = y1 - inset;
  const inX = xs >= u0 - tol && xs <= u1 + tol, inY = y >= v0 - tol && y <= v1 + tol;
  if (inX && (Math.abs(y - v1) < tol || Math.abs(y - v0) < tol)) return Math.floor(xs / dash) % 2 === 0;
  if (inY && (Math.abs(xs - u0) < tol || Math.abs(xs - u1) < tol)) return Math.floor(y / dash) % 2 === 0;
  return false;
}
const hash3 = (a, b, c) => {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function valueNoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = x - xi, v = y - yi, w = z - zi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), sw = w * w * (3 - 2 * w);
  const h = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), su), lerp(h(0, 1, 0), h(1, 1, 0), su), sv),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), su), lerp(h(0, 1, 1), h(1, 1, 1), su), sv), sw);
}
function retextureLegsAndShoes(mesh) {
  const map = mesh.material.map, image = map?.image;
  const { geometry, skeleton } = mesh;
  if (!image?.width || !geometry.attributes.skinIndex) return;
  const uv = geometry.attributes.uv, position = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  // 1 thigh/pelvis, 2 calf, 3 foot/ball, 0 anything else
  const family = new Uint8Array(uv.count);
  for (let v = 0; v < uv.count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(v, k) > skinWeight.getComponent(v, best)) best = k;
    const name = skeleton.bones[skinIndex.getComponent(v, best)]?.name ?? '';
    family[v] = /^(foot|ball)_/.test(name) ? 3 : /^calf_/.test(name) ? 2 : /^(thigh|pelvis)/.test(name) ? 1 : 0;
  }
  const W = image.width, H = image.height;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, W, H), data = pixels.data;
  const done = new Uint8Array(W * H);
  const index = geometry.index?.array ?? null, triangles = (index ? index.length : uv.count) / 3;
  const isFoot = f => f === 2 || f === 3, isLeg = f => f === 1 || f === 2;
  for (let t = 0; t < triangles; t++) {
    const a = index ? index[3 * t] : 3 * t, b = index ? index[3 * t + 1] : 3 * t + 1, c = index ? index[3 * t + 2] : 3 * t + 2;
    const yAvg = (position.getY(a) + position.getY(b) + position.getY(c)) / 3, zAvg = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const xAvg = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    let kind = 0; // 1 jeans, 2 sneaker upper, 3 heel loop
    if (isFoot(family[a]) && isFoot(family[b]) && isFoot(family[c])) {
      // heel loop: a ~2.4 cm strip at the back centre of each heel (heel centres at x = +-0.216 in the rest pose)
      if (zAvg < -.12 && yAvg >= .10 && yAvg < .16 && Math.abs(Math.abs(xAvg) - .216) < .014) kind = 3;
      else if (yAvg < .165) kind = 2;
    } else if (isLeg(family[a]) && isLeg(family[b]) && isLeg(family[c]) && yAvg >= .165 && yAvg < .83) kind = 1;
    if (!kind) continue;
    const ax = uv.getX(a) * W, ay = uv.getY(a) * H, bx = uv.getX(b) * W, by = uv.getY(b) * H, cx = uv.getX(c) * W, cy = uv.getY(c) * H;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x1 - x0 > UV_SEAM_SPAN || y1 - y0 > UV_SEAM_SPAN) continue; // triangles across a UV seam span the atlas: skip them
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
      const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const i = y * W + x;
      if (done[i]) continue;
      done[i] = 1;
      const j = 4 * i;
      // rest-pose position of this texel, in metres: world-space noise keeps the grain continuous across UV seams
      const wx = l1 * position.getX(a) + l2 * position.getX(b) + l3 * position.getX(c);
      const wy = l1 * position.getY(a) + l2 * position.getY(b) + l3 * position.getY(c);
      const wz = l1 * position.getZ(a) + l2 * position.getZ(b) + l3 * position.getZ(c);
      const shadeBase = luminance(data[j], data[j + 1], data[j + 2]);
      if (kind === 3) {
        const g = .92 + .16 * hash3(Math.floor(wx * 900), Math.floor(wy * 900), Math.floor(wz * 900));
        for (let k = 0; k < 3; k++) data[j + k] = Math.min(255, HEEL_TAB[k] * g);
      } else if (kind === 1) {
        const shade = Math.min(1.6, Math.max(.6, shadeBase / 30));
        const twill = 1 + .07 * Math.sin((wx * .6 + wy * .9) * 2 * Math.PI / .012);
        const wash = 1 + .22 * (valueNoise(wx * 9, wy * 9, wz * 9) - .5);
        const grain = 1 + .05 * (hash3(Math.floor(wx * 1200), Math.floor(wy * 1200), Math.floor(wz * 1200)) - .5);
        const thread = onPocketStitch(Math.abs(wx), wy, wz);
        for (let k = 0; k < 3; k++) data[j + k] = Math.min(255, thread ? STITCH[k] * grain : DENIM[k] * shade * twill * wash * grain);
      } else {
        const shade = Math.min(1.7, Math.max(.6, shadeBase / 28));
        const knit = 1 + .18 * (hash3(Math.floor(wx * 380), Math.floor(wy * 380), Math.floor(wz * 380)) - .5);
        for (let k = 0; k < 3; k++) data[j + k] = Math.min(255, KNIT[k] * shade * knit);
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
  map.image = canvas;
  map.needsUpdate = true;
}

// The Head atlas holds the neck base and shoulder cap (rest y 1.40-1.48, skin-coloured): it pokes through the shirt
// as the tan shoulder patches. Its skin texels fade to the shirt tone from y 1.42 (full) to 1.48 (none), so the neck
// gets no hard ring. Those triangles are large in UV, so the seam guard is wider here (256 px) than for the forearm.
const COLLAR_LO = 1.42, COLLAR_HI = 1.48, COLLAR_SPAN = 256, SHIRT_RGB = [28, 28, 30];
// Skin is light and not very saturated: the orange stitch and heel loop (r - g above 60) must not count as skin.
const isSkinLike = (r, g, b) => r > b + 10 && r - g < 60 && luminance(r, g, b) > 60;
function paintCollarSkin(mesh) {
  const map = mesh.material.map, image = map?.image;
  const { geometry } = mesh;
  if (!image?.width) return;
  const uv = geometry.attributes.uv, position = geometry.attributes.position;
  const strength = new Float32Array(uv.count); // 1 below COLLAR_LO, 0 above COLLAR_HI, smooth between
  for (let v = 0; v < uv.count; v++) {
    const u = Math.min(1, Math.max(0, (COLLAR_HI - position.getY(v)) / (COLLAR_HI - COLLAR_LO)));
    strength[v] = u * u * (3 - 2 * u);
  }
  const W = image.width, H = image.height;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, W, H), data = pixels.data;
  const index = geometry.index?.array ?? null, triangles = (index ? index.length : uv.count) / 3;
  for (let t = 0; t < triangles; t++) {
    const a = index ? index[3 * t] : 3 * t, b = index ? index[3 * t + 1] : 3 * t + 1, c = index ? index[3 * t + 2] : 3 * t + 2;
    if (!strength[a] && !strength[b] && !strength[c]) continue;
    const ax = uv.getX(a) * W, ay = uv.getY(a) * H, bx = uv.getX(b) * W, by = uv.getY(b) * H, cx = uv.getX(c) * W, cy = uv.getY(c) * H;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x1 - x0 > COLLAR_SPAN || y1 - y0 > COLLAR_SPAN) continue; // triangles across a UV seam span the atlas: skip them
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
      const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const amount = l1 * strength[a] + l2 * strength[b] + l3 * strength[c];
      if (amount <= 0) continue;
      const i = 4 * (y * W + x);
      if (isSkinLike(data[i], data[i + 1], data[i + 2])) for (let k = 0; k < 3; k++) data[i + k] += (SHIRT_RGB[k] - data[i + k]) * amount;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  map.image = canvas;
  map.needsUpdate = true;
}

// The photos projected a hand and torn fabric onto the hip, so skin-coloured texels show on the trousers and the shirt.
// On triangles of the pelvis, thighs, calves and torso, skin-like texels take the cloth tone. Arms, hands, neck and head keep their skin.
function clearSkinFromClothes(mesh) {
  const map = mesh.material.map, image = map?.image;
  const { geometry, skeleton } = mesh;
  if (!image?.width || !geometry.attributes.skinIndex) return;
  const uv = geometry.attributes.uv, position = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  const cloth = new Uint8Array(uv.count); // 1 trousers, 2 torso below the neck line, 0 anything else (neck and skin above 1.45 m stay)
  for (let v = 0; v < uv.count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(v, k) > skinWeight.getComponent(v, best)) best = k;
    const name = skeleton.bones[skinIndex.getComponent(v, best)]?.name ?? '';
    cloth[v] = /^(pelvis|thigh_|calf_)/.test(name) ? 1 : /^(spine_|clavicle_)/.test(name) && position.getY(v) < 1.45 ? 2 : 0;
  }
  const W = image.width, H = image.height;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, W, H), data = pixels.data;
  const index = geometry.index?.array ?? null, triangles = (index ? index.length : uv.count) / 3;
  for (let t = 0; t < triangles; t++) {
    const a = index ? index[3 * t] : 3 * t, b = index ? index[3 * t + 1] : 3 * t + 1, c = index ? index[3 * t + 2] : 3 * t + 2;
    const fa = cloth[a], fb = cloth[b], fc = cloth[c];
    if (!fa || !fb || !fc) continue;
    const family = fa === 1 || fb === 1 || fc === 1 ? DENIM : SHIRT_RGB;
    const ax = uv.getX(a) * W, ay = uv.getY(a) * H, bx = uv.getX(b) * W, by = uv.getY(b) * H, cx = uv.getX(c) * W, cy = uv.getY(c) * H;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x1 - x0 > COLLAR_SPAN || y1 - y0 > COLLAR_SPAN) continue;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
      const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const i = 4 * (y * W + x);
      if (isSkinLike(data[i], data[i + 1], data[i + 2])) for (let k = 0; k < 3; k++) data[i + k] = family[k];
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
    meshes[0].forEach(mesh => { if (mesh.name === 'Body') { taperJeans(mesh); repaintForearmSkin(mesh); retextureLegsAndShoes(mesh); clearSkinFromClothes(mesh); } if (mesh.name === 'Head') paintCollarSkin(mesh); });
    // Every LOD gets the sole split (the geometry is swapped per LOD); only LOD0's mesh carries the two materials.
    const soleMaterial = new THREE.MeshStandardMaterial({ color: 0xece9e2, roughness: .6, metalness: 0 });
    soleMaterial.userData.sole = true; // figure.js lightCharacter skips it: the midsole must not get the night self-fill
    meshes.forEach(level => level.forEach(mesh => { if (mesh.name === 'Body') splitSoles(mesh.geometry, mesh.skeleton); }));
    meshes[0].forEach(mesh => { if (mesh.name === 'Body') mesh.material = [mesh.material, soleMaterial]; });
    let disposed = false;
    return {
      stride, height,
      create() {
        if (disposed) throw new Error('Reference NPC assets were disposed');
        const root = SkeletonUtils.clone(assets[0].scene);
        const parts = PARTS.map(name => root.getObjectByName(name));
        const shared = parts[0].skeleton;
        // The body does not take its own shadows: the raised arm otherwise casts a hard black wedge onto the shirt.
        parts.forEach(mesh => { mesh.skeleton = shared; mesh.frustumCulled = false; mesh.receiveShadow = mesh.name !== 'Body'; });
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
            const greeting = mixer.clipAction(wave).reset().play();
            (moving ? action : idleAction).crossFadeTo(greeting, .25, false);
            return greeting;
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
