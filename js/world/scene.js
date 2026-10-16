import * as THREE from 'three';
import { routeT, nearestStop } from '../scroll.js';
import { routePoints, RIVER_Z, riverEnd, riverStart, FRAME_LIFT, swapAt } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildBus, buildMini } from './bus.js';
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createAmbient } from './ambient.js';
import { createSigns } from './signs.js';
import { buildFigure } from './figure.js';
import { SECTION_SHOT, shotFor, blendShots, spring, approach, nextTier } from './camera.js';
import { createPost } from './post.js';
const BUS_LANE = 1.75, SCROLL_SMOOTH = 0.18, ARC = 10;
export async function createWorld(canvas, stops, { reducedMotion = false, onProgress = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  Object.assign(renderer, { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, outputColorSpace: THREE.SRGBColorSpace });
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d0f2);
  scene.fog = new THREE.Fog(0xa8d0f2, 450, 1300);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1400);
  const hemi = new THREE.HemisphereLight(0xa8d4ff, 0x5fa032, 1);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.castShadow = true;
  Object.assign(sun.shadow, { bias: -0.0002, normalBias: 0.05 });
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  scene.add(hemi, sun, sun.target);
  const n = stops.length, pts = routePoints(n);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  const { add, list } = createBoxes();
  buildCity(add, stops, pts, curve);
  const { eye, details, plane, planeAt } = buildLandmarks(add, stops, pts);
  const routemaster = buildBus(), mini = buildMini(), bus = new THREE.Group().add(mini, routemaster), swap = swapAt(stops);
  scene.add(buildMeshes(list, { glow: ['#e8d7b3', '#ffd86b', '#fff7c2'] }), eye, details, plane, bus);
  const units = [createAmbient(scene, { curve, pts, stops })];
  const water = createWater({ x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z: RIVER_Z, width: 22 });
  scene.add(water.mesh);
  units.push(await createSigns(scene, { stops, curve }));
  let disposed = false, raf = 0;
  const wake = () => { if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(frame); };
  const figure = buildFigure(wake);
  const end = curve.getPointAt(1), endTan = curve.getTangentAt(1), near = new THREE.Vector3(-endTan.z, 0, endTan.x).normalize();
  figure.position.set(end.x + endTan.x * 9 + near.x * 2, 0, end.z + endTan.z * 9 + near.z * 2);
  scene.add(figure);
  const sky = createSky(scene, { hemi, sun, reducedMotion });
  const post = createPost(renderer, scene, camera, { sun, tier: reducedMotion || matchMedia('(max-width: 767px)').matches ? 'medium' : 'high' });
  let fpsT = 0, fpsN = 0, night = 0, nightTarget = 0, mobile = false;
  const bar = document.querySelector('.bar'), panel = document.querySelector('#panel');
  let fitKey = '';
  const fit = () => {
    const width = innerWidth, height = innerHeight, headerBottom = bar?.getBoundingClientRect().bottom ?? 0, panelBox = panel?.getBoundingClientRect();
    const key = JSON.stringify([width, height, mobile, headerBottom, panelBox]);
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
    post?.setSize(innerWidth, innerHeight);
    fit();
    camera.updateProjectionMatrix();
    wake();
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (fit()) { camera.updateProjectionMatrix(); wake(); } });
  if (bar) observer?.observe(bar);
  if (panel) observer?.observe(panel);
  const busPos = { x: 0, y: 0, z: 0 };
  const updatePlane = (p) => {
    const d = (p - planeAt) * (n - 1);
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(busPos.x + 16 + d * 60, Math.max(3, 14 - d * 10), busPos.z + 8);
  };
  let scroll = { value: 0, velocity: 0 }, target = 0, clock = 0, last = 0;
  const lateral = new THREE.Vector3();
  function frame(now) {
    raf = 0;
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    scroll = reducedMotion ? { value: nearestStop(target, n) / (n - 1), velocity: 0 } : spring(scroll, target, dt, SCROLL_SMOOTH);
    if (!reducedMotion) clock += dt;
    const p = scroll.value, t = routeT(p, n);
    const bp = curve.getPointAt(t), tan = curve.getTangentAt(t);
    lateral.set(tan.z, 0, -tan.x).normalize().multiplyScalar(BUS_LANE);
    routemaster.visible = t >= swap;
    mini.visible = !routemaster.visible;
    bus.position.copy(bp).add(lateral);
    bus.rotation.y = Math.atan2(-tan.z, tan.x);
    Object.assign(busPos, { x: bp.x + lateral.x, y: bp.y, z: bp.z + lateral.z });
    const s = t * (n - 1), i = Math.min(Math.floor(s), n - 2);
    const ka = SECTION_SHOT[stops[i].section], kb = SECTION_SHOT[stops[i + 1].section];
    const la = FRAME_LIFT[stops[i].id] ?? 0, lb = FRAME_LIFT[stops[i + 1].id] ?? 0;
    const lift = la + (lb - la) * (s - i);
    const shot = blendShots(shotFor(ka, busPos, { mobile, lift }), shotFor(kb, busPos, { mobile, lift }), s - i, ka === kb ? 0 : ARC);
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
    sky.update(night, dt, camera.position);
    water.update(clock, night);
    if (dt > 0 && post.tier === 'high') {
      fpsT += dt; fpsN++;
      if (fpsT >= 2) { post.setTier(nextTier(post.tier, [fpsN / fpsT])); fpsT = fpsN = 0; }
    }
    post.render(dt);
    if (!reducedMotion) wake();
  }
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
      disposed = true;
      cancelAnimationFrame(raf); raf = 0;
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      observer?.disconnect();
      renderer.dispose();
    },
  };
}
