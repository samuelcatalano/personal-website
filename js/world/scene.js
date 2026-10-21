import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { routeT, nearestStop, stopMarks, fineMarks } from '../scroll.js';
import { routePoints, routeCurve, RIVER_Z, riverEnd, riverStart, FRAME_LIFT, swapAt, scotRange } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildMotion } from './motion.js';
import { buildCity, tree } from './city.js';
import { buildRealCity } from './real-city.js';
import { createHeroRealm } from './hero-realm.js';
import { createTrees } from './trees.js';
import { buildBackdrop } from './backdrop.js';
import { buildLandmarks } from './landmarks.js';
import { polishLandmarkMaterials } from './landmark-materials.js';
import { buildBus, buildMini } from './bus.js';
import { createMood } from './mood.js';
import { createRain } from './rain.js';
import { createSky, EXPOSURE, SUN_DIR } from './sky.js';
import { createWater } from './water.js';
import { createAmbient } from './ambient.js';
import { createPeople } from './people.js';
import { createSigns } from './signs.js';
import { buildFigure } from './figure.js';
import { SECTION_SHOT, shotFor, blendShots, spring, approach, nextTier } from './camera.js';
import { updateBeams, addBeams } from './beams.js';
import { createLampPools } from './lamps.js';
import { createPost } from './post.js';
import { createRoadMarks } from './roadmarks.js';
const BUS_LANE = 1.75, SCROLL_SMOOTH = 0.18, ARC = 10;
export async function createWorld(canvas, stops, { reducedMotion = false, onProgress = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  Object.assign(renderer, { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: EXPOSURE, outputColorSpace: THREE.SRGBColorSpace });
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d0f2);
  scene.fog = new THREE.Fog(0xa8d0f2, 240, 900);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1400);
  const hemi = new THREE.HemisphereLight(0xb9d4ea, 0x8d8574, 1);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.castShadow = true;
  Object.assign(sun.shadow, { bias: -0.0002, normalBias: 0.05 });
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  const SUN = SUN_DIR.clone().multiplyScalar(95), LD = SUN.clone().normalize(), TEXEL = 160 / 1024;
  const LU = new THREE.Vector3(0, 1, 0).cross(LD).normalize(), LV = LD.clone().cross(LU);
  scene.add(hemi, sun, sun.target);
  const n = stops.length, pts = routePoints(n), marks = stopMarks(pts);
  const curve = routeCurve(THREE, pts), knots = fineMarks(marks, curve);
  const distant = createBoxes();
  buildBackdrop(distant.add, stops, pts);
  const backdrop = buildMeshes(distant.list);
  backdrop.name = 'distant-neighborhoods';
  backdrop.traverse(o => { o.castShadow = o.receiveShadow = false; });
  scene.add(backdrop);
  const { add, list } = createBoxes();
  const treePlacements = [], buildingPlots = [], architecturePlots = [], publicRealmZones = [];
  const { rotors: hubs, lamps } = buildCity(add, stops, pts, curve, (x, z, shape) => treePlacements.push({ x, z, ...shape }), plot => buildingPlots.push(plot), plot => architecturePlots.push(plot), zone => publicRealmZones.push(zone));
  const heroRealm=publicRealmZones.length?createHeroRealm():null;
  if(heroRealm)scene.add(heroRealm);
  const realCity = buildRealCity(architecturePlots);
  const blade = createBoxes(); blade.add(-0.25, 0, -0.15, 0.5, 9, 0.3, P.white); blade.add(-0.5, -0.5, -0.4, 1, 1, 0.8, P.white); // blade + hub cap
  const bm = buildMeshes(blade.list), proto = new THREE.Group().add(...[0, 1, 2].map((k) => { const c = bm.clone(); c.rotation.z = k * Math.PI * 2 / 3; return c; }));
  const rotors = hubs.map(([x, y, z], i) => { // 3 blades at 120deg; clones share geometry + materials
    const g = proto.clone(); g.position.set(x, y, z); g.userData.phase = i * 1.3; return g;
  });
  const SPIN = 0.45; // rad/s
  const { eye, details, plane, planeAt } = buildLandmarks(add, stops, pts, (x, z, shape) => treePlacements.push({ x, z, ...shape }));
  let trees;
  try { trees = await createTrees(treePlacements); scene.add(trees); }
  catch { treePlacements.forEach(({ x, z, ...shape }) => tree(add, x, z, shape)); } // retain trees if the texture cannot load
  const architecture = await realCity;scene.add(architecture);
  const routemaster = buildBus(), mini = buildMini(), bus = new THREE.Group().add(mini, routemaster), swap = swapAt(stops);
  // First Glasgow livery between these fractions of the olm->glasgow and glasgow->tribal segments
  const [SCOT_IN, SCOT_OUT] = scotRange(stops);
  let scot = false;
  addBeams(mini, 1.72, 0.55); addBeams(routemaster, 5.46, 0.8);
  const WIN_L = '#2b2621', RG = '#27394b', RB = '#c9ccd1'; // Glasgow Uni windows, Riverside glass + band
  const world = buildMeshes(list, { glow: [P.lit, '#ffd86b', '#fff7c2', P.arch, WIN_L, RG, RB], glowK: { [P.arch]: 1.1, [WIN_L]: 1.0, [RG]: 0.55, [RB]: 0.2 } });
  world.traverse((o) => { const h = o.material?.color?.getHexString(); if (o.material?.userData.glow) { if (h === WIN_L.slice(1)) o.material.userData.glowColor = new THREE.Color('#ffb04a'); if (h === RG.slice(1)) o.material.userData.glowColor = new THREE.Color('#d8e86a'); if (h === RB.slice(1)) o.material.userData.glowColor = new THREE.Color('#bcd4ff'); } });
  polishLandmarkMaterials(world,stops,pts);
  const motion = buildMotion(); scene.add(motion.group);
  const roadMarks = createRoadMarks(curve, stops);
  scene.add(world, eye, details, plane, bus, ...rotors, roadMarks);
  const units = [createAmbient(scene, { curve, pts, stops })];
  const people = createPeople(scene, { curve, pts, stops, reducedMotion });
  const water = createWater({ x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z: RIVER_Z, width: 22 });
  scene.add(water.mesh);
  units.push(await createSigns(scene, { stops, curve }));
  let disposed = false, raf = 0;
  const wake = () => { if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(frame); };
  const figure = buildFigure(wake);
  const end = curve.getPointAt(1), endTan = curve.getTangentAt(1), near = new THREE.Vector3(-endTan.z, 0, endTan.x).normalize();
  figure.position.set(end.x + endTan.x * 9 + near.x * 2, 0, end.z + endTan.z * 9 + near.z * 2);
  scene.add(figure);
  const pools = createLampPools(scene, lamps);
  const sky = createSky(scene, { hemi, sun, reducedMotion }), moodAt = createMood(stops), rain = createRain(scene, { reducedMotion });
  const post = createPost(renderer, scene, camera, { sun, tier: reducedMotion || matchMedia('(max-width: 767px)').matches ? 'medium' : 'high' });
  let fpsT = 0, fpsN = 0, night = 0, nightTarget = 0, mobile = false;
  const bar = document.querySelector('.bar'), panel = document.querySelector('#panel');
  let fitKey = '';
  // panel size changes per section: ease the view offset to its new value instead of snapping the camera
  const vo = {}, applyView = () => camera.setViewOffset(innerWidth, innerHeight, vo.x, vo.y, innerWidth, innerHeight);
  const fit = () => {
    const width = innerWidth, height = innerHeight, headerBottom = bar?.getBoundingClientRect().bottom ?? 0, panelBox = panel?.getBoundingClientRect();
    const key = JSON.stringify([width, height, mobile, headerBottom, panelBox]);
    if (key === fitKey) return false;
    fitKey = key;
    vo.tx = mobile ? 0 : panel ? -panelBox.right / 2 : 0;
    vo.ty = mobile ? height / 2 - (headerBottom + (panelBox?.top ?? height)) / 2 : panel ? -headerBottom / 2 : 0;
    if (vo.x === undefined) { vo.x = vo.tx; vo.y = vo.ty; }
    applyView();
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
    scroll = reducedMotion ? { value: marks[nearestStop(target, n, marks)], velocity: 0 } : spring(scroll, target, dt, SCROLL_SMOOTH);
    if (!reducedMotion) clock += dt;
    const ox = reducedMotion || !dt ? vo.tx : approach(vo.x, vo.tx, dt, 300), oy = reducedMotion || !dt ? vo.ty : approach(vo.y, vo.ty, dt, 300);
    if (ox !== vo.x || oy !== vo.y) { vo.x = ox; vo.y = oy; applyView(); camera.updateProjectionMatrix(); }
    const p = scroll.value, t = routeT(p, n, knots);
    const bp = curve.getPointAt(t), tan = curve.getTangentAt(t);
    lateral.set(tan.z, 0, -tan.x).normalize().multiplyScalar(BUS_LANE);
    routemaster.visible = t >= swap;
    mini.visible = !routemaster.visible;
    const inScot = t >= SCOT_IN && t < SCOT_OUT;
    if (inScot !== scot) routemaster.userData.setLivery(scot = inScot);
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
    architecture.userData.update?.(camera);
    // snap the shadow centre to whole shadow texels in light space, so shadow edges don't shimmer while moving
    const a = Math.round(bp.dot(LU) / TEXEL) * TEXEL, b = Math.round(bp.dot(LV) / TEXEL) * TEXEL;
    sun.target.position.copy(LU).multiplyScalar(a).addScaledVector(LV, b).addScaledVector(LD, bp.dot(LD));
    sun.position.copy(sun.target.position).add(SUN);
    eye.rotation.z = clock * 0.1; motion.uT.value = clock;
    for (const g of rotors) g.rotation.z = -clock * SPIN + g.userData.phase; // clockwise seen from +z
    updatePlane(t);
    const f = { time: clock, dt, progress: p, t, active: nearestStop(p, n, marks), bus: busPos };
    onProgress(p);
    for (const u of units) u.update(f);
    people.update(dt, camera.position);
    trees?.userData.update(camera);
    night = reducedMotion || dt === 0 ? nightTarget : approach(night, nightTarget, dt, 1.4);
    const mood = moodAt(t);
    sky.update(night, dt, camera.position, camera, mood);
    rain.update(clock, busPos, mood.rain * (1 - 0.5 * night));
    updateBeams(night); pools.update(night);
    water.update(clock, night);
    world.userData.updateLandmarkNight?.(night);
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
      architecture.userData.dispose?.();
      heroRealm?.userData.dispose();
      roadMarks.userData.dispose();
      trees?.userData.dispose?.();
      for (const name of ['wembley', 'bigben', 'masp']) details.getObjectByName(name + '-geometry')?.userData.dispose();
      details.getObjectByName('hero-background')?.userData.dispose();
      details.getObjectByName('paulista-architecture')?.userData.dispose();
      renderer.dispose();
    },
  };
}
