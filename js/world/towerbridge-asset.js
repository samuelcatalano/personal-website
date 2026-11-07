import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
// Authored Tower Bridge (tools/landmarks/towerbridge): one mesh per LOD with one primitive per material: the vertex-colour PBR atlas, a night
// light material (windows, walkway glazing, lamps, gilt, strips) and two floodlit stone bands. Same local frame as createTowerBridge (origin =
// river centreline, x across the carriageway, z along the crossing). Same pattern as bigben-asset.js; the procedural group stays as the fallback:
// it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '11'; // bump when the processed GLBs are regenerated (static hosts cache GLBs aggressively)
const URLS = ['assets/processed/landmarks/towerbridge.lod0.glb', 'assets/processed/landmarks/towerbridge.lod1.glb'].map((u) => u + '?v=' + GLB_V);
const NEAR = 140, FAR = 170; // camera-to-AABB distance (m): LOD0 below NEAR, LOD1 beyond FAR, previous level in between (hysteresis like the city chunks)
const BOX = new THREE.Box3(new THREE.Vector3(-5, -1.05, -29.4), new THREE.Vector3(5, 32, 29.4)); // GLB extent: towers, side spans, chains, shore abutments (owner released the old 8 x 35 m envelope on 2026-11-07; tests/towerbridge-asset.browser.py)
export const towerBridgeForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';
let pending;
// Night glow is data-driven: sky.update sets emissive = glowColor * night * glowK for every material marked glow. Only the light and floodlit
// stone materials glow; the atlas (piers, steel, slate, trim, deck) never does.
const GLOW = {
  TowerBridgeLights: { color: '#ffd9a0', k: 2.2 },
  TowerBridgeFloodLow: { color: '#ffb566', k: 0.5 },
  TowerBridgeFloodHigh: { color: '#ffb566', k: 0.18 },
};
export const loadTowerBridgeAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => {
    for (const lod of lods) lod.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      m.color.setRGB(1.05, 1.03, 1); // vertex colours, warmed slightly toward the city's stone
      const g = GLOW[m.name];
      if (g) Object.assign(m.userData, { glow: true, glowColor: new THREE.Color(g.color), glowK: g.k });
    });
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
  for (const c of group.children) c.visible = false; // the old procedural light strips and wash sit on the old geometry: the GLB carries the night light now
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
