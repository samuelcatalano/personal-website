// POC: walking NPCs (one GLB, one shared rig, one walk clip) on the pavement beside the bus route.
// Opt-in with ?npc3d=1. Debug: ?npcnear=1 puts 12 of them 6-12 m ahead of the scroll point and aims an eye-level camera at walker ?npcshot=k. The sprite crowd, layout and scene stay as they are.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ROAD } from './layout.js'; // read only: the sprite crowd's lane offsets

const GLB = new URL('../../assets/npc/npc_pack.glb', import.meta.url).href;
const NEAR = new URLSearchParams(location.search).has('npcnear'), SHOT = Number(new URLSearchParams(location.search).get('npcshot')) || 0; // debug only
const REDUCED = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // read once at load
const VARIANTS = [ // height: metres; measured: the body height each mesh was built at; speed: scales the walk speed
  { name: 'NPC_A', height: 1.80, measured: 1.799, speed: 1.00 },
  { name: 'NPC_B', height: 1.72, measured: 1.813, speed: 1.08 },
  { name: 'NPC_C', height: 1.78, measured: 1.787, speed: 0.92 },
  { name: 'NPC_D', height: 1.86, measured: 1.806, speed: 1.04 },
  { name: 'NPC_E', height: 1.68, measured: 1.806, speed: 0.96 },
  { name: 'NPC_F', height: 1.62, measured: 1.806, speed: 0.98 },
  { name: 'NPC_G', height: 1.66, measured: 1.806, speed: 1.06 },
  { name: 'NPC_H', height: 1.72, measured: 1.806, speed: 0.94 },
];
// World unit = metre (ROAD is in metres). sprites.js scales each person to look.height, so a sprite body is 1.6-1.9 m tall.
// Lanes mirror crowd.js: inner and outer pavement, walking opposite ways on each side of the route.
const IN = ROAD.padIn + 0.4, OUT = ROAD.padIn + 1.05, LANES = [[IN, 1], [OUT, -1], [-IN, -1], [-OUT, 1]];
const WALK = 1.2; // m/s before the variant scale (1.1-1.3 m/s, the sprites' adult band)
const CLIP_SPEED = 0.905; // m/s: stance-foot speed of NPC_Walk at timeScale 1 (measured: Root static, feet planted); cadence = walk / this, so the feet do not slide
const FEET = 0.02; // pavement top, as people.js
const BACK = 30, AHEAD = 90; // walkers live in a window along the route around the camera (m); the far walkers are recycled inside it
const PART_MEANS = new WeakMap(); // geometry -> mean luminance of [top, trousers, shoes, hair]

// Per-instance colour looks: the build tags every vertex with a part id (_part: 0 fixed, .25 top, .5 trousers, .75 shoes, 1 hair).
// A tinted part is repainted with the palette colour times its own vertex luminance over the part's mean, so shading, cuffs and
// hair gradients survive. Skin, eyes and fine detail stay as built. Each instance gets a cloned material (same draw calls, same program).
// muted, saturated enough to read as cloth: no pale greys (they turned to plastic) and no near-black trousers
const TOPS = ['#5d7a5a', '#a4502f', '#1f3556', '#c79a2c', '#4f6f8f', '#7a2434', '#2d7378', '#d8cdb4', '#33363d', '#8a9a6b', '#9a6f8a', '#c0793a'];
const TROUSERS = ['#2f4a78', '#2b3350', '#b09a73', '#5d6670', '#5a6040', '#6b5a45', '#7a4a32'];
const SHOES = ['#f0eee8', '#1b1b1d', '#5a3a26', '#b3321f'];
const HAIRS = ['#14110f', '#2f2018', '#4e3626', '#7a3c22', '#c9a35d', '#9a9a9a'];
const KEEP = 0.25; // chance that a part keeps the colour it was built with

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

export async function createNpc3d(scene, { curve, count = NEAR ? 12 : 40 }) {
  const gltf = await new GLTFLoader().loadAsync(GLB);
  const clip = gltf.animations.find((a) => a.name === 'NPC_Walk');
  // one template per variant: the shared armature plus only that variant's mesh
  const templates = VARIANTS.map((v) => {
    const t = SkeletonUtils.clone(gltf.scene);
    for (const w of VARIANTS) if (w.name !== v.name) t.getObjectByName(w.name)?.removeFromParent();
    return t;
  });
  const L = curve.getLength(), rng = mulberry32(777);
  const [lo, hi] = NEAR ? [6, 12] : [-BACK, AHEAD]; // walker window, metres ahead of the camera along the route
  const wrap = (v) => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const k = i % VARIANTS.length, v = VARIANTS[k], [off, dir] = LANES[i % LANES.length];
    const inst = SkeletonUtils.clone(templates[k]);
    const mixer = new THREE.AnimationMixer(inst);
    const ws = WALK * v.speed; // walk speed, m/s
    const action = mixer.clipAction(clip);
    action.timeScale = ws / CLIP_SPEED; // the stride matches the speed: planted feet do not slide
    action.time = rng() * clip.duration;
    action.play();
    inst.scale.setScalar(v.height / v.measured);
    inst.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); // takes the building shadows; casting would add a shadow-pass per NPC
    tintNpc(inst, mulberry32(1000 + i)); // seeded: a refresh shows the same crowd
    scene.add(inst);
    walkers.push({ inst, mixer, off, dir, ws, x: null, jit: rng() });
  }
  // one blob per walker like the sprite crowd's (one draw call); hidden walkers get a zero scale
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), count);
  Object.assign(shadow, { name: 'npc3d-shadow', frustumCulled: false, renderOrder: 0 });
  scene.add(shadow);
  const dummy = new THREE.Object3D();
  return {
    update(f) {
      const here = Math.min(1, Math.max(0, f.progress)) * L; // the camera's place on the route (scroll progress), in metres
      const dt = REDUCED && !NEAR ? 0 : f.dt; // reduced motion: they stand still in place (frozen stride), as the sprite crowd does
      walkers.forEach((w, i) => {
        if (w.x === null) w.x = here + lo + w.jit * (hi - lo); // first frame: spread over the window
        w.x += w.dir * w.ws * dt; // absolute route position: the crowd stays put while the camera moves
        w.x = here + wrap(w.x - here); // recycle the walkers that leave the window inside it
        const inRoute = w.x >= 0 && w.x <= L; // past the route ends there is no pavement: hide, do not pile up at the ends
        w.inst.visible = inRoute;
        dummy.scale.setScalar(inRoute ? 1 : 0);
        if (inRoute) {
          w.mixer.update(dt);
          const u = w.x / L, p = curve.getPointAt(u), t = curve.getTangentAt(u);
          w.inst.position.set(p.x - t.z * w.off, FEET, p.z + t.x * w.off); // same side convention as people.js
          w.inst.rotation.y = Math.atan2(t.x * w.dir, t.z * w.dir); // the model walks along +Z; turn it onto the walking direction
          dummy.position.set(w.inst.position.x, FEET + 0.01, w.inst.position.z);
        }
        dummy.updateMatrix();
        shadow.setMatrixAt(i, dummy.matrix);
      });
      shadow.instanceMatrix.needsUpdate = true;
      if (NEAR) { // debug: camera at the scroll point, eye level 1.5 m, aimed at walker ?npcshot=k (default 0), about 9 m away; the site camera stays far
        const a = curve.getPointAt(here / L), w = walkers[SHOT % walkers.length];
        f.camera.position.set(a.x, 1.5, a.z); f.camera.lookAt(w.inst.position.x, 1.0, w.inst.position.z);
      }
    },
    dispose() {
      for (const w of walkers) scene.remove(w.inst);
      scene.remove(shadow);
    },
  };
}
