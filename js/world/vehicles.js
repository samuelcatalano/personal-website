import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
// Smooth stylised cars. Each type is built once into one merged geometry per material role; every car is a
// small group of meshes sharing that geometry and the shared role materials (paint is shared per colour).
// x = forward, y = up from the road, z = right, 1 unit = 1 m.
const M = new Map();
const cached = (key, make) => M.get(key) ?? M.set(key, make()).get(key);
const std = (color, roughness, metalness, glow, glowK) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (glow) { m.userData.glow = true; m.userData.glowK = glowK; } // sky.update drives emissive at night
  return m;
};
export const paint = (c) => cached('paint' + c, () => std(c, 0.45, 0.1));
const signMaterial = () => cached('sign', () => {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd36b'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#1b1d21'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAXI', 64, 34);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  const m = std('#ffffff', 0.5, 0, true, 1.1); m.map = m.emissiveMap = map; m.userData.glowColor = new THREE.Color('#ffffff');
  return m;
});
export const HEAD = '#fff0b5';
const FIXED = {
  glass: () => std('#2f4558', 0.25, 0.2),
  dark: () => std('#1b1d21', 0.7, 0),
  chrome: () => std('#d8dadc', 0.3, 0.25),
  tyre: () => std('#242629', 0.85, 0),
  alloy: () => std('#aeb3b9', 0.4, 0.25),
  plate: () => std('#f4f1ea', 0.6, 0),
  indi: () => std('#e8892b', 0.5, 0),
  head: () => std(HEAD, 0.3, 0, true, 2.6),
  tail: () => std('#c4151c', 0.4, 0, true, 1.2),
};
export const fixed = (role) => role === 'sign' ? signMaterial() : cached(role, FIXED[role]);
const CAST = new Set(['body', 'roof', 'glass']);

// ---- geometry helpers (all return non-indexed, uv-less BufferGeometry so roles merge) ----
const bare = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
function rounded(pts, r) { // polygon with quadratic-filleted corners
  const s = new THREE.Shape(), n = pts.length;
  const at = (i) => {
    const [x, y] = pts[i], [px, py] = pts[(i + n - 1) % n], [nx, ny] = pts[(i + 1) % n];
    const d1 = Math.hypot(px - x, py - y), d2 = Math.hypot(nx - x, ny - y), k1 = Math.min(r, d1 / 2) / d1, k2 = Math.min(r, d2 / 2) / d2;
    return [[x + (px - x) * k1, y + (py - y) * k1], [x, y], [x + (nx - x) * k2, y + (ny - y) * k2]];
  };
  for (let i = 0; i < n; i++) {
    const [a, c, b] = at(i);
    if (i) s.lineTo(...a); else s.moveTo(...a);
    s.quadraticCurveTo(...c, ...b);
  }
  return s;
}
// Smooth beveled slab: outline pts in (x, y), spanning z0..z1, outline unchanged by the bevel.
function slab(pts, r, z0, z1, bev = 0.04) {
  const g = new THREE.ExtrudeGeometry(rounded(pts, r), { depth: z1 - z0 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 3 });
  return toCreasedNormals(bare(g.translate(0, 0, z0 + bev)), 1.0);
}
function flat(pts, r, z0, z1) { // thin trim: no bevel
  return bare(new THREE.ExtrudeGeometry(rounded(pts, r), { depth: z1 - z0, bevelEnabled: false, curveSegments: 2 }).translate(0, 0, z0));
}
function plate(pts, r, X, t, rear) { // shape in (z, y), thickness t along x, outer face at +-X
  const g = new THREE.ExtrudeGeometry(rounded(pts, r), { depth: t, bevelEnabled: false, curveSegments: 2 });
  return bare(g.rotateY(rear ? Math.PI / 2 : -Math.PI / 2).translate(rear ? -X : X, 0, 0));
}
const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const ell = (x, y, z, sx, sy, sz, seg = 8) => bare(new THREE.SphereGeometry(1, seg, Math.ceil(seg * 0.6)).scale(sx, sy, sz).translate(x, y, z));
const cylZ = (x, y, z, r, w, seg) => bare(new THREE.CylinderGeometry(r, r, w, seg).rotateX(Math.PI / 2).translate(x, y, z));
const hex = (h, v0, v1) => { const m = (v0 + v1) / 2, q = h * 0.8; return [[-h, m], [-q, v1], [q, v1], [h, m], [q, v0], [-q, v0]]; };
function arch(x, wr, R, zo, t) { // clipped dark disc behind the wheel; never dips below the road
  const pts = [], y0 = 0.12;
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (-0.2 + 1.4 * i / 14); pts.push([x + R * Math.cos(a), Math.max(y0, wr + R * Math.sin(a))]); }
  return [flat(pts, 0, zo - t, zo), flat(pts, 0, -zo, -zo + t)];
}

// ---- type table ----
const T = {
  sedan: {
    e: 2.25, W: 1.78, wr: 0.33, wb: 2.7, sy: [0.4, 0.92], seams: [0.7, -0.3, -1.1],
    body: [[-2.25, 0.3], [2.25, 0.3], [2.28, 0.62], [2.14, 0.84], [0.9, 0.92], [-1.7, 0.96], [-2.15, 0.94], [-2.28, 0.76], [-2.28, 0.42]],
    glass: [[0.98, 0.86], [0.32, 1.37], [-0.96, 1.37], [-1.7, 0.9]], gw: 1.56, roof: [-1.08, 0.4, 1.34, 1.42],
    pillars: [[[1.02, 0.88], [0.88, 0.88], [0.22, 1.39], [0.38, 1.39]], [[-0.18, 0.88], [-0.36, 0.88], [-0.36, 1.38], [-0.22, 1.38]], [[-1.76, 0.88], [-1.6, 0.88], [-0.88, 1.39], [-1.04, 1.39]]],
    mirror: [0.92, 1.0], head: [0.62, 0.74], tail: [0.8], grille: [0.46, 0.6],
  },
  hatch: {
    e: 1.95, W: 1.72, wr: 0.31, wb: 2.45, sy: [0.4, 0.9], seams: [0.6, -0.2],
    body: [[-1.95, 0.3], [1.95, 0.3], [1.98, 0.6], [1.85, 0.82], [0.85, 0.9], [-1.75, 0.98], [-1.92, 0.9], [-1.99, 0.62], [-1.98, 0.4]],
    glass: [[0.95, 0.85], [0.34, 1.4], [-1.28, 1.42], [-1.8, 0.95]], gw: 1.5, roof: [-1.35, 0.42, 1.38, 1.46],
    pillars: [[[1.0, 0.87], [0.86, 0.87], [0.24, 1.43], [0.4, 1.43]], [[-0.12, 0.9], [-0.3, 0.9], [-0.3, 1.42], [-0.14, 1.42]], [[-1.86, 0.9], [-1.7, 0.9], [-1.2, 1.44], [-1.36, 1.44]]],
    mirror: [0.9, 0.98], head: [0.6, 0.72], tail: [0.8], grille: [0.44, 0.58],
  },
  suv: {
    e: 2.25, W: 1.88, wr: 0.39, wb: 2.75, sy: [0.5, 1.02], seams: [0.8, -0.3, -1.2],
    body: [[-2.25, 0.38], [2.25, 0.38], [2.29, 0.78], [2.17, 1.0], [0.95, 1.08], [-2.0, 1.12], [-2.2, 1.08], [-2.3, 0.9], [-2.3, 0.55]],
    glass: [[1.05, 1.02], [0.5, 1.66], [-1.78, 1.68], [-2.08, 1.06]], gw: 1.66, roof: [-1.9, 0.55, 1.64, 1.74],
    pillars: [[[1.12, 1.02], [0.98, 1.02], [0.4, 1.7], [0.56, 1.7]], [[-0.18, 1.04], [-0.36, 1.04], [-0.36, 1.68], [-0.2, 1.68]], [[-2.16, 1.02], [-2.0, 1.02], [-1.7, 1.7], [-1.86, 1.7]]],
    mirror: [1.0, 1.12], head: [0.7, 0.92], tail: [1.0], grille: [0.5, 0.74],
  },
  cab: { // London TX-style: black, tall, rounded
    e: 2.3, W: 1.8, wr: 0.33, wb: 2.8, sy: [0.4, 0.98], seams: [1.0, 0.0, -1.0], sign: 1,
    body: [[-2.3, 0.3], [2.3, 0.3], [2.34, 0.65], [2.2, 0.92], [1.45, 1.0], [-1.9, 1.05], [-2.2, 1.0], [-2.36, 0.8], [-2.34, 0.45]],
    glass: [[1.5, 0.95], [1.1, 1.66], [-1.75, 1.68], [-2.05, 1.0]], gw: 1.58, roof: [-1.9, 1.2, 1.64, 1.74],
    pillars: [[[1.56, 0.97], [1.42, 0.97], [1.0, 1.7], [1.16, 1.7]], [[0.12, 1.0], [-0.06, 1.0], [-0.06, 1.68], [0.1, 1.68]], [[-2.12, 1.0], [-1.96, 1.0], [-1.66, 1.7], [-1.82, 1.7]]],
    mirror: [1.45, 1.06], head: [0.62, 0.82], tail: [0.85], grille: [0.5, 0.72],
  },
  van: {
    e: 2.4, W: 1.9, wr: 0.36, wb: 3.0, sy: [0.45, 1.05], seams: [0.9, -0.9, -2.0],
    body: [[-2.4, 0.32], [2.4, 0.32], [2.44, 0.7], [2.32, 0.98], [1.1, 1.14], [-0.1, 1.18], [-0.1, 2.1], [-2.28, 2.12], [-2.42, 1.98], [-2.44, 0.5]],
    glass: [[1.15, 1.1], [0.7, 1.86], [-0.06, 1.88], [-0.06, 1.1]], gw: 1.66, roof: [-0.14, 0.82, 1.84, 1.94],
    pillars: [[[1.2, 1.12], [1.06, 1.12], [0.6, 1.9], [0.76, 1.9]]],
    mirror: [1.0, 1.2], head: [0.66, 0.85], tail: [0.9], grille: [0.5, 0.78],
  },
  mini: { // Mini Cooper: white body, red roof, black pillars, chrome nose and bumpers, round headlamps
    e: 1.7, W: 1.68, wr: 0.3, wb: 2.14, wid: 0.22, seg: 22, archR: 0.08, archT: 0.008, wo: 0.04, sy: [0.4, 0.93], seams: [0.62, -0.34], pillarRole: 'dark', roofRole: 'roof',
    body: [[-1.7, 0.3], [1.7, 0.3], [1.7, 0.45], [1.7, 0.86], [1.6, 0.95], [0.72, 0.96], [-1.45, 0.98], [-1.67, 0.92], [-1.73, 0.7], [-1.72, 0.42]],
    glass: [[0.8, 0.86], [0.52, 1.38], [-1.16, 1.38], [-1.44, 0.88]], gw: 1.42, roof: [-1.24, 0.56, 1.35, 1.44], rw: 0.06,
    pillars: [[[0.88, 0.88], [0.72, 0.88], [0.44, 1.38], [0.6, 1.38]], [[-0.22, 0.9], [-0.38, 0.9], [-0.38, 1.38], [-0.24, 1.38]], [[-1.52, 0.88], [-1.36, 0.88], [-1.1, 1.38], [-1.26, 1.38]]],
    mirror: [0.62, 1.04],
    extra(add) {
      const hood = (x) => 0.96 - 0.0385 * (x - 0.72);
      for (const s of [-1, 1]) { // bonnet stripes follow the hood line
        const z0 = s * 0.12, z1 = s * 0.3, [a, b] = z0 < z1 ? [z0, z1] : [z1, z0];
        add('roof', flat([[0.8, hood(0.8) - 0.02], [1.45, hood(1.45) - 0.02], [1.45, hood(1.45) + 0.02], [0.8, hood(0.8) + 0.02]], 0, a, b));
      }
      add('chrome', plate([[-0.37, 0.44], [0.37, 0.44], [0.37, 0.66], [-0.37, 0.66]], 0.07, 1.745, 0.045)); // wide 'moustache' grille surround
      add('dark', plate([[-0.33, 0.475], [0.33, 0.475], [0.33, 0.625], [-0.33, 0.625]], 0.05, 1.755, 0.035));
      for (const v of [0.49, 0.525, 0.56, 0.595]) add('chrome', plate(rect(-0.31, 0.31, v, v + 0.014), 0, 1.762, 0.012)); // horizontal slats
      for (const s of [-1, 1]) {
        add('chrome', bare(new THREE.TorusGeometry(0.155, 0.024, 6, 20).rotateY(Math.PI / 2).translate(1.7, 0.7, s * 0.6)));
        add('head', ell(1.69, 0.7, s * 0.6, 0.06, 0.13, 0.13, 12));
        add('indi', ell(1.69, 0.46, s * 0.62, 0.04, 0.035, 0.07, 6));
        add('tail', ell(-1.72, 0.72, s * 0.68, 0.045, 0.15, 0.07, 8)); // vertical rear lamps
        add('indi', ell(-1.72, 0.9, s * 0.68, 0.04, 0.035, 0.07, 6));
      }
      add('chrome', slab(rect(1.62, 1.78, 0.3, 0.45), 0.05, -0.78, 0.78, 0.03)); // bumpers
      add('chrome', slab(rect(-1.78, -1.62, 0.3, 0.45), 0.05, -0.78, 0.78, 0.03));
    },
  },
};

function buildGeometry(t) {
  const P = {}, add = (role, g) => (P[role] ??= []).push(...[g].flat());
  const { e, W, wr, wb, body, glass, gw, roof, pillars, seg = 14, wid = 0.24 } = t, h = W / 2;
  const n = Math.max(...body.map((p) => p[0])), rr = -Math.min(...body.map((p) => p[0]));
  add('body', slab(body, 0.12, -h, h, 0.05));
  add('dark', slab(rect(-e + 0.15, e - 0.15, 0.2, 0.42), 0.04, -h + 0.12, h - 0.12, 0.03)); // underbody
  add('glass', slab(glass, 0.07, -gw / 2, gw / 2, 0.03));
  const rw = gw / 2 + (t.rw ?? 0.05);
  add(t.roofRole ?? 'body', slab(rect(roof[0], roof[1], roof[2], roof[3]), 0.05, -rw, rw, 0.04));
  for (const q of pillars) { add(t.pillarRole ?? 'body', flat(q, 0.015, gw / 2 - 0.03, gw / 2 + 0.02)); add(t.pillarRole ?? 'body', flat(q, 0.015, -gw / 2 - 0.02, -gw / 2 + 0.03)); }
  for (const x of t.seams) for (const s of [h - 0.012, -h - 0.004]) add('dark', flat(rect(x - 0.008, x + 0.008, t.sy[0], t.sy[1]), 0, s, s + 0.016));
  for (const x of [wb / 2, -wb / 2]) add('dark', arch(x, wr, wr + (t.archR ?? 0.07), h + (t.archT ?? 0.006), (t.archT ?? 0.006) + 0.012)); // flares, both flanks
  for (const s of [-1, 1]) {
    add('body', ell(t.mirror[0], t.mirror[1], s * (h + 0.04), 0.07, 0.055, 0.09, 8));
    for (const x of [wb / 2, -wb / 2]) {
      const z = s * (h - wid / 2 + (t.wo ?? 0.02));
      add('tyre', cylZ(x, wr, z, wr, wid, seg));
      add('alloy', cylZ(x, wr, z, wr * 0.55, wid + 0.01, seg));
      add('dark', cylZ(x, wr, z, wr * 0.38, wid + 0.016, seg));
      add('alloy', cylZ(x, wr, z, wr * 0.17, wid + 0.022, 10));
    }
  }
  if (!t.extra) { // generic nose / tail furniture
    const [hz, hy] = t.head, [ty] = t.tail, [gu, gy] = t.grille;
    for (const s of [-1, 1]) {
      add('head', ell(e - 0.1, hy, s * hz, 0.1, 0.07, 0.2));
      add('tail', ell(-e + 0.07, ty, s * hz, 0.08, 0.07, 0.22));
    }
    add('dark', plate(rect(-gu * 0.7, gu * 0.7, gy - 0.16, gy), 0.04, n + 0.02, 0.05));
    add('dark', plate(rect(-h + 0.12, h - 0.12, 0.3, 0.46), 0.05, n + 0.025, 0.05));
    add('dark', plate(rect(-h + 0.12, h - 0.12, 0.3, 0.46), 0.05, rr + 0.025, 0.05, true));
    add('plate', plate(rect(-0.26, 0.26, 0.34, 0.44), 0.02, n + 0.035, 0.02));
    add('plate', plate(rect(-0.26, 0.26, 0.52, 0.64), 0.02, rr + 0.035, 0.02, true));
  } else {
    add('plate', plate(rect(-0.2, 0.2, 0.5, 0.62), 0.02, rr + 0.045, 0.045, true));
    t.extra(add);
  }
  if (t.sign) { // rooftop TAXI light box
    const g = new THREE.BoxGeometry(0.34, 0.16, 0.7).translate(0.45, roof[3] + 0.07, 0);
    add('sign', g);
  }
  const out = {};
  for (const k in P) out[k] = mergeGeometries(P[k]);
  out.tris = Object.values(out).reduce((a, g) => a + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  return out;
}
const GEO = {};
function make(type, color, roofColor) {
  const geos = GEO[type] ??= buildGeometry(T[type]), group = new THREE.Group();
  group.name = type;
  for (const role in geos) {
    if (role === 'tris') continue;
    const m = new THREE.Mesh(geos[role], role === 'body' ? paint(color) : role === 'roof' ? paint(roofColor ?? color) : fixed(role));
    m.castShadow = CAST.has(role); m.receiveShadow = role === 'body' || role === 'roof';
    group.add(m);
  }
  group.userData.tris = geos.tris;
  return group;
}
export const CAR_TYPES = ['sedan', 'hatch', 'suv', 'cab', 'van'];
export function buildCar(type, color = '#c9252b') { return make(type, type === 'cab' ? '#16181c' : color); }
export function buildMini() { return make('mini', '#f4f1ea', '#c9252b'); }
export { cylZ, bare };
