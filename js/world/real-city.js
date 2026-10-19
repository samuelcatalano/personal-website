import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PALETTE as P } from './palette.js';
import { createBoxes, buildMeshes } from './voxel.js';

const loader = new GLTFLoader(), models = new Map();
const assets = {
  terrace: new URL('../../assets/city/pilot/terrace.glb', import.meta.url),
  midrise: new URL('../../assets/city/pilot/midrise.glb', import.meta.url),
  office: new URL('../../assets/city/pilot/office.glb', import.meta.url),
};

function fallback({ kind, width: w, depth: d, height: h }) {
  const { add, list } = createBoxes();
  add(0, 0, 0, w, h, d, kind === 'terrace' ? P.brick : P.concrete);
  add(0, h - 0.2, 0, w, 0.2, d, P.roof);
  const floors = Math.max(1, Math.floor(h / 3)), columns = Math.max(1, Math.floor(w / 3));
  for (let f = 0; f < floors; f++) for (let c = 0; c < columns; c++) {
    add(-w / 2 + (c + 0.5) * w / columns, (f + 0.3) * h / floors, d / 2 - 0.04, w / columns * 0.5, h / floors * 0.45, 0.08, P.glass);
  }
  return buildMeshes(list);
}

export async function buildRealCity(plots) {
  const city = new THREE.Group();
  city.name = 'real-city-pilot';
  const buildings = await Promise.all(plots.slice(0, 3).map(async plot => {
    if (assets[plot.kind] && !models.has(plot.kind)) {
      models.set(plot.kind, loader.loadAsync(assets[plot.kind].href).then(({ scene }) => {
        const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
        if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 0)) throw Error('Empty pilot model');
        scene.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        return scene;
      }).catch(() => null));
    }
    const template = await models.get(plot.kind), model = template ? template.clone(true) : fallback(plot);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    const building = new THREE.Group().add(model);
    building.name = plot.id;
    building.userData.fallback = !template;
    building.scale.setScalar(Math.min(plot.width / size.x, plot.height / size.y, plot.depth / size.z));
    building.position.set(plot.x, 0, plot.z);
    return building;
  }));
  return city.add(...buildings);
}
