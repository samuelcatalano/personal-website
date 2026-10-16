import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
const DAY = { fog: new THREE.Color(0xa8d0f2), sun: 2.4, hemi: 1.0 };
const NIGHT = { fog: new THREE.Color(0x0e1424), sun: 0.34, hemi: 0.48 };
const GLOW = new THREE.Color(0xffc85a);
export function createSky(scene, { hemi, sun, reducedMotion = false }) {
  const dome = new Sky();
  dome.scale.setScalar(800);
  const u = dome.material.uniforms;
  u.turbidity.value = 2.5; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3();
  scene.add(dome);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const cloudMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false });
  const clouds = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
    const w = 160 + Math.random() * 140;
    c.scale.set(w, w * 0.55, 1);
    c.rotation.x = -Math.PI / 2;
    c.position.set((Math.random() - 0.5) * 900, 120, (Math.random() - 0.5) * 600);
    clouds.add(c);
  }
  scene.add(clouds);
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
    update(night, dt = 0, cam) {
      const el = 35 - 55 * night;
      sunDir.setFromSphericalCoords(1, Math.PI / 2 - el * Math.PI / 180, 0.9);
      u.sunPosition.value.copy(sunDir);
      u.rayleigh.value = 2.2 - 2.0 * night;
      cloudMat.color.setScalar(1 - 0.75 * night);
      cloudMat.opacity = 1 - 0.5 * night;
      if (cam) { dome.position.copy(cam); clouds.position.set(cam.x, 0, cam.z); }
      if (!reducedMotion) for (const c of clouds.children) { c.position.x += dt * 2; if (c.position.x > 450) c.position.x -= 900; }
      scene.fog.color.lerpColors(DAY.fog, NIGHT.fog, night);
      scene.fog.near = 450 - 150 * night; scene.fog.far = 1300 - 420 * night;
      sun.intensity = DAY.sun + (NIGHT.sun - DAY.sun) * night;
      hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * night;
      stars.material.opacity = night;
      stars.visible = night > 0.02;
      for (const m of glow) m.emissive.copy(GLOW).multiplyScalar(night);
    },
  };
}
