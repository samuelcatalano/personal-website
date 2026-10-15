import * as THREE from 'three';

export function paintSign(text, { bg = '#d6211f', fg = '#ffffff', w = 256, h = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#111111'; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg;
  g.font = `${Math.round(h * 0.5)}px Silkscreen, monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const yearStyle = (s) => (s.country === 'BR' ? { bg: '#009c3b', fg: '#ffdf00' } : { bg: '#d6211f', fg: '#ffffff' });

export async function createSigns(scene, { stops, pts }) {
  await document.fonts?.load('48px Silkscreen').catch(() => {}); // fallback font if it never loads

  const yearMat = new THREE.SpriteMaterial({ map: paintSign(stops[0].year, yearStyle(stops[0])) });
  const year = new THREE.Sprite(yearMat);
  year.scale.set(8, 3, 1);
  scene.add(year);

  const company = [];
  stops.forEach((s, i) => {
    if (!s.brand) return;
    const p = pts[i];
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
    pole.position.set(p.x - 7, 3, p.z + 5);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: paintSign(s.brand.initials, { bg: s.brand.color, w: 128, h: 128 }) }));
    sprite.position.set(p.x - 7, 7.5, p.z + 5);
    sprite.scale.set(3.2, 3.2, 1);
    scene.add(pole, sprite);
    company.push({ i, sprite });
  });

  let shown = 0;
  return {
    update({ active, bus }) {
      year.position.set(bus.x, bus.y + 11, bus.z);
      if (active === shown) return;
      const s = stops[active];
      yearMat.map.dispose();
      yearMat.map = paintSign(s.year, yearStyle(s));
      yearMat.needsUpdate = true;
      for (const c of company) c.sprite.scale.setScalar(c.i === active ? 4.2 : 3.2);
      shown = active;
    },
  };
}
