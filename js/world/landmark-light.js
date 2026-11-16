import * as THREE from 'three';
import { PICK_STOP } from './layout.js';
// A panel stop that has a landmark lights it: each landmark mesh is drawn with a twin of its material whose emissive is lifted toward warm amber.
// The twin is made the first time that stop is lit. Shared materials are never edited, so the rest of the city stays as it is; the twin copies the
// original's shader patch and follows its values every frame, so it renders the same apart from the lift.
// ponytail: twins are built once per stop and kept; swap in a single shared twin per material if many stops start to be lit.
const LIGHT = new THREE.Color('#ffb21e'), STRENGTH = 0.6, EASE = 7;
const SYNC = ['roughness', 'metalness', 'opacity', 'envMapIntensity', 'emissiveIntensity'];
export function createLandmarkLight(details) {
  const twins = new Map(); // stop id -> [{ mesh, orig, twin }]
  const listFor = (id) => {
    if (!twins.has(id)) {
      const list = [];
      for (const [name, stopId] of Object.entries(PICK_STOP)) {
        if (stopId !== id) continue;
        details.getObjectByName(`${name}-geometry`)?.traverse((o) => {
          const m = o.isMesh && o.material;
          if (!m || Array.isArray(m) || !m.emissive) return;
          const twin = m.clone();
          twin.onBeforeCompile = m.onBeforeCompile; twin.customProgramCacheKey = m.customProgramCacheKey;
          list.push({ mesh: o, orig: m, twin });
        });
      }
      twins.set(id, list);
    }
    return twins.get(id);
  };
  let stop = null, shown = null, level = 0, lit = [], probe = { shown: null, level: 0, n: 0 };
  // Called from the panel list on focus and hover; null clears it.
  const set = (id) => { stop = id && Object.values(PICK_STOP).includes(id) ? id : null; };
  // Before the frame renders (after sky.update, which sets emissive each frame): draw the lit stop's meshes with their lifted twins.
  const apply = (dt, instant) => {
    restore();
    const goal = stop ? 1 : 0;
    level = instant || !dt ? goal : level + (goal - level) * Math.min(1, dt * EASE);
    if (Math.abs(goal - level) < 0.01) level = goal;
    if (stop) shown = stop; else if (!level) shown = null; // a fading light keeps its landmark until it is gone
    probe = { shown, level, n: 0 };
    if (!shown || !level) return;
    lit = listFor(shown);
    probe.n = lit.length;
    for (const e of lit) {
      for (const k of SYNC) if (e.orig[k] !== undefined) e.twin[k] = e.orig[k];
      e.twin.color.copy(e.orig.color);
      e.twin.emissive.copy(e.orig.emissive).lerp(LIGHT, STRENGTH * level);
      e.mesh.material = e.twin;
    }
  };
  // After the render: every mesh goes back to its own material.
  const restore = () => { for (const e of lit) e.mesh.material = e.orig; lit = []; };
  return { set, apply, restore, twinCount: (id) => listFor(id).length, litCount: () => probe }; // QA probes: the last frame's lit stop and mesh count
}
