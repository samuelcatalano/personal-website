import * as THREE from 'three';
import { PICK_STOP } from './layout.js';
// Click a landmark to ride to its stop, or visible water to ripple it. Hover tests only landmark/bus targets and water.
// Hidden procedural landmark fallbacks share the authored model's footprint, so they count too.
// ponytail: hover test runs at most once per animation frame; swap for a precomputed screen-space hit list if landmark meshes get much heavier.
export function createLandmarkPicker({ canvas, camera, details, bus, onPick, scene, water }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const targets = Object.keys(PICK_STOP).map((n) => details.getObjectByName(`${n}-geometry`)).filter(Boolean);
  if (bus) targets.push(bus); // the hero bus answers to a click too (horn)
  const aim = (e) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const stopAt = (e) => {
    aim(e);
    const hit = ray.intersectObjects(targets, true)[0];
    if (hit && water && (ray.intersectObject(water.mesh)[0]?.distance ?? Infinity) < hit.distance) return null;
    let o = hit?.object;
    while (o && !o.name.endsWith('-geometry') && o !== bus) o = o.parent;
    if (!o) return null;
    return o === bus ? 'bus' : PICK_STOP[o.name.slice(0, -'-geometry'.length)];
  };
  let queued = null, down = null, moved = false, disposed = false;
  const start = (e) => { down = e.button === 0 && e.isPrimary ? { x: e.clientX, y: e.clientY } : null; moved = false; };
  const cancel = () => { down = null; };
  const hover = (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) moved = true;
    if (e.pointerType === 'touch') return;
    if (queued) { queued = e; return; }
    queued = e;
    requestAnimationFrame(() => { const ev = queued; queued = null; if (!disposed) canvas.style.cursor = stopAt(ev) ? 'pointer' : ''; });
  };
  const click = (e) => {
    const tapped = down && !moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 8;
    down = null;
    if (!tapped) return;
    const id = stopAt(e);
    if (id) { onPick(id); return; }
    if (!water || !scene) return;
    const hit = ray.intersectObject(water.mesh)[0];
    if (!hit) return;
    // Only raycast the city on a water tap; visible bridges, boats and buildings occlude it.
    const blockers = [];
    scene.traverseVisible(o => { if (o.isMesh && o !== water.mesh && [o.material].flat().some(m => m.visible && m.opacity > 0 && m.depthWrite)) blockers.push(o); });
    ray.far = hit.distance - 0.01;
    const blocked = ray.intersectObjects(blockers, false).length > 0;
    ray.far = Infinity;
    if (!blocked) water.ripple(hit.point.x, hit.point.z);
  };
  canvas.addEventListener('pointerdown', start, { passive: true });
  canvas.addEventListener('pointercancel', cancel, { passive: true });
  canvas.addEventListener('pointermove', hover, { passive: true });
  canvas.addEventListener('click', click);
  return () => { disposed = true; canvas.style.cursor = ''; canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('click', click); };
}
