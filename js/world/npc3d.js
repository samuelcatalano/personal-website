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
];
const PAVEMENT = 6.5; // offset from the route centre line, the same side convention as people.js
const SPAN = 100; // walkers cycle through a 100 m window that follows the camera along the route
const WALK = 1.2; // m/s before the cadence scale

export async function createNpc3d(scene, { curve, count = 10 }) {
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
