import * as THREE from 'three';

const material = (color) => new THREE.MeshLambertMaterial({ color });
const sphere = new THREE.SphereGeometry(1, 12, 8);
const capsule = (radius, length) => new THREE.CapsuleGeometry(radius, length, 3, 8);

export function buildFigure() {
  const figure = new THREE.Group();
  const shirt = material('#34363a'), sleeve = material('#3b3d41');
  const jeans = material('#353c46'), shoes = material('#51483f');
  const skin = material('#d5aa91');
  const add = (geometry, mat, position, scale, rotation = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.z = rotation;
    mesh.castShadow = mesh.receiveShadow = true;
    figure.add(mesh);
    return mesh;
  };

  // A relaxed stance keeps the feet on the ground while giving the torso a soft silhouette.
  add(capsule(0.36, 0.42), shirt, [0, 1.13, 0], [0.9, 0.72, 0.72]);
  add(capsule(0.14, 0.48), sleeve, [-0.39, 1.12, 0], [1, 1, 1], -0.08);
  add(capsule(0.14, 0.48), sleeve, [0.39, 1.12, 0], [1, 1, 1], 0.08);
  add(sphere, skin, [-0.42, 0.72, 0], [0.14, 0.15, 0.14]);
  add(sphere, skin, [0.42, 0.72, 0], [0.14, 0.15, 0.14]);
  add(capsule(0.14, 0.48), jeans, [-0.17, 0.43, 0], [1, 1, 1], -0.025);
  add(capsule(0.14, 0.48), jeans, [0.17, 0.43, 0], [1, 1, 1], 0.025);
  add(new THREE.CylinderGeometry(0.12, 0.13, 0.13, 12), skin, [0, 1.59, 0], [1, 1, 1]);
  add(sphere, shoes, [-0.18, 0.09, 0.08], [0.2, 0.1, 0.3]);
  add(sphere, shoes, [0.18, 0.09, 0.08], [0.2, 0.1, 0.3]);

  const tex = new THREE.TextureLoader().load('assets/avatar.png', (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 280;
    canvas.getContext('2d').drawImage(image.image, 75, 22, 270, 278, 0, 0, 280, 280);
    const cropped = new THREE.CanvasTexture(canvas);
    cropped.colorSpace = THREE.SRGBColorSpace;
    head.material.map = cropped;
    head.material.needsUpdate = true;
    image.dispose();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  head.scale.set(0.5, 0.5, 1);
  head.position.set(0, 1.9, 0);
  figure.add(head);
  return figure;
}
