import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
import { bigBenForced } from './bigben-asset.js';
// Authored Catedral da Se (tools/landmarks/se): same pattern as bigben-asset.js (one mesh / one atlas material per LOD, KTX2 baseColor + ORM + emissive).
// ponytail: copied rather than generalised (35 lines); fold both into one factory if a third authored landmark lands.
// The procedural group from landmark-geometry.js stays as the fallback: it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '3'; // bump when the processed GLBs are regenerated (static hosts cache GLBs aggressively)
const URLS = ['assets/processed/landmarks/se.lod0.glb'].map((u) => u + '?v=' + GLB_V);
export const seForced = bigBenForced; // ?landmarks=procedural forces the old geometry for every authored landmark
let pending;
export const loadSeAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => { // night glow: sky.update drives emissive = glowColor * night * glowK (the emissive texture holds lit lancets, rose window and the sodium wash on the stone)
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.25, 1.22, 1.15); m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6; } });
    return lods;
  }).catch(() => null);
// Adds authored LOD0 under the procedural group (same local frame), hides the procedural meshes and returns the scene updater.
export async function upgradeSe(group, { isDisposed, track, env }) {
  const lods = await loadSeAsset();
  if (!lods || isDisposed()) return null;
  const meshes = lods.map((root, i) => {
    const clone = root.clone(true); clone.name = 'se-glb-lod' + i; clone.visible = i === 0;
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; track?.(o.material); env?.register(o.material, { k: 0.85, metal: 1 }); /* real gold / copper need the procedural sky env (landmark-env.js) */ } });
    return clone;
  });
  for (const c of [...group.children]) c.visible = false;
  group.add(...meshes);
  return { update() {} }; // Keep scene.js's updater API; Sé stays LOD0 to avoid the visible dome/facade pop.
}
