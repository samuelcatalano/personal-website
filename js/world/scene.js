import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { routeT, nearestStop, stopMarks, fineMarks } from '../scroll.js';
import { routePoints, routeCurve, RIVER_Z, riverEnd, riverStart, FRAME_LIFT, swapAt, heroVehicleAt, ukStart } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildMotion } from './motion.js';
import { buildCity, tree } from './city.js';
import { buildRealCity } from './real-city.js';
import { createHeroRealm } from './hero-realm.js';
import { createTrees } from './trees.js';
import { buildPhoneBoxes } from './phone.js';
import { buildLampPosts } from './street-lamp.js';
import { buildBackdrop } from './backdrop.js';
import { createSkyline } from './skyline.js';
import { buildLandmarks } from './landmarks.js';
import { resetFloodlights } from './building-slice-materials.js';
import { polishLandmarkMaterials } from './landmark-materials.js';
import { buildVehicle } from './vehicles.js';
import { createMood } from './mood.js';
import { createRain } from './rain.js';
import { lagWetness } from './weather.js';
import { createWetSurfaces } from './wet-surfaces.js';
import { createSky, EXPOSURE, SUN_DIR } from './sky.js';
import { createWater } from './water.js';
import { createAmbient } from './ambient.js';
import { createParked } from './parked.js';
import { parkingBays } from './bays.js';
import { createPeople } from './people.js';
import { createSigns } from './signs.js';
import { buildFigure } from './figure.js';
import { SECTION_SHOT, shotFor, blendShots, spring, approach, nextTier } from './camera.js';
import { updateBeams, addBeams } from './beams.js';
import { createLampPools } from './lamps.js';
import { createPost } from './post.js';
import { createRoadMarks } from './roadmarks.js';
import { loadVehicleAsset, adoptVisual, upgradeBus, upgradeMini, rollWheels, initVehicleEnv, updateVehicleEnv } from './vehicle-assets.js';
import { createUnderpass } from './underpass.js';
import { createUnderpassTraffic } from './underpass-traffic.js';
import { upgradeWellington } from './wellington-asset.js';
const BUS_LANE = 1.75, SCROLL_SMOOTH = 0.18, ARC = 10;
export const createHeroGroup = (candidates) => new THREE.Group().add(...candidates);
export const applyHeroPose = (group, position, lateral, heading) => {
  group.position.copy(position).add(lateral);
  group.rotation.y = heading;
};

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
  const far = createBoxes();
  buildBackdrop(distant.add, stops, pts, far.add);
  const skyline = createSkyline(far.list);
  scene.add(skyline);
  const backdrop = buildMeshes(distant.list);
  backdrop.name = 'distant-neighborhoods';
  backdrop.traverse(o => { o.castShadow = o.receiveShadow = false; });
  scene.add(backdrop);
  const { add, list } = createBoxes();
  const treePlacements = [], buildingPlots = [], architecturePlots = [], publicRealmZones = [];
  const { lamps, pilotCrossings } = buildCity(add, stops, pts, curve, (x, z, shape) => treePlacements.push({ x, z, ...shape }), plot => buildingPlots.push(plot), plot => architecturePlots.push(plot), zone => publicRealmZones.push(zone));
  const heroRealm=publicRealmZones.length?createHeroRealm():null;
  if(heroRealm)scene.add(heroRealm);
  const realCity = buildRealCity(architecturePlots);
  resetFloodlights(); // landmark builders re-register their night floodlight boxes
  const { eye, details } = buildLandmarks(add, stops, pts, (x, z, shape) => treePlacements.push({ x, z, ...shape }));
  const plane = buildVehicle('a330'), planeAt = ukStart(stops) / (n - 1), { nav, strobe, shadow } = plane.userData; // flies past the bus at the first UK stop
  plane.visible = shadow.visible = nav.visible = strobe.visible = false;
  // Only the explicitly marked garden lots give way to new buildings.
  const infill = architecturePlots.filter(p => p.replaceGarden);
  for (let i = treePlacements.length - 1; i >= 0; i--) {
    const t = treePlacements[i], radius = t.crown / 2;
    if (infill.some(p => Math.abs(t.x - p.x) < p.width / 2 + radius && Math.abs(t.z - p.z) < p.depth / 2 + radius)) treePlacements.splice(i, 1);
  }
  let trees;
  try { trees = await createTrees(treePlacements); scene.add(trees); }
  catch { treePlacements.forEach(({ x, z, ...shape }) => tree(add, x, z, shape)); } // retain trees if the texture cannot load
  const phones = await buildPhoneBoxes(); if (phones) scene.add(phones);
  const lampPosts = await buildLampPosts(); if (lampPosts) scene.add(lampPosts);
  const architecture = await realCity;scene.add(architecture);
  const mini = buildVehicle('mini', { hero: true }), londonBus = buildVehicle('london', { hero: true }), glasgowBus = buildVehicle('glasgow', { hero: true });
  const candidates = [mini, londonBus, glasgowBus], heroVehicles = { mini, london: londonBus, glasgow: glasgowBus };
  const bus = createHeroGroup(candidates), swap = swapAt(stops);
  candidates.forEach((v) => { v.visible = false; });
  // Glasgow livery between the two railway underpasses (each within 7 m of its scotRange boundary); the visible swap happens inside the tunnel (see frame())
  const underpass = createUnderpass(curve, stops), [ARCH_IN, ARCH_OUT] = underpass.passes.map((a) => a.t);
  scene.add(underpass.group);
  const bridgeCars = createUnderpassTraffic(underpass.passes, { reducedMotion }); scene.add(bridgeCars.group);
  let shown = null, frameNo = 0, swapFade = null; const SWAP_OUT = 0.3, SWAP_IN = 0.35; // Hero changes scale down then up; never both visible outside this fade.
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere(), ray = new THREE.Raycaster();
  for (const v of candidates) addBeams(v, v.userData.front, v.userData.beamY);
  const WIN_L = '#2b2621', RG = '#27394b', RB = '#c9ccd1'; // Glasgow Uni windows, Riverside glass + band
  const world = buildMeshes(list, { glow: [P.lit, '#ffd86b', '#fff7c2', P.arch, WIN_L, RG, RB], glowK: { [P.arch]: 1.1, [WIN_L]: 1.0, [RG]: 0.55, [RB]: 0.2 } });
  world.traverse((o) => { const h = o.material?.color?.getHexString(); if (o.material?.userData.glow) { if (h === WIN_L.slice(1)) o.material.userData.glowColor = new THREE.Color('#ffb04a'); if (h === RG.slice(1)) o.material.userData.glowColor = new THREE.Color('#d8e86a'); if (h === RB.slice(1)) o.material.userData.glowColor = new THREE.Color('#bcd4ff'); } });
  polishLandmarkMaterials(world,stops,pts);
  const motion = buildMotion(); scene.add(motion.group);
  const roadMarks = createRoadMarks(curve, stops, { ...parkingBays(curve, pts, stops, pilotCrossings), pilotCrossings });
  scene.add(world, eye, details, plane, shadow, bus, roadMarks);
  const units = [createAmbient(scene, { curve, pts, stops, reducedMotion }), createParked(scene, { curve, pts, stops, pilotCrossings })];
  const people = createPeople(scene, { curve, pts, stops, reducedMotion });
  const water = createWater({ x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z: RIVER_Z, width: 22, reducedMotion });
  scene.add(water.mesh);
  units.push(await createSigns(scene, { stops, curve }));
  let disposed = false, raf = 0;
  initVehicleEnv(renderer); upgradeMini(mini, { isDisposed: () => disposed }); upgradeBus(londonBus, 'london', { isDisposed: () => disposed }); upgradeBus(glasgowBus, 'glasgow', { isDisposed: () => disposed }); // authored shared London/Glasgow bus GLB
  loadVehicleAsset('a330').then((glb) => { if (glb && !disposed) adoptVisual(plane, glb, ['nav', 'strobe']); }); // authored A330 (tools/vehicles/a330); procedural stays on failure
  const wake = () => { if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(frame); };
  const wellington = details.getObjectByName('wellington-geometry');
  if (wellington) upgradeWellington(wellington, () => disposed).then(wake);
  const figure = buildFigure(wake);
  const end = curve.getPointAt(1), endTan = curve.getTangentAt(1), near = new THREE.Vector3(-endTan.z, 0, endTan.x).normalize();
  figure.position.set(end.x + endTan.x * 9 + near.x * 2, 0, end.z + endTan.z * 9 + near.z * 2);
  scene.add(figure);
  const pools = createLampPools(scene, lamps);
  const sky = createSky(scene, { hemi, sun, reducedMotion }), moodAt = createMood(stops), rain = createRain(scene, { reducedMotion, lamps });
  const wetSurfaces = createWetSurfaces(scene, { lamps, reducedMotion });
  let wet = 0;
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
  const busPos = { x: 0, y: 0, z: 0 }, prevBus = { x: null, z: 0, h: 0 }, MINI_WHEELBASE = 2.5, MAX_STEER = 0.5;
  let steer = 0;
  const updatePlane = (p) => { // the original flyover: passes beside the bus at the first UK stop, heading +x, climbing out
    const d = (p - planeAt) * (n - 1);
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(busPos.x + 16 + d * 60, Math.max(3, 18 - d * 10), busPos.z - 2);
    shadow.visible = plane.visible && night < 0.9;
    nav.visible = plane.visible && night > 0.35; strobe.visible = nav.visible && clock % 1.3 < 0.12; // red left / green right steady, white strobe blinks
    if (shadow.visible) { shadow.position.set(plane.position.x, 0.14, plane.position.z); shadow.scale.set(34, 1, 15); shadow.material.opacity = 0.3 * (1 - night); }
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
    applyHeroPose(bus, bp, lateral, Math.atan2(-tan.z, tan.x));
    Object.assign(busPos, { x: bp.x + lateral.x, y: bp.y, z: bp.z + lateral.z });
    if (prevBus.x !== null) { // hero wheels roll with the distance travelled along the road (signed: scrolling back unrolls them)
      const ds = (busPos.x - prevBus.x) * tan.x + (busPos.z - prevBus.z) * tan.z;
      for (const m of candidates) if (m.visible) rollWheels(m.userData.wheels, ds);
      // Mini front wheels steer into curves: bicycle model on the heading change per metre, smoothed; still / jumps (respawn, reduced-motion stop hops) straighten
      // ponytail: hero Mini only; ambient Minis (axle-merged wheels) and buses do not steer
      const dh = Math.atan2(Math.sin(bus.rotation.y - prevBus.h), Math.cos(bus.rotation.y - prevBus.h)), still = reducedMotion || Math.abs(ds) < 1e-3 || Math.abs(ds) > 2;
      steer += ((still ? 0 : Math.max(-MAX_STEER, Math.min(MAX_STEER, Math.atan(MINI_WHEELBASE * dh / ds)))) - steer) * Math.min(1, dt * 10);
      if (mini.visible) for (const w of mini.userData.wheels) if (w.name === 'FL' || w.name === 'FR') { w.rotation.order = 'YXZ'; w.rotation.y = steer; }
    }
    prevBus.x = busPos.x; prevBus.z = busPos.z; prevBus.h = bus.rotation.y;
    const s = t * (n - 1), i = Math.min(Math.floor(s), n - 2);
    const ka = SECTION_SHOT[stops[i].section], kb = SECTION_SHOT[stops[i + 1].section];
    const la = FRAME_LIFT[stops[i].id] ?? 0, lb = FRAME_LIFT[stops[i + 1].id] ?? 0;
    const lift = la + (lb - la) * (s - i);
    const shot = blendShots(shotFor(ka, busPos, { mobile, lift }), shotFor(kb, busPos, { mobile, lift }), s - i, ka === kb ? 0 : ARC);
    camera.position.fromArray(shot.position);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    // The primary Mini returns as a Mini; regional São Paulo buses belong to secondary traffic.
    const want = heroVehicleAt(t, swap, ARCH_IN, ARCH_OUT, heroVehicles);
    frameNo++;
    if (shown !== want) {
      let why = !shown || shown === mini || want === mini ? 'immediate' : underpass.passes.some((a) => Math.abs(underpass.offset(a, busPos.x, busPos.z)) <= a.half - 5.7) ? 'arch' : Math.abs(s - Math.round(s)) < 0.12 ? 'stop' : ka !== kb && s - i > 0.15 && s - i < 0.85 ? 'blend' : '';
      if (!why) {
        camera.updateMatrixWorld();
        sphere.set(lateral.clone().add(bp).setY(bp.y + 2.2), 6.4);
        if (!frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)).intersectsSphere(sphere)) why = 'offscreen';
        else if (frameNo % 4 === 0) { // occlusion: ray from the camera to the bus centre meets architecture first
          const d = camera.position.distanceTo(sphere.center);
          ray.set(camera.position, sphere.center.clone().sub(camera.position).normalize()); ray.far = d - 4;
          if (ray.intersectObject(architecture, true).length) why = 'occluded';
        }
      }
      if (why) {
        if (swapFade) { swapFade.out.visible = false; swapFade.inn.visible = true; swapFade.out.scale.setScalar(1); swapFade.inn.scale.setScalar(1); swapFade = null; }
        const out = shown; shown = want;
        if ((why === 'immediate' || why === 'region') && out && !reducedMotion) {
          candidates.forEach((v) => { v.visible = v === out; });
          swapFade = { out, inn: want, k: 0 }; // out keeps showing until it has shrunk away
        } else candidates.forEach((v) => { v.visible = v === want; });
      }
    }
    if (swapFade) {
      const f = swapFade, k = f.k += dt
      if (k < SWAP_OUT) f.out.scale.setScalar(Math.max(0.001, 1 - (k / SWAP_OUT) ** 2)); // ease-in
      else {
        if (f.out.visible) { f.out.visible = false; f.out.scale.setScalar(1); f.inn.visible = true; }
        const u = Math.min(1, (k - SWAP_OUT) / SWAP_IN), o = 1 - (1 - Math.min(1, u / 0.7)) ** 3; // ease-out to a 1.04 overshoot, then settle
        f.inn.scale.setScalar(Math.max(0.001, u < 0.7 ? 1.04 * o : 1.04 - 0.04 * (u - 0.7) / 0.3));
        if (u >= 1) { f.inn.scale.setScalar(1); swapFade = null; }
      }
    }
    bridgeCars.update(dt);
    architecture.userData.update?.(camera);
    // snap the shadow centre to whole shadow texels in light space, so shadow edges don't shimmer while moving
    const a = Math.round(bp.dot(LU) / TEXEL) * TEXEL, b = Math.round(bp.dot(LV) / TEXEL) * TEXEL;
    sun.target.position.copy(LU).multiplyScalar(a).addScaledVector(LV, b).addScaledVector(LD, bp.dot(LD));
    sun.position.copy(sun.target.position).add(SUN);
    eye.rotation.z = clock * 0.1; motion.uT.value = clock;
    updatePlane(t);
    const f = { camera, time: clock, dt, progress: p, t, active: nearestStop(p, n, marks), bus: busPos };
    onProgress(p);
    for (const u of units) u.update(f);
    people.update(dt, camera.position);
    trees?.userData.update(camera, clock);
    night = reducedMotion || dt === 0 ? nightTarget : approach(night, nightTarget, dt, 1.4);
    const mood = moodAt(t);
    wet = lagWetness(wet, mood.wet, dt);
    const flash = rain.update(clock, camera, mood, night, post.tier, busPos, bus.rotation.y);
    sky.update(night, dt, camera.position, camera, mood, flash);
    skyline.userData.update(night);
    wetSurfaces.update(clock, wet, mood.rain, night, camera.position, sky.colors, bus.position, bus.rotation.y, post.tier);
    updateBeams(night); pools.update(night, wet); lampPosts?.userData.setNight?.(night);
    water.update(clock, night, mood, post.tier, sky.colors);
    world.userData.updateLandmarkNight?.(night);
    updateVehicleEnv(night);
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
      for (const u of units) u.dispose?.();
      cancelAnimationFrame(raf); raf = 0;
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      observer?.disconnect();
      architecture.userData.dispose?.();
      underpass.group.userData.dispose(); bridgeCars.dispose();
      heroRealm?.userData.dispose();
      roadMarks.userData.dispose();
      rain.dispose?.();
      wetSurfaces.dispose();
      sky.dispose();
      trees?.userData.dispose?.();
      phones?.userData.dispose(); lampPosts?.userData.dispose();
      for (const name of ['wembley', 'bigben', 'masp', 'se', 'estaiada', 'towerbridge', 'eyeframe', 'copan', 'riverside', 'university', 'chambers', 'wellington']) details.getObjectByName(name + '-geometry')?.userData.dispose();
      details.getObjectByName('hero-background')?.userData.dispose();
      details.getObjectByName('paulista-architecture')?.userData.dispose();
      renderer.dispose();
    },
  };
}
