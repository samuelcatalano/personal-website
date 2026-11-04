import * as THREE from 'three';
import { loadReferenceNpcAssets } from './reference-npc.js';
const HEIGHT = 2.2, WIDTH = HEIGHT * 204 / 512;
const LOAD_WITHIN = 400; // metres: far enough that the swap from the Memoji happens out of sight.
const RENDER_WITHIN = 200;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOOK_CHAIN = [['spine_03', .2], ['neck_01', .3], ['head', .5]]; // Shared along the spine, so the neck does not twist alone.

// Night scheme without scene lights, which would recompile every material in the city:
// a soft fill from the character's own colours, and a warm pool on the ground to silhouette the black clothes.
function lightCharacter(root, figure) {
  const materials = [];
  root.traverse((mesh) => {
    if (mesh.name === 'ReferenceEyes') {
      // At this distance an eye covers about one pixel: white sclera and dark iris fight for it and flicker.
      // ponytail: always the steady dark eye; bring the detailed colours back if the camera ever gets close.
      Object.assign(mesh.material, { vertexColors: false, clearcoat: 0, roughness: .85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, needsUpdate: true });
      mesh.material.color.set('#1c1411');
      return;
    }
    if (!mesh.isMesh) return;
    Object.assign(mesh.material, { emissiveMap: mesh.material.map, needsUpdate: true });
    mesh.material.emissive.set(0xffffff);
    materials.push(mesh.material);
  });
  const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  const paint = canvas.getContext('2d'), gradient = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(1, '#000');
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, 64, 64);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), color: '#ffc98a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pool.position.y = 0.03;
  figure.add(pool);
  return {
    set(night) {
      materials.forEach((material) => { material.emissiveIntensity = .04 + night * .18; });
      pool.material.opacity = night * .4;
      pool.visible = night > .01;
    },
    dispose() {
      pool.removeFromParent();
      pool.geometry.dispose();
      pool.material.map.dispose();
      pool.material.dispose();
    },
  };
}

export function buildFigure(onReady = () => {}, { reducedMotion = false } = {}) {
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
  // The Memoji is only the backup: it is not fetched or drawn unless the character fails to load.
  body.visible = false;
  shadow.visible = false;
  const showMemoji = () => {
    body.visible = true;
    shadow.visible = true;
    new THREE.TextureLoader().load('assets/memoji-wave.png', (texture) => {
      Object.assign(texture, { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
      Object.assign(material, { map: texture, emissiveMap: texture, opacity: 1, needsUpdate: true }); // self-lit: keeps the Memoji's own colours
      onReady();
    });
  };
  figure.userData.showMemoji = showMemoji;

  let requested = false, closed = false, library = null, actor = null, light = null, lookChain = [], lookYaw = 0, lookUp = 0;
  const parentTurn = new THREE.Quaternion(), turn = new THREE.Quaternion(), tilt = new THREE.Quaternion(), side = new THREE.Vector3();
  figure.userData.update = (dt, camera, night = 0) => {
    figure.getWorldPosition(at);
    const dx = camera.position.x - at.x, dz = camera.position.z - at.z, distance = Math.hypot(dx, dz);
    if (!requested && distance < LOAD_WITHIN) {
      requested = true;
      // ponytail: one character, always LOD0; add LODs back if a low-end device struggles with 28k triangles.
      loadReferenceNpcAssets({ levels: [0] }).then((assets) => {
        if (closed) { assets.dispose(); return; }
        library = assets;
        actor = assets.create();
        actor.setSpeed(0);
        actor.wave();
        actor.mixer.update(reducedMotion ? 1.3 : .3); // Reduced motion holds the raised hand; otherwise just ends the blend.
        actor.root.scale.setScalar(HEIGHT / actor.height); // Same presence as the Memoji it replaces.
        actor.root.rotation.y = figure.userData.facing ?? Math.atan2(dx, dz);
        // A real sun shadow follows the silhouette and the wave; phones render no shadow maps, so they keep the disc.
        actor.root.traverse((mesh) => { if (mesh.isMesh) mesh.castShadow = mesh.name !== 'ReferenceEyes'; });
        shadow.visible = innerWidth < 768;
        figure.add(actor.root);
        light = lightCharacter(actor.root, figure);
        lookChain = LOOK_CHAIN.map(([name, share]) => {
          const bone = actor.root.getObjectByName(name);
          return { bone, share, rest: bone.quaternion.clone() };
        });
        onReady();
      }).catch((error) => {
        console.warn('Reference character unavailable; showing the Memoji', error);
        if (!closed) showMemoji();
      });
    }
    if (!actor) return;
    light.set(night);
    actor.root.visible = distance < RENDER_WITHIN;
    if (!actor.root.visible) return;
    if (reducedMotion) lookChain.forEach(({ bone, rest }) => bone.quaternion.copy(rest));
    else actor.mixer.update(dt);
    // Eye contact with the viewer: the look is rebuilt after each mixer update, on top of the animation.
    const yaw = actor.root.rotation.y, away = Math.atan2(dx, dz) - yaw, ease = reducedMotion ? 1 : Math.min(1, 4 * dt);
    lookYaw += (THREE.MathUtils.clamp(Math.atan2(Math.sin(away), Math.cos(away)), -.9, .9) - lookYaw) * ease;
    lookUp += (THREE.MathUtils.clamp(Math.atan2(camera.position.y - HEIGHT * .93, distance), -.2, .6) - lookUp) * ease;
    side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const { bone, share } of lookChain) {
      bone.parent.getWorldQuaternion(parentTurn);
      turn.setFromAxisAngle(WORLD_UP, lookYaw * share).multiply(tilt.setFromAxisAngle(side, -lookUp * share));
      bone.quaternion.premultiply(parentTurn.clone().invert().multiply(turn).multiply(parentTurn));
    }
  };
  figure.userData.dispose = () => {
    closed = true;
    actor?.dispose();
    library?.dispose();
    light?.dispose();
  };
  return figure;
}
