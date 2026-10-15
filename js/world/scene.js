import * as THREE from 'three';
import { routeT, nearestStop } from '../scroll.js';
import { routePoints, RIVER_Z } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildBus } from './bus.js';
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createAmbient } from './ambient.js';
import { SECTION_SHOT, shotFor, blendShots, spring, approach } from './camera.js';

const PIXEL_DESKTOP = 3, PIXEL_MOBILE = 2; // drawing buffer = viewport / k, upscaled with image-rendering: pixelated
const SCROLL_SMOOTH = 0.32;                // seconds
const ARC = 18;                            // camera lift when blending between different shot kinds

export async function createWorld(canvas, stops, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !matchMedia('(max-width: 767px)').matches;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9d8f5);
  scene.fog = new THREE.Fog(0xcfe8f7, 90, 340);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  scene.add(hemi, sun, sun.target);

  const n = stops.length;
  const pts = routePoints(n);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  const { add, list } = createBoxes();
  buildCity(add, stops, pts, curve);
  const { eye, plane, planeAt } = buildLandmarks(add, stops, pts);
  const bus = buildBus();
  scene.add(buildMeshes(list, { glow: ['#ffd86b', '#fff7c2'] }), eye, plane, bus);
  const extent = { minX: pts[0].x, maxX: pts[n - 1].x };

  // Per-frame units register here as { update(frame) }; frame = { time, dt, progress, active, bus }.
  const units = [];
  const water = createWater({ span: pts.length * 30 + 120, z: RIVER_Z, width: 22 });
  scene.add(water.mesh);
  units.push(createAmbient(scene, { curve, pts, stops }));
  // ── later tasks add more units ABOVE this line; sky must stay last (it collects glow materials) ──
  const sky = createSky(scene, { hemi, sun });
  let night = 0, nightTarget = 0;

  let mobile = false;
  const resize = () => {
    mobile = innerWidth < 768;
    const k = mobile ? PIXEL_MOBILE : PIXEL_DESKTOP;
    renderer.setSize(Math.ceil(innerWidth / k), Math.ceil(innerHeight / k), false);
    camera.aspect = innerWidth / innerHeight;
    // bus right of the 400px panel on desktop, above the bottom sheet on mobile
    if (!mobile) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.12, 0, innerWidth, innerHeight);
    else camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.18, innerWidth, innerHeight);
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const sign = document.getElementById('year-sign');
  const busPos = { x: 0, y: 0, z: 0 };
  const tmp = new THREE.Vector3();
  const updateSign = () => {
    if (!sign) return;
    tmp.set(busPos.x, 11, busPos.z).project(camera);
    sign.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  };
  const updatePlane = (p) => {
    const d = (p - planeAt) * (n - 1); // -1..1 around the 2020 stop
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(busPos.x + d * 60, 22 - Math.max(0, d) * 14, busPos.z - 6);
  };

  let scroll = { value: 0, velocity: 0 }, target = 0, clock = 0, last = 0, raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; // first frame dt=0 → spring snaps
    last = now;
    if (document.hidden) return;
    scroll = reducedMotion ? { value: target, velocity: 0 } : spring(scroll, target, dt, SCROLL_SMOOTH);
    if (!reducedMotion) clock += dt;

    const p = scroll.value, t = routeT(p, n);
    const bp = curve.getPointAt(t), tan = curve.getTangentAt(t);
    bus.position.copy(bp);
    bus.rotation.y = Math.atan2(-tan.z, tan.x);
    Object.assign(busPos, { x: bp.x, y: bp.y, z: bp.z });

    const s = t * (n - 1), i = Math.min(Math.floor(s), n - 2);
    const ka = SECTION_SHOT[stops[i].section], kb = SECTION_SHOT[stops[i + 1].section];
    const view = { extent, mobile };
    const shot = blendShots(shotFor(ka, busPos, view), shotFor(kb, busPos, view), s - i, ka === kb ? 0 : ARC);
    camera.position.fromArray(shot.position);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    sun.position.set(bp.x + 40, 80, bp.z + 30);
    sun.target.position.copy(bp);

    eye.rotation.z = clock * 0.1;
    updatePlane(p);
    const f = { time: clock, dt, progress: p, active: nearestStop(p, n), bus: busPos };
    for (const u of units) u.update(f);
    night = reducedMotion ? nightTarget : approach(night, nightTarget, dt, 1.4);
    sky.update(night);
    water.update(clock, night);
    renderer.render(scene, camera);
    updateSign();
  };

  return {
    setProgress(p) { target = p; },
    setTheme(name) {
      nightTarget = name === 'night' ? 1 : 0;
      if (!raf) { night = nightTarget; raf = requestAnimationFrame(frame); }
    },
    dispose() { cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', resize); renderer.dispose(); },
  };
}
