import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fixed, paint } from './vehicles.js';
import { destMat } from './buses.js';
// Authored vehicle GLBs (tools/vehicles/*), loaded once and shared. Resolves null on failure so callers keep their procedural model.
const URLS = { a330: 'a330.glb', bus: 'double-decker-bus.glb', mini: 'mini-cooper.glb' };
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
// GLB material names are semantic; each maps to a shared project material (night glow keeps working through sky.update).
const ROLES = {
  BusBody: (v) => paint(v.body, true), BusAccent: (v) => paint(v.accent, true), BusTrim: () => fixed('dark'), BusGlass: () => fixed('busGlass'),
  BusRubber: () => fixed('tyre'), BusMetal: () => fixed('chrome'), BusHeadlight: () => fixed('head'), BusTaillight: () => fixed('tail'),
  BusDisplay: (v) => destMat(...v.dest), BusInterior: () => fixed('cabin'),
  CarBody: (v) => paint(v.body, true), CarRoof: (v) => paint(v.roof, true), CarGlass: () => fixed('carGlass'), CarInterior: () => fixed('carInterior'), CarPlate: () => fixed('plate'), CarRim: () => fixed('rim'), CarTrim: () => fixed('dark'),
  CarChrome: () => fixed('chrome'), CarHeadlight: () => fixed('head'), CarTaillight: () => fixed('tail'),
};
const CASTS = new Set(['BusBody', 'CarBody', 'CarRoof']); // only painted shells cast: trim/glass/wheels add shadow-pass calls for no visible gain
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
const staticWheels = new Map(); // ambient vehicles never spin their wheels: one merged geometry per wheel material per asset, shared
function mergedWheels(key, src) {
  if (staticWheels.has(key)) return staticWheels.get(key);
  const byMat = new Map(); src.updateMatrixWorld(true);
  for (const n of WHEELS) src.getObjectByName(n)?.traverse((o) => { if (o.isMesh) (byMat.get(o.material.name) ?? byMat.set(o.material.name, []).get(o.material.name)).push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  return staticWheels.set(key, [...byMat].map(([name, gs]) => [name, mergeGeometries(gs)])).get(key);
}
// Swap a procedural vehicle's body for a shared authored GLB (geometry shared, materials per palette). Procedural stays on failure.
function upgrade(vehicle, key, v, hero) {
  return loadVehicleAsset(key).then((src) => {
    if (!src) return;
    const glb = src.clone(true);
    if (!hero) {
      for (const n of WHEELS) { const w = glb.getObjectByName(n); w?.parent.remove(w); }
      for (const [name, g] of mergedWheels(key, src)) glb.add(Object.assign(new THREE.Mesh(g, { name }), { name: 'Wheels-static' }));
    }
    glb.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name.replace(/\.\d+$/, '');
      o.material = ROLES[name]?.(v) ?? o.material; o.castShadow = CASTS.has(name); o.receiveShadow = true;
    });
    adoptVisual(vehicle, glb, ['beam']);
    vehicle.userData.wheels = WHEELS.map((n) => glb.getObjectByName(n)).filter(Boolean);
  });
}
export const upgradeBus = (vehicle, variant, { hero = true } = {}) => upgrade(vehicle, 'bus', BUS_VARIANTS[variant], hero);
// London master approved 2026-10-22; geometry frozen (tools/vehicles/double-decker-bus)
export const upgradeMini = (vehicle, { hero = true, body = '#efe7d6', roof = '#c9252b' } = {}) => upgrade(vehicle, 'mini', { body, roof }, hero);
