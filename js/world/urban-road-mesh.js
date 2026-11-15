import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from './palette.js';
import { blockMaterial } from './textures.js';

const CHUNK = 160;
const LEVEL = Object.freeze({ road: 0.08, sidewalk: 0.12, access: 0.12 });

export const inscribedAnchorWidth = (roadWidth, tx, tz) => roadWidth / (Math.abs(tx) + Math.abs(tz));

export function subtractRect(outer, hole) {
  const cut = { x0: Math.max(outer.x0, hole.x0), x1: Math.min(outer.x1, hole.x1), z0: Math.max(outer.z0, hole.z0), z1: Math.min(outer.z1, hole.z1) };
  if (cut.x1 <= cut.x0 || cut.z1 <= cut.z0) return [outer];
  return [
    { x0: outer.x0, x1: cut.x0, z0: outer.z0, z1: outer.z1 },
    { x0: cut.x1, x1: outer.x1, z0: outer.z0, z1: outer.z1 },
    { x0: cut.x0, x1: cut.x1, z0: outer.z0, z1: cut.z0 },
    { x0: cut.x0, x1: cut.x1, z0: cut.z1, z1: outer.z1 },
  ].filter(r => r.x1 > r.x0 && r.z1 > r.z0);
}

export function sampleRoadAnchors(boxes) {
  const anchors = [];
  for (const b of boxes) {
    if (b.color !== P.road || b.y + b.h > 0.061) continue;
    const ry = b.ry || 0, alongX = b.w >= b.d, length = Math.max(b.w, b.d), roadWidth = Math.min(b.w, b.d);
    const tx = alongX ? Math.cos(ry) : Math.sin(ry), tz = alongX ? -Math.sin(ry) : Math.cos(ry);
    const width = inscribedAnchorWidth(roadWidth, tx, tz), end = Math.max(0, length / 2 - roadWidth / 2);
    for (let along = -end; ; along = Math.min(end, along + 5)) {
      anchors.push({ x: b.x + along * tx, z: b.z + along * tz, width });
      if (along >= end) break;
    }
  }
  return anchors;
}

export function createUrbanRoadMeshes(rects) {
  const group = new THREE.Group();
  group.name = 'urban-road-surfaces';
  const materials = { road: blockMaterial(P.road), sidewalk: blockMaterial(P.pave) };
  const chunks = new Map();
  for (const source of rects) {
    let x0 = source.x - source.w / 2, x1 = source.x + source.w / 2;
    while (x0 < x1) {
      const cell = Math.floor(x0 / CHUNK), edge = Math.min(x1, (cell + 1) * CHUNK), w = edge - x0;
      const r = { ...source, x: x0 + w / 2, w };
      const kind = r.kind === 'road' ? 'road' : 'sidewalk';
      const key = `${cell}:${kind}`;
      (chunks.get(key) ?? chunks.set(key, []).get(key)).push(r);
      x0 = edge;
    }
  }
  for (const [key, items] of chunks) {
    const [cell, kind] = key.split(':');
    const parts = items.map((r) => new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2).translate(r.x, LEVEL[kind], r.z));
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    mesh.name = `urban-road-${cell}-${kind}`;
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.rects = items;
    group.add(mesh);
  }
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; group.children.forEach((mesh) => mesh.geometry.dispose()); Object.values(materials).forEach((material) => material.dispose()); };
  return group;
}

export function roadCoverageBoxes(rects) {
  return rects.map((r) => ({ x: r.x, y: 0, z: r.z, w: r.w, h: 0.3, d: r.d }));
}

export function roadGrassPlots(rects) {
  return rects.map((r) => ({ x: r.x, z: r.z, width: r.w, depth: r.d, height: 1 }));
}

export const URBAN_ROAD_LEVELS = LEVEL;
