import { townhouseMaterials, roomGlassMaterial, officeFacadeMaterials, prepareArchitectureMaterials } from './building-slice-materials.js';
import { createShopSpill } from './shop-spill.js';
import { streetEnvironment, setStreetRegions, shopFrontages } from './streetscape-state.js';
import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { routeT, nearestStop, stopMarks, fineMarks } from '../scroll.js';
import { ROAD, regions, routePoints, routeCurve, RIVER_Z, riverEnd, riverStart, towerX, FRAME_LIFT, swapAt, swapTunnelFrame, heroVehicleAt, ukStart, treeRegion, SWAP_GAP, east, eastAdd, stretch, LEGACY_GAPS, underpassFrames, UNDERPASS, LANDMARKS, stopIndex, furnitureSpots } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildMotion } from './motion.js';
import { buildCity, tree } from './city.js';
import { buildRealCity } from './real-city.js';
import { createHeroRealm } from './hero-realm.js';
import { createTrees } from './trees.js';
import { buildPhoneBoxes, kioskSpots } from './phone.js';
import { buildLampPosts, lampSpots } from './street-lamp.js';
import { placeStreetProps, buildStreetProps } from './street-props.js';
import { buildBackdrop, hazeTone, capRise } from './backdrop.js';
import { REALISM } from './textures.js';
import { createSkyline } from './skyline.js';
import { buildLandmarks } from './landmarks.js';
import { initGlbLoader } from './glb-loader.js';
import { upgradeBigBen, bigBenForced } from './bigben-asset.js';
import { upgradeSe, seForced } from './se-asset.js';
import { upgradeTowerBridge, towerBridgeForced } from './towerbridge-asset.js';
import { upgradeMasp, maspForced } from './masp-asset.js';
import { authoredLandmarksForced, upgradeAuthoredLandmark, upgradeLondonEye } from './authored-landmarks.js';
import { resetFloodlights } from './building-slice-materials.js';
import { onLoadChange } from './load-progress.js';
import { polishLandmarkMaterials } from './landmark-materials.js';
import { createLandmarkEnv } from './landmark-env.js';
import { towerGlass, towerFacades } from './building-kit.js';
import { buildVehicle } from './vehicles.js';
import { planePose, smooth, PLANE_IN, PLANE_OUT, TURN_AT, HAZE } from './plane-path.js';
import { createMood } from './mood.js';
import { createRain } from './rain.js';
import { createWeatherCover } from './weather-cover.js';
import { lagWetness } from './weather.js';
import { createWetSurfaces } from './wet-surfaces.js';
import { createCloudShadows } from './cloud-shadows.js';
import { createSky, EXPOSURE, SUN_DIR } from './sky.js';
import { createWater } from './water.js';
import { towerPierBounds } from './water-math.js';
import { createPavementHeight, createPedestrianSpace } from './spatial-mask.js';
import { createAmbient } from './ambient.js';
import { createParked } from './parked.js';
import { parkingBays } from './bays.js';
import { createPeople } from './people.js';
import { createNpc3d } from './npc3d.js';
import { buildFigure } from './figure.js';
import { createLandmarkPicker } from './landmark-pick.js';
import { createLandmarkLight } from './landmark-light.js';
import { laneSide } from './lanes.js';
import { SECTION_SHOT, shotFor, blendShots, spring, approach, CINE, cinePose } from './camera.js';
import { updateBeams, addBeams, refitBeams } from './beams.js';
import { createLampPools } from './lamps.js';
import { createLampField, applyLampField } from './lamp-field.js';
import { treeSun } from './authored-trees.js';
import { disposeNpcBodyAtlas } from './npc-atlas.js';
import { createPost } from './post.js';
import { createVehicleFx } from './vehicle-fx.js';
import { createRoadMarks } from './roadmarks.js';
import { loadVehicleAsset, adoptVisual, upgradeBus, upgradeMini, rollWheels, initVehicleEnv, updateVehicleEnv, setVehicleSkyEnv } from './vehicle-assets.js';
import { RIVER_RUN } from './underwater-profile.js';
import { createUnderpass, HX as UNDERPASS_HALF, W as UNDERPASS_WIDTH, H as UNDERPASS_HEIGHT, deckHeight, ROAD_HW, END as UNDERPASS_END } from './underpass.js';
import { createUnderpassTraffic } from './underpass-traffic.js';
import { createRouteTunnel } from './route-tunnel.js';
import { createSwapTunnel } from './swap-tunnel.js';
import { upgradeWellington } from './wellington-asset.js';
import { bridgeStreetRoute } from './bridge-exits.js';
import { estaiadaRoute, ESTAIADA_DECK } from './landmark-geometry.js';
import { RIVER_WIDTH } from './underwater-profile.js';
import { PARKS, PLAZAS, SQUARES } from './parks.js';
import { walkPaths } from './crowd.js';
import { planUrbanRoads } from './urban-roads.js';
import { createUrbanRoadMeshes, roadCoverageBoxes, roadGrassPlots, sampleRoadAnchors, inscribedAnchorWidth, subtractRect, URBAN_ROAD_LEVELS } from './urban-road-mesh.js';
const BUS_LANE = 1.75, SCROLL_SMOOTH = 0.18, ARC = 10;
const LANDMARK_STARTUP_TIMEOUT = 5000; // ponytail: slower landmark GLBs use procedural geometry for this visit
export const createHeroGroup = (candidates) => new THREE.Group().add(...candidates);
export const applyHeroPose = (group, position, lateral, heading) => {
  group.position.copy(position).add(lateral);
  group.rotation.y = heading;
};

// Owner's request: the corner where the closing character stands is open pavement, no lawn or trees.
const BODY_TURN = .42 - 20 * Math.PI / 180; // radians, marked by the owner (then 20° back toward screen left): at the frame's edge, facing the camera exactly reads as turned away.
const CORNER = { x0: east(801.6), x1: east(816), z0: -1.5, z1: 9 }; // legacy literal, moved onto the real route
const inClosingCorner = (x, z) => x > CORNER.x0 && x < CORNER.x1 && z > CORNER.z0 && z < CORNER.z1;
const isGreen = (color) => { const c = new THREE.Color(color); return c.g > c.r * 1.1 && c.g > c.b * 1.1; };
const clearClosingCorner = (add) => Object.assign((x, y, z, w, h, d, color, ry = 0, ...rest) => {
  const reach = Math.abs(w * Math.cos(ry)) / 2 + Math.abs(d * Math.sin(ry)) / 2, across = Math.abs(w * Math.sin(ry)) / 2 + Math.abs(d * Math.cos(ry)) / 2;
  const overlaps = x + reach > CORNER.x0 && x - reach < CORNER.x1 && z + across > CORNER.z0 && z - across < CORNER.z1;
  if (!overlaps || !isGreen(color)) return add(x, y, z, w, h, d, color, ry, ...rest);
  // Trim along the box's own length, keeping what lies before the corner; lawns run lengthwise.
  const cut = (CORNER.x0 - x) / Math.cos(ry), kept = cut + w / 2;
  if (kept <= 0) return undefined;
  const middle = (cut - w / 2) / 2;
  return add(x + middle * Math.cos(ry), y, z - middle * Math.sin(ry), kept, h, d, color, ry, ...rest);
}, add, { plant: (kind, x, y, z, ...rest) => { if (!inClosingCorner(x, z)) add.plant(kind, x, y, z, ...rest); } });

// Static roots keep their world matrices: matrixAutoUpdate off skips the per-frame compose for every object under them.
// ponytail: one-way and manual; a root that is moved later must get matrixAutoUpdate back on.
const freezeStatic = (root) => {
  if (!root) return;
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (!o.isBone && !o.isSkinnedMesh) o.matrixAutoUpdate = false; });
};

export async function createWorld(canvas, stops, { reducedMotion = false, onProgress = () => {}, onPick = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // ponytail: a lost GPU context falls back to the HTML-only site (the panel is the source of truth); a reload brings the city back, no scene rebuild
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.body.classList.add('no-webgl'); });
  Object.assign(renderer, { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: EXPOSURE, outputColorSpace: THREE.SRGBColorSpace });
  initGlbLoader(renderer);
  await prepareArchitectureMaterials();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // The identity root must not force frozen descendants to multiply world matrices every frame.
  scene.matrixAutoUpdate = false;
  scene.background = new THREE.Color(0xa8d0f2);
  scene.fog = new THREE.Fog(0xa8d0f2, 240, 900);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1400);
  const qa = new URLSearchParams(location.search).has('qa');
  if (qa) { globalThis.__qaCamera = camera; globalThis.__qaRenderer = renderer; globalThis.__qaWorldFrames = 0; globalThis.__qaScene = scene; } // QA captures (tools/qa/route-capture.mjs) record the camera
  const hemi = new THREE.HemisphereLight(0xb9d4ea, 0x8d8574, 1);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.castShadow = true;
  Object.assign(sun.shadow, { bias: -0.0002, normalBias: 0.05, intensity: 0.9 }); // day 0.9, set per frame in sky.js: cast shadows keep 10% of the key, so trees, props and facades ground without going black; night stays 0.8, where long low-sun shadows read lighter (PCFSoft ignores shadow.radius in r169)
  sun.shadow.mapSize.set(2048, 2048); // desktop: 7.8 cm texels over the ±80 m frustum (1024 gave 15.6 cm: soft, detached small shadows)
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  const SUN = SUN_DIR.clone().multiplyScalar(95), LD = SUN.clone().normalize();
  const TEXEL_X = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const TEXEL_Y = (sun.shadow.camera.top - sun.shadow.camera.bottom) / sun.shadow.mapSize.y;
  const LU = new THREE.Vector3(0, 1, 0).cross(LD).normalize(), LV = LD.clone().cross(LU);
  scene.add(hemi, sun, sun.target);
  const n = stops.length, pts = routePoints(n), marks = stopMarks(pts);
  const curve = routeCurve(THREE, pts), knots = fineMarks(marks, curve);
  const streetRegions = regions(stops, pts);
  setStreetRegions(pts[ukStart(stops)].x - 15, streetRegions[0].ctry[0], streetRegions[1].ctry[1]);
  const distant = createBoxes();
  const far = createBoxes();
  const addBackdrop = eastAdd(distant.add, stretch);
  buildBackdrop((x, y, z, w, h, d, color, ...rest) => {
    if (color === P.pave && y < 0) {
      // Stretch both paving edges; translating centres alone leaves sky-visible gaps between neighboring tiles.
      const left = stretch(x - w / 2), right = stretch(x + w / 2);
      return distant.add((left + right) / 2, y, z, right - left, h, d, color, ...rest);
    }
    return addBackdrop(x, y, z, w, h, d, color, ...rest);
  }, stops, routePoints(n, LEGACY_GAPS), eastAdd(far.add, stretch)); // buildings retain their original footprints
  // Far band (z < -190): warm/pale distant walls become cool slates, so through the fog the band reads darker and bluer than the skyline behind it.
  // Done here, after generation, so the generator output the tests pin stays untouched.
  // Chroma ramps down with depth (1:1 colour remaps, so no new per-colour batches): near rows keep ~55% chroma, far slates ~35% and lose their blue cast,
  // which also keeps the night band from glowing saturated blue under the blue fog. Far roof caps rise 0-1.4 m so the rows do not share one flat roofline.
  const SLATE = new Map([[P.londonStock, '#6c727c'], [P.concreteMid, '#717b88'], [P.taupe, '#626670'], [P.cream, '#7a8390'], ['#9db7c6', '#9db7c6']].map(([k, v]) => [k, hazeTone(v, 0.35)]));
  const NEAR = new Set([P.cream, P.stone, P.taupe, P.roof, P.brick, P.redBrown, P.londonStock, P.concreteMid, P.steel, '#86adc6']);
  const SLATE0 = new Map([[P.londonStock, '#6c727c'], [P.concreteMid, '#717b88'], [P.taupe, '#626670'], [P.cream, '#7a8390']]); // phones keep the previous far band (REALISM off)
  if (!REALISM) { for (const b of distant.list) if (b.z < -190 && SLATE0.has(b.color)) b.color = SLATE0.get(b.color); }
  else for (const b of distant.list) {
    if (b.z < -190 && SLATE.has(b.color)) b.color = SLATE.get(b.color);
    else if (NEAR.has(b.color)) b.color = hazeTone(b.color, 0.55);
    if (b.z < -145 && b.y > 0 && Math.abs(b.h - 0.35) < 1e-6) b.h += capRise(b.x, b.z);
  }
  const skyline = createSkyline(far.list);
  scene.add(skyline);
  // Chunked in 160 m cells along x: one merged mesh per colour for the whole route was submitted in every view (2.19 M tris); cells let the frustum reject the far ones.
  const backdrop = new THREE.Group();
  backdrop.name = 'distant-neighborhoods';
  backdrop.userData.list = distant.list.filter((b) => !b.plant); // same box-only list buildMeshes exposed before (tests/backdrop-ground.browser.py)
  backdrop.userData.plants = distant.list.filter((b) => b.plant);
  const backdropCells = new Map();
  for (const b of distant.list) { const k = Math.floor(b.x / 160); (backdropCells.get(k) ?? backdropCells.set(k, []).get(k)).push(b); }
  for (const cell of backdropCells.values()) {
    const part = buildMeshes(cell);
    part.traverse((o) => { if (o.isInstancedMesh) o.computeBoundingSphere(); }); // explicit sphere per cell: frustum test needs it before the first render
    backdrop.add(part);
  }
  backdrop.traverse(o => { o.castShadow = o.receiveShadow = false; });
  scene.add(backdrop);
  const { add, list } = createBoxes();
  const cornerAdd = clearClosingCorner(add);
  const treePlacements = [], buildingPlots = [], architecturePlots = [], publicRealmZones = [];
  // the lot on the viaduct's road extension toward the river is removed (no building there; the road ramps up onto the river bridge)
  const removedPlots = []; if (qa) globalThis.__qaRemoved = removedPlots; // QA probe: lots dropped by onRiverRoad
  const onRiverRoad = (p) => { const hit = onRiverRoad0(p); if (hit) removedPlots.push([p.id, p.kind, +p.x.toFixed(1), +p.z.toFixed(1)]); return hit; };
  const onRiverRoad0 = (p) => underpassFrames(curve, stops).some((u) => u.x > riverStart(stops, pts) && u.x < riverEnd(stops, pts) && (Math.abs(p.x - u.x) < 7 && p.z > RIVER_Z - 14 && p.z < u.z - 32 || Math.abs(p.x - u.x) < 8 + (p.width || 0) / 2 && p.z < RIVER_Z && p.z > RIVER_Z + 11 - RIVER_RUN - 6 - (p.depth || 0) / 2)); // + far-bank lots in front of the exit (to 6 m past the far end of the ramp)
  const { lamps, pilotCrossings } = buildCity(cornerAdd, stops, pts, curve, (x, z, shape) => treePlacements.push({ x, z, ...shape }), plot => { if (!onRiverRoad(plot)) buildingPlots.push(plot); }, plot => { if (!onRiverRoad(plot)) architecturePlots.push(plot); }, zone => publicRealmZones.push(zone));
  const lampField = createLampField(lamps); // night light reach on the ground; facades pick it up in their shader
  const heroRealm=publicRealmZones.length?createHeroRealm():null;
  if(heroRealm)scene.add(heroRealm);
  const realCity = buildRealCity(architecturePlots);
  if (qa) globalThis.__qaPlots = architecturePlots; // QA probe: lots, for the underwater-road house check (no visual effect)
  resetFloodlights(); // landmark builders re-register their night floodlight boxes
  const { eye, details, backgroundPlots } = buildLandmarks(cornerAdd, stops, pts, (x, z, shape) => treePlacements.push({ x, z, ...shape }));
  let routeS = 0;
  const plane = buildVehicle('a330'), planeAt = ukStart(stops) / (n - 1), { nav, strobe, shadow } = plane.userData; // flies past the bus at the first UK stop
  plane.visible = shadow.visible = nav.visible = strobe.visible = false;
  // Only the explicitly marked garden lots give way to new buildings.
  const infill = architecturePlots.filter(p => p.replaceGarden);
  for (let i = treePlacements.length - 1; i >= 0; i--) {
    const t = treePlacements[i], radius = t.crown / 2;
    if (inClosingCorner(t.x, t.z) || infill.some(p => Math.abs(t.x - p.x) < p.width / 2 + radius && Math.abs(t.z - p.z) < p.depth / 2 + radius)) treePlacements.splice(i, 1);
  }
  const lampClearance = lampSpots(), kioskClearance = kioskSpots(), furnitureClearance = furnitureSpots(stops, curve);
  const roadQuery = qa ? new URLSearchParams(location.search).get('urbanroads') : null;
  let urbanRoads = null, urbanRoadInputs = null, urbanRoadRects = [];
  if (roadQuery !== 'off') {
    const plots = [...new Map([...architecturePlots, ...buildingPlots].map(p => [p.id ?? `${p.x}:${p.z}:${p.width}:${p.depth}`, p])).values()];
    const minX = Math.min(...plots.map(p => p.x - p.width / 2)), maxX = Math.max(...plots.map(p => p.x + p.width / 2));
    const toRect = (b) => { const c = Math.abs(Math.cos(b.ry || 0)), s = Math.abs(Math.sin(b.ry || 0)), x = (c * b.w + s * b.d) / 2, z = (s * b.w + c * b.d) / 2; return { x0: b.x - x, x1: b.x + x, z0: b.z - z, z1: b.z + z }; };
    const obstacleSources = [...list, ...distant.list, ...far.list];
    const boxObstacles = obstacleSources.filter(b => b.x >= minX - 30 && b.x <= maxX + 30 && b.y <= 1 && (b.plant || b.y + b.h > 0.25)).map(toRect);
    const backgroundPlotObstacles = backgroundPlots.map(p => ({ x0: p.x - p.width / 2, x1: p.x + p.width / 2, z0: p.z - p.depth / 2, z1: p.z + p.depth / 2 }));
    const clearanceObstacles = [
      ...lampClearance.map(([x, z]) => ({ x0: x - 0.35, x1: x + 0.35, z0: z - 0.35, z1: z + 0.35 })),
      ...kioskClearance.map(([x, z]) => ({ x0: x - 0.85, x1: x + 0.85, z0: z - 0.85, z1: z + 0.85 })),
      ...furnitureClearance.map(({ xz: [x, z] }) => ({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 })),
    ];
    const obstacles = [...boxObstacles, ...backgroundPlotObstacles, ...clearanceObstacles];
    const estaiadaX = pts[stopIndex(stops, LANDMARKS.estaiada)].x;
    const estaiada = estaiadaRoute(estaiadaX, curve, RIVER_Z);
    const estaiadaDeckRects = estaiada.stations.slice(1).flatMap((b, i) => {
      const a = estaiada.stations[i];
      if (Math.max(a.y, b.y) <= 0.3) return [];
      const points = [a, b].flatMap(p => [-1, 1].map(side => ({ x: p.x - p.tz * side * (ESTAIADA_DECK.half + 0.3), z: p.z + p.tx * side * (ESTAIADA_DECK.half + 0.3) })));
      return [{ x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)), z0: Math.min(...points.map(p => p.z)), z1: Math.max(...points.map(p => p.z)) }];
    });
    details.updateMatrixWorld(true);
    const landmarkRects = [];
    const landmarkAccessRects = [];
    const addDetailBounds = (object) => {
      const box = new THREE.Box3().setFromObject(object), w = box.max.x - box.min.x, d = box.max.z - box.min.z;
      if (![box.min.x, box.max.x, box.min.z, box.max.z].every(Number.isFinite)) return;
      if (w > 180 || d > 180) { object.children.forEach(addDetailBounds); return; }
      if (w > 0 && d > 0) landmarkRects.push({ x0: box.min.x - 5, x1: box.max.x + 5, z0: box.min.z - 5, z1: box.max.z + 5 });
    };
    const addAccessDetailBounds = (object) => {
      const box = new THREE.Box3().setFromObject(object), w = box.max.x - box.min.x, d = box.max.z - box.min.z;
      if (![box.min.x, box.max.x, box.min.z, box.max.z].every(Number.isFinite)) return;
      if (w > 180 || d > 180) { object.children.forEach(addAccessDetailBounds); return; }
      if (w > 0 && d > 0) landmarkAccessRects.push({ x0: box.min.x - 0.15, x1: box.max.x + 0.15, z0: box.min.z - 0.15, z1: box.max.z + 0.15 });
    };
    const hasEstaiadaDeck = child => child.name.toLowerCase().includes('estaiada') || !!child.getObjectByName('estaiada-deck');
    details.children.filter(child => !['hero-background', 'paulista-architecture'].includes(child.name) && !hasEstaiadaDeck(child)).forEach(addDetailBounds);
    details.children.filter(child => !['hero-background', 'paulista-architecture'].includes(child.name) && !hasEstaiadaDeck(child)).forEach(addAccessDetailBounds);
    const underpassTerminalAnchors = [];
    const underpassRects = underpassFrames(curve, stops).flatMap(u => {
      const along = UNDERPASS.base + 2, across = UNDERPASS.end + 3;
      const rx = Math.abs(u.tx) * along + Math.abs(u.tz) * across, rz = Math.abs(u.tz) * along + Math.abs(u.tx) * across;
      const outer = { x0: u.x - rx, x1: u.x + rx, z0: u.z - rz, z1: u.z + rz }, c = curve.getPointAt(u.tc), t = curve.getTangentAt(u.tc);
      const onRiver = c.x > riverStart(stops, pts) && c.x < riverEnd(stops, pts);
      const bankAz = onRiver ? Math.abs(RIVER_Z + Math.sign(c.z - RIVER_Z) * RIVER_WIDTH / 2 - c.z) * Math.abs(t.x) : 0;
      const sigma = onRiver ? Math.sign(RIVER_Z - c.z) * Math.sign(t.x) : 1, river = onRiver ? { bankAz, sigma } : null, ports = [];
      for (const side of [-1, 1]) {
        if (Math.abs(deckHeight(side * UNDERPASS_END, river)) > 0.02 || Math.abs(deckHeight(side * (UNDERPASS_END - 1.5), river)) > 0.12) continue;
        const localZ = side * (UNDERPASS_END - 1.5), x = c.x - t.z * localZ, z = c.z + t.x * localZ;
        const width = inscribedAnchorWidth(Math.min(2 * ROAD_HW, 3), t.x, t.z), portWidth = inscribedAnchorWidth(ROAD_HW * 1.5, t.x, t.z);
        underpassTerminalAnchors.push({ x, z, width, portWidth, deckY: deckHeight(localZ, river), tangentX: t.x, tangentZ: t.z });
        for (let distance = localZ; Math.sign(distance) === side && Math.abs(distance) <= UNDERPASS_END + 9; distance += side * portWidth / 2) {
          const px = c.x - t.z * distance, pz = c.z + t.x * distance;
          ports.push({ x0: px - portWidth / 2, x1: px + portWidth / 2, z0: pz - portWidth / 2, z1: pz + portWidth / 2 });
        }
      }
      return ports.reduce((rects, port) => rects.flatMap(r => subtractRect(r, port)), [outer]);
    });
    const moveRect = r => { const d = east((r.x0 + r.x1) / 2) - (r.x0 + r.x1) / 2; return { x0: r.x0 + d, x1: r.x1 + d, z0: r.z0, z1: r.z1 }; };
    const parkRects = PARKS.map(moveRect), squareRects = SQUARES.map(moveRect);
    const plazaNames = new Set(PLAZAS.map(p => p.name));
    const plazaRects = walkPaths(stops, pts).filter(p => p.type === 'loop' && plazaNames.has(p.name)).map(p => p.rect);
    const protectedRects = [...publicRealmZones.map(({ x0, x1, z0, z1 }) => ({ x0, x1, z0, z1 })), ...parkRects, ...squareRects, ...plazaRects, ...landmarkRects, ...estaiadaDeckRects,
      { x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z0: RIVER_Z - 16, z1: RIVER_Z + 16 }, ...underpassRects];
    const accessProtectedRects = [...publicRealmZones.map(({ x0, x1, z0, z1 }) => ({ x0, x1, z0, z1 })), ...landmarkAccessRects, ...estaiadaDeckRects,
      { x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z0: RIVER_Z - RIVER_WIDTH / 2 - 0.3, z1: RIVER_Z + RIVER_WIDTH / 2 + 0.3 }, ...underpassRects];
    const regions = [
      { name: 'sao-paulo', x0: minX - 5, x1: -80 },
      { name: 'london', x0: -80, x1: 300 },
      { name: 'glasgow', x0: 300, x1: 570 },
      { name: 'return', x0: 570, x1: maxX + 5 },
    ];
    const existingAsphaltRects = list.filter(b => b.color === P.road && b.x + b.w / 2 >= minX - 30 && b.x - b.w / 2 <= maxX + 30).map(toRect);
    const anchors = [...sampleRoadAnchors(list), ...underpassTerminalAnchors];
    const addStreetAnchors = (segments, offsetX = 0, offsetZ = 0) => {
      for (const controls of segments) {
        const points = controls.map(([x, a, b]) => new THREE.Vector3(x + offsetX, b === undefined ? 0 : a, (b === undefined ? a : b) + offsetZ));
        const path = points.length === 4 ? new THREE.CubicBezierCurve3(...points) : new THREE.LineCurve3(...points);
        const length = path.getLength();
        if (length < 1e-4) continue;
        for (let s = 0; s <= length; s += 5) {
          const p = path.getPointAt(s / length);
          if (Number.isFinite(p.x) && Number.isFinite(p.z) && p.y < 0.3 && !protectedRects.some(r => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1)) {
            const tangent = path.getTangentAt(s / length);
            anchors.push({ x: p.x, z: p.z, width: inscribedAnchorWidth(5.6, tangent.x, tangent.z) });
          }
        }
      }
    };
    for (const [i, u] of underpassFrames(curve, stops).entries()) {
      const c = curve.getPointAt(u.tc), t = curve.getTangentAt(u.tc), onRiver = c.x > riverStart(stops, pts) && c.x < riverEnd(stops, pts);
      if (!onRiver) continue;
      const bankAz = Math.abs(RIVER_Z + Math.sign(c.z - RIVER_Z) * RIVER_WIDTH / 2 - c.z) * Math.abs(t.x), sigma = Math.sign(RIVER_Z - c.z) * Math.sign(t.x);
      addStreetAnchors(bridgeStreetRoute({ x: c.x, z: c.z, tx: t.x, tz: t.z }, { sigma, inAz: bankAz + RIVER_RUN + 2 }, i));
    }
    const estaiadaSegments = estaiada.street.curve.curves.flatMap(part => {
      const samples = Math.max(2, Math.ceil(part.getLength() / 5));
      const points = Array.from({ length: samples + 1 }, (_, i) => { const p = part.getPointAt(i / samples); return [p.x, p.y, p.z]; });
      return points.slice(1).map((point, i) => [points[i], point]);
    });
    addStreetAnchors(estaiadaSegments, estaiadaX, RIVER_Z);
    if (roadQuery === 'pilot') regions.splice(1);
    const planStarted = performance.now();
    const plan = planUrbanRoads({ plots, trees: treePlacements, obstacles, protectedRects, accessProtectedRects, anchors, existingAsphaltRects, regions, seed: 2026 });
    const plannerGenerationMs = performance.now() - planStarted;
    urbanRoadRects = plan.rects;
    const meshStarted = performance.now();
    urbanRoads = createUrbanRoadMeshes(urbanRoadRects);
    const meshGenerationMs = performance.now() - meshStarted;
    scene.add(urbanRoads);
    urbanRoadInputs = { plots, treePlacements, backgroundPlots, lampClearance, kioskClearance, furnitureClearance, obstacles, protectedRects, accessProtectedRects, anchors, existingAsphaltRects, regions, underpassTerminalAnchors };
    if (qa) {
      globalThis.__qaUrbanRoads = { ...plan, levels: URBAN_ROAD_LEVELS, meshCount: urbanRoads.children.length, generationMs: { planner: plannerGenerationMs, mesh: meshGenerationMs } };
      globalThis.__qaUrbanRoadInputs = urbanRoadInputs;
    }
  }
  const arc = parkingBays(curve, pts, stops, pilotCrossings); // shared by the street props and the road marks
  const roadBoxes = urbanRoads ? roadCoverageBoxes(urbanRoadRects) : [];
  const streetProps = placeStreetProps({ stops, pts, curve, arc, pilotCrossings, boxes: [...list, ...roadBoxes], trees: treePlacements, lamps: lampClearance, kiosks: kioskClearance, plots: [...architecturePlots, ...buildingPlots], exclude: publicRealmZones });
  const [forest, ...streetAssembly] = await Promise.allSettled([
    createTrees(treePlacements, treeRegion(stops, pts)), buildPhoneBoxes(), buildLampPosts(), buildStreetProps(streetProps),
  ]);
  let trees;
  if (forest.status === 'fulfilled') { trees = forest.value; scene.add(trees); }
  else treePlacements.forEach(({ x, z, ...shape }) => tree(cornerAdd, x, z, shape)); // retain trees if the texture cannot load
  // Tree shadow proxies exist only for the shadow pass: three checks the main camera's layers there, so visibility is switched around it.
  const shadowRender = renderer.shadowMap.render.bind(renderer.shadowMap); // render reads this.type
  renderer.shadowMap.render = (...args) => { trees?.userData.setShadowProxies?.(true); shadowRender(...args); trees?.userData.setShadowProxies?.(false); }; // the procedural fallback has no proxies
  const [phones, lampPosts, propsGroup] = streetAssembly.map(result => {
    if (result.status === 'rejected') throw result.reason;
    if (result.value) scene.add(result.value); // preserve source order, before createSky collects the Belisha globes
    return result.value;
  });
  const architecture = await realCity;scene.add(architecture);
  const mini = buildVehicle('mini', { hero: true }), londonBus = buildVehicle('london', { hero: true }), glasgowBus = buildVehicle('glasgow', { hero: true });
  const candidates = [mini, londonBus, glasgowBus], heroVehicles = { mini, london: londonBus, glasgow: glasgowBus };
  const bus = createHeroGroup(candidates), swap = swapAt(stops), swapFrame = swapTunnelFrame(curve, stops);
  candidates.forEach((v) => { v.visible = false; });
  // Glasgow livery between the two railway underpasses (each within 7 m of its scotRange boundary); the visible swap happens inside the tunnel (see frame())
  const closeUp = qa && new URLSearchParams(location.search).get('closeup') ? (() => { const v = new URLSearchParams(location.search).get('closeup').split(',').map(Number); return v.length === 7 && v.every(Number.isFinite) ? { p: v.slice(0, 3), t: v.slice(3, 6), fov: v[6] } : null; })() : null; // QA probe: fixed close-up camera
  const underpass = createUnderpass(curve, stops, qa && new URLSearchParams(location.search).has('noriver') ? null : { x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z: RIVER_Z, width: 22 }), [ARCH_IN, ARCH_OUT] = underpass.passes.map((a) => a.t);
  if (qa) globalThis.__qaUnderpass = underpass.passes; // QA probe: pass centres and frames for the river survey (no visual effect)
  scene.add(underpass.group);
  let shown = null, frameNo = 0, swapFade = null; const archPrev = [], SWAP_OUT = 0.3, SWAP_IN = 0.35; // Hero changes scale down then up; never both visible outside this fade.
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere(), ray = new THREE.Raycaster();
  for (const v of candidates) addBeams(v, v.userData.front, v.userData.beamY);
  const WIN_L = '#2b2621', RG = '#27394b', RB = '#c9ccd1'; // Glasgow Uni windows, Riverside glass + band
  const world = buildMeshes(list, { glow: [P.lit, '#ffd86b', '#fff7c2', P.arch, WIN_L, RG, RB], glowK: { [P.arch]: 1.1, [WIN_L]: 1.0, [RG]: 0.55, [RB]: 0.2 }, grass: { trees: treePlacements, plots: [...architecturePlots, ...roadGrassPlots(urbanRoadRects)], lamps: lampClearance, kiosks: kioskClearance } });
  world.traverse((o) => { const h = o.material?.color?.getHexString(); if (o.material?.userData.glow) { if (h === WIN_L.slice(1)) o.material.userData.glowColor = new THREE.Color('#ffb04a'); if (h === RG.slice(1)) o.material.userData.glowColor = new THREE.Color('#d8e86a'); if (h === RB.slice(1)) o.material.userData.glowColor = new THREE.Color('#bcd4ff'); } });
  const landmarkEnv = createLandmarkEnv(renderer);
  // City-wide environment: the same prefiltered day/night maps at low strength, for standard materials that carry no envMap of their own (registered landmark materials keep theirs).
  // ponytail: a single intensity knob (CITY_ENV); the rest of the scene's look is the thing to A/B against.
  const CITY_ENV = 0.2;
  scene.environment = landmarkEnv.day; scene.environmentIntensity = CITY_ENV; // set before compileAsync so the program change is compiled at startup, not mid-flight
  // Reuse the existing prefiltered sky for ordinary PBR: no new environment capture/target.
  for (const material of [townhouseMaterials().architecture, townhouseMaterials().glass, roomGlassMaterial(), officeFacadeMaterials().glass]) landmarkEnv.register(material, { k: material.name==='slice-architecture'?.28:.40 });
  if (lampField) for (const material of [townhouseMaterials().architecture, townhouseMaterials().glass, roomGlassMaterial(), officeFacadeMaterials().glass]) applyLampField(material, lampField.uniforms);
  landmarkEnv.register(towerGlass, { k: 0.22 }); // tower facades: low-weight environment reflection, same map as the glass above
  if (lampField) for (const material of towerFacades) applyLampField(material, lampField.uniforms); // after the landmark hook above, so the chain keeps it
  polishLandmarkMaterials(world,stops,pts,landmarkEnv);
  const motion = buildMotion(); scene.add(motion.group);
  const roadMarks = createRoadMarks(curve, stops, { ...arc, pilotCrossings });
  scene.add(world, eye, details, plane, shadow, bus, roadMarks);
  for (const root of [backdrop, skyline, trees, phones, lampPosts, propsGroup, architecture, world, roadMarks]) freezeStatic(root);
  const routeTunnel = createRouteTunnel(curve); scene.add(routeTunnel.group); routeTunnel.cut(scene); // after the world/road meshes: cuts the paving over the ramp
  const swapTunnel = SWAP_GAP ? createSwapTunnel(curve, stops) : null; // SP -> London: the hero turns Mini <-> bus inside it (needs SWAP_GAP of road; off while 0)
  if (swapTunnel) { scene.add(swapTunnel.group); swapTunnel.cut(scene); }
  bus.rotation.order = 'YZX'; // yaw, then the dip's pitch
  const pedestrianSurfaces = new Set([P.pave, P.paverWarm, P.stone, P.gravel, P.concrete, P.road]);
  const pavement = list.filter(box => pedestrianSurfaces.has(box.color));
  if (urbanRoads) for (const rect of urbanRoadRects) {
    pavement.push({ ...rect, y: 0, h: URBAN_ROAD_LEVELS[rect.kind] });
  }
  const pedestrianCorridors = walkPaths(stops, pts).filter(p=>p.rect).map(({rect:r})=>({x0:r.x0-.55,x1:r.x1+.55,z0:r.z0-.55,z1:r.z1+.55}));
  // Authored sidewalk corridors also cover paving supplied by landmark meshes rather than low boxes.
  for (let d=0; d<=arc.L; d+=2) {
    const {p,t}=arc.sample(d);
    for (const side of [-1,1]) { const x=p.x-t.z*side*((ROAD.padIn+ROAD.padOut)/2),z=p.z+t.x*side*((ROAD.padIn+ROAD.padOut)/2); pedestrianCorridors.push({x0:x-1.6,x1:x+1.6,z0:z-1.6,z1:z+1.6}); }
  }
  const pedestrianSpaceInputs = {
    boxes: list.filter(b => b.y < 2.1 && (b.plant || b.y + b.h > .25)),
    circles: [...treePlacements.map(({x,z}) => ({x,z,r:.25})), ...streetProps,
      ...lampClearance.map(([x,z]) => ({x,z,r:.35})), ...kioskClearance.map(([x,z]) => ({x,z,r:.85})),
      ...furnitureClearance.map(({xz:[x,z]}) => ({x,z,r:.6}))],
    solids: (heroRealm?.userData.obstacles ?? []).map(({rect:r}) => ({x0:r.x0+heroRealm.position.x,x1:r.x1+heroRealm.position.x,z0:r.z0,z1:r.z1})),
    walkable: [...pavement, ...(heroRealm ? [{x:heroRealm.position.x,z:0,y:0,h:.1,w:20,d:48}] : [])],
    fallback: pedestrianCorridors,
    lawns: list.filter(b => [P.grass,P.patch,P.hill,P.dirt].includes(b.color)),
  };
  const pedestrianSpace = createPedestrianSpace(pedestrianSpaceInputs);
  const people = createPeople({ curve, pts, stops, obstacles: kioskClearance, space: pedestrianSpace, reducedMotion });
  if (qa) globalThis.__qaPedestrians = { people, space: pedestrianSpace, inputs: pedestrianSpaceInputs };
  const pavementHeight = createPavementHeight(pavement);
  const units = [await createNpc3d(scene, { people, pts, stops, pavementHeight, lookTargets: details.children.filter(o=>o.name.endsWith('-geometry')) })]; // finish startup NPCs before the bulk fleet can occupy the download queue
  let disposed = false, raf = 0, landmarksReady = false, startupLandmarksCancelled = false;
  const wetReflectionHidden = [];
  initVehicleEnv(renderer);
  setVehicleSkyEnv(landmarkEnv.day, landmarkEnv.night); // same sky maps as the city environment
  upgradeMini(mini, { isDisposed: () => disposed }).then(() => {
    refitBeams(mini);
    // Brake discs share this chrome mesh and reflect as bright circles under the car.
    const chrome = mini.getObjectByName('Body_CarChrome');
    if (chrome) wetReflectionHidden.push(chrome);
  });
  upgradeBus(londonBus, 'london', { isDisposed: () => disposed }).then(() => refitBeams(londonBus)); upgradeBus(glasgowBus, 'glasgow', { isDisposed: () => disposed }).then(() => refitBeams(glasgowBus)); // authored shared London/Glasgow bus GLB
  loadVehicleAsset('a330').then((glb) => { if (glb && !disposed) adoptVisual(plane, glb, ['nav', 'strobe']); }); // authored A330 (tools/vehicles/a330); procedural stays on failure
  const wake = () => { if (landmarksReady && !disposed && !raf && !document.hidden) raf = requestAnimationFrame(frame); };
  const stopLoadWake = onLoadChange(wake);
  const startupLandmarks = [];
  const authoredLods = [];
  let bigBenLod = null; // authored Big Ben LOD0/LOD1 (tools/landmarks/bigben); the procedural group stays hidden underneath as fallback
  const bigben = details.getObjectByName('bigben-geometry');
  if (bigben && !bigBenForced()) upgradeBigBen(bigben, { isDisposed: () => disposed, track: (m) => sky.track(m), env: landmarkEnv }).then((l) => { bigBenLod = l; wake(); });
  let seLod = null; // authored Catedral da Se (tools/landmarks/se), same fallback rule
  const se = details.getObjectByName('se-geometry');
  if (se && !seForced()) startupLandmarks.push(upgradeSe(se, { isDisposed: () => disposed || startupLandmarksCancelled, track: (m) => sky.track(m), env: landmarkEnv }).then((l) => { seLod = l; wake(); }));
  let towerBridgeLod = null; // authored Tower Bridge LOD0/LOD1 (tools/landmarks/towerbridge); procedural group stays hidden underneath as fallback
  const towerbridge = details.getObjectByName('towerbridge-geometry');
  if (towerbridge && !towerBridgeForced()) upgradeTowerBridge(towerbridge, { isDisposed: () => disposed, track: (m) => sky.track(m), env: landmarkEnv }).then((l) => { towerBridgeLod = l; if (l) water.setPiers(towerPierBounds(towerbridge.position.x, RIVER_Z, true)); wake(); });
  let maspLod = null; // authored MASP LOD0 (tools/landmarks/masp); procedural group stays hidden underneath as fallback
  const masp = details.getObjectByName('masp-geometry');
  if (masp && !maspForced()) startupLandmarks.push(upgradeMasp(masp, { isDisposed: () => disposed || startupLandmarksCancelled, track: (m) => sky.track(m), env: landmarkEnv }).then((l) => { maspLod = l; wake(); }));
  if (!authoredLandmarksForced()) {
    const options = { isDisposed: () => disposed || startupLandmarksCancelled, track: (m) => sky.track(m), env: landmarkEnv };
    for (const name of ['copan', 'riverside', 'university', 'wembley']) {
      const group = details.getObjectByName(name + '-geometry');
      if (group) startupLandmarks.push(upgradeAuthoredLandmark(group, name, options).then((lod) => { if (lod) authoredLods.push(lod); wake(); }));
    }
    const eyeFrame = details.getObjectByName('eyeframe-geometry');
    if (eyeFrame) startupLandmarks.push(upgradeLondonEye(eye, eyeFrame, options).then((lod) => { if (lod) authoredLods.push(lod); wake(); }));
  }
  if (new URLSearchParams(location.search).has('qa')) globalThis.__qaLandmarks = { se, masp, startupLandmarks };
  const wellington = details.getObjectByName('wellington-geometry');
  if (wellington) upgradeWellington(wellington, () => disposed).then(wake);
  // Request startup landmarks first; all ambient/parked models still load at full quality.
  const ambient = createAmbient(scene, { curve, pts, stops, reducedMotion, tunnel: routeTunnel, dip: swapTunnel });
  units.push(ambient, createParked(scene, { curve, pts, stops, pilotCrossings }));
  const bridgeCars = createUnderpassTraffic(underpass.passes, { reducedMotion }); scene.add(bridgeCars.group);
  const figure = buildFigure(wake, { reducedMotion });
  const end = curve.getPointAt(1), endTan = curve.getTangentAt(1), near = new THREE.Vector3(-endTan.z, 0, endTan.x).normalize();
  // ponytail: chosen at load; the phone's panel would cover the desktop corner, so it stays nearer the bus.
  const [spotT, spotN] = matchMedia('(max-width: 767px)').matches ? [7, 6] : [9.66, 4.24]; // desktop: the owner's plaza spot, 1.6 m inward so the closer closing shot keeps him off the frame edge
  figure.position.set(end.x + endTan.x * spotT + near.x * spotN, 0, end.z + endTan.z * spotT + near.z * spotN);
  const closingCam = shotFor('closing', end, { mobile: matchMedia('(max-width: 767px)').matches }).position;
  figure.userData.facing = Math.atan2(closingCam[0] - figure.position.x, closingCam[2] - figure.position.z) + BODY_TURN;
  scene.add(figure);
  const frontages = shopFrontages(architecturePlots);
  const pools = createLampPools(scene, [...lamps, ...(heroRealm?.userData.lampPools ?? [])], 10, frontages);
  const shopSpill = createShopSpill(scene, frontages, list);
  const footprints = [...architecturePlots, ...buildingPlots].map(p => ({ x: p.x, z: p.z, hx: p.width / 2, hz: p.depth / 2, height: p.height }));
  footprints.push(...underpass.passes.map(p => ({ x: p.x, z: p.z, hx: UNDERPASS_HALF, hz: UNDERPASS_WIDTH, height: UNDERPASS_HEIGHT, tx: p.tx, tz: p.tz })));
  footprints.push({ x: towerX(stops, pts), z: RIVER_Z, hx: 4, hz: 42, height: 5.2 }); // existing Tower Bridge carriageway, including its open river span
  if (masp) {
    const b = new THREE.Box3().setFromObject(masp);
    footprints.push({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, height: b.max.y });
  }
  const weatherCover = createWeatherCover(footprints);
  if (qa) globalThis.__qaWeatherCover = weatherCover;
  const sky = createSky(scene, { hemi, sun, reducedMotion }), moodAt = createMood(stops, { reducedMotion }), rain = createRain(scene, { reducedMotion, lamps, cover: weatherCover });
  const kerbs = [], roadSamples = Math.ceil(curve.getLength() / 20);
  for (let i = 0; i < roadSamples; i++) {
    const a = curve.getPointAt(i / roadSamples), b = curve.getPointAt((i + 1) / roadSamples);
    const ta = curve.getTangentAt(i / roadSamples), tb = curve.getTangentAt((i + 1) / roadSamples);
    for (const side of [-1, 1]) kerbs.push([a.x - ta.z * ROAD.half * side, a.z + ta.x * ROAD.half * side, b.x - tb.z * ROAD.half * side, b.z + tb.x * ROAD.half * side]);
  }
  const wetSurfaces = createWetSurfaces(scene, { lamps, reducedMotion, cover: weatherCover, kerbs }), vehicleFx = createVehicleFx(scene, { reducedMotion });
  wetReflectionHidden.push(...sky.objects);
  if (vehicleFx.points) wetReflectionHidden.push(vehicleFx.points);
  // Foam rings Tower Bridge's piers and moored boats. The river reflects landmarks and bank-side lots.
  const piers = towerPierBounds(towerX(stops, pts), RIVER_Z), boatBox = new THREE.Box3(), reflectRoots = [eye];
  const boatBounds = () => {
    const bounds = [];
    scene.traverse((o) => {
      if (!o.name.startsWith('thames-boat')) return;
      boatBox.setFromObject(o);
      bounds.push({ x: (boatBox.min.x + boatBox.max.x) / 2, z: (boatBox.min.z + boatBox.max.z) / 2, hx: (boatBox.max.x - boatBox.min.x) / 2, hz: Math.min((boatBox.max.z - boatBox.min.z) / 2, o.userData.boatHalfWidth ?? 1.08 * Math.abs(o.scale.z)) });
    });
    return bounds;
  };
  const boats = boatBounds();
  scene.traverse((o) => { if (o.name.startsWith('thames-boat')) reflectRoots.push(o); });
  for (const name of ['bigben', 'towerbridge', 'eyeframe', 'estaiada', 'masp', 'se', 'copan', 'riverside', 'university', 'chambers', 'wembley']) reflectRoots.push(details.getObjectByName(name + '-geometry'));
  reflectRoots.push(details.getObjectByName('estaiada-deck')?.parent, details.getObjectByName('bigben-four-clock-faces'));
  if (qa) globalThis.__qaRiver = { x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z: RIVER_Z, width: 22 }; // QA probe: river extent for the underpass survey
  const water = createWater({
    x0: riverStart(stops, pts), x1: riverEnd(stops, pts), z: RIVER_Z, width: 22,
    reducedMotion, piers, boats, reflectRoots, bankPlots: architecturePlots, cover: weatherCover,
  });
  scene.add(water.mesh);
  if (water.bankReflection) scene.add(water.bankReflection);
  ambient.boatsReady.then(() => {
    if (disposed) return;
    water.setBoats(boatBounds());
    const materials = new Set();
    for (const root of reflectRoots) if (root?.name.startsWith('thames-boat')) root.traverse((o) => {
      if (!o.isMesh) return;
      o.layers.enable(5); // Same reflection layer as the river's existing landmark pass.
      for (const m of [].concat(o.material)) materials.add(m);
    });
    for (const m of materials) if (m.isMeshStandardMaterial) landmarkEnv.register(m, { k: 0.7 });
    wake();
  });
  if (qa) globalThis.__qaWater = water;
  let wet = 0;
  const post = createPost(renderer, scene, camera, { sun, tier: matchMedia('(max-width: 767px)').matches ? 'medium' : 'high' }); // owner rule: quality never drops at runtime (no FPS downgrade); reduced motion stops animation, not AO
  if (qa) globalThis.__qaPost = post;
  if (qa) globalThis.__qaFigure = { figure, camera, end, endTan, near };
  const stopPicker = createLandmarkPicker({ canvas, camera, details, bus, onPick, scene, water });
  const landmarkLight = createLandmarkLight(details); // panel focus lights its stop's landmark
  if (qa) globalThis.__qaLandmarkLight = landmarkLight; // QA probe: twin materials per stop
  let night = 0, nightTarget = 0, mobile = false, themeApplied = false;
  const bar = document.querySelector('.bar'), panel = document.querySelector('#panel');
  let fitKey = '', fitHidden = false;
  // panel size changes per section: ease the view offset to its new value instead of snapping the camera
  const vo = {}, applyView = () => camera.setViewOffset(innerWidth, innerHeight, vo.x, vo.y, innerWidth, innerHeight);
  const fit = () => {
    const width = innerWidth, height = innerHeight, headerBottom = bar?.getBoundingClientRect().bottom ?? 0, panelBox = panel?.getBoundingClientRect();
    const hidden = !mobile && document.body.classList.contains('ui-hidden'); // hidden panel and bar leave the city whole, so the bus goes back to the centre
    const key = JSON.stringify([width, height, mobile, headerBottom, panelBox, hidden]);
    if (key === fitKey) return false;
    fitKey = key;
    sky.setViewport(width, height, headerBottom);
    vo.tx = mobile || hidden ? 0 : panel ? -panelBox.right / 2 : 0;
    vo.ty = mobile ? height / 2 - (headerBottom + (panelBox?.top ?? height)) / 2 : hidden ? 0 : panel ? -headerBottom / 2 : 0;
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
  if (qa) globalThis.__qaBus = busPos; // QA probe: projects the bus onto screen for framing checks (no visual effect)
  let heroSpeed = 0, steer = 0, rest = 0, cine = 0; // rest: 0..1, how long the bus has stood still at a journey stop (camera breathing)
  // Flyover at the first UK stop: the path, the pull-in that keeps it clear of the buildings and the timing live in plane-path.js.
  // Atmospheric perspective instead of transparency: the plane stays opaque and solid, and is tinted toward the horizon colour with distance
  // (diffuse darkened, emissive raised to the haze), then dwindles to a speck at the very end. Originals are kept so the tint can be undone.
  const hazeOf = new WeakMap();
  let hazed = false, baseScale = null;
  const hazePlane = (t) => {
    if (t <= 0 && !hazed) return;
    const hor = sky.colors.hor;
    plane.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) {
      let base = hazeOf.get(m);
      if (!base) { base = { c: m.color?.clone(), e: m.emissive?.clone(), i: m.emissiveIntensity }; hazeOf.set(m, base); }
      if (m.emissive) { m.color.copy(base.c).multiplyScalar(1 - t); m.emissive.copy(base.e).lerp(hor, t); m.emissiveIntensity = base.i + (1 - base.i) * t; }
      else if (m.color) m.color.copy(base.c).lerp(hor, t);
    } });
    hazed = t > 0;
  };
  const updatePlane = (p) => {
    const d = (p - planeAt) * (n - 1);
    let present = 0, k = 1;
    if (planeAt >= 0 && d > PLANE_IN && d < PLANE_OUT) {
      present = 1 - smooth(TURN_AT + 1.6, PLANE_OUT, d);
      const pose = planePose(d, busPos, camera.position);
      k = pose.scale;
      plane.position.set(pose.x, pose.y, pose.z);
      plane.rotation.set(pose.bank, pose.heading, pose.pitch);
      baseScale ??= plane.scale.x;
      plane.scale.setScalar(baseScale * k);
      hazePlane(smooth(HAZE[0], HAZE[1], pose.dist)); // distance haze only: the plane arrives fully solid
    }
    plane.visible = present > 0.01;
    shadow.visible = plane.visible && night < 0.9;
    nav.visible = plane.visible && night > 0.35; strobe.visible = nav.visible && clock % 1.3 < 0.12; // red left / green right steady, white strobe blinks
    if (shadow.visible) { shadow.position.set(plane.position.x, 0.14, plane.position.z); shadow.scale.set(34, 1, 15); shadow.scale.multiplyScalar(k); shadow.material.opacity = 0.3 * (1 - night) * present * k * Math.max(0.15, 1 - (plane.position.y - 24) / 70); } // smaller and fainter as it recedes and climbs
  };
  let scroll = { value: 0, velocity: 0 }, target = 0, clock = 0, last = 0, raining = false, flash = 0, pendingSnapshot = null;
  const lateral = new THREE.Vector3();
  function frame(now) {
    raf = 0;
    if (document.hidden) { last = 0; return; }
    if (!innerWidth || !innerHeight) { last = 0; wake(); return; } // a 0x0 viewport has zero-size render targets: skip the frame instead of drawing into incomplete framebuffers
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    scroll = reducedMotion ? { value: marks[nearestStop(target, n, marks)], velocity: 0 } : spring(scroll, target, dt, SCROLL_SMOOTH);
    if (!reducedMotion) clock += dt;
    if (document.body.classList.contains('ui-hidden') !== fitHidden) { fitHidden = !fitHidden; fit(); } // the offset follows the panel: back to the centre while the interface is hidden
    const ox = reducedMotion || !dt ? vo.tx : approach(vo.x, vo.tx, dt, 300), oy = reducedMotion || !dt ? vo.ty : approach(vo.y, vo.ty, dt, 300);
    if (ox !== vo.x || oy !== vo.y) { vo.x = ox; vo.y = oy; applyView(); camera.updateProjectionMatrix(); }
    const p = scroll.value, t = routeT(p, n, knots); routeS = t * (n - 1);
    const bp = curve.getPointAt(t), tan = curve.getTangentAt(t);
    lateral.set(tan.z, 0, -tan.x).normalize().multiplyScalar(BUS_LANE * laneSide((t - swapFrame.t) * swapFrame.speed)); // right-hand lane in Sao Paulo, left-hand in the UK, crossing over under the tunnel cover
    applyHeroPose(bus, bp, lateral, Math.atan2(-tan.z, tan.x));
    bus.position.y += 0.07; bus.rotation.z = 0;
    swapTunnel?.place(bus, candidates.find((v) => v.visible) ?? mini); // down into the SP -> London tunnel and up again
    Object.assign(busPos, { x: bp.x + lateral.x, y: bp.y, z: bp.z + lateral.z });
    if (prevBus.x !== null) { // hero wheels roll with the distance travelled along the road (signed: scrolling back unrolls them)
      const ds = (busPos.x - prevBus.x) * tan.x + (busPos.z - prevBus.z) * tan.z;
      for (const m of candidates) if (m.visible) rollWheels(m.userData.wheels, ds);
      // Mini front wheels steer into curves: bicycle model on the heading change per metre, smoothed; still / jumps (respawn, reduced-motion stop hops) straighten
      // ponytail: hero Mini only; ambient Minis (axle-merged wheels) and buses do not steer
      const dh = Math.atan2(Math.sin(bus.rotation.y - prevBus.h), Math.cos(bus.rotation.y - prevBus.h)), still = reducedMotion || Math.abs(ds) < 1e-3 || Math.abs(ds) > 2;
      steer += ((still ? 0 : Math.max(-MAX_STEER, Math.min(MAX_STEER, Math.atan(MINI_WHEELBASE * dh / ds)))) - steer) * Math.min(1, dt * 10);
      heroSpeed = still || !dt ? 0 : Math.abs(ds) / dt;
      if (mini.visible) for (const w of mini.userData.wheels) if (w.name === 'FL' || w.name === 'FR') { w.rotation.order = 'YXZ'; w.rotation.y = steer; }
    }
    prevBus.x = busPos.x; prevBus.z = busPos.z; prevBus.h = bus.rotation.y;
    const s = t * (n - 1), i = Math.min(Math.floor(s), n - 2);
    const ka = SECTION_SHOT[stops[i].section], kb = SECTION_SHOT[stops[i + 1].section];
    const la = FRAME_LIFT[stops[i].id] ?? 0, lb = FRAME_LIFT[stops[i + 1].id] ?? 0;
    const lift = la + (lb - la) * (s - i);
    const shot = blendShots(shotFor(ka, busPos, { mobile, lift, stop: stops[i].id }), shotFor(kb, busPos, { mobile, lift, stop: stops[i + 1].id }), s - i, ka === kb ? 0 : ARC);
    // Rest breathing: after about 3 s standing still on a journey stop the camera eases 2% toward the bus; moving eases it back fast. Reduced motion never breathes.
    const journeyShot = ka === 'follow' && kb === 'follow';
    rest = reducedMotion || heroSpeed !== 0 || !journeyShot ? Math.max(0, rest - dt * 4) : Math.min(1, rest + dt / 3);
    if (rest > 0) { const k = 1 - 0.02 * rest * rest * (3 - 2 * rest), bp = [busPos.x, busPos.y, busPos.z]; shot.position = shot.position.map((v, j) => bp[j] + (v - bp[j]) * k); }
    const cineStop = CINE[stops[Math.round(s)].id], atStop = Math.abs(s - Math.round(s)) < 0.05;
    cine = reducedMotion || heroSpeed !== 0 || !cineStop || !atStop ? Math.max(0, cine - dt / 1.5) : Math.min(1, cine + dt / 5); // ~5 s push-in once stopped, ~1.5 s ease-back when the bus moves on
    if (cine > 0 && cineStop) shot.position = cinePose(shot.position, [busPos.x, busPos.y, busPos.z], cine, cineStop);
    camera.position.fromArray(shot.position);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    if (closeUp) { camera.position.set(...closeUp.p); camera.lookAt(...closeUp.t); camera.fov = closeUp.fov; camera.updateProjectionMatrix(); } // QA only: ?qa=1&closeup=px,py,pz,tx,ty,tz,fov
    // The primary Mini returns as a Mini; regional São Paulo buses belong to secondary traffic.
    const want = heroVehicleAt(t, swapTunnel?.t ?? swap, ARCH_IN, ARCH_OUT, heroVehicles); // Mini <-> bus inside the tunnel (its centre), else at the region border
    frameNo++;
    if (qa) globalThis.__qaSwap = { p, shown: candidates.indexOf(shown), want: candidates.indexOf(want), visible: candidates.map((v) => (v.visible ? 1 : 0)).join(''), k: swapFade ? swapFade.k : -1, y: bus.position.y, s: swapTunnel ? swapTunnel.offset(busPos.x, busPos.z) : null, h: swapTunnel?.half ?? null }; // QA probe: which hero candidate is shown per frame (no visual effect)
    // Bus centre crossing an arch centre since the last frame: fast scrolls skip the ±1.8 m 'fully under' window between frames
    const archCross = underpass.passes.map((a, i) => { const o = underpass.offset(a, busPos.x, busPos.z), c = archPrev[i] !== undefined && Math.sign(archPrev[i]) !== Math.sign(o); archPrev[i] = o; return c; }).some(Boolean);
    if (shown !== want) {
      const half = (v) => (v.userData.length ?? 4) / 2, under = shown && swapTunnel?.covered(busPos.x, busPos.z, Math.max(half(shown), half(want)));
      // Mini <-> bus: only once the whole of both is inside the tunnel (instant, unseen); a nav jump far from it still shrinks/grows
      let why = !shown ? 'immediate' : shown === mini || want === mini ? (!swapTunnel ? 'immediate' : under ? 'arch' : Math.abs(swapTunnel.offset(busPos.x, busPos.z)) > swapTunnel.half + 12 ? 'immediate' : '') : (archCross || underpass.passes.some((a) => Math.abs(underpass.offset(a, busPos.x, busPos.z)) <= a.half - 5.7)) ? 'arch' : Math.abs(s - Math.round(s)) < 0.12 ? 'stop' : ka !== kb && s - i > 0.15 && s - i < 0.85 ? 'blend' : '';
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
    const architecturePending = architecture.userData.update?.(camera);
    const paulistaPending = details.getObjectByName('paulista-architecture')?.userData.update(camera);
    eye.rotation.z = clock * 0.1; motion.uT.value = clock;
    updatePlane(t);
    const f = { camera, time: clock, dt, progress: p, t, active: nearestStop(p, n, marks), bus: busPos };
    people.update(dt, camera.position, { x: busPos.x, z: busPos.z, speed: heroSpeed });
    figure.userData.update(dt, camera, night);
    for (const u of units) u.update(f);
    streetEnvironment.time.value = clock;
    trees?.userData.update(camera, clock);
    night = reducedMotion || dt === 0 ? nightTarget : approach(night, nightTarget, dt, 1.4);
    const mood = moodAt(t, dt);
    if (qa) globalThis.__qaWeather = mood;
    raining = mood.rain > 0.05;
    post.setRain?.(mood.rain);
    onProgress(p);
    wet = lagWetness(wet, mood.wet, dt);
    flash = rain.update(clock, camera, mood, night, post.tier, busPos, bus.rotation.y);
    sky.update(night, dt, camera.position, camera, mood, flash);
    cloudShadows.update(clock, night, mood.cover, mood.wind);
    // Share the visible astro's azimuth with shadows and water, retaining positive elevation and texel snapping.
    LD.copy(sky.sunDir); SUN.copy(LD).multiplyScalar(95);
    LU.set(0, 1, 0).cross(LD).normalize(); LV.copy(LD).cross(LU);
    const a = Math.round(bp.dot(LU) / TEXEL_X) * TEXEL_X, b = Math.round(bp.dot(LV) / TEXEL_Y) * TEXEL_Y;
    sun.target.position.copy(LU).multiplyScalar(a).addScaledVector(LV, b).addScaledVector(LD, bp.dot(LD));
    sun.position.copy(sun.target.position).add(SUN); sun.shadow.camera.up.copy(LV);
    treeSun.value.set(LD.x, LD.y, LD.z, Math.min(1, sun.intensity / 2.4)); // T3: canopy backlight follows the sun
    skyline.userData.update(night, sky.uniforms);
    bigBenLod?.update(camera.position);
    seLod?.update(camera.position);
    towerBridgeLod?.update(camera.position);
    maspLod?.update(camera.position);
    authoredLods.forEach((lod) => lod.update(camera.position));
    const hl = (candidates.find((v) => v.visible) ?? mini).userData.length ?? 4;
    if (qa) globalThis.__qaHero = { speed: heroSpeed, rest, rain: mood.rain, len: hl }; // QA probe for the vehicle particles
    post.setFocus?.(camera.position.distanceTo(bus.position)); // depth of field focuses on the hero vehicle
    vehicleFx.update(dt, { p: busPos, h: bus.rotation.y, len: hl, halfW: hl > 6 ? 1.3 : 0.95, speed: heroSpeed, rain: mood.rain ?? 0, cold: Math.min(1, (1 - (mood.rs ?? 0)) * 0.3 + night * 0.4) /* exhaust steam: far less in the day, so it stops reading as stray dots (audit W-02) */, night, halfH: renderer.domElement.height / 2 });
    wetSurfaces.update(clock, wet, mood.rain, night, camera.position, sky.colors, bus.position, bus.rotation.y, post.tier, mood.wind);
    updateBeams(night); pools.update(night, wet); shopSpill.update(night, wet); lampPosts?.userData.setNight?.(night); if (lampField) lampField.uniforms.uLampNight.value = night; underpass.group.userData.setNight(night);
    swapTunnel?.group.userData.setNight?.(night);
    water.update(clock, night, mood, post.tier, sky.colors, sky.sunDir);
    world.userData.updateLandmarkNight?.(night);
    updateVehicleEnv(night); landmarkEnv.update(night);
    scene.environment = night > 0.5 ? landmarkEnv.night : landmarkEnv.day; scene.environmentIntensity = CITY_ENV * (1 - 0.7 * night); // swap the map, ramp the strength: no new PMREM per frame
    // One matrix pass per frame: both mirror renders and the main render reuse these world matrices (nothing moves between them).
    scene.updateMatrixWorld(); scene.matrixWorldAutoUpdate = false;
    water.reflect(renderer, scene, camera, post.tier, sky.objects);
    wetSurfaces.reflect(renderer, camera, post.tier, wetReflectionHidden);
    landmarkLight.apply(dt, reducedMotion);
    post.render(dt);
    landmarkLight.restore();
    scene.matrixWorldAutoUpdate = true;
    if (pendingSnapshot && !pendingSnapshot.started) {
      const capture = pendingSnapshot;
      capture.started = true;
      try {
        canvas.toBlob(blob => capture.finish(blob ? null : new Error('snapshot encoding failed'), blob), 'image/png');
      } catch (error) {
        capture.finish(error);
      }
    }
    if (qa) globalThis.__qaWorldFrames++;
    if (!reducedMotion || architecturePending || paulistaPending) wake();
  }
  const visibility = () => { last = 0; wake(); };
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  let startupTimeout;
  await Promise.race([
    Promise.allSettled(startupLandmarks),
    new Promise(resolve => { startupTimeout = setTimeout(() => { startupLandmarksCancelled = true; resolve(); }, LANDMARK_STARTUP_TIMEOUT); }),
  ]);
  clearTimeout(startupTimeout);
  const cloudShadows = createCloudShadows(scene);
  landmarksReady = true;
  resize();
  await renderer.compileAsync(scene, camera).catch(() => {}); // link the visible materials' programs before world-ready; ponytail: visible objects only, hidden LOD/kit materials still compile on first show
  return {
    get raining() { return raining; },
    get routeS() { return routeS; }, // where the bus is on the route, in stops, on the same fine knots as the picture: the sound driver times the plane from it
    get flash() { return flash; }, // lightning brightness this frame: the sound driver times thunder from it
    get samuelGreeting() { return figure.userData.greeting; },
    snapshot() {
      if (disposed) return Promise.reject(new Error('world disposed'));
      if (!pendingSnapshot) {
        const capture = { started: false };
        capture.promise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => capture.finish(new Error('snapshot timeout')), 3000);
          capture.finish = (error, blob) => {
            if (pendingSnapshot !== capture) return;
            pendingSnapshot = null;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(blob);
          };
        });
        pendingSnapshot = capture;
      }
      wake();
      return pendingSnapshot.promise;
    },
    setProgress(p) { target = p; wake(); },
    highlight(ids) { landmarkLight.set(ids); wake(); }, // panel focus or hover: the landmarks of these stops glow (empty clears them)
    jump(p) { target = p; scroll = { value: p, velocity: 0 }; wake(); },
    setTheme(name) {
      nightTarget = name === 'night' ? 1 : 0;
      if (!themeApplied) night = nightTarget; // the first call is the saved theme: start in it, no day-to-night fade on a night visitor's first frames
      themeApplied = true;
      wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pendingSnapshot?.finish(new Error('world disposed'));
      figure.userData.dispose();
      for (const u of units) u.dispose?.();
      cancelAnimationFrame(raf); raf = 0;
      removeEventListener('resize', resize);
      stopLoadWake();
      stopPicker();
      document.removeEventListener('visibilitychange', visibility);
      observer?.disconnect();
      architecture.userData.dispose?.();
      underpass.group.userData.dispose(); bridgeCars.dispose(); routeTunnel.dispose(); swapTunnel?.dispose();
      heroRealm?.userData.dispose();
      shopSpill.dispose();
      roadMarks.userData.dispose(); propsGroup?.userData.dispose();
      urbanRoads?.userData.dispose?.();
      eye.userData.dispose?.();
      rain.dispose?.();
      lampField?.texture.dispose(); // night light field: one R8 texture built at startup
      disposeNpcBodyAtlas(); // pedestrian diffuse and normal arrays
      scene.environment = null; // city sky map: owned by landmarkEnv, which is disposed below
      wetSurfaces.dispose(); vehicleFx.dispose(); water.dispose();
      cloudShadows.dispose();
      weatherCover.dispose();
      sky.dispose();
      trees?.userData.dispose?.();
      phones?.userData.dispose(); lampPosts?.userData.dispose();
      for (const name of ['wembley', 'bigben', 'masp', 'se', 'estaiada', 'towerbridge', 'eyeframe', 'copan', 'riverside', 'university', 'chambers', 'wellington']) details.getObjectByName(name + '-geometry')?.userData.dispose();
      details.getObjectByName('hero-background')?.userData.dispose();
      details.getObjectByName('paulista-architecture')?.userData.dispose();
      post.dispose(); landmarkEnv.dispose();
      renderer.dispose();
    },
  };
}
