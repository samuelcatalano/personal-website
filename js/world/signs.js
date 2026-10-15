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

export async function createSigns(scene, { stops, curve }) {
  await Promise.race([document.fonts?.load('48px Silkscreen'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {}); // fallback font if it never loads

  const yearMat = new THREE.SpriteMaterial({ map: paintSign(stops[0].year, yearStyle(stops[0])), toneMapped: false });
  const year = new THREE.Sprite(yearMat);
  year.scale.set(8, 3, 1);
  scene.add(year);

  const company = [];
  stops.forEach((s, i) => {
    if (!s.brand) return;
    const t = i / (stops.length - 1);
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const far = new THREE.Vector3(tan.z, 0, -tan.x).normalize(); // far side, away from the camera
    const x = p.x + far.x * 6.5 - tan.x * 7, z = p.z + far.z * 6.5 - tan.z * 7;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
    pole.position.set(x, 4.5, z);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: paintSign(s.brand.initials, { bg: s.brand.color, w: 128, h: 128 }), toneMapped: false }));
    sprite.position.set(x, 10, z);
    sprite.scale.set(3.2, 3.2, 1);
    scene.add(pole, sprite);
    company.push({ i, sprite });
  });

  let shown = -1;
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
