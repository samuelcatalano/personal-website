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
import { createSigns } from './signs.js';
import { buildFigure } from './figure.js';
import { SECTION_SHOT, shotFor, blendShots, spring, approach } from './camera.js';

const BUS_LANE = 1.75;
const SCROLL_SMOOTH = 0.18;                // seconds
const ARC = 10;                            // camera lift when blending between different shot kinds

export async function createWorld(canvas, stops, { reducedMotion = false, onProgress = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !matchMedia('(max-width: 767px)').matches;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8e0d2);
  scene.fog = new THREE.Fog(0xe8e0d2, 180, 650);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
  const hemi = new THREE.HemisphereLight(0xfff8eb, 0x8e8375, 1.25);
  const sun = new THREE.DirectionalLight(0xfff3df, 1.25);
  sun.castShadow = true;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.05;
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
  scene.add(buildMeshes(list, { glow: ['#e8d7b3', '#ffd86b', '#fff7c2'] }), eye, plane, bus);

  // Per-frame units register here as { update(frame) }; frame = { time, dt, progress, active, bus }.
  const units = [];
  const water = createWater({ span: pts.length * 30 + 120, z: RIVER_Z, width: 22 });
  scene.add(water.mesh);
  units.push(createAmbient(scene, { curve, pts, stops }));
  units.push(await createSigns(scene, { stops, curve }));
  const figure = buildFigure();
  const end = curve.getPointAt(1), endTan = curve.getTangentAt(1);
  const near = new THREE.Vector3(-endTan.z, 0, endTan.x).normalize(); // camera side
  figure.position.set(end.x + endTan.x * 9 + near.x * 2, 0, end.z + endTan.z * 9 + near.z * 2); // off the road, framed by the closing shot
  scene.add(figure);
  // ── later tasks add more units ABOVE this line; sky must stay last (it collects glow materials) ──
  const sky = createSky(scene, { hemi, sun });
  let night = 0, nightTarget = 0;

  let mobile = false;
  const bar = document.querySelector('.bar'), panel = document.querySelector('#panel');
  let fitKey = '';
  const fit = () => {
    const width = innerWidth, height = innerHeight;
    const headerBottom = bar?.getBoundingClientRect().bottom ?? 0;
    const panelBox = panel?.getBoundingClientRect();
    const key = `${width}:${height}:${mobile}:${headerBottom}:${panelBox?.left}:${panelBox?.top}:${panelBox?.right}:${panelBox?.bottom}`;
    if (key === fitKey) return false;
    fitKey = key;
    if (mobile) {
      const panelTop = panelBox?.top ?? height;
      camera.setViewOffset(width, height, 0, height / 2 - (headerBottom + panelTop) / 2, width, height);
    } else if (panel) {
      const panelRight = panelBox.right;
      camera.setViewOffset(width, height, -panelRight / 2, -headerBottom / 2, width, height);
    } else camera.clearViewOffset();
    return true;
  };
  const resize = () => {
    mobile = innerWidth < 768;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = Math.max(40, Math.min(65, Math.atan(0.48 / camera.aspect) * 360 / Math.PI));
    renderer.shadowMap.enabled = !mobile;
    fit();
    camera.updateProjectionMatrix();
    wake();
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (fit()) { camera.updateProjectionMatrix(); wake(); } });
  if (bar) observer?.observe(bar);
  if (panel) observer?.observe(panel);

  const busPos = { x: 0, y: 0, z: 0 };
  const updatePlane = (p) => {
    const d = (p - planeAt) * (n - 1); // -1..1 around the 2020 stop
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(busPos.x + d * 60, 22 - Math.max(0, d) * 14, busPos.z - 6);
  };

  let scroll = { value: 0, velocity: 0 }, target = 0, clock = 0, last = 0, raf = 0;
  const lateral = new THREE.Vector3();
  const wake = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); };
  const frame = (now) => {
    raf = 0;
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; // first frame dt=0 → spring snaps
    last = now;
    scroll = reducedMotion ? { value: nearestStop(target, n) / (n - 1), velocity: 0 } : spring(scroll, target, dt, SCROLL_SMOOTH);
    if (!reducedMotion) clock += dt;

    const p = scroll.value, t = routeT(p, n);
    const bp = curve.getPointAt(t), tan = curve.getTangentAt(t);
    lateral.set(tan.z, 0, -tan.x).normalize().multiplyScalar(BUS_LANE);
    bus.position.copy(bp).add(lateral);
    bus.rotation.y = Math.atan2(-tan.z, tan.x);
    Object.assign(busPos, { x: bp.x + lateral.x, y: bp.y, z: bp.z + lateral.z });

    const s = t * (n - 1), i = Math.min(Math.floor(s), n - 2);
    const ka = SECTION_SHOT[stops[i].section], kb = SECTION_SHOT[stops[i + 1].section];
    const view = { mobile };
    const shot = blendShots(shotFor(ka, busPos, view), shotFor(kb, busPos, view), s - i, ka === kb ? 0 : ARC);
    camera.position.fromArray(shot.position);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    sun.position.set(bp.x + 40, 80, bp.z + 30);
    sun.target.position.copy(bp);

    eye.rotation.z = clock * 0.1;
    updatePlane(p);
    const f = { time: clock, dt, progress: p, active: nearestStop(p, n), bus: busPos };
    onProgress(p);
    for (const u of units) u.update(f);
    night = reducedMotion || dt === 0 ? nightTarget : approach(night, nightTarget, dt, 1.4);
    sky.update(night);
    water.update(clock, night);
    renderer.render(scene, camera);
    if (!reducedMotion) wake();
  };
  const visibility = () => { last = 0; wake(); };
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  resize();

  return {
    setProgress(p) { target = p; wake(); },
    jump(p) { target = p; scroll = { value: p, velocity: 0 }; wake(); },
    setTheme(name) {
      nightTarget = name === 'night' ? 1 : 0;
      wake();
    },
    dispose() {
      cancelAnimationFrame(raf); raf = 0;
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      observer?.disconnect();
      renderer.dispose();
    },
  };
}
