import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Authored vehicle GLBs (tools/vehicles/*), loaded once. Resolves null on failure so callers keep their procedural model.
const URLS = { a330: new URL('../../assets/vehicles/a330.glb', import.meta.url) };
const cache = new Map();
export function loadVehicleAsset(type) {
  if (!cache.has(type)) cache.set(type, new GLTFLoader().loadAsync(URLS[type].href).then((g) => g.scene).catch(() => null));
  return cache.get(type);
}
// Swap a procedural vehicle's body for the GLB, keeping its behaviour children (nav lights, beams...) named in `keep`.
export function adoptVisual(vehicle, visual, keep) {
  for (const c of [...vehicle.children]) if (!keep.includes(c.name)) { vehicle.remove(c); }
  visual.name = vehicle.name + '-glb';
  vehicle.add(visual);
}
