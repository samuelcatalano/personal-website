import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fixed, paint } from './vehicles.js';
import { destMat } from './buses.js';
// Authored vehicle GLBs (tools/vehicles/*), loaded once and shared. Resolves null on failure so callers keep their procedural model.
const URLS = { a330: 'a330.glb', bus: 'double-decker-bus.glb' };
const cache = new Map();
export function loadVehicleAsset(type) {
  if (!cache.has(type)) cache.set(type, new GLTFLoader().loadAsync(new URL('../../assets/vehicles/' + URLS[type], import.meta.url).href).then((g) => g.scene).catch(() => null));
  return cache.get(type);
}
// Swap a procedural vehicle's body for the GLB, keeping its behaviour children (nav lights, beams...) named in `keep`.
export function adoptVisual(vehicle, visual, keep) {
  for (const c of [...vehicle.children]) if (!keep.includes(c.name)) vehicle.remove(c);
  visual.name = vehicle.name + '-glb';
  vehicle.add(visual);
}
// One double-decker geometry; London/Glasgow differ only by palette. GLB material names are semantic and are replaced by the
// project's shared materials (so night glow, cabin light and destination displays keep working through sky.update).
export const BUS_VARIANTS = {
  london: { body: '#c9252b', accent: '#8f171d', dest: ['london', '19', 'Finsbury Park', '#ffb347'] },
  glasgow: { body: '#8a36ae', accent: '#c9cdd2', dest: ['glasgow', '6', 'Renfrew Street', '#ff7a1a'] },
};
const role = (name, v) => ({
  BusBody: () => paint(v.body, true), BusAccent: () => paint(v.accent, true), BusTrim: () => fixed('dark'), BusGlass: () => fixed('busGlass'),
  BusRubber: () => fixed('tyre'), BusMetal: () => fixed('chrome'), BusHeadlight: () => fixed('head'), BusTaillight: () => fixed('tail'),
  BusDisplay: () => destMat(...v.dest), BusInterior: () => fixed('cabin'),
}[name.replace(/\.\d+$/, '')]?.());
const BUS_GLB_ENABLED = true; // London master approved 2026-10-22; geometry frozen (tools/vehicles/double-decker-bus)
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
let staticWheels; // ambient buses never spin their wheels: one merged geometry per wheel material, shared by every ambient bus
function mergedWheels(src) {
  if (staticWheels) return staticWheels;
  const byMat = new Map(); src.updateMatrixWorld(true);
  for (const n of WHEELS) src.getObjectByName(n)?.traverse((o) => { if (o.isMesh) (byMat.get(o.material.name) ?? byMat.set(o.material.name, []).get(o.material.name)).push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  return (staticWheels = [...byMat].map(([name, gs]) => [name, mergeGeometries(gs)]));
}
export function upgradeBus(vehicle, variant, { hero = true } = {}) {
  if (!BUS_GLB_ENABLED) return Promise.resolve();
  return loadVehicleAsset('bus').then((src) => {
    if (!src) return;
    const v = BUS_VARIANTS[variant], glb = src.clone(true); // clone shares geometry; materials are swapped per variant below
    if (!hero) {
      for (const n of WHEELS) { const w = glb.getObjectByName(n); w?.parent.remove(w); }
      for (const [name, g] of mergedWheels(src)) glb.add(Object.assign(new THREE.Mesh(g, { name }), { name: 'Wheels-static' }));
    }
    glb.traverse((o) => {
      if (!o.isMesh) return;
      const cast = o.material.name === 'BusBody'; // only the painted shell casts: wheels/trim/glass add shadow-pass calls for no visible gain
      o.material = role(o.material.name, v) ?? o.material;
      o.castShadow = cast;
      o.receiveShadow = true;
    });
    adoptVisual(vehicle, glb, ['beam']);
    vehicle.userData.wheels = ['FL', 'FR', 'RL', 'RR'].map((n) => glb.getObjectByName(n)).filter(Boolean);
  });
}
