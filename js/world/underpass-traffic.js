import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { upgradeMini, loadFleetCatalog, regionalFleetModel, upgradeFleet, rollWheels } from './vehicle-assets.js';
import { ROAD_HW, END, deckHeight } from './underpass.js';
import { addBeams, refitBeams } from './beams.js';
import { bridgeTrafficState } from './bridge-exits.js';
import { STREET_HALF } from './bridge-street.js';
// Cars looping over each overpass (one lane each way, drive on the left): a plain independent loop per bridge. They live in a group per pass beside the
// underpass meshes (same frame: x along the route, z across it), recycle behind the rear blocks and stand still under reduced motion.
// Opposite lanes never meet and same-lane cars share one speed, so no queueing is needed.
const CARS = [['mini', '#285b8f', 1, 0], ['sedan', '#c8102e', -1, 0.3], ['mini', '#1f4a35', -1, 0.75], ['hatch', '#e8c425', 1, 0.55]]; // type, colour, direction along z, loop phase
const SPEED = 6, PAINT = { '#285b8f': 0, '#1f4a35': 1 };
export function createUnderpassTraffic(passes, { reducedMotion = false } = {}) {
  const root = new THREE.Group(); root.name = 'underpass-traffic';
  let disposed = false, clock = 0;
  const beamPoint = new THREE.Vector3(), roadPoint = new THREE.Vector3(), roadTangent = new THREE.Vector3();
  const beamMatrix = new THREE.Matrix4(), beamInverse = new THREE.Matrix4();
  const roadPose = (c,s,point,tangent) => {
    let half=ROAD_HW;
    if(c.street && s>c.bridgeLength){
      const distance=s-c.bridgeLength,u=Math.min(1,Math.max(0,distance/c.street.length));
      c.street.curve.getPointAt(u,point);c.street.curve.getTangentAt(u,tangent);
      point.y=.12;half=STREET_HALF+.2*Math.max(0,1-distance/6);
    }else{
      const sg=c.river?.sigma??-1,z=sg*(s-(END-2));
      point.set(0,deckHeight(z,c.river)+.12,z);
      tangent.set(0,deckHeight(z+sg*.5,c.river)-deckHeight(z-sg*.5,c.river),sg).normalize();
    }
    if(c.dir>0)tangent.negate();
    const horizontal=Math.hypot(tangent.x,tangent.z);
    point.x+=tangent.z/horizontal*half/2;point.z-=tangent.x/horizontal*half/2;
  };
  const projectBeams = (c) => {
    if(!c.mesh.visible)return;
    c.mesh.updateMatrix();
    for(const beam of c.mesh.children.filter(o=>o.name==='beam'&&o.isMesh)){
      if(!beam.material.opacity)continue;
      if(!beam.userData.roadVertices){
        beam.geometry=new THREE.PlaneGeometry(13,8,26,1).rotateX(-Math.PI/2).translate(6.5,0,0);
        beam.userData.roadVertices=beam.geometry.attributes.position.array.slice();
      }
      beam.updateMatrix();beamMatrix.multiplyMatrices(c.mesh.matrix,beam.matrix);beamInverse.copy(beamMatrix).invert();
      const p=beam.geometry.attributes.position,base=beam.userData.roadVertices;
      for(let i=0;i<p.count;i++){
        beamPoint.fromArray(base,i*3).applyMatrix4(beam.matrix);
        const right=beamPoint.z,s=c.s+(c.dir>0?-1:1)*beamPoint.x;
        roadPose(c,s,roadPoint,roadTangent);
        const horizontal=Math.hypot(roadTangent.x,roadTangent.z);
        roadPoint.x-=roadTangent.z/horizontal*right;roadPoint.z+=roadTangent.x/horizontal*right;roadPoint.y+=.05;
        beamPoint.copy(roadPoint).applyMatrix4(beamInverse);p.setXYZ(i,beamPoint.x,beamPoint.y,beamPoint.z);
      }
      p.needsUpdate=true;
    }
  };
  const cars = passes.flatMap((p, pi) => {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(-p.tz, p.tx); root.add(g);
    return CARS.map(([type, color, dir, phase], k) => {
      const mesh = buildVehicle(type, { color }); addBeams(mesh, mesh.userData.front, mesh.userData.beamY); mesh.rotation.order = 'YZX'; mesh.rotation.y = -dir * Math.PI / 2; g.add(mesh);
      return { mesh, dir, phase: (phase + pi * 0.37) % 1, type, color, slot: pi * 2 + k, z: 0, s: 0, river: p.river, street: p.street, bridgeLength: (p.river ? p.river.inAz : END-2)+END-2 };
    });
  });
  const place = (c) => {
    const pose=bridgeTrafficState(reducedMotion?0:clock*SPEED,c.phase,c.dir,c.bridgeLength,c.street?.length??0);
    c.s=pose.s;c.mesh.visible=pose.visible;
    roadPose(c,c.s,roadPoint,roadTangent);
    c.mesh.position.copy(roadPoint);c.mesh.rotation.y=Math.atan2(-roadTangent.z,roadTangent.x);
    c.mesh.rotation.z=Math.atan2(roadTangent.y,Math.hypot(roadTangent.x,roadTangent.z));
    for(const beam of c.mesh.children.filter(o=>o.name==='beam'))beam.visible=c.mesh.visible;
    projectBeams(c);
    if (!reducedMotion) rollWheels(c.mesh.userData.wheels ?? [], SPEED * (c.dtLast ?? 0));
    c.z = c.mesh.position.z;
  };
  const ready = (async () => {
    const catalog = await loadFleetCatalog();
    await Promise.all(cars.map(async (c) => {
      if (c.type === 'mini') await upgradeMini(c.mesh, { hero: false, body: c.color, roof: '#f4f1ea', isDisposed: () => disposed });
      else { const m = regionalFleetModel(catalog, 'uk', c.slot); if (m && !disposed) await upgradeFleet(c.mesh, m, { body: c.color, isDisposed: () => disposed }); }
      if (!disposed) { refitBeams(c.mesh); place(c); }
    }));
  })().catch(() => {});
  cars.forEach(place);
  return { group: root, ready, dispose() { disposed = true; },
    update(dt) { if (reducedMotion) { cars.forEach(projectBeams); return; } clock += dt; for (const c of cars) { c.dtLast = dt; place(c); } } };
}
