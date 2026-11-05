import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { loadGlb } from './glb-loader.js';

const VERSION = '11', NEAR = 140, FAR = 170;
const ASSETS = {
  copan: ['copan.lod0.glb', 'copan.lod1.glb'],
  'london-eye': ['london-eye.lod0.glb', 'london-eye.lod1.glb'],
  riverside: ['riverside.lod0.glb', 'riverside.lod1.glb'],
  university: ['university.lod0.glb', 'university.lod1.glb'],
  wembley: ['wembley.lod0.glb', 'wembley.lod1.glb'],
};
const pending = new Map();
export const authoredLandmarksForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('landmarks') === 'procedural';

function load(name) {
  if (!pending.has(name)) {
    const urls = ASSETS[name].map((file) => new URL(`../../assets/processed/landmarks/${file}?v=${VERSION}`, import.meta.url).href);
    pending.set(name, Promise.all(urls.map(loadGlb)).catch(() => null));
  }
  return pending.get(name);
}

function prepare(root, name, { track, env }) {
  const materials = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone();
    const own = (m) => {
      if (!materials.has(m)) materials.set(m, m.clone());
      return materials.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.receiveShadow = true;
    o.castShadow = name === 'london-eye'
      ? ['eye-rim', 'eye-pods', 'eye-frame-footing'].includes(o.name)
      : mats.some((m) => m.name === 'Mass');
    for (const m of mats) {
      if (name === 'london-eye' && o.name === 'eye-rim') {
        m.userData.glow = true;
        m.userData.glowColor = new THREE.Color(P.eyeRim);
        m.userData.glowK = 0.45;
      } else if (name === 'copan' && m.name === 'Glass' && m.emissiveMap) {
        m.userData.glow = true;
        m.userData.glowColor = new THREE.Color('#ffffff');
        m.userData.glowK = 1.4;
        m.emissive.setRGB(0, 0, 0);
      } else if ((m.name === 'Glass' && name === 'university') || (name === 'london-eye' && o.name === 'eye-pods')) {
        m.userData.glow = true;
        m.userData.glowColor = new THREE.Color(name === 'london-eye' ? P.eyePod : '#ffe1b5');
        m.userData.glowK = name === 'london-eye' ? 0.3 : 0.7;
      } else if (name === 'wembley' && m.name === 'Glass') {
        m.userData.glow = true;
        m.userData.glowColor = new THREE.Color('#c7dcf0');
        m.userData.glowK = 0.32;
      }
      track?.(m);
      env?.register(m, { k: name === 'riverside' && m.name === 'Glass' ? 1.2 : 0.85, metal: m.metalness });
    }
  });
}

function disposeRoots(group, roots) {
  const fallback = group.userData.dispose;
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    roots.forEach((root) => group.remove(root));
    fallback?.();
    for (const root of roots) root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.dispose();
    });
  };
}

function hideStructure(group, prefix) {
  for (const child of group.children) if (new RegExp(`^${prefix}-(mass|trim|glass)$`).test(child.name)) child.visible = false;
}

function lodController(roots) {
  const bounds = roots.map((root) => new THREE.Box3().setFromObject(root));
  let level = 0;
  return {
    update(position) {
      const d = bounds[0].distanceToPoint(position), next = d < NEAR ? 0 : d > FAR ? 1 : level;
      if (next !== level) {
        level = next;
        roots.forEach((root, i) => { root.visible = i === level; });
      }
    },
  };
}

export async function upgradeAuthoredLandmark(group, name, options) {
  if (!ASSETS[name]) return null;
  const source = await load(name);
  if (!source || options.isDisposed()) return null;
  const roots = source.map((root, i) => {
    const clone = root.clone(true);
    clone.name = `${name}-glb-lod${i}`;
    clone.visible = i === 0;
    prepare(clone, name, options);
    return clone;
  });
  hideStructure(group, name);
  group.add(...roots);
  group.updateWorldMatrix(true, true);
  disposeRoots(group, roots);
  return lodController(roots);
}

export async function upgradeLondonEye(wheel, frame, options) {
  const source = await load('london-eye');
  if (!source || options.isDisposed()) return null;
  const rimMaterial = wheel.getObjectByName('eye-rim').material;
  const podMaterial = wheel.getObjectByName('eye-pods').material;
  const wheels = [], frames = [];
  for (const [i, root] of source.entries()) {
    const wheelRoot = root.getObjectByName('eye-wheel'), frameRoot = root.getObjectByName('eye-frame');
    if (!wheelRoot || !frameRoot) return null;
    const wheelLod = wheelRoot.clone(true), frameLod = frameRoot.clone(true);
    wheelLod.name = `london-eye-wheel-lod${i}`;
    frameLod.name = `london-eye-frame-lod${i}`;
    wheelLod.visible = frameLod.visible = i === 0;
    prepare(wheelLod, 'london-eye', options);
    prepare(frameLod, 'london-eye', options);
    const rim = wheelLod.getObjectByName('eye-rim').material, pods = wheelLod.getObjectByName('eye-pods').material;
    rim.color.copy(rimMaterial.color);
    pods.color.copy(podMaterial.color);
    for (const [target, original] of [[rim, rimMaterial], [pods, podMaterial]]) {
      target.userData.glow = original.userData.glow;
      target.userData.glowColor = original.userData.glowColor?.clone();
      target.userData.glowK = original.userData.glowK;
    }
    wheels.push(wheelLod);
    frames.push(frameLod);
  }
  for (const child of wheel.children) child.visible = false;
  hideStructure(frame, 'eyeframe');
  wheel.add(...wheels);
  frame.add(...frames);
  wheel.updateWorldMatrix(true, true);
  frame.updateWorldMatrix(true, true);
  disposeRoots(frame, frames);
  const boxes = wheels.map((root, i) => new THREE.Box3().setFromObject(root).union(new THREE.Box3().setFromObject(frames[i])));
  let level = 0;
  return {
    update(position) {
      const d = boxes[0].distanceToPoint(position), next = d < NEAR ? 0 : d > FAR ? 1 : level;
      if (next !== level) {
        level = next;
        wheels.forEach((root, i) => { root.visible = frames[i].visible = i === level; });
      }
    },
  };
}
