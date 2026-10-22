import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
const BUS_GLB_ENABLED = false; // ponytail: bus GLB is NO-GO pending the geometry correction pass; procedural buses render meanwhile
export function upgradeBus(vehicle, variant) {
  if (!BUS_GLB_ENABLED) return Promise.resolve();
  return loadVehicleAsset('bus').then((src) => {
    if (!src) return;
    const v = BUS_VARIANTS[variant], glb = src.clone(true); // clone shares geometry; materials are swapped per variant below
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
