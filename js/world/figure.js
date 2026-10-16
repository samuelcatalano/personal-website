import * as THREE from 'three';

const material = (color) => new THREE.MeshLambertMaterial({ color });
const sphere = new THREE.SphereGeometry(1, 20, 14);
const capsule = (radius, length) => new THREE.CapsuleGeometry(radius, length, 4, 10);

export function buildFigure(onReady = () => {}) {
  const figure = new THREE.Group();
  const shirt = material('#222326'), sleeve = material('#292a2d');
  const jeans = material('#353c46'), shoes = material('#51483f');
  const skin = material('#e2b49b'), hair = material('#171719');
  const add = (geometry, mat, position, scale = [1, 1, 1], rotation = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.z = rotation;
    mesh.castShadow = position[1] < 1.5;
    mesh.receiveShadow = true;
    figure.add(mesh);
    return mesh;
  };

  // Rounded tee with short sleeves and exposed forearms.
  add(capsule(0.36, 0.32), shirt, [0, 1.04, 0], [0.95, 0.8, 0.56]);
  add(capsule(0.14, 0.16), sleeve, [-0.39, 1.28, 0], [1, 1, 1], -0.12);
  add(capsule(0.14, 0.16), sleeve, [0.39, 1.28, 0], [1, 1, 1], 0.12);
  add(capsule(0.105, 0.3), skin, [-0.43, 1.08, 0], [1, 1, 1], -0.08);
  add(capsule(0.105, 0.3), skin, [0.43, 1.08, 0], [1, 1, 1], 0.08);
  add(sphere, skin, [-0.43, 0.84, 0], [0.13, 0.14, 0.13]);
  add(sphere, skin, [0.43, 0.84, 0], [0.13, 0.14, 0.13]);
  add(capsule(0.15, 0.5), jeans, [-0.17, 0.42, 0], [1, 1, 1], -0.025);
  add(capsule(0.15, 0.5), jeans, [0.17, 0.42, 0], [1, 1, 1], 0.025);
  add(sphere, shoes, [-0.18, 0.09, 0.08], [0.2, 0.1, 0.3]);
  add(sphere, shoes, [0.18, 0.09, 0.08], [0.2, 0.1, 0.3]);

  // The existing Memoji supplies the expression; the dark ellipsoid gives it depth.
  add(capsule(0.12, 0.12), skin, [0, 1.48, -0.04]);
  add(sphere, hair, [0, 1.84, 0], [0.37, 0.34, 0.34]).name = 'head';
  const faceGeometry = new THREE.SphereGeometry(1, 32, 24, 0, Math.PI);
  const uv = faceGeometry.getAttribute('uv'), vertices = faceGeometry.getAttribute('position');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (vertices.getX(i) + 1) / 2, (vertices.getY(i) + 1) / 2);
  }
  uv.needsUpdate = true;
  const face = add(faceGeometry, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, alphaTest: 0.04, side: THREE.DoubleSide }), [0, 1.84, 0], [0.375, 0.35, 0.35]);
  face.name = 'face';
  new THREE.TextureLoader().load('assets/avatar.png', (loaded) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 280;
    canvas.getContext('2d').drawImage(loaded.image, 75, 18, 270, 282, 0, 0, 280, 280);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    face.material.map = texture;
    face.material.opacity = 1;
    face.material.needsUpdate = true;
    loaded.dispose();
    onReady();
  });
  return figure;
}
