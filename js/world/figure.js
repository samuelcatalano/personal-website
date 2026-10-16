import * as THREE from 'three';
const HEIGHT = 2.2, WIDTH = HEIGHT * 204 / 512;
export function buildFigure(onReady = () => {}) {
  const figure = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0, alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.55 });
  const body = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT).translate(0, HEIGHT / 2, 0), material);
  body.name = 'memoji';
  const at = new THREE.Vector3();
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
    Object.assign(texture, { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
    Object.assign(material, { map: texture, emissiveMap: texture, opacity: 1, needsUpdate: true }); // self-lit: keeps the Memoji's own colours
    onReady();
  });
  return figure;
}
