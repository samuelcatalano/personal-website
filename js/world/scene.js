import * as THREE from 'three';
import { routeT } from '../scroll.js';
import { routePoints } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildBus } from './bus.js';

const THEMES = {
  day: { sky: 0xa9d8f5, fog: 0xcfe8f7, sun: 1.6, hemi: 1.1, glow: 0x000000 },
  night: { sky: 0x0d1b3a, fog: 0x14244a, sun: 0.25, hemi: 0.35, glow: 0xffc85a },
};
const CAM_OFFSET = new THREE.Vector3(-22, 20, 30);

export async function createWorld(canvas, stops, { reducedMotion = false } = {}) {
  const mobile = matchMedia('(max-width: 767px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = !mobile;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe8f7, 80, 260);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 600);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  scene.add(hemi, sun, sun.target);

  const pts = routePoints(stops.length);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  const { add, list } = createBoxes();
  buildCity(add, stops, pts, curve);
  const { eye, plane, planeAt } = buildLandmarks(add, stops, pts);
  const world = buildMeshes(list, { glow: ['#ffd86b', '#fff7c2'] });
  const bus = buildBus();
  scene.add(world, eye, plane, bus);

  const sign = document.getElementById('year-sign');
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let target = 0, current = 0, raf = 0;

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const place = (t, snap) => {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    bus.position.copy(p);
    bus.rotation.y = Math.atan2(-tan.z, tan.x);
    const wantCam = tmp.copy(p).add(CAM_OFFSET);
    if (snap) { camPos.copy(wantCam); look.copy(p); } else { camPos.lerp(wantCam, 0.12); look.lerp(p, 0.12); }
    camera.position.copy(camPos);
    camera.lookAt(look);
    sun.position.set(p.x + 40, 80, p.z + 30);
    sun.target.position.copy(p);
  };

  const updateSign = () => {
    tmp.copy(bus.position).setY(11).project(camera);
    sign.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  };

  const updatePlane = (p) => {
    const d = (p - planeAt) * (stops.length - 1); // -1..1 around the 2020 stop
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(bus.position.x + d * 60, 30 - Math.max(0, d) * 18, -20);
  };

  const loop = (time) => {
    current = reducedMotion ? target : current + (target - current) * 0.1;
    place(routeT(current, stops.length), reducedMotion);
    if (!reducedMotion) eye.rotation.z = time * 0.0001;
    updatePlane(current);
    renderer.render(scene, camera);
    updateSign();
    raf = requestAnimationFrame(loop);
  };

  return {
    setProgress(p) { target = p; },
    setTheme(name) {
      const t = THEMES[name] ?? THEMES.day;
      scene.background = new THREE.Color(t.sky);
      scene.fog.color.set(t.fog);
      sun.intensity = t.sun;
      hemi.intensity = t.hemi;
      scene.traverse((o) => { if (o.material?.userData?.glow) o.material.emissive.set(t.glow); });
      if (!raf) { current = target; place(routeT(target, stops.length), true); raf = requestAnimationFrame(loop); }
    },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
  };
}
