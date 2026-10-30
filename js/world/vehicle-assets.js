import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { fixed, paint } from './vehicles.js';
import { destMat } from './buses.js';
// Authored vehicle GLBs (tools/vehicles/*), loaded once and shared. Resolves null on failure so callers keep their procedural model.
const URLS = { a330: 'a330.glb', bus: 'double-decker-bus.glb', 'sao-paulo': 'sao-paulo-bus.glb', mini: 'mini-cooper-2011.glb', cab: 'london-cab.glb' };
// Production GLBs (tools/pipeline: weld/simplify/Meshopt) are the default; ?glb=raw forces the raw source GLB, and a failed processed load falls back to it.
const PROCESSED = { mini: 'processed/vehicles/mini-cooper-2011.lod0.glb' };
// Fleet models with a processed GLB (same coordinates, so catalog axles/beam anchors still apply). honda-hr-v stays raw: its triangles share no vertices, so it cannot be simplified.
for (const id of ['toyota-corolla', 'vw-t-cross', 'nissan-qashqai', 'land-rover-range-rover', 'mercedes-e63-amg-s-wagon']) PROCESSED[id] = `processed/vehicles/${id}.glb`;
const PIPELINE_V = '6'; // bump when processed GLBs are regenerated (cache busting)
const useProcessed = typeof location === 'undefined' || new URLSearchParams(location.search).get('glb') !== 'raw';
const cache = new Map();
let fleetCatalog;
export function loadFleetCatalog() {
  return fleetCatalog ??= fetch(new URL('../../tools/vehicles/regional-fleet/models.json', import.meta.url), { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw Error('Fleet catalog unavailable'); return r.json(); })
    .then((data) => data.models).catch(() => []);
}
export function regionalFleetModel(catalog, region, slot) {
  const pool = catalog.filter((m) => [].concat(m.region).includes(region)); // region: "uk" | "br" | ["uk","br"]
  return pool[slot % pool.length];
}
export function loadVehicleAsset(type) {
  if (!cache.has(type)) cache.set(type, (async () => {
    const model = URLS[type] ? null : (await loadFleetCatalog()).find((m) => m.id === type);
    const raw = URLS[type] ? 'assets/vehicles/' + URLS[type] : model?.path, tries = [useProcessed && PROCESSED[type] ? 'assets/' + PROCESSED[type] : null, raw].filter(Boolean);
    for (const path of tries) { // processed first, raw source as fallback
      const url = new URL('../../' + path, import.meta.url); if (type === 'bus') url.searchParams.set('v', 'w2'); // bump when the bus GLB is rebuilt
      if (model?.sha256) url.searchParams.set('v', path === raw ? model.sha256 : PIPELINE_V + model.sha256.slice(0, 8));
      try { return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url.href)).scene; } catch { /* next candidate */ }
    }
    return null;
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
  london: { body: '#9e2a2b', accent: '#6a1c1e', dest: ['london', '19', 'Finsbury Park', '#ffb347'] }, // no stripe: BusStripe falls back to the body red
  'sao-paulo': { body: '#0a8f3c', accent: '#9bd02a', sweep: '#e6eee6', dest: ['sao-paulo', '', '', '#ffb347'] },
  // stylised First-Glasgow-style repaint (colour blocking only, no logos/text): purple body and white roof, white + lilac diagonal sweep, pale-violet rear, magenta line; the London roundel is painted out
  glasgow: { body: '#5b2a86', accent: '#33174f', stripe: '#e0398f', skirtF: '#33174f', sweep: '#f1eef6', lilac: '#b79ad6', rear: '#7b4bb0', mark: '#7b4bb0', mark2: '#7b4bb0', dest: ['glasgow', '6', 'Renfrew Street', '#ff7a1a'] },
};
// GLB material names are semantic; each maps to a shared project material (night glow keeps working through sky.update).
// Realistic finish for the authored cars: clear-coated paint, metal chrome and reflective glass, all lit by one small
// prefiltered studio environment generated in-browser (no texture download). Only these materials get it, so the rest of
// the scene keeps its approved look; intensity follows day/night (updateVehicleEnv).
let envTex = null; const envMats = new Set(), physCache = new Map();
const CAB_ENV_NIGHT = [['cabBody', 0.16], ['cabGlass', 0.28], ['cabTrim', 0.18], ['fleetGlass', 0.2], ['busGlass', 0.0], ['busWheel', 0.35]];
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
  const bg = physCache.get('busGlass'); if (bg) { bg.emissive ??= new THREE.Color(); bg.emissive.set('#ffe0b0').multiplyScalar(0.022 * night); } // saloon light through the glass
  const fleetLights = physCache.get('fleetLights'); if (fleetLights) fleetLights.emissiveIntensity = 0.9 * night;
  const lights = physCache.get('cabLights'); if (lights) lights.emissiveIntensity = 0.9 * night;
}
const phys = (key, make) => physCache.get(key) ?? physCache.set(key, (() => {
  const m = make(); m.userData.envDay = m.envMapIntensity; if (envTex) m.envMap = envTex; envMats.add(m); return m;
})()).get(key);
// Shader tweaks chained onto a material (fade.js chains its dither after them). Underbody: darkens paint toward the ground (sills,
// arches, shadowed lower body) from the model-space height. Fresnel: glass turns opaque/mirror-like at grazing angles.
const tweak = (m, key, vert, frag) => {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => { prev?.(s, r); s.vertexShader = vert(s.vertexShader); s.fragmentShader = frag(s.fragmentShader); };
  m.customProgramCacheKey = () => key; return m;
};
const lowAO = (m) => tweak(m, 'lowAO', (v) => 'varying float vH;\n' + v.replace('#include <begin_vertex>', '#include <begin_vertex>\n vH = position.y;'),
  (f) => 'varying float vH;\n' + f.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.32, 1.0, smoothstep(0.1, 0.55, vH));'));
const fresnel = (m, a0) => tweak(m, 'fres' + a0, (v) => v,
  (f) => f.replace('#include <opaque_fragment>', 'diffuseColor.a = mix(' + a0.toFixed(2) + ', 1.0, pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.5));\n#include <opaque_fragment>'));
const carPaint = (c) => phys('paint' + c, () => lowAO(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.34, metalness: c === '#f2f0e9' ? 0.24 : 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.34 })));
const busPaint = (c) => phys('busPaint' + c, () => lowAO(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.06 })));
// Automotive glass: dark blue-green tint, mirror-like at grazing angles, clearer head-on; vertex colours (where authored) carry the frit border.
const glass = (key, color, a0, env, vc) => phys(key, () => fresnel(new THREE.MeshPhysicalMaterial({ color, vertexColors: !!vc, roughness: 0.04, metalness: 0, envMapIntensity: env, transparent: true, opacity: a0, depthWrite: false }), a0));
const CAR_FINISH = {
  CarChrome: () => phys('chrome', () => new THREE.MeshPhysicalMaterial({ color: '#e4e6e8', roughness: 0.14, metalness: 1, envMapIntensity: 0.7 })),
  CarRim: () => phys('rim', () => new THREE.MeshPhysicalMaterial({ color: '#4a4e54', roughness: 0.28, metalness: 0.85, clearcoat: 0.6, envMapIntensity: 0.5 })),
  CarGlass: () => glass('glass', '#08141b', 0.78, 0.6),
  CarTrim: () => phys('trim', () => new THREE.MeshPhysicalMaterial({ color: '#16181b', roughness: 0.55, metalness: 0, clearcoat: 0.3, envMapIntensity: 0.25 })),
};
const CAB_FINISH = {
  CabBody: () => phys('cabBody', () => lowAO(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.008, 0.009, 0.011), vertexColors: true, roughness: 0.29, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.4 }))),
  CabGlass: () => glass('cabGlass', new THREE.Color(0.05, 0.085, 0.10), 0.62, 0.6, true),
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
  BusBody: (v) => busPaint(v.body), BusAccent: (v) => busPaint(v.accent), BusStripe: (v) => busPaint(v.stripe ?? v.body), BusSkirtF: (v) => busPaint(v.skirtF ?? v.accent), BusSweep: (v) => busPaint(v.sweep ?? v.body), BusLilac: (v) => busPaint(v.lilac ?? v.body), BusRear: (v) => busPaint(v.rear ?? v.body), BusMark: (v) => busPaint(v.mark ?? '#f0efe9'), BusMark2: (v) => busPaint(v.mark2 ?? '#1c3f94'), BusTrim: () => fixed('dark'), BusGlass: () => glass('busGlass', '#07121a', 0.96, 0.6),
  BusRubber: () => fixed('tyre'), BusMetal: () => fixed('chrome'), BusWheel: () => phys('busWheel', () => new THREE.MeshPhysicalMaterial({ color: '#c3c8cd', roughness: 0.38, metalness: 0.45, envMapIntensity: 0.55 })), // painted steel wheel disc: env-lit (floor kept at night) so it never goes black BusHeadlight: () => fixed('head'), BusTaillight: () => fixed('tail'),
  BusDisplay: (v) => destMat(...v.dest), BusInterior: () => fixed('dark'), // the authored glazing is large: the shared warm 'cabin' glow would flood it cream at night, so the glow comes from busGlass only
  CarBody: (v) => carPaint(v.body), CarRoof: (v) => carPaint(v.roof), CarStripe: () => carPaint('#f2f0e9'), CarGlass: CAR_FINISH.CarGlass, CarTrim: CAR_FINISH.CarTrim, CarInterior: () => phys('miniInterior', () => new THREE.MeshStandardMaterial({ color: '#655d51', roughness: 0.85, envMapIntensity: 0.18 })), CarPlate: () => fixed('plate'), CarRim: CAR_FINISH.CarRim,
  CarChrome: CAR_FINISH.CarChrome, CarHeadlight: () => fixed('head'), CarTaillight: () => fixed('tail'),
};
const FLEET_FINISH = {
  FleetBody: (v) => phys('fleetBody' + v.body, () => lowAO(new THREE.MeshPhysicalMaterial({ color: v.body, vertexColors: true, roughness: 0.34, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.34 }))),
  FleetGlass: () => glass('fleetGlass', '#2c3f48', 0.72, 0.6, true),
  FleetTrim: () => phys('fleetTrim', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.45, envMapIntensity: 0.35 })),
  FleetRubber: () => phys('fleetRubber', () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, envMapIntensity: 0.1 })),
  FleetInterior: () => phys('fleetInterior', () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, envMapIntensity: 0.1 })),
  FleetLights: (v) => phys(v.parked ? 'fleetLightsOff' : 'fleetLights', () => { // parked cars own an unlit copy: updateVehicleEnv only drives 'fleetLights'
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.22, emissive: 0xffffff, emissiveIntensity: 0, envMapIntensity: 0.15 });
    m.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'); };
    return m;
  }),
};
const CASTS = new Set(['BusBody', 'BusAccent', 'BusStripe', 'BusSkirtF', 'BusSweep', 'BusLilac', 'BusRear', 'BusMark', 'BusMark2', 'CarBody', 'CarRoof', 'CabBody']); // only painted shells cast: trim/glass/wheels add shadow-pass calls for no visible gain
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
export const rollWheels = (wheels, distance) => wheels.forEach((w) => { w.rotation.z -= distance / (w.userData.radius ?? w.position.y); });
// Weld UV/normal seams for connectivity only; never cut a tyre or body panel by triangle centroid.
function wheelComponents(g, classify) {
  const p = g.attributes.position, idx = g.index.array, parent = new Int32Array(p.count), positions = new Map();
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i)*1e5)},${Math.round(p.getY(i)*1e5)},${Math.round(p.getZ(i)*1e5)}`;
    parent[i] = positions.get(key) ?? i; if (!positions.has(key)) positions.set(key, i);
  }
  for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]); parent[find(idx[i+1])] = a; parent[find(idx[i+2])] = a; }
  const pieces = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const root = find(idx[i]), piece = pieces.get(root) ?? { triangles: [], votes: [0,0], count: 0 };
    let x=0,y=0,z=0; for(let k=0;k<3;k++){x+=p.getX(idx[i+k])/3;y+=p.getY(idx[i+k])/3;z+=p.getZ(idx[i+k])/3;}
    const a=classify(x,y,z); if(a>=0)piece.votes[a]++; piece.count++; piece.triangles.push(idx[i],idx[i+1],idx[i+2]); pieces.set(root,piece);
  }
  const keep=[], wheels=[[],[]];
  for(const piece of pieces.values()) {
    const a=piece.votes[0]>piece.votes[1]?0:1, target=piece.votes[a]/piece.count>.8?wheels[a]:keep;
    for(const i of piece.triangles)target.push(i);
  }
  return {keep,wheel:wheels};
}
// Dark static disc behind each wheel, appended to the body's rubber (no extra call): hides the authored tyre/rim gap that would flicker once spinning.
function withDiscs(g, keep, xs, r, half, seg = 20, centerY = r) {
  const base = g.attributes.position.count, n = base + xs.length * 2 * (seg + 1), out = new THREE.BufferGeometry(), index = [...keep];
  for (const k in g.attributes) { const a = g.attributes[k], b = new a.array.constructor(n * a.itemSize); b.set(a.array); out.setAttribute(k, new THREE.BufferAttribute(b, a.itemSize, a.normalized)); }
  const P = out.attributes.position, N = out.attributes.normal, C = out.attributes.color; let i = base;
  for (const x of xs) for (const sz of [-1, 1]) {
    const c = i;
    for (let k = -1; k < seg; k++, i++) {
      const t = k / seg * Math.PI * 2, rr = k < 0 ? 0 : r * 0.9;
      P.setXYZ(i, x + rr * Math.cos(t), centerY + rr * Math.sin(t), sz * (half - 0.05)); N?.setXYZ(i, 0, 0, sz); C?.setXYZ(i, 0.02, 0.02, 0.02); if (C?.itemSize === 4) C.setW(i, 1);
      if (k >= 0) index.push(...(sz > 0 ? [c, c + 1 + k, c + 1 + (k + 1) % seg] : [c, c + 1 + (k + 1) % seg, c + 1 + k]));
    }
  }
  out.setIndex(index); out.computeBoundingSphere(); return out;
}
// Ambient wheels spin per axle: both wheels of an axle share its line, so each axle is one geometry per wheel material pivoted on
// that line (two calls per material per car, vs one when static). Built once per asset and shared by every clone.
const axleCache = new Map();
function axleWheels(key, src, axles) {
  if (axleCache.has(key)) return axleCache.get(key);
  src.updateMatrixWorld(true);
  const res = { axles: [], body: new Map(), materials: new Map() }, push = (m, k, g) => (m.get(k) ?? m.set(k, []).get(k)).push(g);
  if (axles?.markers) { // São Paulo axle markers are empty; split embedded wheel triangles around all three pairs
    const pairs = [['FL', 'FR'], ['ML', 'MR'], ['RL', 'RR'], ['TL', 'TR']].filter((p) => src.getObjectByName(p[0])), centers = pairs.map((pair) => {
      const a = src.getObjectByName(pair[0]).getWorldPosition(new THREE.Vector3()), b = src.getObjectByName(pair[1]).getWorldPosition(new THREE.Vector3());
      return { name: pair.join('-'), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: [a.z, b.z] };
    }), r = axles.radius ?? 0.52, parts = pairs.map(() => []), v = new THREE.Vector3();
    src.traverse((o) => {
      if (!o.isMesh || !/(Rubber|Trim|Metal)/.test(o.material.name) || !o.geometry.index) return;
      const g = o.geometry, p = g.attributes.position, idx = g.index.array, keep = [], wheel = pairs.map(() => []);
      for (let t = 0; t < idx.length; t += 3) {
        v.set(0, 0, 0); for (let k = 0; k < 3; k++) v.x += p.getX(idx[t + k]) / 3, v.y += p.getY(idx[t + k]) / 3, v.z += p.getZ(idx[t + k]) / 3;
        const a = centers.findIndex((c) => Math.abs(v.z) > 0.3 && Math.hypot(v.x - c.x, v.y - c.y) < r + 0.005 && c.z.some((z) => Math.abs(v.z - z) < 0.24));
        (a < 0 ? keep : wheel[a]).push(idx[t], idx[t + 1], idx[t + 2]);
      }
      if (keep.length === idx.length) return;
      const sub = (list) => { const s = new THREE.BufferGeometry(); for (const n in g.attributes) s.setAttribute(n, g.attributes[n]); s.setIndex(list); return s; };
      res.body.set(o.material.name, /Rubber/.test(o.material.name) ? withDiscs(g, keep, centers.map((c) => c.x), r, 0.55) : sub(keep));
      wheel.forEach((list, a) => list.length && parts[a].push([o.material.name, sub(list), 1]));
    });
    centers.forEach(({ name, x, y }, a) => res.axles.push({ name, x, y, radius: r, parts: parts[a] }));
  } else if (src.getObjectByName('FL')) { // authored wheel nodes (Mini, bus): merge each axle's pair
    for (const pair of [['FL', 'FR'], ['RL', 'RR']]) {
      const c = src.getObjectByName(pair[0]).getWorldPosition(new THREE.Vector3()), byMat = new Map();
      for (const n of pair) src.getObjectByName(n).traverse((o) => { if (o.isMesh) push(byMat, o.material.name, o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-c.x, -c.y, 0)); });
      res.axles.push({ x: c.x, y: c.y, parts: [...byMat].map(([n, gs]) => [n, mergeGeometries(gs), 0]) });
    }
  } else if (axles) { // wheels merged into the rubber/trim meshes (fleet, cab): split their triangles inside the tyre cylinders by index
    const r = axles.wheelRadius ?? axles.height, y = axles.height, xs = [axles.front, axles.rear], parts = [[], []];
    src.traverse((o) => {
      if (!o.isMesh || (!/Rubber|Trim/.test(o.material.name) && !axles.wheelMaterials?.includes(o.material.name)) || !o.geometry.index) return;
      res.materials.set(o.material.name, o.material);
      const g = o.geometry, idx = g.index.array;
      const {keep,wheel} = wheelComponents(g, (vx,vy,vz) => Math.abs(vz) > axles.halfTrack - 0.28 ? xs.findIndex(x => Math.hypot(vx-x,vy-y)<r+.005) : -1);
      if (keep.length === idx.length) return;
      const sub = (list) => { const s = new THREE.BufferGeometry(); for (const n in g.attributes) s.setAttribute(n, g.attributes[n]); s.setIndex(list); return s; };
      res.body.set(o.material.name, /Rubber/.test(o.material.name) ? withDiscs(g, keep, xs, r, axles.halfTrack, 20, y) : sub(keep));
      wheel.forEach((list, a) => list.length && parts[a].push([o.material.name, sub(list), 1]));
    });
    xs.forEach((x, a) => {
      const box = new THREE.Box3(), point = new THREE.Vector3();
      for(const [,g] of parts[a])for(const i of g.index.array)box.expandByPoint(point.fromBufferAttribute(g.attributes.position,i));
      const center=box.isEmpty()?new THREE.Vector3(x,y,0):box.getCenter(new THREE.Vector3());
      res.axles.push({ x: center.x, y: center.y, radius: r, parts: parts[a] });
    });
  }
  return axleCache.set(key, res).get(key);
}
// Swap a procedural vehicle's body for a shared authored GLB (geometry shared, materials per palette). Procedural stays on failure.
function upgrade(vehicle, key, v, hero, isDisposed = () => false, axles) {
  return loadVehicleAsset(key).then((src) => {
    if (!src || isDisposed()) return;
    const glb = src.clone(true);
    let wheels = [];
    if (!hero) {
      for (const n of WHEELS) { const w = glb.getObjectByName(n); w?.parent.remove(w); }
      const split = axleWheels(key, src, axles);
      glb.traverse((o) => { if (o.isMesh && split.body.has(o.material.name)) o.geometry = split.body.get(o.material.name); });
      wheels = split.axles.map(({ name, x, y, radius, parts }) => {
        const w = new THREE.Group(); w.name = name ?? 'wheel'; w.position.set(x, y, 0); if (radius) w.userData.radius = radius;
        for (const [name, g, shared] of parts) { const m = new THREE.Mesh(g, split.materials.get(name) ?? { name }); if (shared) m.position.set(-x, -y, 0); w.add(m); } // shared: indexes the car-space buffer
        glb.add(w); return w;
      });
    }
    const paintMaterials = new Set(v.paintMaterials ?? []), paint = new Map();
    glb.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name.replace(/\.\d+$/, '');
      o.userData.role = name; // reskinBus maps it back to a livery
      if (paintMaterials.has(name)) {
        let m = paint.get(name);
        if (!m) {
          m = o.material.clone(); m.name = name; m.color.set(v.body); m.vertexColors = false;
          m.roughness = 0.28; m.metalness = 0.72; m.envMapIntensity = 0.48; m.userData.envDay = 0.48;
          if (envTex) m.envMap = envTex;
          envMats.add(m); paint.set(name, m);
        }
        o.material = m;
      } else o.material = (FLEET_FINISH[name] ?? ROLES[name])?.(v) ?? o.material;
      if (FLEET_FINISH[name]) o.material.name = name;
      o.castShadow = CASTS.has(name) || name === 'FleetBody' || !!v.shadowMaterials?.includes(name); o.receiveShadow = true;
    });
    adoptVisual(vehicle, glb, ['beam']);
    vehicle.userData.visualAsset = key;
    vehicle.userData.wheels = hero ? WHEELS.map((n) => glb.getObjectByName(n)).filter(Boolean) : wheels;
  });
}
// Re-livery an upgraded bus in place (shared cached materials, no allocation): ambient buses wear the livery of the region they are driving in.
export const reskinBus = (vehicle, variant) => vehicle.traverse((o) => { if (o.isMesh && o.userData.role) o.material = ROLES[o.userData.role]?.(BUS_VARIANTS[variant]) ?? o.material; });
export async function upgradeBus(vehicle, variant, { hero = true, isDisposed, asset = 'bus' } = {}) {
  const isSaoPaulo = asset.startsWith('sao-paulo');
  await upgrade(vehicle, asset, BUS_VARIANTS[variant], hero, isDisposed, isSaoPaulo ? { markers: true, radius: 0.52 } : undefined);
  if (!isSaoPaulo || isDisposed?.()) return;
  const glb = vehicle.getObjectByName(vehicle.name + '-glb'); if (!glb) return;
  const box = new THREE.Box3().setFromObject(glb), size = box.getSize(new THREE.Vector3()), beamY = 0.95, lampZ = size.z * 0.34;
  Object.assign(vehicle.userData, { length: size.x, dimensions: size.toArray(), front: box.max.x, beamY, beamAnchors: { front: [[box.max.x, beamY, -lampZ], [box.max.x, beamY, lampZ]], rear: [[box.min.x, beamY, -lampZ], [box.min.x, beamY, lampZ]] } });
}
// bus geometry: tools/vehicles/double-decker-bus-dd (supersedes the procedural tools/vehicles/double-decker-bus)
export const upgradeMini = (vehicle, { hero = true, body = '#f2f0e9', roof = '#c9252b', isDisposed } = {}) => upgrade(vehicle, 'mini', { body, roof }, hero, isDisposed);
export const upgradeCab = (vehicle, { isDisposed } = {}) => upgrade(vehicle, 'cab', {}, false, isDisposed);
// parked: static kerbside car (hero path keeps the authored wheels, no spinning axles) with unlit lamps
export async function upgradeFleet(vehicle, model, { body = '#2f6fcf', isDisposed, parked = false } = {}) {
  await upgrade(vehicle, model.id, { body, parked, paintMaterials: model.paintMaterials, shadowMaterials: model.shadowMaterials }, parked, isDisposed, model.axles);
  if (isDisposed?.() || !vehicle.children.some((c) => c.name === vehicle.name + '-glb')) return;
  Object.assign(vehicle.userData, { fleetModel: model.id, length: model.dimensions.length,
    front: Math.max(...model.beamAnchors.front.map((p) => p[0])), beamY: model.beamAnchors.front[0][1], beamAnchors: model.beamAnchors });
}
