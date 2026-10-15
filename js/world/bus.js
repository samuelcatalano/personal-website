import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';

const RED = '#d6211f', DARK = '#1b1b1b', GLASS = '#bfe3ff', CREAM = '#f3ead2', YELLOW = '#ffd23f';

export function buildBus() {
  const { add, list } = createBoxes();
  add(0, 0.8, 0, 11, 6.6, 3.6, RED);                  // body, both decks
  add(0, 7.4, 0, 10.6, 0.5, 3.4, RED);                // roof
  add(0, 4.0, 0, 11.05, 0.4, 3.65, CREAM);            // between-deck stripe
  for (const deck of [1.9, 4.9]) {                    // window rows, both sides
    for (let i = -4; i <= 3; i++) {
      add(i * 1.25 + 0.3, deck, 1.81, 1, 1.4, 0.05, GLASS);
      add(i * 1.25 + 0.3, deck, -1.81, 1, 1.4, 0.05, GLASS);
    }
  }
  add(5.51, 4.9, 0, 0.05, 1.6, 3, GLASS);             // upper front window (avatar sits here)
  add(5.51, 1.9, 0.6, 0.05, 1.6, 1.8, GLASS);         // driver window
  add(5.52, 3.6, 0, 0.05, 0.4, 2.4, YELLOW);          // destination board
  add(5.52, 1.0, 1.4, 0.06, 0.4, 0.4, '#fff7c2');     // headlights
  add(5.52, 1.0, -1.4, 0.06, 0.4, 0.4, '#fff7c2');
  for (const x of [-3.5, 3.5]) for (const z of [1.7, -1.7]) add(x, 0, z, 1.6, 1.6, 0.6, DARK); // wheels
  const bus = buildMeshes(list, { glow: ['#fff7c2', YELLOW] });

  const tex = new THREE.TextureLoader().load('assets/avatar.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const avatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  avatar.scale.set(1.6, 1.6, 1);
  avatar.position.set(5.62, 5.7, 0);
  bus.add(avatar);
  return bus;
}
