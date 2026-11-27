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
    for (const lod of lods) lod.traverse((o) => { if (o.isMesh) { const m = o.material; m.color.setRGB(1.0, .88, .92); /* baked albedo, lifted a touch toward the city's lighting */ m.userData.glow = true; m.userData.glowColor = new THREE.Color(1, 1, 1); m.userData.glowK = 1.6;
      // Round 4 / batch D: the red frame read as one flat saturated volume. For strongly red texels only (glass and concrete are untouched):
      // a low-frequency +-9% value drift across the frame, soft vertical streaks, and a darker foot toward the ground. Albedo math only.
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMaspP;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vMaspP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
  varying vec3 vMaspP;
  float maspH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float maspN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(maspH(i), maspH(i + vec2(1.0, 0.0)), f.x), mix(maspH(i + vec2(0.0, 1.0)), maspH(i + vec2(1.0, 1.0)), f.x), f.y); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  float maspRed = smoothstep(0.30, 0.55, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));
  float maspDrift = maspN(vec2(vMaspP.x * 0.09 + vMaspP.z * 0.05, vMaspP.y * 0.12)) * 2.0 - 1.0;
  float maspStreak = maspN(vec2((vMaspP.x + vMaspP.z) * 0.8, 3.0)) * 2.0 - 1.0;
  diffuseColor.rgb *= 1.0 + maspRed * (0.09 * maspDrift + 0.04 * maspStreak - 0.16 * (1.0 - smoothstep(0.0, 7.0, vMaspP.y)));`);
      };
      m.customProgramCacheKey = () => 'masp-red-variation-1'; } });
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
