import * as THREE from 'three';
import { swapAt } from './layout.js';
// Painted road markings as ribbons that follow the route curve (axis-aligned boxes stair-step on bends).
// São Paulo: double yellow centre line; UK: white dashed centre. Both: white edge lines, zebra crossings near stops.
const Y = 0.074, HALF = 3.85; // road top is at 0.07; edge lines sit just inside the 8.5 m carriageway
const YELLOW = new THREE.Color('#e9b93a'), WHITE = new THREE.Color('#ece8de');
export function createRoadMarks(curve, stops) {
  const pos = [], col = [], swap = swapAt(stops), len = curve.getLength(), n = Math.ceil(len / 1.2);
  const quad = (a, b, c, d, color) => { // a,b,c,d: [x,z] counter-clockwise from above
    for (const [x, z] of [a, b, c, a, c, d]) { pos.push(x, Y, z); col.push(color.r, color.g, color.b); }
  };
  const frame = (u) => { const p = curve.getPointAt(u), t = curve.getTangentAt(u); return { p, t, nx: -t.z, nz: t.x }; };
  // strip from u0 to u1 at lateral offset o, width w
  const strip = (u0, u1, o, w, color) => {
    const A = frame(u0), B = frame(u1);
    const at = (F, s) => [F.p.x + F.nx * (o + s * w / 2), F.p.z + F.nz * (o + s * w / 2)];
    quad(at(A, 1), at(B, 1), at(B, -1), at(A, -1), color);
  };
  const zebras = stops.map((_, i) => curve.getPointAt(Math.min(1, i / (stops.length - 1) + 9 / len))), ZEBRA_CLEAR = 3.4; // m from a crossing's centre (1.4 m half-length + 2 m): no centre line through it
  for (let k = 0; k < n; k++) {
    const u0 = k / n, u1 = (k + 1) / n, br = (u0 + u1) / 2 < swap;
    const mid = curve.getPointAt((u0 + u1) / 2), atZebra = zebras.some((z) => Math.hypot(z.x - mid.x, z.z - mid.z) < ZEBRA_CLEAR);
    for (const o of [-HALF, HALF]) strip(u0, u1, o, 0.12, WHITE);
    if (atZebra) continue;
    if (br) for (const o of [-0.11, 0.11]) strip(u0, u1, o, 0.1, YELLOW);
    else if (k % 5 < 2) strip(u0, u1, 0, 0.12, WHITE); // 2.4 m dash, 3.6 m gap
  }
  // zebra just past each stop sign (bus stops sit on the stop mark)
  for (let i = 0; i < stops.length; i++) {
    const u = Math.min(1, i / (stops.length - 1) + 9 / len), F = frame(u);
    for (let s = -3.3; s <= 3.31; s += 0.95) {
      const c = [F.p.x + F.nx * s, F.p.z + F.nz * s], h = 1.4, w = 0.27;
      const ax = [F.t.x * h, F.t.z * h], bx = [F.nx * w, F.nz * w];
      quad([c[0] - ax[0] - bx[0], c[1] - ax[1] - bx[1]], [c[0] + ax[0] - bx[0], c[1] + ax[1] - bx[1]], [c[0] + ax[0] + bx[0], c[1] + ax[1] + bx[1]], [c[0] - ax[0] + bx[0], c[1] - ax[1] + bx[1]], WHITE);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'road-markings'; mesh.receiveShadow = true;
  mesh.userData.dispose = () => { g.dispose(); mat.dispose(); };
  return mesh;
}
