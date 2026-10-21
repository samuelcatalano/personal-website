import * as THREE from 'three';
import { LANDMARKS, stopIndex, RIVER_Z, towerX, glasgowSites } from './layout.js';
import { PALETTE as P } from './palette.js';
import { createWembley, createBigBen, createMasp, createSe, createEstaiada, createTowerBridge, createLondonEye, createCopan, createRiverside, createUniversity, createChambers, createWellington } from './landmark-geometry.js';
import { buildSaoPaulo } from './saopaulo.js';
import { createHeroBackground } from './hero-background.js';
import { createCityRollout } from './city-rollout.js';
import { buildGlasgow } from './glasgow.js';
import { buildRiverside } from './riverside.js';
import { buildUniversity } from './university.js';
import { flag } from './flags.js';
const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
const PI = Math.PI, at = (stops, pts, key) => pts[stopIndex(stops, LANDMARKS[key])];
function clockFaces(x, z) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#f4f0e2'; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#4d4030'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 116, 0, PI * 2); c.stroke();
  c.strokeStyle = '#6d604b'; c.lineWidth = 3;
  for (let i = 0; i < 60; i++) {
    const a = i * PI / 30, r1 = i % 5 ? 103 : 91;
    c.beginPath(); c.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1);
    c.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108); c.stroke();
  }
  c.fillStyle = '#493d30'; c.font = 'bold 21px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = i * PI / 6;
    c.fillText('I II III IV V VI VII VIII IX X XI XII'.split(' ')[i - 1], 128 + Math.sin(a) * 77, 128 - Math.cos(a) * 77);
  }
  c.strokeStyle = '#392d24'; c.lineCap = 'round';
  const hand = (w, len, a) => { c.lineWidth = w; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + len * Math.sin(a), 128 - len * Math.cos(a)); c.stroke(); };
  hand(8, 45, (10 + 10 / 60) * PI / 6); hand(5, 68, PI / 3);
  c.fillStyle = '#392d24'; c.beginPath(); c.arc(128, 128, 7, 0, PI * 2); c.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(3.55, 3.55);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: texture }), 4);
  [[x, z + 3.06, 0], [x, z - 3.06, PI], [x + 3.06, z, PI / 2], [x - 3.06, z, -PI / 2]]
    .forEach(([fx, fz, ry], i) => mesh.setMatrixAt(i, m.compose(p.set(fx, 21, fz), q.setFromAxisAngle(UP, ry), s)));
  mesh.name = 'bigben-four-clock-faces';
  mesh.userData = { faceCount: 4 };
  const group = new THREE.Group(); group.name = 'bigben-details'; group.add(mesh);
  return group;
}
function towerBridge(add, { x }) {
  for (const along of [-9.5, 9.5]) flag(add, x, 35.2, RIVER_Z + along, 'jack', 0.65);
  return createTowerBridge(x, RIVER_Z);
}
export function buildLandmarks(add, stops, pts, onTree) {
  const details = new THREE.Group(); details.name = 'landmark-details';
  const ben = at(stops, pts, 'bigben');
  details.add(createBigBen(ben.x, RIVER_Z - 16), clockFaces(ben.x, RIVER_Z - 16));
  details.add(towerBridge(add, { x: towerX(stops, pts) }));
  const { wheel, frame } = createLondonEye(at(stops, pts, 'eye').x, RIVER_Z + 13); details.add(frame);
  details.add(createWembley(at(stops, pts, 'wembley').x, RIVER_Z - 26));
  buildGlasgow(add, at(stops, pts, 'glasgow'), onTree, site => details.add(createChambers(site.x, site.z)), site => details.add(createWellington(site.x, site.z)));
  const { museum, uni } = glasgowSites(stops, pts), hill = (dx, w, d, y, h, c) => add(uni.x + dx, y, uni.z, w, h, d, c);
  buildRiverside(add, museum, site => details.add(createRiverside(site.x, site.z)));
  hill(0, uni.w + 12, 24, 0, 1.2, P.steel); hill(0, uni.w + 6, 20, 1.2, 1.3, P.skyBlue); // blue-grey paved plaza the university stands on
  buildUniversity((x, y, z, w, h, d, c) => add(x, y + uni.lift, z, w, h, d, c), uni, site => details.add(createUniversity(site.x, site.z, uni.lift)));
  flag(add, uni.x, 34.7 + uni.lift, uni.z + 3, 'saltire', 1.1); // finial top
  const backgroundPlots = [];
  buildSaoPaulo(add, stops, pts, plot => backgroundPlots.push(plot), true, site => details.add(createMasp(site.x, RIVER_Z - 18)), site => details.add(createSe(site.x, RIVER_Z - 18)), site => details.add(createEstaiada(site.x, RIVER_Z)), site => details.add(createCopan(site)));
  const control = backgroundPlots.filter(p => p.id.startsWith('paulista-hero-'));
  if (control.length) details.add(createHeroBackground(control));
  const generic = backgroundPlots.filter(p => !p.id.startsWith('paulista-hero-'));
  if (generic.length) { const group=createCityRollout(generic);group.name='paulista-architecture';details.add(group); }
  return {
    eye: wheel,
    details,
  };
}
