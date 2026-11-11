import * as THREE from 'three';
import { allLampSpots } from './street-lamp.js';
// Additive light pools under street lamps: one InstancedMesh, opacity follows night.
export function createLampPools(scene, streetLamps, size = 10, shopFronts = [], registered = true) {
  const seen = new Set(), lamps = [...streetLamps, ...(registered ? allLampSpots() : [])].filter(([x, z]) => { const k = `${Math.round(x * 4)},${Math.round(z * 4)}`; return !seen.has(k) && seen.add(k); }); // park and Glasgow lamps get a pool too
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Inverse-square-like falloff, windowed to 0 at the rim: bright core under the lantern, long soft skirt, no visible disc edge.
  for (let i = 0; i <= 12; i++) { const t = i / 12, f = Math.max(0, (1 / (1 + (t * 4) ** 2) - 1 / 17) / (1 - 1 / 17)); gr.addColorStop(t, `rgba(255,${Math.round(206 - 30 * t)},${Math.round(140 - 40 * t)},${(0.7 * f).toFixed(3)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const mat = new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, opacity: 0, fog: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat, lamps.length), m = new THREE.Matrix4();
  lamps.forEach(([x, z, s = 1, y = 0.08], i) => mesh.setMatrixAt(i, m.makeScale(s, 1, s).setPosition(x, y, z))); // s: per-lamp size (the plaza lantern's is wider)
  lamps.forEach(([x, z], i) => { const commercial = shopFronts.some(p => Math.hypot(p.x - x, p.z - z) < 16); mesh.setColorAt(i, new THREE.Color().setScalar(commercial ? 1 : .78)); });
  mesh.name = 'lamp-pools'; mesh.frustumCulled = false; mesh.renderOrder = 2;
  scene.add(mesh);
  let lastWet=-1;
  return { dispose() { mesh.geometry.dispose(); mat.map.dispose(); mat.dispose(); }, update(night, wet = 0) {
    if(Math.abs(wet-lastWet)>.005){
      const spread=1+wet*.35;
      lamps.forEach(([x,z,s=1,y=.08],i)=>{m.makeScale(spread*s,1,spread*s).setPosition(x,y,z);mesh.setMatrixAt(i,m);});
      mesh.instanceMatrix.needsUpdate=true;lastWet=wet;
    }
    // A wider wet halo spreads the same light instead of creating extra brightness.
    mat.opacity = night * 0.5 / (1 + wet * 0.35) ** 2; mesh.visible = night > 0.01;
  } };
}
