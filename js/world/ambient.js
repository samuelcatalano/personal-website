import * as THREE from 'three';
import { createBoat } from './landmark-geometry.js';
import { buildVehicle } from './vehicles.js';
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
export function createAmbient(scene, { curve, pts, stops }) {
  const knots = fineMarks(stopMarks(pts), curve);
  const traffic = [
    { mesh: buildVehicle('london'), lane: 1.75, offset: -0.16, relative: true, uk: true, scot: false },
    { mesh: buildVehicle('glasgow'), lane: 1.75, offset: -0.12, relative: true, uk: true, scot: true }, // exists only inside the Scotland range, so it never swaps on screen
    { mesh: cab(), lane: 1.75, offset: 0.22, relative: true },
    { mesh: cab(), lane: -1.75, offset: 0.25, reverse: true },
    { mesh: cab(), lane: -1.75, offset: 0.75, reverse: true },
    { mesh: cab(), lane: 1.75, offset: -0.16, relative: true, uk: false },
    // deterministic fleet: [colour, route offset, uk-only flag, body type]
    ...[['#e8c425', .08, 1, 'mini'], ['#2f6fcf', .17, 0, 'sedan'], ['#f4f1ea', .33, 0, 'suv'], ['#3f9d4a', .42, 1, 'mini'], ['#16181c', .5, 1, 'sedan'], ['#b9bec4', .58, 0, 'van'],
      ['#e07a1f', .67, 0, 'sedan'], ['#8b2f45', .71, 0, 'hatch'], ['#16181c', .83, 1, 'suv'], ['#4a7f9e', .92, 0, 'sedan']].map(([c, offset, uk, type]) => (
      { mesh: car(type, c), lane: -1.75, offset, reverse: true, uk: uk ? true : undefined })),
  ];
  traffic.forEach((v) => { addBeams(v.mesh, v.mesh.userData.front, v.mesh.userData.beamY); scene.add(v.mesh); });
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
  const nrm = new THREE.Vector3(), swap = swapAt(stops), [scotIn, scotOut] = scotRange(stops);
  return {
    update({ time, t: route }) {
      for (const v of traffic) {
        let t = v.relative ? route + v.offset : routeT(((v.offset - time * 0.012) % 1 + 1) % 1, pts.length, knots);
        v.mesh.visible = t >= 0 && t <= 1 && (v.uk === undefined || (t >= swap) === v.uk) && (v.scot === undefined || (t >= scotIn && t < scotOut) === v.scot);
        if (!v.mesh.visible) continue;
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        nrm.set(tan.z, 0, -tan.x).normalize();
        v.mesh.position.copy(p).addScaledVector(nrm, v.lane);
        v.mesh.rotation.y = Math.atan2(-tan.z, tan.x) + (v.reverse ? Math.PI : 0);
      }
      boats.forEach((b, i) => {
        b.position.y = 0.1 + Math.sin(time * 1.1 + i * 2) * 0.25;
        b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
      });
      blink.visible = Math.floor(time * 1.4) % 2 === 0;
    },
  };
}
