import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';

const RED = '#c9252b', GLASS = '#a9c5d3', FRAME = '#8f171d', TYRE = '#242629', HUB = '#a9a49a';
const GLOW = '#fff0b5';

export function buildBus({ avatar: withAvatar = true } = {}) {
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

  // buildMeshes anchors boxes at their base Y, so convert these visual centres once here.
  const addBox = (color, x, y, z, w, h, d) => add(x, y - h / 2, z, w, h, d, color);
  // Recessed glass panels leave a narrow body-colour frame around each opening.
  for (const z of [-1.262, 1.262]) {
    const side = Math.sign(z);
    for (const y of [1.53, 3.5]) for (let i = 0; i < 7; i++) {
      const x = -4.35 + i * 1.32;
      addBox(GLASS, x, y, z, 1.02, 0.72, 0.016);
      if (i < 6) addBox(RED, x + 0.59, y, z + side * 0.011, 0.055, 0.76, 0.018);
    }
    // Front-side entry door and its two glass panes.
    addBox(FRAME, 4.62, 1.26, z + side * 0.013, 0.74, 1.8, 0.02);
    addBox(GLASS, 4.62, 1.57, z + side * 0.026, 0.58, 1.04, 0.018);
    addBox(GLASS, 4.62, 0.71, z + side * 0.026, 0.58, 0.52, 0.018);
    addBox(RED, 4.62, 1.04, z + side * 0.04, 0.035, 0.12, 0.02);
  }
  // Front windscreen is split by a slim centre mullion.
  addBox(GLASS, 5.512, 3.5, -0.53, 0.016, 0.86, 0.9);
  addBox(GLASS, 5.512, 3.5, 0.53, 0.016, 0.86, 0.9);
  addBox(GLASS, 5.512, 1.72, 0, 0.016, 0.7, 1.9);
  addBox(RED, 5.524, 3.5, 0, 0.02, 0.9, 0.045);

  // Thin lower trim adds a restrained break between body and road.
  addBox(FRAME, 0, 0.48, 0, 10.35, 0.12, 2.43);
  for (const z of [-0.82, 0.82]) {
    addBox(GLOW, 5.505, 0.72, z, 0.025, 0.22, 0.3);
    addBox(GLOW, -5.505, 0.72, z, 0.025, 0.2, 0.28);
  }

  const details = buildMeshes(list, { glow: [GLOW] });
  bus.add(details);
  const addWheels = (geometry, color, positions) => {
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
    positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    bus.add(mesh);
    return mesh;
  };
  const wheels = [], hubs = [];
  for (const x of [-3.75, 3.75]) for (const z of [-1.18, 1.18]) {
    wheels.push([x, 0.55, z]);
    hubs.push([x, 0.55, Math.sign(z) * 1.29]);
  }
  const wheelGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.22, 20).rotateX(Math.PI / 2);
  const hubGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16).rotateX(Math.PI / 2);
  addWheels(wheelGeometry, TYRE, wheels);
  addWheels(hubGeometry, HUB, hubs);

  if (withAvatar) {
    const tex = new THREE.TextureLoader().load('assets/avatar.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    const avatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    avatar.scale.set(0.5, 0.5, 1);
    avatar.position.set(5.56, 3.5, -0.5);
    bus.add(avatar);
  }
  return bus;
}
