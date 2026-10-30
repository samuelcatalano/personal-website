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
const L = 13, W = 8, LAMP = 0.75; // pool size (m); lamp lateral offset
// ponytail: one soft trapezoid footprint (widening with distance, soft sides, fades in past the bonnet and out with range); lamps not simulated separately.
const lit = tex(128, 64, (g) => {
  const im = g.createImageData(128, 64), ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const ax = (x + 0.5) / 128 * L, az = Math.abs(((y + 0.5) / 64 - 0.5) * W), hw = 1.1 + ax * 0.26;
    const a = (1 - ss(0.35, 1, az / hw)) * ss(0, 2.2, ax) * Math.exp(-ax / 6.5) * (1 - ss(L * 0.55, L, ax)) * (0.75 + 0.25 * ss(0.3, 0, az / hw));
    im.data.set([255, 255, 255, Math.min(1, a) * 255], (y * 128 + x) * 4);
  }
  g.putImageData(im, 0, 0);
});
const blob = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
// Lamp glow on the vehicle itself: camera-facing points (head warm, tail red), additive, shared material.
const gm = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  uniforms: { uOp: { value: 0 }, uPx: { value: 1 } },
  vertexShader: `uniform float uPx; attribute vec3 aCol; varying vec3 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(0.05 * projectionMatrix[1][1] * uPx / max(-mv.z, 1.0), 1.0, 3.0); }`,
  fragmentShader: 'uniform float uOp; varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.0) * uOp; gl_FragColor = vec4(vC * a, a); }',
});
const M = { pool: mat(lit, 0xfff0dc), tail: mat(blob, 0xff2a1a) };
const OP = { pool: 0.3, tail: 0.055 };
const pool = new THREE.PlaneGeometry(L, W).rotateX(-Math.PI / 2).translate(L / 2, 0, 0);
// Two subdued wet-road reflections, anchored directly below the tail lamps instead of free-floating red blobs.
const tailPool = new THREE.PlaneGeometry(0.7, 0.55).rotateX(-Math.PI / 2).translate(-0.2, 0, 0);
// One road pool per vehicle, one tail glow per lamp, at the lamps' lateral position (≈68 % of the half-width), not from the vehicle's centre line.
const box = new THREE.Box3();
export function addBeams(vehicle, front, y = 0.65, anchors) {
  box.makeEmpty(); vehicle.updateMatrixWorld(true);
  vehicle.traverse((o) => { if (o.isMesh && o.name !== 'beam') { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().premultiply(vehicle.matrixWorld.clone().invert()))); } });
  const half = box.isEmpty() ? 0.9 : (box.max.z - box.min.z) / 2, lamp = Math.min(1.1, half * 0.68);
  const frontLamps = anchors?.front ?? [[front, y, -lamp], [front, y, lamp]], rearLamps = anchors?.rear ?? [[-front, y, -lamp], [-front, y, lamp]];
  const tail = new THREE.Group(); tail.name = 'beam'; tail.position.set(rearLamps[0][0], 0.04, 0);
  for (const [, , z] of rearLamps) {
    const t = new THREE.Mesh(tailPool, M.tail); t.position.z = z; t.scale.z = 0.5; // road reflection below the actual lens
    t.name = 'beam'; t.renderOrder = 5; t.frustumCulled = false; tail.add(t);
  }
  const p = new THREE.Mesh(pool, M.pool); p.position.set(frontLamps[0][0] - 0.3, 0.04, 0); p.scale.z = Math.max(0.75, lamp / LAMP) ** 0.5; p.name = 'beam'; p.renderOrder = 5; p.frustumCulled = false;
  tail.userData.swell = (k) => tail.children.forEach((t) => t.scale.set(1, 1, 0.5 * k)); // braking widens the reflection without moving it behind the car
  const pos = [], col = [];
  for (const [x, ly, z] of frontLamps) { pos.push(x - p.position.x, ly - 0.04, z / p.scale.z); col.push(0, 0, 0); }
  for (const [x, ly, z] of rearLamps) { pos.push(x - p.position.x, ly - 0.04, z / p.scale.z); col.push(1, 0.12, 0.06); }
  // glow points are children of the pool (p), so ambient.js keeps tail as the last vehicle child
  const gp = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)), gm);
  gp.name = 'beam'; gp.frustumCulled = false; gp.renderOrder = 6;
  gp.visible = !!vehicle.userData.fleetModel; p.add(gp); vehicle.add(p, tail);
}
export function refitBeams(vehicle) {
  vehicle.children.filter((c) => c.name === 'beam').forEach((b) => { b.traverse((o) => { if (o.isPoints) o.geometry.dispose(); }); b.removeFromParent(); });
  addBeams(vehicle, vehicle.userData.front, vehicle.userData.beamY, vehicle.userData.beamAnchors);
  return vehicle.children.at(-1);
}
export function updateBeams(night) {
  for (const k in M) { M[k].opacity = night * OP[k]; M[k].visible = night > 0.02; }
  gm.uniforms.uOp.value = night * 0.8; gm.uniforms.uPx.value = innerHeight * Math.min(devicePixelRatio || 1, 1.5) * 0.5;
}
