import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';

// Voxel body in a black tee (like the Memoji) with the avatar as the head.
export function buildFigure() {
  const { add, list } = createBoxes();
  add(-0.45, 0, 0, 0.7, 2.4, 0.8, '#2b2d33');   // legs
  add(0.45, 0, 0, 0.7, 2.4, 0.8, '#2b2d33');
  add(0, 2.4, 0, 2, 2.6, 1.1, '#141414');       // torso
  add(-1.3, 2.7, 0, 0.6, 2.2, 0.7, '#141414');  // arms
  add(1.3, 2.7, 0, 0.6, 2.2, 0.7, '#141414');
  add(0, 5, 0, 0.7, 0.4, 0.7, '#e9c9b2');       // neck
  const fig = buildMeshes(list);
  const tex = new THREE.TextureLoader().load('assets/avatar.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  head.scale.set(2.6, 2.6, 1);
  head.position.set(0, 6.5, 0);
  fig.add(head);
  return fig;
}
