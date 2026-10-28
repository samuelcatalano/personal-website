import * as THREE from 'three';
import { swapAt, ROAD } from './layout.js';
import { SLOT } from './bays.js';
// Painted road markings as ribbons that follow the route curve (axis-aligned boxes stair-step on bends).
// São Paulo: double yellow centre line; UK: white dashed centre. Both: white edge lines, zebra crossings near stops.
const Y = 0.074, HALF = ROAD.edge; // road top is at 0.07; the edge lines separate the traffic lanes from the parking bays (ROAD.edge .. ROAD.curb)
const YELLOW = new THREE.Color('#e9b93a'), WHITE = new THREE.Color('#ece8de');
export function createRoadMarks(curve, stops, { bays, sample }) {
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
  const zebras = stops.map((_, i) => curve.getPointAt(Math.min(1, i / (stops.length - 1) + 9 / len))), ZEBRA_CLEAR = 3.4, FIRST_ZEBRA_END = 9 + ZEBRA_CLEAR; // m from a crossing's centre (1.4 m half-length + 2 m): no centre line through it
  for (let k = 0; k < n; k++) {
    const u0 = k / n, u1 = (k + 1) / n, br = (u0 + u1) / 2 < swap;
    const mid = curve.getPointAt((u0 + u1) / 2), atZebra = zebras.some((z) => Math.hypot(z.x - mid.x, z.z - mid.z) < ZEBRA_CLEAR);
    for (const o of [-HALF, HALF]) strip(u0, u1, o, 0.12, WHITE);
    if (atZebra || (br && u0 * len < FIRST_ZEBRA_END)) continue;
    if (br) for (const o of [-0.11, 0.11]) strip(u0, u1, o, 0.1, YELLOW);
    else if (k % 5 < 2) strip(u0, u1, 0, 0.12, WHITE); // 2.4 m dash, 3.6 m gap
  }
  // zebra just past each stop sign (bus stops sit on the stop mark)
  for (let i = 0; i < stops.length; i++) {
    const u = Math.min(1, i / (stops.length - 1) + 9 / len), F = frame(u);
    for (let s = -ROAD.half + 0.25; s <= ROAD.half - 0.24; s += 0.95) { // across the whole carriageway, parking lanes included
      const c = [F.p.x + F.nx * s, F.p.z + F.nz * s], h = 1.4, w = 0.27;
      const ax = [F.t.x * h, F.t.z * h], bx = [F.nx * w, F.nz * w];
      quad([c[0] - ax[0] - bx[0], c[1] - ax[1] - bx[1]], [c[0] + ax[0] - bx[0], c[1] + ax[1] - bx[1]], [c[0] + ax[0] + bx[0], c[1] + ax[1] + bx[1]], [c[0] - ax[0] + bx[0], c[1] - ax[1] + bx[1]], WHITE);
    }
  }
  // bay separators: a short tick across each parking lane at both ends of every bay that has a car slot (no bays at zebras, stops, junctions, plazas, bridges)
  const ticks = new Set(); bays.forEach((b) => { if (b.ok) { ticks.add(b.k); ticks.add(b.k + 1); } });
  for (const k of ticks) {
    const { p, t } = sample(k * SLOT);
    for (const side of [-1, 1]) {
      const c = [p.x - t.z * side * ROAD.bayMid, p.z + t.x * side * ROAD.bayMid], h = (ROAD.bay - 0.2) / 2, w = 0.06;
      const nx = -t.z * side * h, nz = t.x * side * h, tx = t.x * w, tz = t.z * w;
      quad([c[0] - nx - tx, c[1] - nz - tz], [c[0] + nx - tx, c[1] + nz - tz], [c[0] + nx + tx, c[1] + nz + tz], [c[0] - nx + tx, c[1] - nz + tz], WHITE);
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
