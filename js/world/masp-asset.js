import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
// Authored MASP (tools/landmarks/masp): LOD0 mesh with one atlas material (KTX2 baseColor + ORM + emissive), same local frame as
// createMasp (origin = footprint centre at ground level, x along the long side). Same pattern as bigben-asset.js; the procedural group stays
// as the fallback: it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '8'; // bump when the processed GLB is regenerated (static hosts cache GLBs aggressively)
const URLS = ['assets/processed/landmarks/masp.lod0.glb'].map((u) => u + '?v=' + GLB_V);
export const maspForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';
let pending;
export const loadMaspAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => { // night glow: sky.update drives emissive = glowColor * night * glowK (emissive texture: uplit red frames only)
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.0, .88, .92); /* baked albedo, lifted a touch toward the city's lighting */ m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6; } });
    return lods;
  }).catch(() => null);
// Adds authored LOD0 under the procedural group, hides the fallback and returns the scene updater.
export async function upgradeMasp(group, { isDisposed, track, env }) {
  const lods = await loadMaspAsset();
  if (!lods || isDisposed()) return null;
  const meshes = lods.map((root, i) => {
    const clone = root.clone(true); clone.name = 'masp-glb-lod' + i; clone.visible = i === 0;
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; track?.(o.material); env?.register(o.material, { k: 0.85, metal: 1 }); /* landmark sky env: glass and painted steel need it (landmark-env.js) */ } });
    return clone;
  });
  for (const c of [...group.children]) c.visible = false;
  group.add(...meshes);
  return { update() {} }; // Keep the scene updater API; MASP stays LOD0 to preserve its facade details.
}
