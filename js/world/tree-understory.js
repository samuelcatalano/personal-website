import * as THREE from 'three';
import { createPlantGeometry, createPlantMaterial } from './plant-mesh.js';

export function addTreeUnderstory(group, placements) {
  const low = placements.flatMap((p, i) => (i % 3 === 0 && (p.base ?? 0.1) < 0.3 ? [{ p, i, side: -1 }, { p, i, side: 1 }] : []));
  if (!low.length) return null;
  const shrubs = new THREE.InstancedMesh(createPlantGeometry('shrub'), createPlantMaterial(), low.length);
  const o = new THREE.Object3D(); shrubs.name = 'tree-understory'; shrubs.receiveShadow = true;
  low.forEach(({ p, i, side }, k) => {
    const radius = p.crown * 0.16;
    o.position.set(p.x + side * p.crown * 0.17, (p.base ?? 0.1) + .012, p.z + Math.sin(i) * p.crown * 0.05); o.scale.set(radius * 2, .46, radius * 1.66); o.updateMatrix();
    shrubs.setMatrixAt(k, o.matrix); shrubs.setColorAt(k, new THREE.Color([0xe2e9d5, 0xcddbc0, 0xe7e2cd][Math.floor(i / 3) % 3]).offsetHSL(0, 0, ((i * 0.618) % 1 - 0.5) * 0.06));
  });
  shrubs.userData.sourceIndices = low.map((e) => e.i); shrubs.computeBoundingBox(); shrubs.computeBoundingSphere(); group.add(shrubs);
  return shrubs;
}
