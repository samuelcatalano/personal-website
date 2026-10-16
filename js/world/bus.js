import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';

const RED = '#d6211f', DARK = '#1b1b1b', GLASS = '#bfe3ff', CREAM = '#f3ead2', YELLOW = '#ffd23f';

export function buildBus({ avatar: withAvatar = true } = {}) {
  const { add, list } = createBoxes();
  add(0, 0.65, 0, 11, 3.55, 2.5, RED);               // 11 × 4.6 × 2.5m overall, two decks
  add(0, 4.2, 0, 10.6, 0.4, 2.4, RED);
  add(0, 2.05, 0, 11.05, 0.2, 2.55, CREAM);
  for (const deck of [1.2, 3.0]) {
    for (let i = -3; i <= 3; i++) {
      add(i * 1.25 + 0.3, deck, 1.26, 1.05, 0.75, 0.05, GLASS);
      add(i * 1.25 + 0.3, deck, -1.26, 1.05, 0.75, 0.05, GLASS);
    }
  }
  add(5.51, 3.0, 0, 0.05, 0.85, 2.1, GLASS);
  add(5.51, 1.2, 0.45, 0.05, 0.75, 1.25, GLASS);
  add(5.52, 3.9, 0, 0.05, 0.25, 1.6, YELLOW);
  add(5.52, 0.45, 0.82, 0.06, 0.3, 0.3, '#fff7c2');
  add(5.52, 0.45, -0.82, 0.06, 0.3, 0.3, '#fff7c2');
  for (const x of [-3.7, 3.7]) for (const z of [1, -1]) add(x, 0, z, 1.4, 1.1, 0.55, DARK);
  const bus = buildMeshes(list, { glow: ['#fff7c2', YELLOW] });

  if (withAvatar) {
    const tex = new THREE.TextureLoader().load('assets/avatar.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    const avatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    avatar.scale.set(0.8, 0.8, 1);
    avatar.position.set(5.62, 3.4, 0);
    bus.add(avatar);
  }
  return bus;
}
