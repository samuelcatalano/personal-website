import * as THREE from 'three';
// Fake headlight cone + road pool + tail glow, shared geometry/materials, children of each vehicle. x = forward.
const tex = (w, h, draw) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  return new THREE.CanvasTexture(cv);
};
const mat = (map, color) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const fade = tex(64, 64, (g) => { // u = along the beam (bright near the car), v = across (soft edges)
  const im = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const a = (1 - x / 63) ** 1.5 * (1 - Math.abs(y / 31.5 - 1)) ** 1.3, i = (y * 64 + x) * 4;
    im.data.set([255, 255, 255, a * 255], i);
  }
  g.putImageData(im, 0, 0);
});
const blob = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const M = { cone: mat(fade, 0xfff2cc), pool: mat(blob, 0xffe9b0), tail: mat(blob, 0xff2a1a) };
const OP = { cone: 0.07, pool: 0.11, tail: 0.1 };
const cone = new THREE.BufferGeometry(); // two soft fans, one flat and one upright, 12 m long, widening away from the car
{
  const L = 12, p = [], uv = [], ix = [];
  [[2.2, 0.4, 0], [1.0, 0.25, 1]].forEach(([w1, w0, up], q) => {
    for (const [x, s] of [[0, -1], [0, 1], [L, -1], [L, 1]]) { const w = (x ? w1 : w0) * s; p.push(x, up ? w : 0, up ? 0 : w); uv.push(x / L, (s + 1) / 2); }
    ix.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2);
  });
  cone.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)).setIndex(ix);
}
const pool = new THREE.PlaneGeometry(10, 5).rotateX(-Math.PI / 2).translate(6.5, 0, 0);
const tailPool = new THREE.PlaneGeometry(2, 1.8).rotateX(-Math.PI / 2).translate(-1.4, 0, 0);
export function addBeams(vehicle, front, y = 0.65) {
  const c = new THREE.Mesh(cone, M.cone), p = new THREE.Mesh(pool, M.pool), t = new THREE.Mesh(tailPool, M.tail);
  c.position.set(front, y, 0); c.rotation.z = -0.07;
  p.position.set(front, 0.04, 0); t.position.set(-front, 0.04, 0);
  for (const m of [c, p, t]) { m.name = 'beam'; m.renderOrder = 5; m.frustumCulled = false; vehicle.add(m); }
}
export function updateBeams(night) {
  for (const k in M) { M[k].opacity = night * OP[k]; M[k].visible = night > 0.02; }
}
