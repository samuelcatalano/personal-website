import * as THREE from 'three';
import { fixed, paint } from './vehicles.js';
// Lofted double-decker buses: London New Routemaster and Glasgow Wright StreetDeck.
// The hull is a lattice of rounded-rectangle cross-sections along x (stations x ring). Windows, masks and livery are polygons in
// lattice space that are CARVED out of the hull quads (glass is recessed with reveal walls), so the glazing is part of the shell.
// Contract matches vehicles.js: x = forward, y = up (min.y = 0), z = right, metres; group.userData {length, front, beamY, wheels, tris}.
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const COLS = {};
const col = (hex) => COLS[hex] ??= new THREE.Color(hex);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MEMO = new Map();
const memo = (k, f) => MEMO.get(k) ?? (MEMO.set(k, f()), MEMO.get(k));
const BLK = '#121417', DK = '#1b1d21', WHT = '#f4f1ea', CH = '#d8dadc';

// dot-matrix destination board (glows at night through the sky.update glow path, same convention as vehicles.js)
export const destMat = (key, num, text, fg, bg = '#0b0a09') => memo('busdest' + key, () => {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 104;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 320, 104);
  g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.font = 'bold 66px sans-serif'; g.fillText(num, 14, 54);
  g.font = 'bold 36px sans-serif'; g.fillText(text, 84, 56, 226);
  g.fillStyle = 'rgba(0,0,0,.55)';
  for (let x = 0; x < 320; x += 3) g.fillRect(x, 0, 1, 104);
  for (let y = 0; y < 104; y += 3) g.fillRect(0, y, 320, 1);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0 });
  m.userData.glow = true; m.userData.glowK = 1.5; m.userData.glowColor = new THREE.Color('#ffffff');
  m.map = m.emissiveMap = map;
  return m;
});

// ---- per-role geometry accumulator (non-indexed; trim/matte carry vertex colours, lit carries uv) ----
function makeAcc() {
  const R = {};
  const get = (role) => R[role] ??= { p: [], n: [], c: [], u: [] };
  const colored = (role) => role === 'trim' || role === 'matte';
  const vtx = (role, p, n, hex, uv) => {
    const r = get(role); r.p.push(p.x, p.y, p.z); r.n.push(n.x, n.y, n.z);
    if (colored(role)) { const c = col(hex ?? '#ffffff'); r.c.push(c.r, c.g, c.b); }
    if (role === 'lit') r.u.push(uv[0], uv[1]);
  };
  const add = (role, g, hex) => {
    g = g.index ? g.toNonIndexed() : g;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color;
    for (let k = 0; k < P.count; k++) vtx(role, V3().fromBufferAttribute(P, k), V3().fromBufferAttribute(N, k), C ? '#' + new THREE.Color().fromBufferAttribute(C, k).getHexString() : hex, U ? [U.getX(k), U.getY(k)] : [0, 0]);
  };
  const geos = () => {
    const out = {}; let tris = 0;
    for (const role in R) {
      const r = R[role], g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(r.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(r.n, 3));
      if (r.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(r.c, 3));
      if (r.u.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(r.u, 2));
      g.computeBoundingSphere(); out[role] = g; tris += r.p.length / 9;
    }
    return { out, tris };
  };
  return { vtx, add, geos };
}
const bx = (x, y, z, w, h, d) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// rounded roof pod: rounded rectangle in plan, extruded up with a small bevel
function podGeo(x, y, z, w, d, h, r) {
  const s = new THREE.Shape(), hx = w / 2, hz = d / 2;
  s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.quadraticCurveTo(hx, -hz, hx, -hz + r); s.lineTo(hx, hz - r); s.quadraticCurveTo(hx, hz, hx - r, hz);
  s.lineTo(-hx + r, hz); s.quadraticCurveTo(-hx, hz, -hx, hz - r); s.lineTo(-hx, -hz + r); s.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
  return new THREE.ExtrudeGeometry(s, { depth: h - 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 3 }).rotateX(-Math.PI / 2).translate(x, y, z);
}

// ---- 2D polygon helpers in lattice space ----
const area2 = (p) => { let s = 0; for (let k = 0; k < p.length; k++) { const q = p[(k + 1) % p.length]; s += p[k][0] * q[1] - q[0] * p[k][1]; } return s; };
function clipHalf(poly, a, b, left) {
  const out = [], sd = (p) => (left ? 1 : -1) * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], dp = sd(p), dq = sd(q);
    if (dp >= 0) out.push(p);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
const clean = (p) => {
  const o = p.filter((v, k) => { const q = p[(k + 1) % p.length]; return Math.abs(v[0] - q[0]) + Math.abs(v[1] - q[1]) > 1e-7; });
  return o.length >= 3 && Math.abs(area2(o)) > 1e-7 ? o : null;
};
function splitBy(poly, zp) { // convex poly vs convex CCW zone: inside piece + disjoint convex outside pieces
  let cur = poly; const out = [];
  for (let k = 0; k < zp.length; k++) {
    const a = zp[k], b = zp[(k + 1) % zp.length];
    const o = clean(clipHalf(cur, a, b, false)); if (o) out.push(o);
    cur = clean(clipHalf(cur, a, b, true));
    if (!cur) return { inside: null, outside: out };
  }
  return { inside: cur, outside: out };
}

// ---- the hull lattice ----
function lattice(P, hero) {
  const { hl, hw } = P, Fe = P.front, Re = P.rear;
  const nb = 2, KA = hero ? 4 : 3, R = hero ? 8 : 6, Kr = hero ? 6 : 4;
  const H = nb + KA + R + KA + Kr, M = 2 * H;
  const K = hero ? 8 : 5, step = hero ? 0.55 : 0.95;
  const st = [];
  for (let k = K; k >= 0; k--) { const t = Math.sin(Math.PI / 2 * k / K); st.push({ x: -hl + Re.L * (1 - t), side: -1, t }); }
  const xa = -hl + Re.L, xb = hl - Fe.L, n = Math.max(1, Math.round((xb - xa) / step));
  for (let k = 1; k < n; k++) st.push({ x: xa + (xb - xa) * k / n, side: 0, t: 0 });
  for (let k = 0; k <= K; k++) { const t = Math.sin(Math.PI / 2 * k / K); st.push({ x: hl - Fe.L + Fe.L * t, side: 1, t }); }
  const N = st.length - 1, xs = st.map((s) => s.x), nodes = [], RY = [], WF = [];
  const tab = (T, y) => { for (let k = 1; k < T.length; k++) if (y <= T[k][0]) return lerp(T[k - 1][1], T[k][1], (y - T[k - 1][0]) / (T[k][0] - T[k - 1][0])); return T[T.length - 1][1]; };
  for (const s of st) {
    const E = s.x > 0 ? Fe : Re, ax = Math.abs(s.x), pe = s.side ? (s.side > 0 ? Fe : Re) : null;
    const w = pe ? hw * Math.pow(Math.max(0, 1 - Math.pow(s.t, pe.p)), 1 / pe.p) : hw;
    const te = clamp((ax - (hl - E.Le)) / E.Le, 0, 1), tb = clamp((ax - (hl - E.Leb)) / E.Leb, 0, 1);
    const yt = P.YT - E.dT * (1 - Math.sqrt(1 - te * te)), yb = P.YB + E.dB * (1 - Math.sqrt(1 - tb * tb));
    const rb = Math.min(P.rb, 0.92 * w), rt = Math.min(P.rt, 0.92 * w), c = P.crown * Math.min(1, w / hw);
    const half = [];
    for (let k = 0; k <= nb; k++) half.push([(w - rb) * k / nb, yb]);
    for (let k = 1; k <= KA; k++) { const a = -Math.PI / 2 + Math.PI / 2 * k / KA; half.push([w - rb + rb * Math.cos(a), yb + rb + rb * Math.sin(a)]); }
    for (let k = 1; k <= R; k++) half.push([w, lerp(yb + rb, yt - c - rt, k / R)]);
    for (let k = 1; k <= KA; k++) { const a = Math.PI / 2 * k / KA; half.push([w - rt + rt * Math.cos(a), yt - c - rt + rt * Math.sin(a)]); }
    for (let k = 1; k <= Kr; k++) { const z = (w - rt) * (1 - k / Kr), q = w - rt > 1e-6 ? z / (w - rt) : 0; half.push([z, yt - c * q * q]); }
    const wt = pe ? Math.pow(s.t, 3) : 0, tbl = s.side > 0 ? P.warpF : P.warpR;
    const row = [], ry = [];
    for (let j = 0; j < M; j++) {
      const [z, y] = j <= H ? half[j] : half[M - j], sg = j <= H ? 1 : -1;
      const dx = wt && tbl ? tab(tbl, y) * wt * (s.side > 0 ? -1 : 1) : 0;
      row.push(V3(s.x + dx, y, sg * z));
    }
    for (let j = 0; j <= H; j++) ry.push(half[j][1]);
    nodes.push(row); RY.push(ry); WF.push(w / hw);
  }
  // smooth node normals (area-weighted), tips averaged across the centre line
  const nrm = nodes.map((r) => r.map(() => V3()));
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const j1 = (j + 1) % M, a = nodes[i][j], b = nodes[i + 1][j], c = nodes[i + 1][j1], d = nodes[i][j1];
    const f = V3().subVectors(c, a).cross(V3().subVectors(d, b));
    nrm[i][j].add(f); nrm[i + 1][j].add(f); nrm[i + 1][j1].add(f); nrm[i][j1].add(f);
  }
  for (const i of [0, N]) for (let j = 1; j < H; j++) { const s = nrm[i][j].clone().add(nrm[i][M - j]); nrm[i][j].copy(s); nrm[i][M - j].copy(s); }
  for (const r of nrm) for (const v of r) v.normalize();
  const cellAt = (ci, cj, a, b) => {
    const j1 = (cj + 1) % M, w = [(1 - a) * (1 - b), a * (1 - b), a * b, (1 - a) * b];
    const ns = [nodes[ci][cj], nodes[ci + 1][cj], nodes[ci + 1][j1], nodes[ci][j1]], nn = [nrm[ci][cj], nrm[ci + 1][cj], nrm[ci + 1][j1], nrm[ci][j1]];
    const p = V3(), n = V3();
    for (let k = 0; k < 4; k++) { p.addScaledVector(ns[k], w[k]); n.addScaledVector(nn[k], w[k]); }
    return { p, n: n.normalize() };
  };
  const S = (i, j) => { const ci = clamp(Math.floor(i), 0, N - 1), cj = ((Math.floor(j) % M) + M) % M; return cellAt(ci, cj, i - ci, j - Math.floor(j)); };
  // y -> fractional ring index on the +z half at fractional station i
  const jOf = (s, y) => { const ry = RY[s]; if (y >= ry[H]) return H; for (let j = H - 1; j >= 0; j--) if (ry[j] <= y) { const d = ry[j + 1] - ry[j]; return j + (d > 1e-9 ? Math.min(1, (y - ry[j]) / d) : 0); } return 0; };
  const J = (i, y) => { const i0 = Math.min(N - 1, Math.floor(i)), f = i - i0; return lerp(jOf(i0, y), jOf(i0 + 1, y), f); };
  const interp = (arr, v) => { for (let k = 1; k < arr.length; k++) if (v <= arr[k]) return k - 1 + (v - arr[k - 1]) / (arr[k] - arr[k - 1]); return arr.length - 1; };
  const iF0 = st.findIndex((s) => s.side > 0), iR0 = st.findIndex((s) => s.side >= 0) - 1;
  const I = (x) => {
    if (typeof x === 'number') return interp(xs, x);
    if (x === 'F') return N; if (x === 'R') return 0;
    const q = parseFloat(x.slice(1)); // width fraction at the front ('f.7') or rear ('r.7') curve
    if (x[0] === 'f') { for (let i = iF0 + 1; i <= N; i++) if (WF[i] <= q) return i - 1 + (WF[i - 1] - q) / (WF[i - 1] - WF[i]); return N; }
    for (let i = iR0 - 1; i >= 0; i--) if (WF[i] <= q) return i + 1 - (WF[i + 1] - q) / (WF[i + 1] - WF[i]); return 0;
  };
  return { N, M, H, nodes, nrm, S, J, I, xs };
}

// carve zones out of the hull and emit every role
function carve(L, zones, acc, depthRev) {
  const { N, M, S } = L;
  for (const z of zones) { z.i0 = Math.min(...z.poly.map((p) => p[0])); z.i1 = Math.max(...z.poly.map((p) => p[0])); z.j0 = Math.min(...z.poly.map((p) => p[1])); z.j1 = Math.max(...z.poly.map((p) => p[1])); }
  const emit = (poly, ci, cj, role, hex, depth, uvFn) => {
    const vs = poly.map(([i, j]) => { const { p, n } = S(i, j); if (depth) p.addScaledVector(n, -depth); return { p, n, uv: uvFn ? uvFn(p) : null }; });
    for (let k = 1; k < vs.length - 1; k++) for (const v of [vs[0], vs[k], vs[k + 1]]) acc.vtx(role, v.p, v.n, hex, v.uv);
  };
  for (let ci = 0; ci < N; ci++) for (let cj = 0; cj < M; cj++) {
    let rem = [[[ci, cj], [ci + 1, cj], [ci + 1, cj + 1], [ci, cj + 1]]];
    for (const z of zones) {
      if (z.i1 <= ci || z.i0 >= ci + 1 || z.j1 <= cj || z.j0 >= cj + 1) continue;
      const next = [];
      for (const p of rem) {
        const r = splitBy(p, z.poly);
        if (r.inside) emit(r.inside, ci, cj, z.role, z.hex, z.depth, z.uvFn);
        next.push(...r.outside);
      }
      rem = next;
    }
    for (const p of rem) emit(p, ci, cj, 'body');
  }
  // reveal walls around every recessed zone
  for (const z of zones) {
    if (!z.depth || z.noReveal) continue;
    const cen = [0, 0]; for (const p of z.poly) { cen[0] += p[0] / z.poly.length; cen[1] += p[1] / z.poly.length; }
    const c3 = S(cen[0], cen[1]).p;
    for (let k = 0; k < z.poly.length; k++) {
      const a = z.poly[k], b = z.poly[(k + 1) % z.poly.length];
      if ((a[0] >= N - 1e-6 && b[0] >= N - 1e-6) || (a[0] <= 1e-6 && b[0] <= 1e-6)) continue;
      const ns = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 0.5));
      for (let s = 0; s < ns; s++) {
        const pts = [0, 1].map((e) => { const t = (s + e) / ns, { p, n } = S(lerp(a[0], b[0], t), lerp(a[1], b[1], t)); return [p, p.clone().addScaledVector(n, -z.depth)]; });
        const [o0, i0] = pts[0], [o1, i1] = pts[1];
        const fn = V3().subVectors(o1, o0).cross(V3().subVectors(i0, o0));
        if (fn.lengthSq() < 1e-12) continue; fn.normalize();
        const mid = o0.clone().add(o1).multiplyScalar(0.5);
        if (fn.dot(V3().subVectors(c3, mid)) < 0) { fn.negate(); acc.vtx('matte', o0, fn, z.revHex ?? BLK); acc.vtx('matte', i1, fn, z.revHex ?? BLK); acc.vtx('matte', i0, fn, z.revHex ?? BLK); acc.vtx('matte', o0, fn, z.revHex ?? BLK); acc.vtx('matte', o1, fn, z.revHex ?? BLK); acc.vtx('matte', i1, fn, z.revHex ?? BLK); } else { acc.vtx('matte', o0, fn, z.revHex ?? BLK); acc.vtx('matte', i0, fn, z.revHex ?? BLK); acc.vtx('matte', i1, fn, z.revHex ?? BLK); acc.vtx('matte', o0, fn, z.revHex ?? BLK); acc.vtx('matte', i1, fn, z.revHex ?? BLK); acc.vtx('matte', o1, fn, z.revHex ?? BLK); }
      }
    }
  }
}

// inside-out box (cabin shell seen through the glass: dark by day, warm at night)
function cabinShell(acc, x0, x1, y0, y1, hz) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, 2 * hz).toNonIndexed().translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let k = 0; k < P.count; k += 3) for (const q of [0, 2, 1]) acc.vtx('cabin', V3().fromBufferAttribute(P, k + q), V3().fromBufferAttribute(N, k + q).negate());
}

// ---- wheels (hero: 4 spinnable meshes; ambient: merged static into 'matte') ----
function wheelGeo(r, w, rim, hero) {
  return memo(`buswh${r}|${w}|${hero}`, () => {
    const a = makeAcc(), seg = hero ? 22 : 12;
    const cyl = (rr, ww) => new THREE.CylinderGeometry(rr, rr, ww, seg).rotateX(Math.PI / 2);
    a.add('matte', cyl(r, w), '#242629'); a.add('matte', cyl(r * 0.64, w + 0.014), rim); a.add('matte', cyl(r * 0.42, w + 0.024), '#2b2e33'); a.add('matte', cyl(r * 0.16, w + 0.044), rim);
    if (hero) for (let k = 0; k < 5; k++) a.add('matte', new THREE.BoxGeometry(r * 0.5, r * 0.12, w + 0.034).translate(r * 0.3, 0, 0).rotateZ(k * Math.PI * 2 / 5 + 0.3), rim);
    return a.geos().out.matte;
  });
}
const archPoly = (ax, wr) => { const p = [[ax - wr - 0.12, 0.33], [ax + wr + 0.12, 0.33]]; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; p.push([ax + (wr + 0.12) * Math.cos(a), wr + 0.02 + (wr + 0.12) * Math.sin(a)]); } return p.slice(0, 2).concat(p.slice(2)); };

// =============================== LONDON: New Routemaster ===============================
const LONDON = {
  name: 'london', hl: 5.6, hw: 1.275, YB: 0.3, YT: 4.28, crown: 0.12, rb: 0.24, rt: 0.52, color: '#c9252b', wr: 0.46, ax: [3.5, -3.0], beamY: 0.9,
  front: { L: 2.0, p: 2.5, Le: 1.8, dT: 0.75, Leb: 1.2, dB: 0.42 }, rear: { L: 1.7, p: 2.3, Le: 1.6, dT: 0.85, Leb: 1.0, dB: 0.3 },
  warpF: [[0.3, 0.5], [0.9, 0.08], [1.7, 0], [2.6, 0.22], [3.4, 0.5], [4.4, 0.9]], warpR: [[0.3, 0.25], [1.0, 0], [3.0, 0.15], [4.4, 0.5]],
  dest: ['london', '19', 'Finsbury Park', '#ffb347'], seat: '#33406b', mirror: '#f2c230',
};
const GLASGOW = {
  name: 'glasgow', hl: 5.5, hw: 1.275, YB: 0.36, YT: 4.2, crown: 0.06, rb: 0.14, rt: 0.2, color: '#5b2a86', wr: 0.46, ax: [3.4, -2.8], beamY: 1.0,
  front: { L: 0.85, p: 4.6, Le: 0.45, dT: 0.2, Leb: 0.4, dB: 0.14 }, rear: { L: 0.75, p: 4.6, Le: 0.4, dT: 0.16, Leb: 0.35, dB: 0.1 },
  warpF: [[0.3, 0.2], [1.0, 0.02], [2.25, 0.2], [2.45, 0.0], [4.2, 0.05]], warpR: [[0.4, 0.1], [1.0, 0.0], [4.2, 0.0]],
  dest: ['glasgow', '6', 'Renfrew Street', '#ff7a1a'], seat: '#4a2f78', mirror: '#f5c20b',
};

function bake(P, hero) {
  const acc = makeAcc(), L = lattice(P, hero), { N, M, J, I, S } = L, zones = [];
  const Z = (role, pts, o = {}) => { // polygon of [x|'F'|'R'|'f.7'|'r.7', y|'b'] on both flanks (or one with o.side)
    const base = pts.map(([x, y]) => { const i = I(x); return [i, y === 'b' ? 0 : J(i, y)]; });
    for (const sg of (o.side ? [o.side] : [1, -1])) {
      const poly = sg > 0 ? base.map((p) => p.slice()) : base.map(([i, j]) => [i, M - j]);
      if (area2(poly) < 0) poly.reverse();
      zones.push({ poly, role, ...o });
    }
  };
  const glass = (pts, o = {}) => Z('glass', pts, { depth: 0.16, ...o });
  const surf = (sg, x, y) => { const i = I(x), j = J(i, y); return S(i, sg > 0 ? j : M - j); };
  const arch = (x) => Z('matte', archPoly(x, P.wr), { hex: '#0b0c0e', depth: 0.38, noReveal: false });
  const hl = P.hl, hw = P.hw;
  if (P === LONDON) londonZones({ Z, glass, arch, P });
  else glasgowZones({ Z, glass, arch, P });
  carve(L, zones, acc);

  // ---- interior shell + hero interior ----
  if (P === LONDON) cabinShell(acc, -hl + 1.25, hl - 1.35, 0.9, 4.02, 1.12); else cabinShell(acc, -hl + 0.5, hl - 0.6, 0.9, 4.02, 1.12);
  if (hero) {
    acc.add('matte', bx(0, 2.5, 0, 8.6, 0.06, 2.1), '#2c2f35');
    acc.add('matte', bx(0, 0.93, 0, 8.6, 0.05, 2.1), '#2c2f35');
    for (const [fy, n] of [[0.93, 9], [2.53, 10]]) for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const x = -4.0 + i * 0.86;
      acc.add('matte', bx(x, fy + 0.4, s * 0.98, 0.46, 0.1, 0.4), P.seat);
      acc.add('matte', bx(x - 0.2, fy + 0.7, s * 0.98, 0.08, 0.55, 0.4), P.seat);
    }
    for (const fy of [0.93, 2.53]) for (const x of [-3.3, -1.2, 1.2, 3.0]) for (const s of [-0.45, 0.45]) acc.add('trim', new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6).translate(x, fy + 0.85, s), '#d9c25a');
  }
  // mullions inside the recesses (London ribbons are continuous glass with a few slim posts)
  const mull = (xs, y0, y1) => { for (const x of xs) for (const sg of [-1, 1]) acc.add('matte', bx(x, (y0 + y1) / 2, sg * (hw - 0.08), 0.085, y1 - y0, 0.16), BLK); };
  if (P === LONDON) { mull([-3.85, -2.7, -1.55, -0.4, 0.75, 1.9], 1.3, 2.25); mull([-3.9, -2.85, -1.8, -0.75], 3.05, 3.64); }
  else { /* bays carry their own pillars */ }
  // roof pods
  if (P === LONDON) { acc.add('trim', podGeo(-2.6, P.YT - 0.06, 0, 1.6, 1.05, 0.2, 0.2), WHT); acc.add('trim', podGeo(0.9, P.YT - 0.06, 0, 2.4, 1.1, 0.2, 0.22), WHT); }
  else { acc.add('trim', podGeo(-2.5, P.YT - 0.03, 0, 1.7, 1.05, 0.15, 0.1), WHT); acc.add('trim', podGeo(0.5, P.YT - 0.03, 0, 2.6, 1.1, 0.15, 0.1), WHT); }
  // lamps and mirrors
  const lamp = (sg, x, y, r, rear) => {
    const { p, n } = surf(sg, x, y);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), n);
    if (!rear) {
      acc.add('trim', new THREE.TorusGeometry(r, r * 0.16, 6, hero ? 18 : 10).applyQuaternion(q).translate(p.x + n.x * 0.02, p.y + n.y * 0.02, p.z + n.z * 0.02), CH);
      acc.add('head', new THREE.CircleGeometry(r * 0.88, hero ? 14 : 8).applyQuaternion(q).translate(p.x + n.x * 0.03, p.y + n.y * 0.03, p.z + n.z * 0.03));
    } else acc.add('tail', new THREE.CircleGeometry(r, 8).applyQuaternion(q).translate(p.x + n.x * 0.02, p.y + n.y * 0.02, p.z + n.z * 0.02));
  };
  if (P === LONDON) {
    for (const sg of [-1, 1]) { lamp(sg, 'f.66', 0.92, 0.14); lamp(sg, 'r.62', 1.0, 0.1, true); }
    for (const sg of [-1, 1]) { // mirrors: arm + black head + yellow tip
      acc.add('matte', bx(4.55, 2.7, sg * 1.38, 0.05, 0.05, 0.3), BLK); acc.add('matte', bx(4.7, 2.45, sg * 1.54, 0.1, 0.52, 0.07), BLK); acc.add('trim', bx(4.7, 2.76, sg * 1.54, 0.12, 0.08, 0.09), P.mirror);
    }
  } else {
    for (const sg of [-1, 1]) {
      lamp(sg, 'f.78', 0.98, 0.1); lamp(sg, 'r.8', 1.05, 0.09, true);
      acc.add('matte', bx(4.7, 2.75, sg * 1.38, 0.05, 0.05, 0.3), BLK); acc.add('matte', bx(4.78, 2.5, sg * 1.58, 0.1, 0.5, 0.07), BLK); acc.add('trim', bx(4.78, 2.78, sg * 1.58, 0.12, 0.1, 0.09), P.mirror);
    }
  }
  // wheels for ambient (static)
  const ax = P.ax, wz = hw - 0.17;
  if (!hero) for (const x of ax) for (const s of [-1, 1]) { const g = wheelGeo(P.wr, 0.3, '#aeb3b9', false).clone().translate(x, P.wr, s * wz); acc.add('matte', g); }
  const { out, tris } = acc.geos();
  return { out, tris };
}

// ----- London carve zones: diagonal staircase bands, ribbon glazing, wrap-around black mask, two-level windscreen -----
function londonZones({ Z, glass, arch, P }) {
  P.dW = 1.3; P.dY = 2.63; P.dH = 0.46;
  for (const x of P.ax) arch(x);
  const DI = 1.17; // dx per dy of the staircase diagonal
  const diag = (s) => { // s = +1: front diagonal (x grows toward the bottom); s = -1: mirrored rear diagonal
    const xs = (v) => s * v;
    return [[xs(3.3), 1.3], [xs(4.9), 1.3], [xs(1.8), 3.85], [xs(0.2), 3.85]];
  };
  // +z (offside): front staircase diagonal + ribbon + lower deck
  glass(diag(1), { side: 1 });
  glass([[-4.65, 1.3], [3.2, 1.3], [2.09, 2.25], [-4.65, 2.25]], { side: 1 });
  glass([['R', 3.05], [1.15, 3.05], [0.1, 3.85], ['R', 3.85]], { side: 1 });
  glass([[2.95, 3.05], ['F', 3.05], ['F', 3.85], [1.9, 3.85]], { side: 1 });
  // -z (nearside): rear staircase diagonal, doors, long upper ribbon
  glass(diag(-1), { side: -1 });
  glass([['R', 3.05], [-2.95, 3.05], [-1.9, 3.85], ['R', 3.85]], { side: -1 });
  glass([[-1.15, 3.05], ['F', 3.0], ['F', 4.6], [-0.1, 4.0]], { side: -1 });
  glass([[-3.2, 1.3], [-0.2, 1.3], [-0.2, 2.25], [-2.09, 2.25]], { side: -1 });
  glass([[1.55, 1.3], [3.25, 1.3], [3.25, 2.25], [1.55, 2.25]], { side: -1 });
  for (const [a, b] of [[3.85, 4.45], [4.5, 5.0]]) glass([[a, 0.85], [b, 0.85], [b, 2.2], [a, 2.2]], { side: -1 });
  for (const [a, b] of [[0.1, 0.55], [0.6, 1.05]]) glass([[a, 0.85], [b, 0.85], [b, 2.2], [a, 2.2]], { side: -1 });
  Z('matte', [[-0.05, 0.62], [1.2, 0.62], [1.2, 2.3], [-0.05, 2.3]], { side: -1, hex: BLK }); // middle door leaf
  // front: lower windscreen, destination display, upper windscreen
  glass([['f.93', 1.3], ['F', 1.3], ['F', 2.25], ['f.93', 2.25]]);
  Z('lit', [['f.6', 2.4], ['F', 2.4], ['F', 2.86], ['f.6', 2.86]], { depth: 0.012, noReveal: true, uvFn: (p) => [0.5 - p.z / 1.3, 0.5 + (p.y - 2.63) / 0.46] });
  // black mask wrapping the lower front and the display band
  Z('matte', [[3.5, 'b'], ['F', 'b'], ['F', 2.32], [3.5, 2.32]], { hex: BLK });
  Z('matte', [['f.9', 2.28], ['F', 2.28], ['F', 2.98], ['f.9', 2.98]], { hex: BLK });
  // rear: lit route number, plate recess, engine louvres
  Z('lit', [['r.5', 3.1], ['R', 3.1], ['R', 3.5], ['r.5', 3.5]], { depth: 0.012, noReveal: true, uvFn: (p) => [lerp(0.02, 0.2, 0.5 + p.z / 0.8), 0.5 + (p.y - 3.3) / 0.4] });
  Z('matte', [['r.55', 0.65], ['R', 0.65], ['R', 0.85], ['r.55', 0.85]], { hex: '#f2c230' });
  Z('matte', [[-5.0, 0.9], [-4.35, 0.9], [-4.35, 2.25], [-5.0, 2.25]], { side: 1, depth: 0.04, hex: '#15171a', noReveal: true });
  Z('matte', [[-5.0, 0.9], [-4.35, 0.9], [-4.35, 2.25], [-5.0, 2.25]], { side: -1, depth: 0.04, hex: '#15171a', noReveal: true });
  // dark skirt
  Z('matte', [[-5.6, 'b'], [5.6, 'b'], [5.6, 0.62], [-5.6, 0.62]], { hex: '#17191c' });
  void DI;
}

// ----- Glasgow carve zones: bay-and-pillar windows, deep lower windscreen + split upper screen with orange band, silver front + swoosh -----
function glasgowZones({ Z, glass, arch, P }) {
  P.dW = 1.5; P.dY = 2.7; P.dH = 0.46;
  for (const x of P.ax) arch(x);
  const bays = (x0, n, bw, pw, y0, y1, side, skip) => { for (let k = 0; k < n; k++) { const a = x0 + k * (bw + pw); if (skip && skip(a, a + bw)) continue; glass([[a, y0], [a + bw, y0], [a + bw, y1], [a, y1]], side ? { side } : {}); } };
  bays(-4.9, 8, 0.98, 0.19, 3.05, 3.95, 0);
  bays(-4.9, 7, 0.98, 0.19, 1.28, 2.25, 1);
  bays(-4.9, 5, 0.98, 0.19, 1.28, 2.25, -1);
  // front door (nearside) and driver's side window (offside)
  for (const [a, b] of [[3.5, 3.95], [4.0, 4.45]]) glass([[a, 0.85], [b, 0.85], [b, 2.25], [a, 2.25]], { side: -1 });
  glass([[3.9, 1.28], [4.75, 1.28], [4.75, 2.25], [3.9, 2.25]], { side: 1 });
  glass([[0.4, 0.85], [0.85, 0.85], [0.85, 2.25], [0.4, 2.25]], { side: -1 });
  glass([[0.9, 0.85], [1.35, 0.85], [1.35, 2.25], [0.9, 2.25]], { side: -1 });
  // front: deep lower windscreen, split upper screen, orange LED band
  glass([['f.9', 1.22], ['F', 1.22], ['F', 2.28], ['f.9', 2.28]]);
  glass([['f.9', 3.1], ['F', 3.1], ['F', 3.95], ['f.9', 3.95]]);
  Z('lit', [['f.8', 2.42], ['F', 2.42], ['F', 2.96], ['f.8', 2.96]], { depth: 0.012, noReveal: true, uvFn: (p) => [0.5 - p.z / 1.5, 0.5 + (p.y - 2.7) / 0.46] });
  Z('matte', [['f.93', 2.3], ['F', 2.3], ['F', 3.08], ['f.93', 3.08]], { hex: BLK });
  // rear: route number, engine louvres
  glass([['r.9', 3.1], ['R', 3.1], ['R', 3.95], ['r.9', 3.95]]);
  Z('lit', [['r.45', 2.55], ['R', 2.55], ['R', 2.95], ['r.45', 2.95]], { depth: 0.012, noReveal: true, uvFn: (p) => [lerp(0.02, 0.2, 0.5 + p.z / 0.8), 0.5 + (p.y - 2.75) / 0.4] });
  Z('matte', [['r.8', 0.75], ['R', 0.75], ['R', 2.2], ['r.8', 2.2]], { hex: '#15171a', depth: 0.05, noReveal: true });
  Z('matte', [['r.5', 0.5], ['R', 0.5], ['R', 0.66], ['r.5', 0.66]], { hex: '#f4f1ea' });
  // livery: silver front + diagonal swoosh, lavender stripes behind it, dark skirt
  Z('matte', [[-5.5, 'b'], [5.5, 'b'], [5.5, 0.62], [-5.5, 0.62]], { hex: '#17191c' });
  Z('trim', [['f.8', 0.62], ['F', 0.62], ['F', 2.3], ['f.8', 2.3]], { hex: '#e9ebf0' });
  Z('trim', [[1.4, 0.62], [5.5, 0.62], [5.5, 3.05], [3.9, 3.05]], { hex: '#e9ebf0' });
  for (const [d, w] of [[0.42, 0.14], [0.8, 0.14]]) Z('trim', [[1.4 - d, 0.62], [1.4 - d + w, 0.62], [3.9 - d + w, 3.05], [3.9 - d, 3.05]], { hex: '#bfa3e6' });
}

// ---- assembly ----
const GEO = {};
function make(P, hero) {
  const key = P.name + (hero ? 'H' : 'A');
  const geos = GEO[key] ??= bake(P, hero), group = new THREE.Group();
  group.name = P.name;
  for (const role in geos.out) {
    const mat = role === 'body' ? paint(P.color, true) : role === 'lit' ? destMat(P.dest[0], ...P.dest.slice(1)) : role === 'glass' ? fixed(hero ? 'heroGlass' : 'busGlass') : fixed(role);
    const mesh = new THREE.Mesh(geos.out[role], mat);
    mesh.castShadow = role === 'body'; mesh.receiveShadow = role === 'body' || role === 'trim';
    group.add(mesh);
  }
  const wheels = [];
  if (hero) {
    const wg = wheelGeo(P.wr, 0.3, '#aeb3b9', true);
    for (const x of P.ax) for (const s of [-1, 1]) {
      const w = new THREE.Group(), m = new THREE.Mesh(wg, fixed('matte'));
      m.castShadow = true; w.add(m); w.position.set(x, P.wr, s * (P.hw - 0.17)); w.name = 'wheel'; group.add(w); wheels.push(w);
    }
  }
  Object.assign(group.userData, { length: P.hl * 2 + 0.1, front: P.hl + 0.07, beamY: P.beamY, wheels, tris: geos.tris });
  return group;
}
export const buildLondonBus = ({ hero = false } = {}) => make(LONDON, hero);
export const buildGlasgowBus = ({ hero = false } = {}) => make(GLASGOW, hero);
