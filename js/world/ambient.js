import * as THREE from 'three';
import { createBoat } from './landmark-geometry.js';
import { buildVehicle } from './vehicles.js';
import { upgradeBus, upgradeMini, upgradeCab, loadFleetCatalog, regionalFleetModel, upgradeFleet } from './vehicle-assets.js';
import { RIVER_Z, LANDMARKS, ukStart, stopIndex, swapAt, scotRange, riverEnd, riverStart } from './layout.js';
import { stopMarks, fineMarks, routeT } from '../scroll.js';
import { addBeams } from './beams.js';
const cab = () => buildVehicle('cab'); // London black cab (LEVC TX)
const car = (type, color) => buildVehicle(type, { color });
function boat(hull = '#6b4f3a', cabin = '#f4f4f4', sx = 1) {
  const m = createBoat(hull, cabin);
  m.scale.x = sx;
  return m;
}
// Traffic. `relative` vehicles keep a fixed offset from the player (same lane, glued to the scroll position); the rest drive the oncoming lane on their own:
// a base speed by type, eased down toward a zebra crossing (and back up) by integrating acceleration each frame, a minimum gap to the vehicle ahead, yaw eased toward the road tangent.
const SPEED = { london: 10, glasgow: 10, cab: 13, mini: 13, car: 13.5 }; // m/s
const ACC = 3, DEC = 6, GAP = 3.5, ZEBRA_AT = 9, SLOW = 24; // m/s^2 up, m/s^2 down, bumper gap (m), zebra offset past a stop (roadmarks.js), slow-down radius (m)
const CARS = [['#e8c425', 'mini'], ['#2f6fcf', 'sedan'], ['#c8102e', 'suv'], ['#3f9d4a', 'mini'], ['#16181c', 'sedan'], ['#1f6b3a', 'van'], ['#f2b705', 'sedan'], ['#b3161f', 'hatch'], ['#2e7d32', 'suv'], ['#e8c425', 'sedan']]; // saturated paints only: no white/grey
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
    G(1, 0.17, { uk: false }), G(2, 0.33, { uk: false }), G(5, 0.58, { uk: false }), G(9, 0.92, { uk: false }),
  ].map((v, i) => ({ lane: -1.75, ...v, base: SPEED[v.type] * (v.type === 'car' ? 0.9 + 0.2 * ((i * 7) % 5) / 4 : 1), p: v.offset, v: 0, brake: 0, yaw: null, x: 0, z: 0, active: false }));
  traffic.forEach((v) => { v.v = v.base; v.len = v.mesh.userData.length; v.tail = null; addBeams(v.mesh, v.mesh.userData.front, v.mesh.userData.beamY); v.tail = v.mesh.children[v.mesh.children.length - 1]; scene.add(v.mesh); });
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
  const zebras = stops.map((_, i) => curve.getPointAt(Math.min(1, i / (stops.length - 1) + ZEBRA_AT / len)));
  const auto = traffic.filter((v) => !v.relative);
  // Thames only: none on the Pinheiros
  const bx = pts[ukStart(stops)].x - 15, bw = riverEnd(stops, pts) - bx;
  const boats = Array.from({ length: 7 }, (_, i) => {
    const mesh = boat(...[[], ['#2b4a7a', '#f4f4f4', 1.2], ['#a8442f', '#e0c880', 0.85], ['#2f6b4a', '#f4f4f4', 1.1]][i % 4]);
    mesh.position.set(bx + bw * (i + 0.5) / 7, 0.1, RIVER_Z + ((i % 3) - 1) * 4);
    scene.add(mesh);
    return mesh;
  });
  const bb = pts[stopIndex(stops, LANDMARKS.bigben)];
  const blink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  blink.position.set(bb.x, 34.4, RIVER_Z - 16);
  scene.add(blink);
  const nrm = new THREE.Vector3(), swap = swapAt(stops), [scotIn, scotOut] = scotRange(stops), wrap = (p) => ((p % 1) + 1) % 1;
  return {
    ready,
    dispose() { disposed = true; },
    update({ time, t: route, dt = 0 }) {
      const move = !reducedMotion && dt > 0;
      if (move) {
        for (const v of auto) { // speed profile: ease toward the target, slower near a zebra crossing
          let near = SLOW; for (const z of zebras) near = Math.min(near, Math.hypot(v.x - z.x, v.z - z.z));
          const target = v.base * (0.3 + 0.7 * Math.min(1, Math.max(0, (near - 3) / (SLOW - 3))) ** 2), prev = v.v;
          v.v += Math.max(-DEC * dt, Math.min(ACC * dt, target - v.v));
          v.brake += (Math.min(1, Math.max(0, (prev - v.v) / dt / 2)) - v.brake) * Math.min(1, dt * 8);
          v.p = wrap(v.p - v.v * dt / len); // oncoming: against the route
        }
        const act = auto.filter((v) => v.active).sort((a, b) => a.p - b.p); // spacing: clamp behind the leader (next lower progress, wrapping)
        for (let pass = 0; pass < 2; pass++) act.forEach((v, i) => {
          if (act.length < 2) return;
          const lead = act[(i + act.length - 1) % act.length], lp = i ? lead.p : lead.p - 1, min = ((v.len + lead.len) / 2 + GAP) / len;
          if (v.p - lp < min) { v.p = wrap(lp + min); v.v = Math.min(v.v, lead.v); }
        });
      }
      for (const v of traffic) {
        const t = v.relative ? route + v.offset : routeT(v.p, pts.length, knots);
        v.active = t >= 0 && t <= 1 && (v.uk === undefined || (t >= swap) === v.uk) && (v.scot === undefined || (t >= scotIn && t < scotOut) === v.scot);
        v.mesh.visible = v.active;
        if (!v.active) continue;
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
      boats.forEach((b, i) => {
        b.position.y = 0.1 + Math.sin(time * 1.1 + i * 2) * 0.25;
        b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
      });
      blink.visible = Math.floor(time * 1.4) % 2 === 0;
    },
  };
}
