// POC: the five 3D NPCs (one GLB, one shared rig, one walk clip) walking the pavement beside the bus route.
// Opt-in with ?npc3d=1. The sprite crowd, the layout and the scene stay as they are; this only adds walkers.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const GLB = new URL('../../assets/npc/npc_pack.glb', import.meta.url).href;
const CROWD_HEIGHT = 1.07; // sprites.js draws people CELL_H / S = 1.07 world units tall; the NPCs match them
const K = CROWD_HEIGHT / 1.8; // the meshes are built at about 1.8 m
const VARIANTS = [ // height: metres; measured: the body height each mesh was built at; speed: scales the shared clip
  { name: 'NPC_A', height: 1.80, measured: 1.799, speed: 1.00 },
  { name: 'NPC_B', height: 1.72, measured: 1.813, speed: 1.08 },
  { name: 'NPC_C', height: 1.78, measured: 1.787, speed: 0.92 },
  { name: 'NPC_D', height: 1.86, measured: 1.806, speed: 1.04 },
  { name: 'NPC_E', height: 1.68, measured: 1.806, speed: 0.96 },
  { name: 'NPC_F', height: 1.62, measured: 1.806, speed: 0.98 },
  { name: 'NPC_G', height: 1.66, measured: 1.806, speed: 1.06 },
  { name: 'NPC_H', height: 1.72, measured: 1.806, speed: 0.94 },
];
const PAVEMENT = 6.5; // offset from the route centre line, the same side convention as people.js
const SPAN = 100; // walkers cycle through a 100 m window that follows the camera along the route
const WALK = 1.2; // m/s before the cadence scale

// Per-instance colour looks: the build tags every vertex with a part id (_part: 0 fixed, .25 top, .5 trousers, .75 shoes, 1 hair).
// A tinted part is repainted with the palette colour times its own vertex luminance over the part's mean, so shading, cuffs and
// hair gradients survive. Skin, eyes and fine detail stay as built. Each instance gets a cloned material (same draw calls, same program).
// muted, saturated enough to read as cloth: no pale greys (they turned to plastic) and no near-black trousers
const TOPS = ['#5d7a5a', '#a4502f', '#1f3556', '#c79a2c', '#4f6f8f', '#7a2434', '#2d7378', '#d8cdb4', '#33363d', '#8a9a6b', '#9a6f8a', '#c0793a'];
const TROUSERS = ['#2f4a78', '#2b3350', '#b09a73', '#5d6670', '#5a6040', '#6b5a45', '#7a4a32'];
const SHOES = ['#f0eee8', '#1b1b1d', '#5a3a26', '#b3321f'];
const HAIRS = ['#14110f', '#2f2018', '#4e3626', '#7a3c22', '#c9a35d', '#9a9a9a'];
const KEEP = 0.25; // chance that a part keeps the colour it was built with
const PART_MEANS = new WeakMap(); // geometry -> mean luminance of [top, trousers, shoes, hair]

export function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function partMeans(geo) {
  let m = PART_MEANS.get(geo);
  if (m) return m;
  const sum = [0, 0, 0, 0], n = [0, 0, 0, 0], col = geo.attributes.color, part = geo.attributes._part;
  for (let i = 0; i < col.count; i++) {
    const k = Math.round(part.getX(i) * 4) - 1;
    if (k < 0) continue;
    sum[k] += 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
    n[k]++;
  }
  m = new THREE.Vector4(...sum.map((v, k) => (n[k] ? v / n[k] : 1) || 1));
  PART_MEANS.set(geo, m);
  return m;
}

// give every mesh of `inst` its own tinted material; rng picks the palette entries
export function tintNpc(inst, rng) {
  const pick = (list) => (rng() < KEEP ? new THREE.Vector4(0, 0, 0, 0) : (({ r, g, b }) => new THREE.Vector4(r, g, b, 1))(new THREE.Color(list[Math.floor(rng() * list.length)])));
  const tint = [pick(TOPS), pick(TROUSERS), pick(SHOES), pick(HAIRS)];
  inst.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes._part) return;
    const means = partMeans(o.geometry);
    o.material = o.material.clone();
    o.material.roughness = 0.92; // matte cloth: the default sheen read as plastic on light tops
    o.material.onBeforeCompile = (sh) => {
      sh.uniforms.tints = { value: tint };
      sh.uniforms.means = { value: means };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _part;\nvarying float vPart;')
        .replace('#include <color_vertex>', '#include <color_vertex>\nvPart = _part;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 tints[4];\nuniform vec4 means;\nvarying float vPart;')
        .replace('#include <color_fragment>', `#include <color_fragment>
        int k = int(floor(vPart * 4.0 + 0.5)) - 1;
        if (k >= 0 && tints[k].w > 0.5) {
          float lum = dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = tints[k].rgb * clamp(lum / means[k], 0.35, 2.2);
        }`);
    };
  });
}

export async function createNpc3d(scene, { curve, count = 12 }) {
  const gltf = await new GLTFLoader().loadAsync(GLB);
  const clip = gltf.animations.find((a) => a.name === 'NPC_Walk');
  // one template per variant: the shared armature plus only that variant's mesh
  const templates = VARIANTS.map((v) => {
    const t = SkeletonUtils.clone(gltf.scene);
    for (const w of VARIANTS) if (w.name !== v.name) t.getObjectByName(w.name)?.removeFromParent();
    return t;
  });
  const L = curve.getLength();
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const k = i % VARIANTS.length, v = VARIANTS[k];
    const inst = SkeletonUtils.clone(templates[k]);
    const mixer = new THREE.AnimationMixer(inst);
    const action = mixer.clipAction(clip);
    action.timeScale = v.speed;
    action.time = Math.random() * clip.duration;
    action.play();
    inst.scale.setScalar(K * v.height / v.measured);
    tintNpc(inst, mulberry32(1000 + i)); // seeded: a refresh shows the same crowd
    scene.add(inst);
    walkers.push({ inst, mixer, v, s: (i / count) * SPAN, side: i % 2 ? 1 : -1 });
  }
  return {
    update(f) {
      const here = Math.min(1, Math.max(0, f.progress)) * L; // the camera's place on the route, in metres
      for (const w of walkers) {
        w.mixer.update(f.dt);
        w.s = (w.s + WALK * w.v.speed * f.dt) % SPAN;
        const u = Math.min(1, Math.max(0, (here - 20 + w.s) / L)); // walkers sit in a window around the camera
        const p = curve.getPointAt(u), t = curve.getTangentAt(u);
        w.inst.position.set(p.x - t.z * PAVEMENT * w.side, p.y, p.z + t.x * PAVEMENT * w.side);
        w.inst.rotation.y = Math.atan2(t.x, t.z); // the model walks along +Z; turn it onto the route tangent
      }
    },
    dispose() {
      for (const w of walkers) scene.remove(w.inst);
    },
  };
}
