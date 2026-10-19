import * as THREE from 'three';
export const EXPOSURE = 1.1; // renderer.toneMappingExposure, needed to undo ACES for the sky
// Every sky colour is authored as the colour we want ON SCREEN. The composer tone-maps the whole frame in OutputPass
// (toneMapped:false is ignored inside a render target), so we pre-invert ACES here or the sky washes out to white.
const IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777);
const OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
const INi = IN.clone().invert(), OUTi = OUT.clone().invert(), tmp = new THREE.Vector3();
export function untone(c) {
  tmp.set(c.r, c.g, c.b).clampScalar(0.001, 0.98).applyMatrix3(OUTi);
  const y = tmp.toArray().map((t) => {
    t = Math.min(0.98, Math.max(0.001, t));
    const a = 0.983729 * t - 1, b = 0.432951 * t - 0.0245786, k = 0.238081 * t + 0.000090537;
    return (-b - Math.sqrt(Math.max(b * b - 4 * a * k, 0))) / (2 * a);
  });
  tmp.fromArray(y).applyMatrix3(INi).multiplyScalar(0.6 / EXPOSURE);
  return c.setRGB(Math.max(0, tmp.x), Math.max(0, tmp.y), Math.max(0, tmp.z));
}
const C = (h) => new THREE.Color(h);
const DAY = { zen: C(0x6fb1e8), hor: C(0xb9dcf5), cloud: C(0xf4f9ff), sun: 2.4, hemi: 1.0, light: C(0xfff0d0) };
const NIGHT = { zen: C(0x0b1530), hor: C(0x1d2b4f), cloud: C(0x3b4668), sun: 0.34, hemi: 0.48, light: C(0xaec4ff) };
export const SUN_DIR = new THREE.Vector3(110, 45, 40).normalize(); // directional light + sun + moon share this direction
const DIST = 1300; // just inside camera.far (1400), beyond every building
function disc(draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sprite = (map, size) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: true, depthWrite: false, fog: false, toneMapped: false }));
  m.renderOrder = 1000;
  return m;
};
const LON = { zen: [0.435, 0.694, 0.91], hor: [0.725, 0.863, 0.961], cloud: [0.957, 0.976, 1], light: [1, 0.941, 0.816], sun: 1, hemi: 1, fogK: 1, cloudOp: 0 }; // default mood (== DAY)
export function createSky(scene, { hemi, sun, reducedMotion = false }) {
  const d1 = new THREE.Color(), day = (a, c = d1) => c.setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace); // mood sRGB triplet -> working colour
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
      vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uZen; uniform vec3 uHor; varying float vY; void main(){ gl_FragColor = vec4(mix(uHor, uZen, smoothstep(0.0, 0.7, vY)), 1.0); }',
    }),
  );
  dome.renderOrder = -10; dome.frustumCulled = false;
  const u = dome.material.uniforms;
  const sunM = sprite(disc((g) => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, '#fff'); r.addColorStop(0.2, '#fff'); r.addColorStop(0.24, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  }), 400);
  sunM.material.color.copy(untone(C(0xfff0b8)));
  const moonM = sprite(disc((g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,160,185,0.55)';
    for (const [x, y, r] of [[100, 105, 18], [150, 95, 11], [140, 150, 22], [95, 155, 9], [170, 130, 7]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }), 110); // moon disc ≈ sun disc (sun disc is ~0.2 of its 400 sprite)
  moonM.material.color.copy(untone(C(0xe6e9f0)));
  scene.add(dome, sunM, moonM);
  // blocky clouds: flat-topped clusters of boxes in three layers
  const cloudMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, fog: false, toneMapped: false });
  const box = new THREE.BoxGeometry(1, 1, 1), clouds = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group(), n = 4 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(box, cloudMat);
      m.scale.set(30 + Math.random() * 40, 8 + Math.random() * 6, 22 + Math.random() * 26);
      m.position.set(j * 36 - n * 18, Math.random() * 5, (Math.random() - 0.5) * 40);
      g.add(m);
    }
    g.userData = { x: Math.random() * 2.8 - 1.4, y: 0.6 + Math.random() * 0.38, k: 1.3 + Math.random() * 1.1 };
    g.scale.setScalar(g.userData.k);
    clouds.add(g);
  }
  clouds.children.forEach((c) => c.children.forEach((m) => { m.renderOrder = 999; }));
  scene.add(clouds);
  // sky band: the follow camera looks down, so the sun/moon/clouds are pinned to NDC points of the upper frame
  const at = (cam, x, y, d, out) => out.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(d).add(cam.position);
  const glow = [];
  scene.traverse((o) => { if (o.material?.userData?.glow) glow.push(o.material); });
  const pos = [];
  for (let i = 0; i < 500; i++) { // upper hemisphere around the camera
    const a = Math.random() * Math.PI * 2, e = (0.12 + Math.random() * 0.88) * Math.PI / 2;
    pos.push(Math.cos(a) * Math.cos(e) * 1000, Math.sin(e) * 1000, Math.sin(a) * Math.cos(e) * 1000);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: untone(C(0xdde6ff)), size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false, toneMapped: false }),
  );
  stars.renderOrder = -9; stars.frustumCulled = false;
  scene.add(stars);
  const place = (m, cam, x, y) => { at(cam, x, y, DIST, m.position); m.lookAt(cam.position); };
  return {
    update(night, dt = 0, camPos = new THREE.Vector3(), cam, mood = LON) {
      cam?.updateMatrixWorld();
      u.uZen.value.lerpColors(day(mood.zen, d1), NIGHT.zen, night); untone(u.uZen.value);
      u.uHor.value.lerpColors(day(mood.hor, d1), NIGHT.hor, night); untone(u.uHor.value);
      scene.fog.color.copy(u.uHor.value); // already tone-inverted
      scene.background?.copy(scene.fog.color);
      scene.fog.near = (240 - 60 * night) * mood.fogK; scene.fog.far = (900 - 220 * night) * mood.fogK;
      cloudMat.color.lerpColors(day(mood.cloud, d1), NIGHT.cloud, night); untone(cloudMat.color);
      cloudMat.opacity = 0.7 + mood.cloudOp - 0.2 * night;
      dome.position.copy(camPos); stars.position.copy(camPos);
      if (cam) {
        const wide = cam.aspect > 1;
        for (const c of clouds.children) {
          const d = c.userData;
          if (!reducedMotion) d.x = d.x > 1.4 ? -1.4 : d.x + dt * 0.012;
          at(cam, d.x, d.y, 1250, c.position);
          c.lookAt(cam.position);
        }
        place(sunM, cam, wide ? 0.66 : 0.6, wide ? 0.8 : 0.78); place(moonM, cam, wide ? 0.66 : 0.6, wide ? 0.8 : 0.78);
      }
      sunM.visible = night < 0.98; sunM.material.opacity = (1 - night) * Math.min(1, mood.sun) ** 2; // veiled by overcast
      moonM.visible = night > 0.02; moonM.material.opacity = night;
      const ds = DAY.sun * mood.sun, dh = DAY.hemi * mood.hemi;
      sun.intensity = ds + (NIGHT.sun - ds) * night;
      sun.color.lerpColors(day(mood.light, d1), NIGHT.light, night);
      hemi.intensity = dh + (NIGHT.hemi - dh) * night;
      stars.material.opacity = Math.max(0, night * 1.4 - 0.4);
      stars.visible = night > 0.3;
      for (const m of glow) { if (m.userData.uNight) m.userData.uNight.value = night; m.emissive.copy(m.userData.glowColor ?? m.color).multiplyScalar(night * (m.userData.glowK ?? 2.2)); } // each light glows in its own colour, bright enough to bloom
    },
  };
}
