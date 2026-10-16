import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
const RED = '#c9252b', GLASS = '#a9c5d3', FRAME = '#8f171d', TYRE = '#242629', HUB = '#a9a49a';
const GLOW = '#fff0b5';
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
  for (const x of [cx - cl / 2 + 0.07, cx + cl / 2 - 0.07, cx + cl * 0.05]) add(x, 0.9, 0, 0.14, ch, W - 0.12, c); // A/B/C pillars
  add(cx, top, 0, cl + 0.05, 0.1, W - 0.14, roof);                   // roof, narrower than the body
  if (taxi) add(cx + 0.4, top + 0.1, 0, 0.35, 0.14, 0.7, '#ffd36b'); // TAXI roof sign
  for (const s of sx) add(s * bx, 0.28, 0, 0.2, 0.28, W - 0.06, BUMP); // bumpers
  add(e - 0.07, 0.6, 0, 0.08, 0.2, W - 0.9, DARK);                   // grille
  for (const z of sz) {
    const lz = z * (W / 2 - 0.3);
    if (ring) add(e - 0.08, 0.57, lz, 0.08, 0.3, 0.3, '#c9c9c9');    // chrome ring (Mini)
    add(e - 0.05, 0.62, lz, 0.1, ring ? 0.2 : 0.18, ring ? 0.2 : 0.3, GLOW);   // headlight
    add(-e + 0.07, 0.62, lz, 0.1, 0.2, 0.3, TAIL);                   // tail-light
    add(-e + 0.07, 0.83, lz, 0.1, 0.08, 0.3, INDI);                  // indicator
    add(cx + cl / 2, 1, z * (W / 2 + 0.04), 0.12, 0.1, 0.12, c);      // mirror
    for (const x of [L * 0.3, -L * 0.3]) {
      add(x, 0.05, z * (W / 2 - 0.03), 0.84, 0.72, 0.1, ARCH);       // wheel arch
      add(x, 0, z * (W / 2 - 0.11), 0.6, 0.6, 0.24, TYRE);            // wheel, tucked in
      add(x, 0.2, z * (W / 2 + 0.02), 0.2, 0.2, 0.04, HUB);
    }
  }
  return buildMeshes(list, { glow: [GLOW] });
}
export const buildMini = () => car({ L: 3.9, W: 1.68, c: '#f4f1ea', roof: RED, hl: 0.6, bl: 0.35, ch: 0.55, ring: 1 });
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
  const addBox = (color, x, y, z, w, h, d) => add(x, y - h / 2, z, w, h, d, color);
  for (const z of [-1.262, 1.262]) {
    const side = Math.sign(z);
    for (const y of [1.53, 3.5]) for (let i = 0; i < 7; i++) {
      const x = -4.35 + i * 1.32;
      addBox(GLASS, x, y, z, 1.02, 0.72, 0.016);
      if (i < 6) addBox(RED, x + 0.59, y, z + side * 0.011, 0.055, 0.76, 0.018);
    }
    addBox(FRAME, 4.62, 1.26, z + side * 0.013, 0.74, 1.8, 0.02);
    addBox(GLASS, 4.62, 1.57, z + side * 0.026, 0.58, 1.04, 0.018);
    addBox(GLASS, 4.62, 0.71, z + side * 0.026, 0.58, 0.52, 0.018);
    addBox(RED, 4.62, 1.04, z + side * 0.04, 0.035, 0.12, 0.02);
  }
  addBox(GLASS, 5.512, 3.5, -0.53, 0.016, 0.86, 0.9);
  addBox(GLASS, 5.512, 3.5, 0.53, 0.016, 0.86, 0.9);
  addBox(GLASS, 5.512, 1.72, 0, 0.016, 0.7, 1.9);
  addBox(RED, 5.524, 3.5, 0, 0.02, 0.9, 0.045);
  addBox(FRAME, 0, 0.48, 0, 10.35, 0.12, 2.43);
  for (const z of [-0.82, 0.82]) {
    addBox(GLOW, 5.505, 0.72, z, 0.025, 0.22, 0.3);
    addBox(GLOW, -5.505, 0.72, z, 0.025, 0.2, 0.28);
  }
  bus.add(buildMeshes(list, { glow: [GLOW] }));
  const wheels = [-3.75, 3.75].flatMap((x) => [-1.18, 1.18].map((z) => [x, 0.55, z]));
  addWheels(bus, new THREE.CylinderGeometry(0.55, 0.55, 0.22, 20).rotateX(Math.PI / 2), TYRE, wheels);
  addWheels(bus, new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16).rotateX(Math.PI / 2), HUB, wheels.map(([x, y, z]) => [x, y, Math.sign(z) * 1.29]));
  return bus;
}
