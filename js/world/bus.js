import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
const RED = '#c9252b', GLASS = '#a9c5d3', FRAME = '#8f171d', TYRE = '#242629', HUB = '#a9a49a';
const WARM = new THREE.Color('#ffc865'), GLOW = '#fff0b5', CREAM = '#e6dcc4', WHITE = '#f4f1ea', CHROME = '#c9c9c9', GILT = '#b39a64', PLATE_Y = '#f2c230';
const addWheels = (group, geometry, color, positions) => {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color }), positions.length);
  positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
};
// One data-driven voxel car. x = forward, y = up from the road, 1 unit = 1 m.
const DARK = '#1b1d21', BUMP = '#4a4d52', ARCH = '#08090a', TAIL = '#c4151c', INDI = '#e8892b';
export function car({ L, W, c, roof = c, hl, bl, ch, taxi }) {
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
    add(e - 0.05, 0.62, lz, 0.1, 0.18, 0.3, GLOW);                   // headlight
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
// Mini Cooper, hand-built. x forward, z right (driver on +z), y up, 1 unit = 1 m. Outer faces sit >= 0.03 proud of what they cover.
export function buildMini() {
  const { add, list } = createBoxes();
  const WHITE_ = '#f4f1ea', PANE = '#2c3d4a', SEAT = '#454a52', TRIM = '#23262b', ALLOY = '#b9bec4', YEL = '#f2c230';
  const box = (c, x0, x1, y0, y1, z0, z1) => add((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c);
  const side = (c, x0, x1, y0, y1, zo, t) => { box(c, x0, x1, y0, y1, zo - t, zo); box(c, x0, x1, y0, y1, -zo, -zo + t); };
  const sym = (c, x0, x1, y0, y1, za, zb) => za ? (box(c, x0, x1, y0, y1, za, zb), box(c, x0, x1, y0, y1, -zb, -za)) : box(c, x0, x1, y0, y1, -zb, zb);
  const nose = (c, xo, t, y0, y1, za, zb) => sym(c, xo - t, xo, y0, y1, za, zb);      // front, outer face at +xo
  const tail = (c, xo, t, y0, y1, za, zb) => sym(c, -xo, -xo + t, y0, y1, za, zb);    // rear, outer face at -xo
  // body: sill, lower body, stepped rounded ends, bonnet and boot
  box(DARK, -1.6, 1.6, 0.2, 0.4, -0.78, 0.78);
  box(WHITE_, -1.66, 1.66, 0.4, 0.9, -0.84, 0.84);
  nose(WHITE_, 1.72, 0.06, 0.44, 0.88, 0, 0.78); tail(WHITE_, 1.72, 0.06, 0.44, 0.88, 0, 0.78);
  box(WHITE_, 0.62, 1.72, 0.9, 1.0, -0.78, 0.78);                     // bonnet
  box(WHITE_, 1.0, 1.7, 0.9, 1.0, -0.84, 0.84);                       // wing shoulders
  box(WHITE_, -1.72, -1.05, 0.9, 1.0, -0.78, 0.78);                   // boot lid
  side(DARK, -0.5, 0.5, 0.4, 0.5, 0.87, 0.03);                        // sill
  box(DARK, 0.7, 1.62, 1.0, 1.03, -0.64, -0.6); box(DARK, 0.7, 1.62, 1.0, 1.03, 0.6, 0.64); // clamshell lines
  box(CHROME, 0.9, 1.65, 1.0, 1.03, -0.03, 0.03);                     // bonnet chrome strip
  box(RED, 0.7, 1.62, 1.0, 1.03, -0.26, -0.14); box(RED, 0.7, 1.62, 1.0, 1.03, 0.14, 0.26); // bonnet stripes
 
  // roof: stepped eaves + crown
  box(RED, -1.14, 0.7, 1.45, 1.5, -0.8, 0.8); box(RED, -1.08, 0.62, 1.5, 1.55, -0.7, 0.7);
  // glass + black rubber pillars; side panes start above the door cards so seats show below
  side(PANE, -0.18, 0.52, 1.12, 1.42, 0.72, 0.03); side(PANE, -0.98, -0.32, 1.12, 1.42, 0.72, 0.03);
  box(PANE, 0.58, 0.63, 0.98, 1.2, -0.62, 0.62); box(PANE, 0.54, 0.59, 1.2, 1.43, -0.62, 0.62);   // windscreen, stepped rake
  box(PANE, -1.12, -1.07, 0.98, 1.2, -0.62, 0.62); box(PANE, -1.07, -1.02, 1.2, 1.43, -0.62, 0.62); // rear window
  for (const [x0, x1] of [[0.52, 0.66], [-0.32, -0.18], [-1.12, -0.98]]) side(DARK, x0, x1, 0.9, 1.45, 0.76, 0.14);
  side(CHROME, -0.98, 0.52, 1.08, 1.12, 0.8, 0.04);                   // chrome window surround, bottom
  side(CHROME, -1.1, 0.6, 1.42, 1.45, 0.8, 0.04);                     // drip rail
  side(CHROME, -1.15, 0.7, 0.9, 0.93, 0.82, 0.06);                    // belt line
  // interior hint
  box(TRIM, -1.05, 0.58, 0.9, 0.92, -0.7, 0.7);                       // floor
  box(TRIM, 0.45, 0.58, 0.92, 1.1, -0.7, 0.7);                        // dashboard
  box(TRIM, 0.36, 0.42, 1.0, 1.14, 0.28, 0.5);                        // steering wheel (driver on +z)
  for (const z of [-0.36, 0.36]) {
    box(SEAT, 0.0, 0.4, 0.92, 1.0, z - 0.2, z + 0.2); box(SEAT, -0.22, -0.1, 0.92, 1.34, z - 0.2, z + 0.2); box(SEAT, -0.2, -0.12, 1.34, 1.44, z - 0.1, z + 0.1); // seat, back, headrest
  }
  box(SEAT, -0.9, -0.5, 0.92, 1.0, -0.62, 0.62); box(SEAT, -0.95, -0.82, 0.92, 1.3, -0.62, 0.62); // rear bench
  // doors: seams, handles, side repeater, mirrors
  for (const x of [0.54, -0.54]) side(DARK, x - 0.01, x + 0.01, 0.42, 0.9, 0.87, 0.03);
  side(CHROME, -0.5, -0.36, 0.78, 0.83, 0.9, 0.06);
  side(INDI, 1.2, 1.3, 0.82, 0.88, 0.9, 0.06);
  for (const z of [-1, 1]) {
    box(DARK, 0.5, 0.58, 1.02, 1.1, z * 0.76 - 0.06, z * 0.76 + 0.06);   // mirror stalk
    box(DARK, 0.47, 0.57, 1.0, 1.12, z > 0 ? 0.82 : -0.93, z > 0 ? 0.93 : -0.82);
  }
  // nose: grille with chrome surround, badge, round headlights, indicators, bumper, fog lights, plate
  nose(DARK, 1.75, 0.03, 0.6, 0.82, 0, 0.36);
  for (const y of [0.64, 0.7, 0.76]) nose(CHROME, 1.78, 0.03, y, y + 0.025, 0, 0.36);
  nose(CHROME, 1.78, 0.06, 0.56, 0.6, 0, 0.4); nose(CHROME, 1.78, 0.06, 0.82, 0.86, 0, 0.4); nose(CHROME, 1.78, 0.06, 0.6, 0.82, 0.36, 0.4);
  nose(GILT, 1.75, 0.03, 0.92, 0.98, 0, 0.14);                        // badge on the bonnet nose
  for (const z of [-0.62, 0.62]) {
    const a = z - 0.15, b = z + 0.15;
    box(CHROME, 1.72, 1.76, 0.72, 0.9, z - 0.12 * 1, z + 0.12); box(CHROME, 1.72, 1.76, 0.66, 0.96, z - 0.09, z + 0.09); box(CHROME, 1.72, 1.76, 0.69, 0.93, a, b); // bezel (octagon)
    box(GLOW, 1.75, 1.79, 0.73, 0.89, z - 0.08, z + 0.08);            // lens
    box(GLOW, 1.75, 1.79, 0.71, 0.91, z - 0.05, z + 0.05);
    box(INDI, 1.72, 1.76, 0.52, 0.62, z - 0.05 + Math.sign(z) * 0.12, z + 0.05 + Math.sign(z) * 0.12); // indicator
    box(YEL, 1.72, 1.79, 0.34, 0.44, Math.sign(z) * 0.5 - 0.07, Math.sign(z) * 0.5 + 0.07); // fog light
  }
  nose(CHROME, 1.76, 0.12, 0.3, 0.5, 0, 0.8);                        // bumper
  nose(WHITE_, 1.79, 0.03, 0.32, 0.46, 0, 0.2);                       // front plate + text
  nose(DARK, 1.805, 0.015, 0.37, 0.41, 0, 0.15);
  // tail: vertical lamps, badge, plate, bumper, exhaust
  tail(TAIL, 1.76, 0.04, 0.52, 0.88, 0.66, 0.76); tail(INDI, 1.79, 0.03, 0.78, 0.86, 0.66, 0.76);
  tail(CHROME, 1.75, 0.03, 0.76, 0.84, 0, 0.07);                      // rear badge
  tail(YEL, 1.755, 0.035, 0.56, 0.72, 0, 0.22); tail(DARK, 1.785, 0.03, 0.62, 0.66, 0, 0.17);
  tail(CHROME, 1.76, 0.12, 0.3, 0.5, 0, 0.8);
  box('#8a8e94', -1.74, -1.58, 0.22, 0.3, 0.42, 0.5); box(DARK, -1.8, -1.74, 0.23, 0.29, 0.43, 0.49); // exhaust
  // wheels: arch flares, tyres (octagon), alloy rim, spokes, hub
  for (const x of [1.08, -1.08]) for (const z of [-1, 1]) {
    const w = (c, hx, hy, y0, zo, t) => box(c, x - hx, x + hx, y0 - hy, y0 + hy, z > 0 ? zo - t : -zo, z > 0 ? zo : -zo + t);
    w(ARCH, 0.42, 0.36, 0.41, 0.86, 0.03);                            // arch hole
    w(ARCH, 0.5, 0.09, 0.71, 0.9, 0.06);                              // flare
    w(TYRE, 0.3, 0.18, 0.3, 0.87, 0.22); w(TYRE, 0.18, 0.3, 0.3, 0.87, 0.22); w(TYRE, 0.25, 0.25, 0.3, 0.87, 0.22);
    w(ALLOY, 0.18, 0.12, 0.3, 0.9, 0.04); w(ALLOY, 0.12, 0.18, 0.3, 0.9, 0.04);
    w(DARK, 0.17, 0.02, 0.3, 0.93, 0.03); w(DARK, 0.02, 0.17, 0.3, 0.93, 0.03);   // spokes
    w(TRIM, 0.05, 0.05, 0.3, 0.95, 0.08);                             // hub
  }
  return buildMeshes(list, { glow: [GLOW] });
}
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
  rear(CHROME, 5.56, 0.045, 0.85, 2.2, -0.65, -0.6);
  rear(PLATE_Y, 5.53, 0.03, 2.25, 2.42, -0.32, 0.32);
  rear(GLASS, 5.52, 0.016, 3.14, 3.86, -0.8, 0.8);
  add(0, 4.6, 0, 9.6, 0.06, 2.0, RED); add(0, 4.66, 0, 8.0, 0.04, 1.2, RED); // stepped roof
  add(0, 0.36, 0, 10.35, 0.12, 2.43, FRAME);                         // skirt
  const body = buildMeshes(list, { glow: [GLOW, GLASS], glowK: { [GLASS]: 0.18 } }); // windows: warm cabin light at night
  body.traverse((o) => { if (o.material?.color?.getHexString() === GLASS.slice(1)) o.material.userData.glowColor = WARM; });
  bus.add(body);
  const wheels = [-3.75, 3.75].flatMap((x) => [-1.18, 1.18].map((z) => [x, 0.55, z]));
  addWheels(bus, new THREE.CylinderGeometry(0.55, 0.55, 0.22, 20).rotateX(Math.PI / 2), TYRE, wheels);
  addWheels(bus, new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16).rotateX(Math.PI / 2), HUB, wheels.map(([x, y, z]) => [x, y, Math.sign(z) * 1.29]));
  return bus;
}
