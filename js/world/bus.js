import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
const RED = '#c9252b', GLASS = '#a9c5d3', FRAME = '#8f171d', TYRE = '#242629', HUB = '#a9a49a';
const GLOW = '#fff0b5', CREAM = '#e6dcc4', WHITE = '#f4f1ea', CHROME = '#c9c9c9', GILT = '#b39a64', PLATE_Y = '#f2c230';
const addWheels = (group, geometry, color, positions) => {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color }), positions.length);
  positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
};
// One data-driven voxel car. x = forward, y = up from the road, 1 unit = 1 m.
const DARK = '#1b1d21', BUMP = '#4a4d52', ARCH = '#08090a', TAIL = '#c4151c', INDI = '#e8892b';
export function car({ L, W, c, roof = c, hl, bl, ch, taxi, ring }) {
  const { add, list } = createBoxes(), e = L / 2, bx = e - 0.1, sx = [1, -1], sz = [1, -1];
  const xf = bx - hl, xr = -bx + bl, cl = xf - xr, cx = (xf + xr) / 2, top = 0.9 + ch;
  add(0, 0.2, 0, L - 0.2, 0.2, W - 0.2, DARK);                       // chassis skirt
  add(0, 0.4, 0, L - 0.2, 0.5, W, c);                                // lower body
  add((xf + bx) / 2, 0.9, 0, hl, 0.1, W - 0.1, c);                   // hood, below the cabin
  add((xr - bx) / 2, 0.9, 0, bl, 0.1, W - 0.1, c);                   // boot
  add(cx, 0.9, 0, cl - 0.1, ch - 0.02, W - 0.24, '#1d2630');                // glass, inset 0.06
  for (const x of [cx - cl / 2 + 0.07, cx + cl / 2 - 0.07, cx + cl * 0.05]) add(x, 0.9, 0, 0.14, ch, W - 0.12, ring ? DARK : c); // A/B/C pillars (black on the Mini)
  add(cx, top, 0, cl + 0.05, 0.1, W - 0.14, roof);                   // roof, narrower than the body
  if (taxi) add(cx + 0.4, top + 0.1, 0, 0.35, 0.14, 0.7, '#ffd36b'); // TAXI roof sign
  for (const s of sx) add(s * bx, 0.28, 0, 0.2, 0.28, W - 0.06, ring ? CHROME : BUMP); // bumpers
  add(e - 0.07, 0.6, 0, 0.08, 0.2, W - 0.9, DARK);                   // grille
  if (ring) {                                                        // Mini extras
    for (const y of [0.63, 0.69, 0.75]) add(e - 0.02, y, 0, 0.06, 0.03, W - 0.98, CHROME); // grille bars
    add(-e + 0.06, 0.62, 0, 0.08, 0.16, 0.44, '#f2c230');            // rear plate
  }
  for (const z of sz) {
    if (ring) {
      add(e - 0.01, 0.34, z * 0.62, 0.08, 0.08, 0.14, '#f2c230');    // fog light
      for (const x of [L * 0.3, -L * 0.3]) add(x, 0.6, z * (W / 2), 1.0, 0.22, 0.08, ARCH); // wheel-arch trim
      add(cx + cl * 0.05 + 0.25, 0.78, z * (W / 2 + 0.01), 0.14, 0.05, 0.05, CHROME); // door handle
    }
    const lz = z * (W / 2 - 0.3);
    if (ring) add(e - 0.08, 0.57, lz, 0.08, 0.3, 0.3, '#c9c9c9');    // chrome ring (Mini)
    add(e - 0.05, 0.62, lz, 0.1, ring ? 0.2 : 0.18, ring ? 0.2 : 0.3, GLOW);   // headlight
    add(-e + 0.07, 0.62, lz, 0.1, 0.2, 0.3, TAIL);                   // tail-light
    add(-e + 0.07, 0.83, lz, 0.1, 0.08, 0.3, INDI);                  // indicator
    add(cx + cl / 2, 1, z * (W / 2 + 0.04), 0.12, 0.1, 0.12, ring ? DARK : c); // mirror
    for (const x of [L * 0.3, -L * 0.3]) {
      add(x, 0.05, z * (W / 2 - 0.03), 0.84, 0.72, 0.1, ARCH);       // wheel arch
      add(x, 0, z * (W / 2 - 0.11), 0.6, 0.6, 0.24, TYRE);            // wheel, tucked in
      add(x, 0.2, z * (W / 2 + 0.02), 0.2, 0.2, 0.04, HUB);
    }
  }
  return buildMeshes(list, { glow: [GLOW] });
}
export const buildMini = () => car({ L: 3.6, W: 1.68, c: '#f4f1ea', roof: RED, hl: 0.55, bl: 0.3, ch: 0.55, ring: 1 });
export function buildBus() {
  const bus = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: RED });
  const { add, list } = createBoxes();
  const shape = new THREE.Shape();
  shape.moveTo(-5.08, 0.42);
  shape.lineTo(5.08, 0.42);
  shape.quadraticCurveTo(5.46, 0.42, 5.46, 0.8);
  shape.lineTo(5.46, 4.18);
  shape.quadraticCurveTo(5.46, 4.56, 5.08, 4.56);
  shape.lineTo(-5.08, 4.56);
  shape.quadraticCurveTo(-5.46, 4.56, -5.46, 4.18);
  shape.lineTo(-5.46, 0.8);
  shape.quadraticCurveTo(-5.46, 0.42, -5.08, 0.42);
  const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: 2.42, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4,
  }), bodyMaterial);
  shell.position.z = -1.21;
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
  front(CREAM, 5.525, 0.025, 1.0, 1.34, -0.42, 0.42);                // radiator badge area
  front(DARK, 5.54, 0.015, 1.04, 1.08, -0.36, 0.36); front(DARK, 5.54, 0.015, 1.26, 1.3, -0.36, 0.36);
  front(GILT, 5.55, 0.025, 1.1, 1.22, -0.1, 0.1);                    // badge
  front(WHITE, 5.53, 0.03, 0.82, 0.96, -0.28, 0.28);                 // front number plate
  for (const z of [-1, 1]) {
    front(CREAM, 5.52, 0.02, 0.82, 1.12, z * 0.85 - 0.17, z * 0.85 + 0.17);   // headlight ring
    front(GLOW, 5.535, 0.015, 0.87, 1.07, z * 0.85 - 0.12, z * 0.85 + 0.12); // headlight
    front(INDI, 5.53, 0.03, 0.88, 1.08, z * 1.12 - 0.09, z * 1.12 + 0.09);  // indicator
    rear(TAIL, 5.53, 0.03, 0.9, 1.2, z * 1.05 - 0.15, z * 1.05 + 0.15);     // tail-light
  }
  // open rear platform, grab pole, plate, rear window
  rear(DARK, 5.524, 0.024, 0.85, 2.1, -0.85, 0.85);
  rear(CHROME, 5.545, 0.045, 0.85, 2.2, -0.65, -0.6);
  rear(PLATE_Y, 5.53, 0.03, 2.25, 2.42, -0.32, 0.32);
  rear(GLASS, 5.52, 0.016, 3.14, 3.86, -0.8, 0.8);
  add(0, 4.6, 0, 9.6, 0.06, 2.0, RED); add(0, 4.66, 0, 8.0, 0.04, 1.2, RED); // stepped roof
  add(0, 0.36, 0, 10.35, 0.12, 2.43, FRAME);                         // skirt
  bus.add(buildMeshes(list, { glow: [GLOW] }));
  const wheels = [-3.75, 3.75].flatMap((x) => [-1.18, 1.18].map((z) => [x, 0.55, z]));
  addWheels(bus, new THREE.CylinderGeometry(0.55, 0.55, 0.22, 20).rotateX(Math.PI / 2), TYRE, wheels);
  addWheels(bus, new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16).rotateX(Math.PI / 2), HUB, wheels.map(([x, y, z]) => [x, y, Math.sign(z) * 1.29]));
  return bus;
}
