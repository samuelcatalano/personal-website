import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
// Authored Tower Bridge (tools/landmarks/towerbridge): one mesh / one atlas material per LOD (KTX2 baseColor + ORM + emissive), same local frame as
// createTowerBridge (origin = river centreline, x across the deck, z along the crossing). Same pattern as bigben-asset.js; the procedural group stays
// as the fallback: it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '2'; // bump when the processed GLBs are regenerated (static hosts cache GLBs aggressively)
const URLS = ['assets/processed/landmarks/towerbridge.lod0.glb', 'assets/processed/landmarks/towerbridge.lod1.glb'].map((u) => u + '?v=' + GLB_V);
const NEAR = 140, FAR = 170; // camera-to-AABB distance (m): LOD0 below NEAR, LOD1 beyond FAR, previous level in between (hysteresis like the city chunks)
const BOX = new THREE.Box3(new THREE.Vector3(-4.1, -1, -17.6), new THREE.Vector3(4.1, 35.3, 17.6)); // old procedural envelope (tests/towerbridge-asset.browser.py)
export const towerBridgeForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';
let pending;
export const loadTowerBridgeAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => { // night glow: sky.update drives emissive = glowColor * night * glowK (emissive texture: floodlit stone, lit windows, chain / walkway / deck lights)
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.05, 1.03, 1); /* baked albedo, warmed slightly toward the city's stone */ m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6; } });
    return lods;
  }).catch(() => null);
// Adds the LOD meshes under the procedural group (same local frame), hides the procedural meshes, returns { update(cameraPosition) }.
export async function upgradeTowerBridge(group, { isDisposed, track, env }) {
  const lods = await loadTowerBridgeAsset();
  if (!lods || isDisposed()) return null;
  const meshes = lods.map((root, i) => {
    const clone = root.clone(true); clone.name = 'towerbridge-glb-lod' + i; clone.visible = i === 0;
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; track?.(o.material); env?.register(o.material, { k: 0.85, metal: 1 }); /* landmark sky env: blue steel + gilt need it (landmark-env.js) */ } });
    return clone;
  });
  for (const c of [...group.children]) c.visible = false;
  group.add(...meshes);
  const world = BOX.clone().translate(group.position);
  let level = 0;
  return {
    update(cameraPosition) {
      const d = world.distanceToPoint(cameraPosition), want = d < NEAR ? 0 : d > FAR ? 1 : level;
      if (want !== level) { level = want; meshes.forEach((m, i) => { m.visible = i === level; }); }
    },
  };
}
