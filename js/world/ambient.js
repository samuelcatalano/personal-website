import * as THREE from 'three';
import { createBoat, estaiadaRoute } from './landmark-geometry.js';
import { buildVehicle } from './vehicles.js';
import { upgradeBus, reskinBus, upgradeMini, upgradeCab, loadFleetCatalog, regionalFleetModel, upgradeFleet } from './vehicle-assets.js';
import { RIVER_Z, LANDMARKS, ukStart, stopIndex, swapAt, scotRange, riverEnd, riverStart } from './layout.js';
import { stopMarks, fineMarks, routeT } from '../scroll.js';
import { addBeams } from './beams.js';
import { fadeVehicle, disposeFade } from './fade.js';
const cab = () => buildVehicle('cab'); // London black cab (LEVC TX)
const car = (type, color) => buildVehicle(type, { color });
function boat(hull = '#6b4f3a', cabin = '#f4f4f4', sx = 1, style = 'cruiser') {
  const m = createBoat(hull, cabin, style);
  m.name = `thames-boat-${style}`;
  m.userData.boatStyle = style;
  m.scale.x = sx;
  return m;
}
// Traffic. `relative` vehicles keep a fixed offset from the player (same lane, glued to the scroll position); the rest drive the oncoming lane on their own:
// a base speed by type, eased down toward a zebra crossing (and back up) by integrating acceleration each frame, a minimum gap to the vehicle ahead, yaw eased toward the road tangent.
const FADE = 0.6; // s: a vehicle that must appear/vanish inside the camera frustum fades; outside it toggles instantly (and always under reduced motion)
const HIDE = 110; // m from the player beyond which an ambient vehicle may appear/vanish at a region border
const BRIDGE_FAR = 80; // m: Estaiada cars only appear/vanish beyond this from the player
const SPEED = { london: 10, glasgow: 10, cab: 13, mini: 13, car: 13.5 }; // m/s
const SP_RANGE = 0.062, MIN_SPAWN = 110; // Sao Paulo cars loop inside [route start, swap + SP_RANGE] (curve t) instead of the whole route: respawn at the east end only when >= MIN_SPAWN m from the player
const ACC = 3, DEC = 6, GAP = 3.5, ZEBRA_AT = 9, SLOW = 24; // m/s^2 up, m/s^2 down, bumper gap (m), zebra offset past a stop (roadmarks.js), slow-down radius (m)
const CARS = [['#e8c425', 'mini'], ['#2f6fcf', 'sedan'], ['#c8102e', 'suv'], ['#3f9d4a', 'mini'], ['#16181c', 'sedan'], ['#1f6b3a', 'van'], ['#f2b705', 'sedan'], ['#b3161f', 'hatch'], ['#2e7d32', 'suv'], ['#e8c425', 'sedan'], ['#e07a1f', 'hatch'], ['#0e8a8a', 'suv'], ['#8a1c4a', 'sedan'], ['#2a4fa8', 'hatch'], ['#d94f2b', 'suv'], ['#6d8f1f', 'sedan']]; // saturated paints only: no white/grey
export function createAmbient(scene, { curve, pts, stops, reducedMotion = false }) {
  const knots = fineMarks(stopMarks(pts), curve), len = curve.getLength();
  let disposed = false, miniIndex = 0;
  const MINI_PAINT = [{ body: '#285b8f', roof: '#f4f1ea' }, { body: '#1f4a35', roof: '#f4f1ea' }, { body: '#b3161f', roof: '#f4f1ea' }];
  const D = (type, offset, extra = {}) => {
    const palette = type === 'mini' ? MINI_PAINT[miniIndex++ % MINI_PAINT.length] : undefined;
    return { mesh: buildVehicle(type, { color: palette?.body }), palette, type, offset, uk: true, scot: false, ...extra };
  };
  const G = (i, offset, extra) => ({ mesh: car(CARS[i][1], CARS[i][0]), body: CARS[i][0], type: 'car', offset, ...extra });
  const traffic = [
    // London: 2 buses, 4 cabs, 3 Minis, 3 generic cars
    D('london', -0.16, { lane: 1.75, relative: true }), D('london', 0.35),
    D('cab', 0.22, { lane: 1.75, relative: true }), D('cab', 0.25), D('cab', 0.55), D('cab', 0.75),
    D('mini', 0.08), D('mini', 0.42), D('mini', 0.64),
    G(4, 0.5, { uk: true, scot: false }), G(8, 0.83, { uk: true, scot: false }), G(6, 0.95, { uk: true, scot: false }),
    // Glasgow (only inside the Scotland range): 2 buses, 2 generic cars
    D('glasgow', -0.12, { lane: 1.75, relative: true, scot: true }), D('glasgow', 0.4, { scot: true }),
    G(1, 0.3, { uk: true, scot: true }), G(7, 0.6, { uk: true, scot: true }),
    // Sao Paulo: generic cars only (the player there is the Mini)
    G(1, 0.17, { uk: false }), G(2, 0.33, { uk: false }), G(5, 0.06, { uk: false }), G(9, 0.27, { uk: false }),
    // Extra density (appended: the first 20 keep their slots). Sao Paulo: ten more cars on the same short loop
    ...[[10, 0.01], [11, 0.09], [12, 0.115], [13, 0.14], [14, 0.21], [15, 0.24], [0, 0.3], [3, 0.36], [6, 0.39], [4, 0.41]].map(([c, o]) => G(c, o, { uk: false })),
    // London: 1 bus, 3 cabs, 2 Minis, 3 generic cars
    D('london', 0.71), D('cab', 0.47), D('cab', 0.88), D('cab', 0.12), D('mini', 0.6), D('mini', 0.79),
    G(11, 0.385, { uk: true, scot: false }), G(13, 0.675, { uk: true, scot: false }), G(15, 0.99, { uk: true, scot: false }),
  ].map((v, i) => ({ lane: -1.75, livery: v.type === 'london' || v.type === 'glasgow' ? v.type : null, ...v, base: SPEED[v.type] * (v.type === 'car' ? 0.9 + 0.2 * ((i * 7) % 5) / 4 : 1), p: v.offset, v: 0, brake: 0, yaw: null, x: 0, z: 0, active: false, fade: 0 }));
  traffic.forEach((v) => { v.v = v.base; v.len = v.mesh.userData.length; v.tail = null; addBeams(v.mesh, v.mesh.userData.front, v.mesh.userData.beamY); v.tail = v.mesh.children[v.mesh.children.length - 1]; scene.add(v.mesh); });
  // Ponte Estaiada, two cars each way: 'in' cars take the avenue's oncoming lane, turn onto the S-ramp and cross to the far-bank ground;
  // 'out' cars come back over the river, down the ramp and away along the avenue. Spawns/despawns only happen BRIDGE_FAR m from the player.
  const er = estaiadaRoute(pts[stopIndex(stops, LANDMARKS.estaiada)].x, curve, RIVER_Z), uIn = er.uj + 9 / len, uOut = er.uj - 9 / len;
  const laneAt = (u, o = new THREE.Vector3()) => { const p = curve.getPointAt(Math.min(1, Math.max(0, u))), t = curve.getTangentAt(Math.min(1, Math.max(0, u))); return o.set(p.x - 1.75 * t.z, p.y, p.z + 1.75 * t.x); }; // oncoming lane
  const side = (q, o) => new THREE.Vector3(q.x - q.tz * o, q.y + 0.12, q.z + q.tx * o); // o m right of travel far -> near, on the asphalt
  const paths = {
    in: new THREE.CatmullRomCurve3([3, 2, 1].map((k) => laneAt(er.uj + k * 3 / len)).concat(er.stations.slice().reverse().map((q) => side(q, -1.75)))),
    out: new THREE.CatmullRomCurve3(er.stations.map((q) => side(q, 1.75)).concat([1, 2, 3].map((k) => laneAt(er.uj - k * 3 / len)))),
  };
  for (const c of Object.values(paths)) c.plen = c.getLength();
  const atJ = (c, q) => { let best = 0; for (let k = 1; k <= 400; k++) if (c.getPointAt(k / 400).distanceTo(q) < c.getPointAt(best / 400).distanceTo(q)) best = k; return best / 400 * c.plen; };
  const sIn = atJ(paths.in, side(er.stations.at(-1), -1.75)), sOut = atJ(paths.out, side(er.stations.at(-1), 1.75)); // path distance where each lane meets the kerb line
  const bridge = [[3, 'in', 'road', 25], [7, 'in', 'path', 0.55], [2, 'out', 'path', 0.2], [9, 'out', 'path', 0.75]].map(([c, kind, phase, at], k) => {
    const mesh = car(CARS[c][1], CARS[c][0]); addBeams(mesh, mesh.userData.front, mesh.userData.beamY); mesh.rotation.order = 'YZX'; scene.add(mesh);
    const tail = mesh.children[mesh.children.length - 1], base = kind === 'in' ? 11.5 : 12.5;
    return { mesh, kind, phase, p: 0, t0: uIn + at / len, s: at * paths[kind].plen, body: CARS[c][0], slot: 4 + k, tail, base, v: base, brake: 0, x: 0, z: 0, len: mesh.userData.length };
  });
  const isDisposed = () => disposed;
  const ready = Promise.all(traffic.map(async (v, i) => {
    if (v.type === 'london' || v.type === 'glasgow') await upgradeBus(v.mesh, v.type, { hero: false, isDisposed });
    else if (v.type === 'cab') await upgradeCab(v.mesh, { isDisposed });
    else if (v.type === 'mini') await upgradeMini(v.mesh, { hero: false, ...v.palette, isDisposed });
    else {
      const catalog = await loadFleetCatalog(), slot = traffic.slice(0, i).filter((p) => p.type === 'car' && p.uk === v.uk).length;
      const model = regionalFleetModel(catalog, v.uk ? 'uk' : 'br', slot);
      if (!model || disposed) return;
      await upgradeFleet(v.mesh, model, { body: v.body, isDisposed });
      if (disposed || !v.mesh.userData.fleetModel) return;
      v.len = v.mesh.userData.length;
      const [pool, tail] = v.mesh.children.filter((c) => c.name === 'beam');
      pool.position.x = v.mesh.userData.front - 0.3;
      tail.position.x = model.beamAnchors.rear[0][0];
      tail.children.forEach((lamp, j) => { lamp.position.z = model.beamAnchors.rear[j][2]; });
    }
  }));
  const bridgeReady = Promise.all(bridge.map(async (b) => {
    const catalog = await loadFleetCatalog(), model = regionalFleetModel(catalog, 'br', b.slot);
    if (model && !disposed) await upgradeFleet(b.mesh, model, { body: b.body, isDisposed });
    if (!disposed && b.mesh.userData.fleetModel) b.len = b.mesh.userData.length;
  }));
  const zebras = stops.map((_, i) => curve.getPointAt(Math.min(1, i / (stops.length - 1) + ZEBRA_AT / len)));
  const auto = traffic.filter((v) => !v.relative);
  // Thames only: none on the Pinheiros
  const bx = pts[ukStart(stops)].x - 15, bw = riverEnd(stops, pts) - bx;
  const boatPalette = [[], ['#2b4a7a', '#f4f4f4', 1.2], ['#a8442f', '#e0c880', 0.85], ['#2f6b4a', '#f4f4f4', 1.1]];
  const boatStyles = ['launch', 'cruiser', 'service', 'launch', 'cruiser', 'service', 'launch'];
  const boats = Array.from({ length: 7 }, (_, i) => {
    const mesh = boat(...boatPalette[i % 4], boatStyles[i]);
    mesh.position.set(bx + bw * (i + 0.5) / 7, 0.1, RIVER_Z + ((i % 3) - 1) * 4);
    scene.add(mesh);
    return mesh;
  });
  const bb = pts[stopIndex(stops, LANDMARKS.bigben)];
  const blink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  blink.position.set(bb.x, 34.4, RIVER_Z - 16);
  scene.add(blink);
  const invP = (t) => { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (routeT(m, pts.length, knots) < t) a = m; else b = m; } return (a + b) / 2; }; // route progress for a curve t
  bridge.forEach((b) => { if (b.phase === 'road') b.p = invP(b.t0); });
  const rangeP = invP(swapAt(stops) + SP_RANGE); // route progress of the Sao Paulo loop's east end
  traffic.forEach((v) => { if (v.uk === false) { v.range = [0, rangeP]; v.p *= rangeP / 0.43; } });
  const lanePos = (t, lane) => { const p = curve.getPointAt(t), tn = curve.getTangentAt(t); return { x: p.x + tn.z * lane, z: p.z - tn.x * lane }; }; // same side convention as the frame loop
  const tOf = (v) => routeT(v.p, pts.length, knots);
  let lastRoute = null;
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), ball = new THREE.Sphere(), SEEN_MARGIN = 4, tmp = new THREE.Vector3(), here = new THREE.Vector3(), nrm = new THREE.Vector3(), swap = swapAt(stops), [scotIn, scotOut] = scotRange(stops), wrap = (p) => ((p % 1) + 1) % 1;
  return {
    ready: Promise.all([ready, bridgeReady]),
    dispose() { disposed = true; traffic.forEach((v) => disposeFade(v.mesh)); },
    update({ time, t: route, dt = 0, camera }) {
      let seen = () => false; // ponytail: no camera (tests) = nothing is on screen
      if (camera) { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); seen = (x, z, len) => frustum.intersectsSphere(ball.set(tmp.set(x, 1.5, z), len / 2 + SEEN_MARGIN)); }
      const move = !reducedMotion && dt > 0;
      if (move) {
        const road = bridge.filter((b) => b.phase === 'road'); // bridge cars on the avenue share the oncoming lane: same speed profile and spacing
        for (const v of auto.concat(road)) { // speed profile: ease toward the target, slower near a zebra crossing
          let near = SLOW; for (const z of zebras) near = Math.min(near, Math.hypot(v.x - z.x, v.z - z.z));
          const target = v.base * (0.3 + 0.7 * Math.min(1, Math.max(0, (near - 3) / (SLOW - 3))) ** 2), prev = v.v;
          v.v += Math.max(-DEC * dt, Math.min(ACC * dt, target - v.v));
          v.brake += (Math.min(1, Math.max(0, (prev - v.v) / dt / 2)) - v.brake) * Math.min(1, dt * 8);
          const np = v.p - v.v * dt / len; // oncoming: against the route
          const rg = v.range ?? [0, 1]; // ambient cars loop over their range (SP: its short loop; the rest: the whole route); bridge cars (kind) wrap
          if (!v.kind && !v.hold && np < rg[0]) v.hold = true; // left the west end: vanish, respawn at the east end
          if (v.hold) { // ponytail: waits (invisible) until the east end is >= MIN_SPAWN m from the player and 20 m clear of other cars
            const q = curve.getPointAt(routeT(rg[1], pts.length, knots));
            if (q.distanceTo(here) > MIN_SPAWN && !auto.some((o) => o !== v && (o.active || o.fade > 0) && Math.hypot(o.x - q.x, o.z - q.z) < 20)) { v.hold = false; v.p = rg[1]; v.v = v.base; v.active = true; v.x = q.x; v.z = q.z; } // active now: the next held car sees it
          } else v.p = v.kind ? wrap(np) : np;
        }
        // still in (or already back in) the lane while turning: fixed leaders for the spacing, so nobody drives through them
        const turning = bridge.filter((b) => b.phase === 'path' && (b.kind === 'in' ? b.s < sIn : b.s > sOut))
          .map((b) => ({ tt: b.kind === 'in' ? uIn - b.s / len : uOut + (paths.out.plen - b.s) / len, at: b.mesh.position, len: b.len, v: b.v, fixed: true }));
        // spacing on real distance: curve t (getPointAt) is only roughly arc length (coarse three.js table: 12 'm' of t can be 6 m), progress p even less
        const act = auto.filter((v) => v.active || v.fade > 0).concat(road).map((v) => Object.assign(v, { tt: tOf(v), at: null })).concat(turning).sort((a, b) => a.tt - b.tt);
        const where = (v) => v.at ?? laneAt(v.tt, new THREE.Vector3()); // lane points, like the turning cars' real positions
        for (let pass = 0; pass < 2; pass++) act.forEach((v, i) => {
          if (!i || v.fixed) return; // ponytail: no wrap pair (route ends are never both in view)
          const lead = act[i - 1], min = (v.len + lead.len) / 2 + GAP, d = where(v).distanceTo(where(lead));
          if (d < min) { v.tt = Math.min(v.tt + 1.5 / len, lead.tt + (v.tt - lead.tt) * min / Math.max(d, 0.1) + (d < 0.1 ? min / len : 0)); v.p = invP(Math.min(1, v.tt)); v.v = Math.min(v.v, lead.v); } // at most ~1.5 m back per pass (two passes)
        });
      }
      here.copy(curve.getPointAt(Math.min(1, Math.max(0, route))));
      const first = lastRoute === null, jump = first || Math.abs(route - lastRoute) > 0.02; lastRoute = route; // first frame or a nav jump: settle every vehicle at once
      if (jump) for (const v of auto) { v.active = false; if (!first) v.fade = 0; } // re-place them one by one: each checks the clearance against those already placed
      for (const v of traffic) {
        const t = v.relative ? route + v.offset : routeT(v.p, pts.length, knots);
        const inside = t >= 0 && t <= 1, want = inside && !v.hold && (v.range || v.uk === undefined || (t >= swap) === v.uk) && (v.scot === undefined || (t >= scotIn && t < scotOut) === v.scot);
        // region borders sit in view (SP and London share a frame): a vehicle only switches city once it is far from the player, so it drives off instead of popping
        if (jump || !inside || v.relative || v.hold || want === v.active || curve.getPointAt(t).distanceTo(here) > HIDE) {
          // never appear on top of a car already in the lane (region borders, nav jumps): stay hidden and keep driving until it is clear
          v.active = want && (v.relative || !traffic.some((o) => o !== v && (o.active || o.fade > 0) && o.lane === v.lane && Math.hypot(o.x - lanePos(t, v.lane).x, o.z - lanePos(t, v.lane).z) < (v.len + o.len) / 2 + GAP) && !bridge.some((b) => Math.hypot(b.x - lanePos(t, v.lane).x, b.z - lanePos(t, v.lane).z) < (v.len + b.len) / 2 + GAP));
        }
        if (v.fade !== +v.active) { // toggle instantly while off screen (its new place if appearing, its last place otherwise); fade only if it is in view
          const lp = !v.fade && v.active ? lanePos(t, v.lane) : { x: v.x, z: v.z };
          v.fade = first || reducedMotion || !dt || !inside || !seen(lp.x, lp.z, v.len) ? +v.active : v.active ? Math.min(1, v.fade + dt / FADE) : Math.max(0, v.fade - dt / FADE);
        }
        v.mesh.visible = v.fade > 0; fadeVehicle(v.mesh, v.fade);
        if (!v.active && !v.fade) continue; // a fading-out car keeps driving (spawn checks still see it); off the route ends (hold) it just vanishes
        if (v.livery) { const livery = t >= scotIn && t < scotOut ? 'glasgow' : 'london'; if (livery !== v.livery && v.mesh.userData.wheels) { reskinBus(v.mesh, livery); v.livery = livery; } } // buses wear the livery of the region they are in, also after a respawn or past a region border
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        nrm.set(tan.z, 0, -tan.x).normalize();
        v.mesh.position.copy(p).addScaledVector(nrm, v.lane);
        const ds = (v.mesh.position.x - v.x) * Math.cos(v.mesh.rotation.y) - (v.mesh.position.z - v.z) * Math.sin(v.mesh.rotation.y); // signed travel along the heading
        if (Math.abs(ds) < 5) for (const w of v.mesh.userData.wheels ?? []) w.rotation.z -= ds / w.position.y; // wheels roll; skip respawn jumps
        v.x = v.mesh.position.x; v.z = v.mesh.position.z;
        const yaw = Math.atan2(-tan.z, tan.x) + (v.lane < 0 ? Math.PI : 0);
        v.yaw = v.yaw === null || !move ? yaw : v.yaw + (((yaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8); // ease around bends
        v.mesh.rotation.y = v.yaw;
        v.tail.userData.swell?.(1 + 1.4 * v.brake); // brake lights: the tail glow pool (night only) swells while slowing
      }
      const lane = auto.filter((v) => v.active || v.fade > 0).concat(bridge.filter((b) => b.phase === 'road')), merge = [uOut - 8 / len, er.uj + 35 / len];
      for (const kind of ['in', 'out']) { // ramp/deck: same-direction cars keep their gap (a car held at the junction queues the next)
        const onPath = bridge.filter((b) => b.kind === kind && b.phase === 'path').sort((a, b) => b.s - a.s);
        onPath.forEach((b, i) => {
          if (!move) return;
          b.v += Math.max(-DEC * dt, Math.min(ACC * dt, b.base - b.v));
          let s1 = b.s + b.v * dt;
          if (kind === 'out' && b.s <= sOut - b.len / 2 - 0.5 && s1 > sOut - b.len / 2 - 0.5 && (lane.some((v) => { const t = tOf(v); return t > merge[0] && t < merge[1]; }) || bridge.some((o) => o.kind === 'in' && o.phase === 'path' && o.s < sIn + 6))) { s1 = b.s; b.v = 0; } // give way to the avenue (and to a car turning in) before pulling out
          const at = paths[kind].getPointAt(Math.min(1, Math.max(0, s1 / paths[kind].plen))), clear = (v) => at.distanceTo(v.mesh.position) >= (v.len + b.len) / 2 + GAP; // real distance: path s shortens nothing on the bend
          if (i) { const lead = onPath[i - 1]; if (lead.s - s1 < (lead.len + b.len) / 2 + GAP || !clear(lead)) { s1 = b.s; b.v = Math.min(b.v, lead.v); } }
          const inLane = kind === 'in' ? s1 < sIn : s1 > sOut - b.len / 2, t1 = kind === 'in' ? uIn - s1 / len : uOut + (paths.out.plen - s1) / len;
          if (kind === 'in' && s1 < sIn && bridge.some((o) => o.kind === 'out' && o.phase === 'path' && o.s > sOut - o.len / 2 - 0.3)) { s1 = b.s; b.v = 0; } // a car already pulling out (not one waiting at the line) has the junction: wait before turning in
          if (inLane) for (const v of lane) if (tOf(v) < t1 && !clear(v)) { s1 = b.s; b.v = Math.min(b.v, v.v); } // in the lane: also queue behind the avenue car ahead (incl. the bridge car that just merged)
          b.s = s1;
        });
      }
      for (const b of bridge) {
        const path = paths[b.kind];
        if (b.phase === 'road') {
          const t = tOf(b);
          if (b.kind === 'in' && t <= uIn) { b.phase = 'path'; b.s = (uIn - t) * len; }
          else if (b.kind === 'out' && t < uOut - 10 / len && laneAt(t, tmp).distanceTo(here) > BRIDGE_FAR && bridge.every((o) => o === b || o.kind !== 'out' || o.phase !== 'path' || o.s > o.len + GAP + b.len)) { b.phase = 'path'; b.s = 0; b.v = b.base; } // respawn on the far bank (always > BRIDGE_FAR away)
        } else if (b.s >= path.plen) {
          b.phase = 'road';
          if (b.kind === 'out') b.p = invP(uOut - (b.s - path.plen) / len);
          else { let D = 25; const busy = (t) => lane.some((v) => v !== b && laneAt(t, tmp).distanceTo(v.mesh.position) < (v.len + b.len) / 2 + GAP + 4); while (D < 400 && (curve.getPointAt(Math.min(1, uIn + D / len)).distanceTo(here) < BRIDGE_FAR || busy(uIn + D / len))) D += 5; b.p = invP(uIn + D / len); b.v = b.base; } // next 'in' car starts out of sight, in a free gap
        }
        const m = b.mesh, x0 = m.position.x, z0 = m.position.z;
        if (b.phase === 'road') { const t = tOf(b), tg = curve.getTangentAt(Math.min(1, Math.max(0, t))); laneAt(t, m.position); m.rotation.set(0, Math.atan2(-tg.z, tg.x) + Math.PI, 0); }
        else { const k = Math.min(1, Math.max(0, b.s / path.plen)), tg = path.getTangentAt(k); m.position.copy(path.getPointAt(k)); m.rotation.set(0, Math.atan2(-tg.z, tg.x), Math.atan2(tg.y, Math.hypot(tg.x, tg.z))); } // pitch with the ramp
        const ds = Math.hypot(m.position.x - x0, m.position.z - z0); b.x = m.position.x; b.z = m.position.z;
        if (move && ds < 5) for (const w of m.userData.wheels ?? []) w.rotation.z -= ds / w.position.y; // skip respawn jumps
        b.tail.userData.swell?.(1 + 1.4 * b.brake);
      }
      boats.forEach((b, i) => {
        b.position.y = 0.1 + Math.sin(time * 1.1 + i * 2) * 0.25;
        b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
      });
      blink.visible = Math.floor(time * 1.4) % 2 === 0;
    },
  };
}
