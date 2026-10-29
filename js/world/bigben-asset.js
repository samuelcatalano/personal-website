import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
// Authored Big Ben + Westminster river front (tools/landmarks/bigben): one mesh / one atlas material per LOD (KTX2 baseColor + ORM + emissive).
// The procedural group from landmark-geometry.js stays as the fallback: it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '6'; // bump when the processed GLBs are regenerated (static hosts cache GLBs aggressively)
const URLS = ['assets/processed/landmarks/bigben.lod0.glb', 'assets/processed/landmarks/bigben.lod1.glb'].map((u) => u + '?v=' + GLB_V);
const NEAR = 140, FAR = 170; // camera-to-AABB distance (m): LOD0 below NEAR, LOD1 beyond FAR, previous level in between (hysteresis like the city chunks)
const BOX = new THREE.Box3(new THREE.Vector3(-3.1, 0, -4), new THREE.Vector3(37, 34, 4.6)); // local envelope (tests/bigben-asset.browser.py)
export const bigBenForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';
let pending;
export const loadBigBenAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => { // night glow: sky.update drives emissive = glowColor * night * glowK (the emissive texture holds the lit windows and the faint stone flood)
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.3, 1.26, 1.18); /* baked albedo reads darker than the city's sandstone */ m.metalness = 0.2; /* the scene has no environment map, so full-metal gold would render black by day: the ORM metal channel is scaled down */ m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6; } });
    return lods;
  }).catch(() => null);
// Adds the LOD meshes under the procedural group (same local frame), hides the procedural meshes, returns { update(cameraPosition) }.
export async function upgradeBigBen(group, { isDisposed, track }) {
  const lods = await loadBigBenAsset();
  if (!lods || isDisposed()) return null;
  const meshes = lods.map((root, i) => {
    const clone = root.clone(true); clone.name = 'bigben-glb-lod' + i; clone.visible = i === 0;
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; track?.(o.material); } });
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
