import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
// Authored Big Ben + Westminster river front (tools/landmarks/bigben): one mesh / one atlas material (KTX2 baseColor + ORM + emissive).
// The procedural group from landmark-geometry.js stays as the fallback: it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '9'; // bump when the processed GLBs are regenerated (static hosts cache GLBs aggressively)
// Only LOD0 is shipped to the scene: LOD1 (3.3k vs 11.6k tris, 540 KB) saved ~8k triangles but its atlas read ~12% brighter and popped in just past Tower Bridge at night. bigben.lod1.glb stays on disk, unused.
const URLS = ['assets/processed/landmarks/bigben.lod0.glb?v=' + GLB_V];
export const bigBenForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';
let pending;
export const loadBigBenAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => { // night glow: sky.update drives emissive = glowColor * night * glowK (the emissive texture holds the lit windows and the faint stone flood)
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.3, 1.26, 1.18); /* baked albedo reads darker than the city's sandstone */ m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6; } });
    return lods;
  }).catch(() => null);
// Adds the LOD meshes under the procedural group (same local frame), hides the procedural meshes, returns { update() } (kept for the scene loop; nothing to swap).
export async function upgradeBigBen(group, { isDisposed, track, env }) {
  const lods = await loadBigBenAsset();
  if (!lods || isDisposed()) return null;
  const meshes = lods.map((root, i) => {
    const clone = root.clone(true); clone.name = 'bigben-glb-lod' + i; clone.visible = i === 0;
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; track?.(o.material); env?.register(o.material, { k: 0.85, metal: 1 }); /* procedural sky env: real gold metalness (landmark-env.js) */ } });
    return clone;
  });
  for (const c of [...group.children]) c.visible = false;
  group.add(...meshes);
  return { update() {} };
}
