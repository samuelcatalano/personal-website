import * as THREE from 'three';

export function addTreeUnderstory(group, placements) {
  const low = placements.flatMap((p, i) => (i % 3 === 0 && (p.base ?? 0.1) < 0.3 ? [{ p, i, side: -1 }, { p, i, side: 1 }] : []));
  if (!low.length) return null;
  const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), low.length);
  const o = new THREE.Object3D(); shrubs.name = 'tree-understory'; shrubs.receiveShadow = true;
  low.forEach(({ p, i, side }, k) => {
    const radius = p.crown * 0.16;
    o.position.set(p.x + side * p.crown * 0.17, (p.base ?? 0.1) + 0.24, p.z + Math.sin(i) * p.crown * 0.05); o.scale.set(radius, 0.22, radius * 0.83); o.updateMatrix();
    shrubs.setMatrixAt(k, o.matrix); shrubs.setColorAt(k, new THREE.Color([0x3a5a32, 0x4a6a34, 0x55703c][Math.floor(i / 3) % 3]).offsetHSL(0, 0, ((i * 0.618) % 1 - 0.5) * 0.06));
  });
  shrubs.userData.sourceIndices = low.map((e) => e.i); shrubs.computeBoundingBox(); shrubs.computeBoundingSphere(); group.add(shrubs);
  return shrubs;
}
