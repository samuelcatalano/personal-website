import * as THREE from 'three';

// assets/memoji-wave.png is 204×512: the cut-out is scaled to human height, never enlarged for emphasis.
const HEIGHT = 2.2, WIDTH = HEIGHT * 204 / 512;

// The user's 3D Memoji (waving pose, cut from his character sheet) as a camera-facing billboard.
// It turns only around Y so it never tilts with the camera pitch, and its lit material dims at night with the scene.
export function buildFigure(onReady = () => {}) {
  const figure = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0, alphaTest: 0.5, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT).translate(0, HEIGHT / 2, 0), material); // feet at y = 0
  body.name = 'memoji';
  body.castShadow = false; // a cut-out plane casts a poor shadow; the soft disc below stands in for it
  const at = new THREE.Vector3();
  // three r169 calls onBeforeRender before computing modelViewMatrix, so the turn applies in this same frame.
  body.onBeforeRender = (renderer, scene, camera) => {
    figure.getWorldPosition(at);
    body.rotation.y = Math.atan2(camera.position.x - at.x, camera.position.z - at.z);
    body.updateMatrixWorld();
  };
  figure.add(body);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#3a352f', transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.name = 'memoji-shadow';
  shadow.position.y = 0.02;
  shadow.scale.x = 1.3;
  figure.add(shadow);

  new THREE.TextureLoader().load('assets/memoji-wave.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    material.map = texture;
    material.opacity = 1;
    material.needsUpdate = true;
    onReady();
  });
  return figure;
}
