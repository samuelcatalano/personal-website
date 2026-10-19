import * as THREE from 'three';
import { furnitureSpots } from './layout.js';
const tex = (c) => Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
export function paintPlaque(text, color, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#8e8375'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#f8f6f1'; g.fillRect(4, 4, size - 8, size - 8);
  g.fillStyle = color; g.fillRect(14, size - 26, size - 28, 6);
  g.font = `600 ${Math.round(size * (text.length > 2 ? 0.3 : 0.38))}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, size / 2, size / 2 - 6);
  return tex(c);
}
export async function createSigns(scene, { stops, curve }) {
  await Promise.race([document.fonts?.load('600 48px Inter'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  const company = [], spots = furnitureSpots(stops, curve);
  for (const { i, kind, xz: [x, z] } of spots) {
    if (kind === 'plaque') {
      const { brand } = stops[i];
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), new THREE.MeshLambertMaterial({ color: 0x8e8375 }));
      pole.position.set(x, 1.7, z);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: paintPlaque(brand.initials, brand.color), toneMapped: false }));
      sprite.position.set(x, 3.7, z);
      sprite.scale.set(1.6, 1.6, 1);
      scene.add(pole, sprite);
      company.push({ i, sprite });
    }
  }
  let shown = -1;
  return {
    update({ active }) {
      if (active === shown) return;
      for (const c of company) c.sprite.scale.setScalar(c.i === active ? 2 : 1.6);
      shown = active;
    },
  };
}
