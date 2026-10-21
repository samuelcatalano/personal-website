import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildCar, fixed, bare } from './vehicles.js';
const RED = '#c9252b', GLASS = '#a9c5d3', FRAME = '#8f171d', TYRE = '#242629', HUB = '#a9a49a';
const PURPLE = '#5b2a86', PURPLE_D = '#3f1c5e', GREY = '#c9cdd2'; // First Glasgow livery
const WARM = new THREE.Color('#ffc865'), GLOW = '#fff0b5', CREAM = '#e6dcc4', WHITE = '#f4f1ea', CHROME = '#c9c9c9', GILT = '#b39a64', PLATE_Y = '#f2c230';
const addWheels = (group, geometry, color, positions) => {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color }), positions.length);
  positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
};
const DARK = '#1b1d21', ARCH = '#08090a', TAIL = '#c4151c', INDI = '#e8892b';
// Ambient traffic and the Mini live in vehicles.js; `car` stays as a thin adapter for older callers.
export { buildMini } from './vehicles.js';
export const car = ({ c, taxi }) => buildCar(taxi ? 'cab' : 'sedan', c);
export function buildBus() {
  const bus = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: RED });
  const { add, list } = createBoxes();
  const shape = new THREE.Shape();
  // contour inset by 0.1 so the 0.14 bevel rounds the roof/nose/skirt edges and lands on the 11 x 4.6 x 2.5 envelope
  shape.moveTo(-4.98, 0.52);
  shape.lineTo(4.98, 0.52);
  shape.quadraticCurveTo(5.36, 0.52, 5.36, 0.9);
  shape.lineTo(5.36, 4.08);
  shape.quadraticCurveTo(5.36, 4.46, 4.98, 4.46);
  shape.lineTo(-4.98, 4.46);
  shape.quadraticCurveTo(-5.36, 4.46, -5.36, 4.08);
  shape.lineTo(-5.36, 0.9);
  shape.quadraticCurveTo(-5.36, 0.52, -4.98, 0.52);
  const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: 2.22, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 4, curveSegments: 6,
  }), bodyMaterial);
  shell.position.z = -1.11;
  shell.castShadow = shell.receiveShadow = true;
  bus.add(shell);
  // side(color, x0, x1, y0, y1, outerZ, thickness): same box mirrored on both flanks
  const side = (color, x0, x1, y0, y1, zo, t) => {
    for (const s of [1, -1]) add((x0 + x1) / 2, y0, s * (zo - t / 2), x1 - x0, y1 - y0, t, color);
  };
  const front = (color, xo, t, y0, y1, z0, z1) => add(xo - t / 2, y0, (z0 + z1) / 2, t, y1 - y0, z1 - z0, color); // box on the nose, outer face at xo
  const rear = (color, xo, t, y0, y1, z0, z1) => add(-xo + t / 2, y0, (z0 + z1) / 2, t, y1 - y0, z1 - z0, color);
  // windows: lower + upper deck bands, cream frame rails and pillars (outer 1.29 > glass 1.27)
  for (const [y0, y1] of [[1.17, 1.89], [3.14, 3.86]]) {
    side(CREAM, -4.92, 4.12, y1, y1 + 0.06, 1.29, 0.03);
    side(CREAM, -4.92, 4.12, y0 - 0.06, y0, 1.29, 0.03);
    for (let i = 0; i < 7; i++) {
      const x = -4.35 + i * 1.32;
      side(GLASS, x - 0.51, x + 0.51, y0, y1, 1.27, 0.016);
      if (i < 6) side(CREAM, x + 0.5, x + 0.82, y0 - 0.06, y1 + 0.06, 1.29, 0.03);
    }
  }
  side(CREAM, -5.05, 5.05, 2.86, 2.94, 1.29, 0.03);                   // thin band under the upper windows
  side(CREAM, -4.7, 3.9, 2.05, 2.76, 1.285, 0.03);                   // advert panel between decks
  [[-4.5, -2.0, '#0f1d4a'], [-1.7, 0.8, '#d4a548'], [1.1, 3.6, '#3f5a8a']].forEach(([x0, x1, c]) => {
    side(c, x0, x1, 2.15, 2.66, 1.3, 0.015);
    side(WHITE, x0 + 0.2, x1 - 0.2, 2.45, 2.52, 1.31, 0.01);
    side(WHITE, x0 + 0.5, x1 - 0.5, 2.28, 2.33, 1.31, 0.01);
  });
  for (const x of [-3.75, 3.75]) side(ARCH, x - 0.55, x + 0.55, 0.5, 1.1, 1.27, 0.03); // wheel arches
  side(FRAME, 4.39, 5.01, 0.36, 2.16, 1.285, 0.02);                  // front door
  side(GLASS, 4.45, 4.95, 1.05, 2.09, 1.297, 0.018);
  side(GLASS, 4.45, 4.95, 0.45, 0.97, 1.297, 0.018);
  side(RED, 4.68, 4.72, 0.98, 1.1, 1.31, 0.02);
  for (const z of [-1, 1]) {
    add(5.25, 2.3, z * 1.2, 0.04, 0.06, 0.2, DARK);                  // mirror arm
    add(5.25, 2.0, z * 1.29, 0.08, 0.4, 0.04, CHROME);               // mirror
  }
  // nose: windscreens, destination blind, grille, lamps, plate
  front(GLASS, 5.52, 0.016, 3.14, 3.86, -1.0, -0.08); front(GLASS, 5.52, 0.016, 3.14, 3.86, 0.08, 1.0);
  front(RED, 5.534, 0.02, 3.05, 3.95, -0.0225, 0.0225);
  front(GLASS, 5.52, 0.016, 1.37, 2.07, -0.95, 0.95);
  front(DARK, 5.53, 0.03, 3.97, 4.2, -0.75, 0.75);                    // destination blind box
  front(GLOW, 5.545, 0.015, 4.02, 4.15, -0.55, 0.55);                // lit text area
  front(CHROME, 5.52, 0.012, 0.96, 1.38, -0.48, 0.48);               // radiator surround
  front(CREAM, 5.525, 0.025, 1.0, 1.34, -0.42, 0.42);                // radiator badge area
  front(DARK, 5.54, 0.015, 1.04, 1.08, -0.36, 0.36); front(DARK, 5.54, 0.015, 1.26, 1.3, -0.36, 0.36);
  for (let i = -4; i <= 4; i++) if (i) front(DARK, 5.535, 0.01, 1.1, 1.24, i * 0.075 - 0.008, i * 0.075 + 0.008); // vertical slats
  front(GILT, 5.55, 0.025, 1.1, 1.22, -0.1, 0.1);                    // badge
  front(WHITE, 5.53, 0.03, 0.82, 0.96, -0.28, 0.28);                 // front number plate
  for (const z of [-1, 1]) {
    front(INDI, 5.53, 0.03, 0.88, 1.08, z * 1.12 - 0.09, z * 1.12 + 0.09);  // indicator
    rear(TAIL, 5.53, 0.03, 0.9, 1.2, z * 1.05 - 0.15, z * 1.05 + 0.15);     // tail-light
  }
  // open rear platform, grab pole, plate, rear window
  rear(DARK, 5.524, 0.024, 0.85, 2.1, -0.85, 0.85);
  rear(CHROME, 5.56, 0.045, 0.85, 2.2, -0.65, -0.6);
  rear(PLATE_Y, 5.53, 0.03, 2.25, 2.42, -0.32, 0.32);
  rear(GLASS, 5.52, 0.016, 3.14, 3.86, -0.8, 0.8);
  add(0, 4.6, 0, 9.6, 0.06, 2.0, RED); add(0, 4.66, 0, 8.0, 0.04, 1.2, RED); // stepped roof
  add(0, 0.36, 0, 10.35, 0.12, 2.43, FRAME);                         // skirt
  const body = buildMeshes(list, { glow: [GLOW, GLASS], glowK: { [GLASS]: 0.18 } }); // windows: warm cabin light at night
  // smooth glass: shared plain material instead of the triplanar-noise block material (same hex, same night cabin glow)
  const glassMat = new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.2, metalness: 0.3 });
  glassMat.userData.glow = true; glassMat.userData.glowK = 0.18; glassMat.userData.glowColor = WARM;
  body.traverse((o) => { if (o.material?.color?.getHexString() === GLASS.slice(1)) { o.material = glassMat; o.receiveShadow = false; } });
  bus.add(body);
  // round headlamps: chrome bezel + domed glowing lens (shared vehicle materials; night glow via userData.glow)
  const lampGeo = [bare(new THREE.TorusGeometry(0.19, 0.03, 6, 20).rotateY(Math.PI / 2)), bare(new THREE.SphereGeometry(0.16, 14, 8).scale(0.4, 1, 1))];
  for (const z of [-1, 1]) lampGeo.forEach((g, i) => { const m = new THREE.Mesh(g, fixed(i ? 'head' : 'chrome')); m.position.set(5.5, 0.97, z * 0.85); bus.add(m); });
  // Glasgow livery: same mesh, repaint. RED/FRAME instanced meshes get private material clones (world materials are shared by colour); grey panels are hidden in London.
  const paint = [bodyMaterial, ...[[RED, PURPLE], [FRAME, PURPLE_D]].flatMap(([from, to]) => {
    const ms = [];
    body.traverse((o) => {
      if (!o.isInstancedMesh || '#' + o.material.color.getHexString() !== from) return;
      const m = o.material, c = new THREE.MeshStandardMaterial({ color: from, map: m.map, roughness: m.roughness, metalness: 0 });
      c.onBeforeCompile = m.onBeforeCompile; c.userData = { ...m.userData }; o.material = c; ms.push(c);
    });
    return ms.map((m) => (m.userData.from = from, m.userData.to = to, m));
  })];
  const g = createBoxes();
  const gs = (x0, x1, y0, y1) => { for (const s of [1, -1]) g.add((x0 + x1) / 2, y0, s * 1.252, x1 - x0, y1 - y0, 0.02, GREY); }; // flank panel, outer face 1.262 (shell 1.25, glass 1.27)
  gs(-5, 5.1, 0.5, 1.12);                                                              // lower band
  [[2.0, 5.3, 1.12, 1.3], [2.6, 5.34, 1.3, 2.2], [3.2, 5.34, 2.2, 3.1], [3.8, 5.3, 3.1, 4.4]].forEach(([x0, x1, y0, y1]) => gs(x0, x1, y0, y1)); // stepped swoosh, front end grey
  g.add(5.5, 0.55, 0, 0.02, 3.8, 2.1, GREY);                                            // whole nose face, outer 5.51 (glass 5.52)
  const grey = buildMeshes(g.list); grey.visible = false; bus.add(grey);
  bodyMaterial.userData.from = RED; bodyMaterial.userData.to = PURPLE;
  bus.userData.setLivery = (glasgow) => { grey.visible = glasgow; for (const m of paint) m.color.set(glasgow ? m.userData.to : m.userData.from); };
  const wheels = [-3.75, 3.75].flatMap((x) => [-1.18, 1.18].map((z) => [x, 0.55, z]));
  addWheels(bus, new THREE.CylinderGeometry(0.55, 0.55, 0.22, 20).rotateX(Math.PI / 2), TYRE, wheels);
  const out = (dz) => wheels.map(([x, y, z]) => [x, y, Math.sign(z) * (1.29 + dz)]);
  addWheels(bus, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20).rotateX(Math.PI / 2), HUB, out(0));   // hub plate
  addWheels(bus, new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16).rotateX(Math.PI / 2), TYRE, out(0.01));  // dished centre
  addWheels(bus, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12).rotateX(Math.PI / 2), HUB, out(0.02));    // hub cap
  return bus;
}
