import * as THREE from 'three';
import { loadGlb } from './glb-loader.js';
// Authored MASP (tools/landmarks/masp): one mesh / one atlas material per LOD (KTX2 baseColor + ORM + emissive), same local frame as
// createMasp (origin = footprint centre at ground level, x along the long side). Same pattern as bigben-asset.js; the procedural group stays
// as the fallback: it is hidden, never removed, so a failed load changes nothing.
const GLB_V = '5'; // bump when the processed GLBs are regenerated (static hosts cache GLBs aggressively)
const URLS = ['assets/processed/landmarks/masp.lod0.glb', 'assets/processed/landmarks/masp.lod1.glb'].map((u) => u + '?v=' + GLB_V);
const NEAR = 140, FAR = 170; // camera-to-AABB distance (m): LOD0 below NEAR, LOD1 beyond FAR, previous level in between (hysteresis like the city chunks)
const BOX = new THREE.Box3(new THREE.Vector3(-20.1, 0, -6.6), new THREE.Vector3(20.1, 15.7, 6.6)); // local envelope (tests/masp-asset.browser.py)
export const maspForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';
let pending;
export const loadMaspAsset = () => pending ??= Promise.all(URLS.map((u) => loadGlb(new URL('../../' + u, import.meta.url).href)))
  .then((lods) => { // night glow: sky.update drives emissive = glowColor * night * glowK (emissive texture: lit gallery box, uplit red frames, lit soffit and plaza)
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.0, .88, .92); /* baked albedo, lifted a touch toward the city's lighting */ m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6; } });
    return lods;
  }).catch(() => null);
// Adds the LOD meshes under the procedural group (same local frame), hides the procedural meshes, returns { update(cameraPosition) }.
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
  const world = BOX.clone().translate(group.position);
  let level = 0;
  return {
    update(cameraPosition) {
      const d = world.distanceToPoint(cameraPosition), want = d < NEAR ? 0 : d > FAR ? 1 : level;
      if (want !== level) { level = want; meshes.forEach((m, i) => { m.visible = i === level; }); }
    },
  };
}
