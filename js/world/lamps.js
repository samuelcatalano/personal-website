import * as THREE from 'three';
// Additive light pools under street lamps: one InstancedMesh, opacity follows night.
export function createLampPools(scene, lamps, size = 10) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Inverse-square-like falloff, windowed to 0 at the rim: bright core under the lantern, long soft skirt, no visible disc edge.
  for (let i = 0; i <= 12; i++) { const t = i / 12, f = Math.max(0, (1 / (1 + (t * 4) ** 2) - 1 / 17) / (1 - 1 / 17)); gr.addColorStop(t, `rgba(255,${Math.round(206 - 30 * t)},${Math.round(140 - 40 * t)},${(0.7 * f).toFixed(3)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const mat = new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, opacity: 0, fog: false });
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
    mat.opacity = night * (0.5 + wet*.12); mesh.visible = night > 0.01;
  } };
}
