import * as THREE from 'three';
export function paintSign(text, { bg = '#d6211f', fg = '#ffffff', w = 256, h = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f6f1'; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(4, 4, w - 8, h - 8);
  g.fillStyle = fg;
  g.font = `600 ${Math.round(h * 0.42)}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
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
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const YEAR = { bg: '#e8e0d2', fg: '#302d29' };
export async function createSigns(scene, { stops, curve }) {
  await Promise.race([document.fonts?.load('600 48px Inter'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  const yearMat = new THREE.SpriteMaterial({ map: paintSign(stops[0].year, YEAR), toneMapped: false });
  const year = new THREE.Sprite(yearMat);
  year.scale.set(4.2, 1.5, 1);
  scene.add(year);
  const company = [];
  stops.forEach((s, i) => {
    if (!s.brand) return;
    const t = i / (stops.length - 1);
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const far = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const x = p.x - far.x * 11.5 + tan.x * 7, z = p.z - far.z * 11.5 + tan.z * 7;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), new THREE.MeshLambertMaterial({ color: 0x8e8375 }));
    pole.position.set(x, 1.7, z);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: paintPlaque(s.brand.initials, s.brand.color), toneMapped: false }));
    sprite.position.set(x, 3.7, z);
    sprite.scale.set(1.6, 1.6, 1);
    scene.add(pole, sprite);
    company.push({ i, sprite });
  });
  let shown = -1;
  const near = new THREE.Vector3();
  return {
    update({ progress, active, bus }) {
      const tangent = curve.getTangentAt(progress);
      near.set(-tangent.z, 0, tangent.x).normalize();
      const finalSegment = Math.max(0, Math.min(1, (progress * (stops.length - 1) - (stops.length - 2))));
      const lift = finalSegment * finalSegment * (3 - 2 * finalSegment) * 4;
      year.position.set(bus.x + near.x * 14, bus.y + 8.5 + lift, bus.z + near.z * 14);
      if (active === shown) return;
      const s = stops[active];
      yearMat.map.dispose();
      yearMat.map = paintSign(s.year, YEAR);
      yearMat.needsUpdate = true;
      for (const c of company) c.sprite.scale.setScalar(c.i === active ? 2 : 1.6);
      shown = active;
    },
  };
}
