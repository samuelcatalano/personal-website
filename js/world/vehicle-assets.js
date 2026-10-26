import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { fixed, paint } from './vehicles.js';
import { destMat } from './buses.js';
// Authored vehicle GLBs (tools/vehicles/*), loaded once and shared. Resolves null on failure so callers keep their procedural model.
const URLS = { a330: 'a330.glb', bus: 'double-decker-bus.glb', mini: 'mini-cooper.glb', cab: 'london-cab.glb' };
const cache = new Map();
let fleetCatalog;
export function loadFleetCatalog() {
  return fleetCatalog ??= fetch(new URL('../../tools/vehicles/regional-fleet/models.json', import.meta.url))
    .then((r) => { if (!r.ok) throw Error('Fleet catalog unavailable'); return r.json(); })
    .then((data) => data.models).catch(() => []);
}
export function regionalFleetModel(catalog, region, slot) {
  const pool = catalog.filter((m) => [].concat(m.region).includes(region)); // region: "uk" | "br" | ["uk","br"]
  return pool[slot % pool.length];
}
export function loadVehicleAsset(type) {
  if (!cache.has(type)) cache.set(type, (async () => {
    const path = URLS[type] ? 'assets/vehicles/' + URLS[type] : (await loadFleetCatalog()).find((m) => m.id === type)?.path;
    if (!path) return null;
    return new GLTFLoader().loadAsync(new URL('../../' + path, import.meta.url).href).then((g) => g.scene);
  })().catch(() => null));
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
// Realistic finish for the authored cars: clear-coated paint, metal chrome and reflective glass, all lit by one small
// prefiltered studio environment generated in-browser (no texture download). Only these materials get it, so the rest of
// the scene keeps its approved look; intensity follows day/night (updateVehicleEnv).
let envTex = null; const envMats = new Set(), physCache = new Map();
const CAB_ENV_NIGHT = [['cabBody', 0.16], ['cabGlass', 0.28], ['cabTrim', 0.18]];
export function initVehicleEnv(renderer) {
  if (envTex) return;
  const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  for (const m of envMats) { m.envMap = envTex; m.needsUpdate = true; }
}
export function updateVehicleEnv(night) {
  for (const m of envMats) m.envMapIntensity = m.userData.envDay * (1 - 0.94 * night);
  for (const [key, floor] of CAB_ENV_NIGHT) {
    const m = physCache.get(key); if (m) m.envMapIntensity = m.userData.envDay * (1 - night) + floor * night;
  }
  const glass = physCache.get('glass'); if (glass) glass.envMapIntensity = glass.userData.envDay * (1 - night) + 0.13 * night;
  const fleetLights = physCache.get('fleetLights'); if (fleetLights) fleetLights.emissiveIntensity = 0.9 * night;
  const lights = physCache.get('cabLights'); if (lights) lights.emissiveIntensity = 0.9 * night;
}
const phys = (key, make) => physCache.get(key) ?? physCache.set(key, (() => {
  const m = make(); m.userData.envDay = m.envMapIntensity; if (envTex) m.envMap = envTex; envMats.add(m); return m;
})()).get(key);
const carPaint = (c) => phys('paint' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.28 }));
const CAR_FINISH = {
  CarChrome: () => phys('chrome', () => new THREE.MeshPhysicalMaterial({ color: '#e4e6e8', roughness: 0.14, metalness: 1, envMapIntensity: 0.7 })),
  CarRim: () => phys('rim', () => new THREE.MeshPhysicalMaterial({ color: '#4a4e54', roughness: 0.28, metalness: 0.85, clearcoat: 0.6, envMapIntensity: 0.5 })),
  CarGlass: () => phys('glass', () => { const m = new THREE.MeshPhysicalMaterial({ color: '#809096', roughness: 0.08, metalness: 0.05, envMapIntensity: 0.24, transparent: true, opacity: 0.58, depthWrite: false }); return m; }),
  CarTrim: () => phys('trim', () => new THREE.MeshPhysicalMaterial({ color: '#16181b', roughness: 0.55, metalness: 0, clearcoat: 0.3, envMapIntensity: 0.25 })),
};
const CAB_FINISH = {
  CabBody: () => phys('cabBody', () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.008, 0.009, 0.011), vertexColors: true, roughness: 0.29, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.28 })),
  CabGlass: () => phys('cabGlass', () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.055, 0.085, 0.10), vertexColors: true, roughness: 0.12, metalness: 0.05, envMapIntensity: 0.6, transparent: true, opacity: 0.32, depthWrite: false })),
  CabRubber: () => phys('cabRubber', () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.015, 0.018, 0.021), vertexColors: true, roughness: 0.8, envMapIntensity: 0.1 })),
  CabTrim: () => phys('cabTrim', () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.53, 0.57, 0.61), vertexColors: true, roughness: 0.23, metalness: 0.8, envMapIntensity: 0.7 })),
  CabInterior: () => phys('cabInterior', () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.075, 0.081, 0.088), vertexColors: true, roughness: 0.85, envMapIntensity: 0.1 })),
  CabLights: () => phys('cabLights', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.22, emissive: 0xffffff, emissiveIntensity: 0, envMapIntensity: 0.15 });
    // Three's vertex colors tint diffuse only; keep the shared lamp emission red/amber/white too.
    m.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'); };
    return m;
  }),
};
const ROLES = {
  ...CAB_FINISH,
  BusBody: (v) => paint(v.body, true), BusAccent: (v) => paint(v.accent, true), BusTrim: () => fixed('dark'), BusGlass: () => fixed('busGlass'),
  BusRubber: () => fixed('tyre'), BusMetal: () => fixed('chrome'), BusHeadlight: () => fixed('head'), BusTaillight: () => fixed('tail'),
  BusDisplay: (v) => destMat(...v.dest), BusInterior: () => fixed('cabin'),
  CarBody: (v) => carPaint(v.body), CarRoof: (v) => carPaint(v.roof), CarGlass: CAR_FINISH.CarGlass, CarTrim: CAR_FINISH.CarTrim, CarInterior: () => phys('miniInterior', () => new THREE.MeshStandardMaterial({ color: '#655d51', roughness: 0.85, envMapIntensity: 0.18 })), CarPlate: () => fixed('plate'), CarRim: CAR_FINISH.CarRim,
  CarChrome: CAR_FINISH.CarChrome, CarHeadlight: () => fixed('head'), CarTaillight: () => fixed('tail'),
};
const FLEET_FINISH = {
  FleetBody: (v) => phys('fleetBody' + v.body, () => new THREE.MeshPhysicalMaterial({ color: v.body, vertexColors: true, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.28 })),
  FleetGlass: () => phys('fleetGlass', () => new THREE.MeshPhysicalMaterial({ color: '#a4b4bb', vertexColors: true, roughness: 0.12, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 0.32 })),
  FleetTrim: () => phys('fleetTrim', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.45, envMapIntensity: 0.35 })),
  FleetRubber: () => phys('fleetRubber', () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, envMapIntensity: 0.1 })),
  FleetInterior: () => phys('fleetInterior', () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, envMapIntensity: 0.1 })),
  FleetLights: () => phys('fleetLights', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.22, emissive: 0xffffff, emissiveIntensity: 0, envMapIntensity: 0.15 });
    m.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'); };
    return m;
  }),
};
const CASTS = new Set(['BusBody', 'CarBody', 'CarRoof', 'CabBody']); // only painted shells cast: trim/glass/wheels add shadow-pass calls for no visible gain
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
const staticWheels = new Map(); // ambient vehicles never spin their wheels: one merged geometry per wheel material per asset, shared
function mergedWheels(key, src) {
  if (staticWheels.has(key)) return staticWheels.get(key);
  const byMat = new Map(); src.updateMatrixWorld(true);
  for (const n of WHEELS) src.getObjectByName(n)?.traverse((o) => { if (o.isMesh) (byMat.get(o.material.name) ?? byMat.set(o.material.name, []).get(o.material.name)).push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  return staticWheels.set(key, [...byMat].map(([name, gs]) => [name, mergeGeometries(gs)])).get(key);
}
// Swap a procedural vehicle's body for a shared authored GLB (geometry shared, materials per palette). Procedural stays on failure.
function upgrade(vehicle, key, v, hero, isDisposed = () => false) {
  return loadVehicleAsset(key).then((src) => {
    if (!src || isDisposed()) return;
    const glb = src.clone(true);
    if (!hero) {
      for (const n of WHEELS) { const w = glb.getObjectByName(n); w?.parent.remove(w); }
      for (const [name, g] of mergedWheels(key, src)) glb.add(Object.assign(new THREE.Mesh(g, { name }), { name: 'Wheels-static' }));
    }
    glb.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name.replace(/\.\d+$/, '');
      o.material = (FLEET_FINISH[name] ?? ROLES[name])?.(v) ?? o.material;
      if (FLEET_FINISH[name]) o.material.name = name;
      o.castShadow = CASTS.has(name) || name === 'FleetBody'; o.receiveShadow = true;
    });
    adoptVisual(vehicle, glb, ['beam']);
    vehicle.userData.wheels = WHEELS.map((n) => glb.getObjectByName(n)).filter(Boolean);
  });
}
export const upgradeBus = (vehicle, variant, { hero = true, isDisposed } = {}) => upgrade(vehicle, 'bus', BUS_VARIANTS[variant], hero, isDisposed);
// London master approved 2026-10-22; geometry frozen (tools/vehicles/double-decker-bus)
export const upgradeMini = (vehicle, { hero = true, body = '#efe7d6', roof = '#c9252b', isDisposed } = {}) => upgrade(vehicle, 'mini', { body, roof }, hero, isDisposed);
export const upgradeCab = (vehicle, { isDisposed } = {}) => upgrade(vehicle, 'cab', {}, false, isDisposed);
export async function upgradeFleet(vehicle, model, { body = '#2f6fcf', isDisposed } = {}) {
  await upgrade(vehicle, model.id, { body }, false, isDisposed);
  if (isDisposed?.() || !vehicle.children.some((c) => c.name === vehicle.name + '-glb')) return;
  Object.assign(vehicle.userData, { fleetModel: model.id, length: model.dimensions.length,
    front: Math.max(...model.beamAnchors.front.map((p) => p[0])), beamY: model.beamAnchors.front[0][1], beamAnchors: model.beamAnchors });
}
