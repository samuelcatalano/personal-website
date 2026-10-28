import * as THREE from 'three';
// Additive light pools under street lamps: one InstancedMesh, opacity follows night.
export function createLampPools(scene, lamps, size = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  // ponytail: smooth cosine-like falloff (many stops) so the pool has no visible rim and neighbours blend additively.
  for (let i = 0; i <= 8; i++) { const t = i / 8, f = (0.5 + 0.5 * Math.cos(Math.PI * t)) ** 1.6; gr.addColorStop(t, `rgba(255,${Math.round(214 - 14 * t)},${Math.round(150 - 30 * t)},${(0.85 * f).toFixed(3)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const mat = new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat, lamps.length), m = new THREE.Matrix4();
  lamps.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0.08, z)));
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  scene.add(mesh);
  let lastWet=-1;
  return { update(night, wet = 0) {
    if(Math.abs(wet-lastWet)>.005){
      const spread=1+wet*.35;
      lamps.forEach(([x,z],i)=>{m.makeScale(spread,1,spread).setPosition(x,.08,z);mesh.setMatrixAt(i,m);});
      mesh.instanceMatrix.needsUpdate=true;lastWet=wet;
    }
    mat.opacity = night * (0.6 + wet*.12); mesh.visible = night > 0.01;
  } };
}
