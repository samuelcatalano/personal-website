import * as THREE from 'three';
// Additive light pools under street lamps: one InstancedMesh, opacity follows night.
export function createLampPools(scene, lamps, size = 4) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat, lamps.length), m = new THREE.Matrix4();
  lamps.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0.08, z)));
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  scene.add(mesh);
  return { update(night) { mat.opacity = night * 0.7; mesh.visible = night > 0.01; } };
}
