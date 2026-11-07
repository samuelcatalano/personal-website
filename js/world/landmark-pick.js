import * as THREE from 'three';
import { PICK_STOP } from './layout.js';
// Click a landmark to ride to its stop. Raycasts only the landmark groups (hidden procedural fallbacks share the authored model's footprint, so they count too).
// ponytail: hover test runs at most once per animation frame; swap for a precomputed screen-space hit list if landmark meshes get much heavier.
export function createLandmarkPicker({ canvas, camera, details, bus, onPick }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const targets = Object.keys(PICK_STOP).map((n) => details.getObjectByName(`${n}-geometry`)).filter(Boolean);
  if (bus) targets.push(bus); // the hero bus answers to a click too (horn)
  const stopAt = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let o = ray.intersectObjects(targets, true)[0]?.object;
    while (o && !o.name.endsWith('-geometry') && o !== bus) o = o.parent;
    if (!o) return null;
    return o === bus ? 'bus' : PICK_STOP[o.name.slice(0, -'-geometry'.length)];
  };
  let queued = null;
  const hover = (e) => {
    if (e.pointerType === 'touch') return;
    if (queued) { queued = e; return; }
    queued = e;
    requestAnimationFrame(() => { const ev = queued; queued = null; canvas.style.cursor = stopAt(ev) ? 'pointer' : ''; });
  };
  const click = (e) => { const id = stopAt(e); if (id) onPick(id); };
  canvas.addEventListener('pointermove', hover, { passive: true });
  canvas.addEventListener('click', click);
  return () => { canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('click', click); };
}
