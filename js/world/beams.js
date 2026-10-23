import * as THREE from 'three';
// Baked headlamp road light + tail glow, shared geometry/materials, children of each vehicle. x = forward.
const tex = (w, h, draw) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  return new THREE.CanvasTexture(cv);
};
const mat = (map, color) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
// Road light from two headlamps (texture space: u = metres ahead / L, v = lateral across W). Each lamp: angular Gaussian
// (~13 deg) x distance falloff, faded in over the first metres (bonnet cut-off) - reads as a lit patch of road, not a solid cone.
const L = 15, W = 8, LAMP = 0.75; // pool size (m); lamp lateral offset used to bake the texture
const lit = tex(128, 64, (g) => {
  const im = g.createImageData(128, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const ax = (x + 0.5) / 128 * L, az = ((y + 0.5) / 64 - 0.5) * W;
    let a = 0;
    for (const s of [-1, 1]) { const dz = az - s * LAMP, ang = Math.atan2(Math.abs(dz), ax + 0.6); a += Math.exp(-((ang / 0.23) ** 2)) / (1 + (ax / 7) ** 2); }
    a *= Math.min(1, ax / 2.2) ** 1.5 * Math.min(1, (L - ax) / 3); // soft near cut-off and far fade
    im.data.set([255, 255, 255, Math.min(1, a * 0.75) * 255], (y * 128 + x) * 4);
  }
  g.putImageData(im, 0, 0);
});
const blob = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const M = { pool: mat(lit, 0xfff0dc), tail: mat(blob, 0xff2a1a) };
const OP = { pool: 0.24, tail: 0.1 };
const pool = new THREE.PlaneGeometry(L, W).rotateX(-Math.PI / 2).translate(L / 2, 0, 0);
const tailPool = new THREE.PlaneGeometry(2, 1.8).rotateX(-Math.PI / 2).translate(-1.4, 0, 0);
// One road pool per vehicle, one tail glow per lamp, at the lamps' lateral position (≈68 % of the half-width), not from the vehicle's centre line.
const box = new THREE.Box3();
export function addBeams(vehicle, front, y = 0.65) {
  box.makeEmpty(); vehicle.updateMatrixWorld(true);
  vehicle.traverse((o) => { if (o.isMesh && o.name !== 'beam') { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().premultiply(vehicle.matrixWorld.clone().invert()))); } });
  const half = box.isEmpty() ? 0.9 : (box.max.z - box.min.z) / 2, lamp = Math.min(1.1, half * 0.68);
  const tail = new THREE.Group(); tail.name = 'beam'; tail.position.set(-front, 0.04, 0);
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(tailPool, M.tail); t.position.z = s * lamp; t.scale.z = 0.5; // lamp lenses glow on the model itself
    t.name = 'beam'; t.renderOrder = 5; t.frustumCulled = false; tail.add(t);
  }
  const p = new THREE.Mesh(pool, M.pool); p.position.set(front - 0.3, 0.04, 0); p.scale.z = Math.max(0.75, lamp / LAMP) ** 0.5; p.name = 'beam'; p.renderOrder = 5; p.frustumCulled = false;
  tail.userData.swell = (k) => tail.children.forEach((t) => t.scale.set(k, 1, 0.5 * k)); // brake lights grow in place
  vehicle.add(p, tail);
}
export function updateBeams(night) {
  for (const k in M) { M[k].opacity = night * OP[k]; M[k].visible = night > 0.02; }
}
