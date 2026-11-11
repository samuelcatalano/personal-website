import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { upgradeMini, loadFleetCatalog, regionalFleetModel, upgradeFleet, rollWheels } from './vehicle-assets.js';
import { ROAD_HW, END, deckHeight } from './underpass.js';
import { addBeams, refitBeams } from './beams.js';
// Cars looping over each overpass (one lane each way, drive on the left): a plain independent loop per bridge. They live in a group per pass beside the
// underpass meshes (same frame: x along the route, z across it), appear/vanish at the foot of the ramps and stand still under reduced motion.
// Opposite lanes never meet and same-lane cars share one speed, so no queueing is needed.
const CARS = [['mini', '#285b8f', 1, 0], ['sedan', '#c8102e', -1, 0.3], ['mini', '#1f4a35', -1, 0.75], ['hatch', '#e8c425', 1, 0.55]]; // type, colour, direction along z, loop phase
const SPEED = 6, PAINT = { '#285b8f': 0, '#1f4a35': 1 };
export function createUnderpassTraffic(passes, { reducedMotion = false } = {}) {
  const root = new THREE.Group(); root.name = 'underpass-traffic';
  let disposed = false, clock = 0;
  // Cars and their beams share the road profile, including the level river side and far-bank exit.
  const yAt = (zz, river) => deckHeight(zz, river) + 0.12;
  const beamPoint = new THREE.Vector3(), beamMatrix = new THREE.Matrix4(), beamInverse = new THREE.Matrix4();
  const projectBeams = (mesh, river) => {
    mesh.updateMatrix();
    for (const beam of mesh.children.filter(o => o.name === 'beam' && o.isMesh)) {
      if (!beam.userData.roadVertices) {
        beam.geometry = new THREE.PlaneGeometry(13, 8, 26, 1).rotateX(-Math.PI / 2).translate(6.5, 0, 0);
        beam.userData.roadVertices = beam.geometry.attributes.position.array.slice();
      }
      beam.updateMatrix(); beamMatrix.multiplyMatrices(mesh.matrix, beam.matrix); beamInverse.copy(beamMatrix).invert();
      const p = beam.geometry.attributes.position, base = beam.userData.roadVertices;
      for (let i = 0; i < p.count; i++) {
        beamPoint.fromArray(base, i * 3).applyMatrix4(beamMatrix);
        const az = Math.abs(beamPoint.z), step = (END - 11) / 10;
        const z0 = Math.max(11, Math.min(END, 11 + Math.floor((az - 11) / step) * step)), z1 = Math.min(END, z0 + step);
        const t = z1 > z0 ? Math.max(0, Math.min(1, (az - z0) / (z1 - z0))) : 0;
        const sg = Math.sign(beamPoint.z);
        beamPoint.y = river && beamPoint.z * river.sigma >= 0 ? deckHeight(beamPoint.z, river) + 0.17 : THREE.MathUtils.lerp(deckHeight(sg * z0, river), deckHeight(sg * z1, river), t) + 0.17;
        beamPoint.applyMatrix4(beamInverse); p.setXYZ(i, beamPoint.x, beamPoint.y, beamPoint.z);
      }
      p.needsUpdate = true;
    }
  };
  const cars = passes.flatMap((p, pi) => {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(-p.tz, p.tx); root.add(g);
    return CARS.map(([type, color, dir, phase], k) => {
      const mesh = buildVehicle(type, { color }); addBeams(mesh, mesh.userData.front, mesh.userData.beamY); mesh.rotation.order = 'YZX'; mesh.rotation.y = -dir * Math.PI / 2; g.add(mesh);
      return { mesh, dir, phase: (phase + pi * 0.37) % 1, type, color, slot: pi * 2 + k, z: 0, river: p.river, lin: p.river ? p.river.inAz : END - 2 };
    });
  });
  const place = (c) => {
    // loop: from the river end (sigma side, distance c.lin) across the deck to the land end; opposite lanes run the loop backwards
    const loop = c.lin + END - 2, u = (c.phase * loop + (reducedMotion ? 0 : clock * SPEED)) % loop, v = c.dir > 0 ? u : loop - u;
    const sg = c.river ? c.river.sigma : -1, zz = sg * (c.lin - v), h = 0.5;
    const pitch = Math.atan2(yAt(zz + c.dir * h, c.river) - yAt(zz - c.dir * h, c.river), 2 * h);
    c.mesh.visible = Math.abs(zz) < END - 2.5 || (c.river && zz * c.river.sigma > END - 2.5) || reducedMotion && Math.abs(zz) < 12;
    c.mesh.position.set(c.dir * ROAD_HW / 2, yAt(zz, c.river), zz); c.mesh.rotation.z = pitch;
    projectBeams(c.mesh, c.river);
    if (!reducedMotion) rollWheels(c.mesh.userData.wheels ?? [], SPEED * (c.dtLast ?? 0));
    c.z = zz;
  };
  const ready = (async () => {
    const catalog = await loadFleetCatalog();
    await Promise.all(cars.map(async (c) => {
      if (c.type === 'mini') await upgradeMini(c.mesh, { hero: false, body: c.color, roof: '#f4f1ea', isDisposed: () => disposed });
      else { const m = regionalFleetModel(catalog, 'uk', c.slot); if (m && !disposed) await upgradeFleet(c.mesh, m, { body: c.color, isDisposed: () => disposed }); }
      if (!disposed) refitBeams(c.mesh);
    }));
  })().catch(() => {});
  cars.forEach(place);
  return { group: root, ready, dispose() { disposed = true; },
    update(dt) { if (reducedMotion) return; clock += dt; for (const c of cars) { c.dtLast = dt; place(c); } } };
}
