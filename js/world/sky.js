import * as THREE from 'three';

const DAY = { sky: new THREE.Color(0xe8e0d2), fog: new THREE.Color(0xe8e0d2), sun: 1.25, hemi: 1.25 };
const NIGHT = { sky: new THREE.Color(0x20252c), fog: new THREE.Color(0x30343a), sun: 0.34, hemi: 0.48 };
const GLOW = new THREE.Color(0xffc85a);

// Call after every glow material is in the scene: it collects them once.
export function createSky(scene, { hemi, sun }) {
  const glow = [];
  scene.traverse((o) => { if (o.material?.userData?.glow) glow.push(o.material); });

  const pos = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 200;
    pos.push(Math.cos(a) * r, 60 + Math.random() * 220, Math.sin(a) * r - 150);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }),
  );
  scene.add(stars);

  return {
    update(night) {
      scene.background.lerpColors(DAY.sky, NIGHT.sky, night);
      scene.fog.color.lerpColors(DAY.fog, NIGHT.fog, night);
      sun.intensity = DAY.sun + (NIGHT.sun - DAY.sun) * night;
      hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * night;
      stars.material.opacity = night;
      stars.visible = night > 0.02;
      for (const m of glow) m.emissive.copy(GLOW).multiplyScalar(night);
    },
  };
}
