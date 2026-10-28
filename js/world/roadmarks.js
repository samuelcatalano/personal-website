import * as THREE from 'three';
import { swapAt, ROAD } from './layout.js';
import { SLOT } from './bays.js';
// Painted road markings as ribbons that follow the route curve (axis-aligned boxes stair-step on bends).
// São Paulo: double yellow centre line; UK: white dashed centre. Both: white edge lines, zebra crossings near stops.
const Y = 0.074, HALF = ROAD.edge; // road top is at 0.07; the edge lines separate the traffic lanes from the parking bays (ROAD.edge .. ROAD.curb)
const YELLOW = new THREE.Color('#e9b93a'), WHITE = new THREE.Color('#ece8de');
export function createRoadMarks(curve, stops, { bays, sample, pilotCrossings = [] }) {
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
  // Crossings: stop zebras (9 m past a stop, 1.4 m half-length) and pilot crossings (city.js, ~1.85 m half-length). Each is a world-space band (centre C, road tangent T at C,
  // half-depth h + GAP). Every longitudinal line (edges, centre, dashes) is clipped on its own edge corners by signed distance along T, so all lines end on one straight cut
  // perpendicular to the road, whatever the line type or the curvature. `gaps` (arc spans) only serves the bay ticks.
  const GAP = 0.5, spans = [...stops.map((_, i) => [Math.min(1, i / (stops.length - 1) + 9 / len), 1.4]), ...pilotCrossings.map((u) => [u, 1.85])];
  const bands = spans.map(([u, h]) => { const F = frame(u); return { x: F.p.x, z: F.p.z, tx: F.t.x, tz: F.t.z, d: h + GAP, s: u * len }; });
  const gaps = bands.map((c) => [c.s - c.d, c.s + c.d]);
  const inCrossing = (s) => gaps.some(([a, b]) => s > a && s < b);
  const line = (s0, s1, o, w, color) => {
    const A = frame(s0 / len), B = frame(s1 / len), pt = (F, k) => [F.p.x + F.nx * (o + k * w / 2), F.p.z + F.nz * (o + k * w / 2)];
    const E = [1, -1].map((k) => [pt(A, k), pt(B, k)]); // left and right edge: [start, end]
    const m = [(A.p.x + B.p.x) / 2, (A.p.z + B.p.z) / 2];
    let keep = [[{ t: 0 }, { t: 1 }]]; // kept [start, end] pieces along the strip; a cut carries its band c and signed distance g
    for (const c of bands) {
      if (Math.hypot(m[0] - c.x, m[1] - c.z) > 8) continue;
      const dist = ([x, z]) => (x - c.x) * c.tx + (z - c.z) * c.tz, dA = dist([A.p.x, A.p.z]), dB = dist([B.p.x, B.p.z]);
      if (dA === dB) continue;
      let lo = (-c.d - dA) / (dB - dA), hi = (c.d - dA) / (dB - dA), gl = -c.d, gh = c.d;
      if (lo > hi) { [lo, hi] = [hi, lo]; [gl, gh] = [gh, gl]; }
      if (hi <= 0 || lo >= 1) continue;
      const next = [];
      for (const [p, q] of keep) {
        if (hi <= p.t || lo >= q.t) { next.push([p, q]); continue; }
        if (lo > p.t) next.push([p, { t: lo, g: gl, c }]);
        if (hi < q.t) next.push([{ t: hi, g: gh, c }, q]);
      }
      keep = next;
    }
    const at = ([P, Q], e) => { // point on an edge at a cut (exact signed distance g from the nearest band) or at its original end
      if (e.g === undefined) return e.t === 0 ? P : Q;
      const c = e.c;
      const dP = (P[0] - c.x) * c.tx + (P[1] - c.z) * c.tz, dQ = (Q[0] - c.x) * c.tx + (Q[1] - c.z) * c.tz, t = (e.g - dP) / (dQ - dP);
      return [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
    };
    for (const [p, q] of keep) {
      const L = [p, q].map((e) => at(E[0], e)), R = [p, q].map((e) => at(E[1], e));
      quad(L[0], L[1], R[1], R[0], color);
    }
  };
  const FIRST_ZEBRA_END = 12.4; // no centre line from the route start to just past the first zebra
  for (let k = 0; k < n; k++) {
    const u0 = k / n, u1 = (k + 1) / n, s0 = u0 * len, s1 = u1 * len, br = (u0 + u1) / 2 < swap;
    for (const o of [-HALF, HALF]) line(s0, s1, o, 0.12, WHITE);
    if (br && s0 < FIRST_ZEBRA_END) continue;
    if (br) for (const o of [-0.11, 0.11]) line(s0, s1, o, 0.1, YELLOW);
    else if (k % 5 < 2) line(s0, s1, 0, 0.12, WHITE); // 2.4 m dash, 3.6 m gap
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
    if (inCrossing(k * SLOT)) continue;
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
