import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
// Procedural vehicles. SPECS[type].build(A, opts) pushes parts into per-role lists; each (type, hero) is merged once into one
// geometry per material role and cached, every instance is a small group of meshes sharing it. Roles: body (paint per colour),
// trim + matte (shared vertex-colour materials), glass, head, tail, lit (destination / taxi sign), cabin (bus interior glow).
// x = forward, y = up from the road, z = right, 1 unit = 1 m. No logos or wordmarks anywhere.
const M = new Map();
const cached = (key, make) => M.get(key) ?? M.set(key, make()).get(key);
const WARM = new THREE.Color('#ffc865');
const std = (color, roughness, metalness, glow, glowK, vc) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, vertexColors: !!vc });
  if (glow) { m.userData.glow = true; m.userData.glowK = glowK; } // sky.update drives emissive at night
  return m;
};
export const paint = (c, gloss) => cached('paint' + c + (gloss ? 'g' : ''), () => std(c, gloss ? 0.28 : 0.45, 0.1));
const signMaterial = () => cached('sign', () => {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd36b'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#1b1d21'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAXI', 64, 34);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  const m = std('#ffffff', 0.5, 0, true, 1.1); m.map = m.emissiveMap = map; m.userData.glowColor = new THREE.Color('#ffffff');
  return m;
});
// dot-matrix destination board: amber dots on black, 256x40 canvas; glows at night through the sky.update glow path
const destMaterial = (key, text, fg) => cached('dest' + key, () => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 40;
  const g = cv.getContext('2d');
  g.fillStyle = '#0b0a09'; g.fillRect(0, 0, 256, 40);
  g.fillStyle = fg; g.font = 'bold 25px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 22);
  g.fillStyle = 'rgba(0,0,0,.6)';
  for (let x = 0; x < 256; x += 3) g.fillRect(x, 0, 1, 40);
  for (let y = 0; y < 40; y += 3) g.fillRect(0, y, 256, 1);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  const m = std('#ffffff', 0.5, 0, true, 1.5); m.map = m.emissiveMap = map; m.userData.glowColor = new THREE.Color('#ffffff');
  return m;
});
export const HEAD = '#fff0b5';
const FIXED = {
  glass: () => std('#2f4558', 0.25, 0.2),
  busGlass: () => { const m = std('#3d5262', 0.2, 0.3, true, 0.12); m.userData.glowColor = WARM; return m; },
  heroGlass: () => { const m = std('#4f6877', 0.2, 0.3, true, 0.1); m.userData.glowColor = WARM; m.transparent = true; m.opacity = 0.5; m.depthWrite = false; return m; },
  cabin: () => { const m = std('#2a2622', 0.9, 0, true, 0.9); m.userData.glowColor = WARM; return m; }, // interior shell seen through the windows: dark by day, warm at night
  trim: () => std('#ffffff', 0.4, 0.1, false, 0, true), // vertex-coloured: chrome, alloys, accent paint
  matte: () => std('#ffffff', 0.75, 0, false, 0, true), // vertex-coloured: trim, tyres, seats, plates
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
const CAST = new Set(['body', 'trim', 'glass']);

// ---- geometry helpers (non-indexed, uv-less unless noted, so roles merge) ----
const bare = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
const COL = {};
const colg = (g, hex) => { // flat vertex colour (linear) for the trim / matte materials
  const c = COL[hex] ??= new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  return g.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
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
function slab(pts, r, z0, z1, bev = 0.04, bs = 2, cs = 3) {
  const g = new THREE.ExtrudeGeometry(rounded(pts, r), { depth: z1 - z0 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: bs, curveSegments: cs });
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
const box = (x, y, z, w, h, d) => bare(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
const cylZ = (x, y, z, r, w, seg) => bare(new THREE.CylinderGeometry(r, r, w, seg).rotateX(Math.PI / 2).translate(x, y, z));
const cylY = (x, y, z, r, h, seg) => bare(new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z));
const hex = (h, v0, v1) => { const m = (v0 + v1) / 2, q = h * 0.8; return [[-h, m], [-q, v1], [q, v1], [h, m], [q, v0], [-q, v0]]; };
function arch(x, wr, R, zo, t) { // clipped dark disc behind the wheel; never dips below the road
  const pts = [], y0 = 0.12;
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (-0.2 + 1.4 * i / 14); pts.push([x + R * Math.cos(a), Math.max(y0, wr + R * Math.sin(a))]); }
  return [flat(pts, 0, zo - t, zo), flat(pts, 0, -zo, -zo + t)];
}
// vertical display quad (keeps uv): face = +x / -x / +z / -z
function pane(face, w, h, X, y, z = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  if (face === '+x') g.rotateY(Math.PI / 2); else if (face === '-x') g.rotateY(-Math.PI / 2); else if (face === '-z') g.rotateY(Math.PI);
  return g.translate(face.endsWith('x') ? X : z, y, face.endsWith('x') ? z : X).toNonIndexed();
}
const TYRE = '#242629', DK = '#1b1d21', BLK = '#121417', CH = '#d8dadc', WHT = '#f4f1ea', AMB = '#e8892b', RED = '#c0262d', BUSRED = '#c9252b';
// Shared wheel: tyre + rim + dish + hub, vertex-coloured, axis on z. Cached per radius/width/rim; hero gets spokes and more segments.
const wheelGeo = (r, w, rim, hero) => cached(`wh${r}|${w}|${rim}|${hero}`, () => {
  const seg = hero ? 22 : 12, parts = [];
  const add = (g, hex) => parts.push(colg(g, hex));
  add(cylZ(0, 0, 0, r, w, seg), TYRE);
  add(cylZ(0, 0, 0, r * 0.62, w + 0.014, seg), rim);
  add(cylZ(0, 0, 0, r * 0.42, w + 0.024, seg), '#2b2e33');
  if (hero) for (let k = 0; k < 5; k++) add(bare(new THREE.BoxGeometry(r * 0.5, r * 0.12, w + 0.034).translate(r * 0.3, 0, 0).rotateZ(k * Math.PI * 2 / 5 + 0.3)), rim);
  add(cylZ(0, 0, 0, r * 0.16, w + 0.044, hero ? 10 : 6), rim);
  return mergeGeometries(parts);
});
// round lamp: chrome bezel + glowing lens, axis x (front) at x
const lamp = (A, x, y, z, r, hero, rear) => {
  const s = rear ? -1 : 1;
  A('trim', bare(new THREE.TorusGeometry(r, r * 0.17, 6, hero ? 20 : 12).rotateY(Math.PI / 2).scale(1, 0.9, 1.1).translate(x, y, z)), CH);
  A('head', ell(x - s * 0.02, y, z, r * 0.4, r * 0.9, r, hero ? 12 : 8));
};

// ---- Mini hatch: cream body, red roof + mirror caps, twin red bonnet stripes, white roof stripes, oval lamps, hexagon grille ----
function miniParts(A, { hero }) {
  const bs = hero ? 3 : 2, cs = hero ? 4 : 3, h = 0.82, hood = (x) => 0.98 - 0.068 * (x - 0.62), seg = hero ? 12 : 8, NX = 1.97;
  A('body', slab([[-1.92, 0.3], [1.92, 0.3], [1.95, 0.5], [1.93, 0.8], [1.8, 0.9], [0.62, 0.98], [-1.75, 1.02], [-1.9, 0.95], [-1.96, 0.65], [-1.94, 0.4]], 0.12, -h, h, 0.05, bs, cs));
  A('matte', slab(rect(-1.77, 1.77, 0.2, 0.42), 0.04, -h + 0.12, h - 0.12, 0.03, 1, 2), DK);
  A('glass', slab([[0.72, 0.96], [0.16, 1.37], [-1.2, 1.37], [-1.72, 1.0]], 0.07, -0.7, 0.7, 0.03, 1, 2));
  A('trim', slab(rect(-1.3, 0.24, 1.36, 1.44), 0.05, -0.73, 0.73, 0.04, 1, 2), RED); // floating red roof
  for (const z of [-0.2, 0.2]) A('trim', box(-0.5, 1.444, z, 1.5, 0.008, 0.07), WHT); // twin white roof stripes
  for (const s of [-1, 1]) { // twin red bonnet stripes follow the hood line
    const a = s * 0.12, b = s * 0.3, z0 = Math.min(a, b), z1 = Math.max(a, b);
    A('trim', flat([[0.75, hood(0.75) - 0.01], [1.7, hood(1.7) - 0.01], [1.7, hood(1.7) + 0.007], [0.75, hood(0.75) + 0.007]], 0, z0, z1), RED);
  }
  A('body', ell(1.15, hood(1.15) + 0.004, 0, 0.2, 0.045, 0.1, seg)); // bonnet scoop
  for (const q of [[[0.76, 0.96], [0.64, 0.96], [0.12, 1.38], [0.24, 1.38]], [[-0.2, 0.97], [-0.36, 0.97], [-0.36, 1.38], [-0.22, 1.38]], [[-1.78, 0.98], [-1.62, 0.98], [-1.14, 1.38], [-1.28, 1.38]]])
    for (const s of [-1, 1]) A('matte', s > 0 ? flat(q, 0.015, 0.67, 0.72) : flat(q, 0.015, -0.72, -0.67), BLK); // blacked-out pillars
  for (const x of [0.62, -0.34]) for (const s of [h - 0.012, -h - 0.004]) A('matte', flat(rect(x - 0.008, x + 0.008, 0.4, 0.93), 0, s, s + 0.016), DK);
  for (const x of [1.25, -1.25]) A('matte', arch(x, 0.31, 0.39, h + 0.006, 0.018), BLK); // black arch trim
  for (const s of [-1, 1]) {
    A('trim', ell(0.58, 1.05, s * (h + 0.045), 0.06, 0.05, 0.07, 8), RED); // mirror caps
    lamp(A, 1.93, 0.78, s * 0.56, 0.15, hero);
    A('matte', ell(1.93, 0.5, s * 0.64, 0.04, 0.03, 0.07, 6), AMB);
    A('tail', ell(-1.96, 0.8, s * 0.66, 0.05, 0.17, 0.07, 8)); // vertical rear lamps
    A('matte', ell(-1.95, 1.0, s * 0.66, 0.04, 0.03, 0.07, 6), AMB);
  }
  A('trim', plate(hex(0.36, 0.46, 0.84), 0.02, NX + 0.005, 0.04), CH); // hexagon grille: chrome surround, black mesh, slats
  A('matte', plate(hex(0.32, 0.5, 0.8), 0.015, NX + 0.012, 0.03), BLK);
  for (const v of [0.58, 0.65, 0.72]) A('trim', plate(rect(-0.28, 0.28, v, v + 0.012), 0, NX + 0.018, 0.012), CH);
  A('matte', plate(rect(-0.55, 0.55, 0.3, 0.44), 0.05, NX - 0.005, 0.05), BLK); // lower intake
  A('matte', plate(rect(-0.2, 0.2, 0.32, 0.42), 0.015, NX + 0.012, 0.012), WHT);
  A('matte', plate(rect(-0.78, 0.78, 0.3, 0.46), 0.05, 1.985, 0.05, true), DK); // rear bumper
  A('matte', plate(rect(-0.2, 0.2, 0.52, 0.64), 0.015, 1.99, 0.02, true), WHT);
}

// ---- London cab (LEVC TX): tall rounded gloss-black van-like body, upright chrome slatted grille, round lamps, lit TAXI sign ----
function cabParts(A, { hero }) {
  const h = 0.95;
  A('body', slab([[-2.42, 0.32], [2.42, 0.32], [2.47, 0.55], [2.46, 0.98], [2.3, 1.08], [1.52, 1.12], [-2.2, 1.2], [-2.4, 1.12], [-2.47, 0.75], [-2.45, 0.45]], 0.13, -h, h, 0.06, hero ? 3 : 2, hero ? 4 : 3));
  A('matte', slab(rect(-2.2, 2.2, 0.2, 0.44), 0.04, -h + 0.12, h - 0.12, 0.03, 1, 2), DK);
  A('glass', slab([[1.56, 1.1], [1.12, 1.72], [-2.05, 1.74], [-2.3, 1.2]], 0.08, -0.81, 0.81, 0.03, 1, 2));
  A('body', slab(rect(-2.32, 1.22, 1.7, 1.78), 0.06, -0.88, 0.88, 0.05, 1, 2));
  for (const q of [[[1.6, 1.08], [1.46, 1.08], [1.04, 1.74], [1.2, 1.74]], [[0.18, 1.1], [0.0, 1.1], [0.0, 1.74], [0.16, 1.74]], [[-2.34, 1.16], [-2.18, 1.16], [-1.96, 1.74], [-2.12, 1.74]]])
    for (const s of [-1, 1]) A('body', s > 0 ? flat(q, 0.015, 0.78, 0.83) : flat(q, 0.015, -0.83, -0.78));
  for (const s of [h - 0.012, -h - 0.004]) A('trim', flat(rect(-2.2, 1.5, 1.09, 1.115), 0, s, s + 0.016), CH); // chrome belt line
  for (const x of [1.5, -1.5]) A('matte', arch(x, 0.34, 0.42, h + 0.006, 0.018), BLK);
  for (const s of [-1, 1]) {
    A('body', ell(1.42, 1.18, s * (h + 0.05), 0.06, 0.06, 0.08, 8)); // mirrors
    lamp(A, 2.46, 0.86, s * 0.7, 0.12, hero);
    A('matte', ell(2.46, 0.6, s * 0.78, 0.04, 0.03, 0.08, 6), AMB);
    A('tail', ell(-2.47, 0.88, s * 0.82, 0.05, 0.2, 0.07, 8));
  }
  const NX = 2.52; // big upright grille: chrome surround, dark mesh, vertical chrome slats
  A('trim', plate(rect(-0.42, 0.42, 0.5, 1.02), 0.07, NX, 0.05), CH);
  A('matte', plate(rect(-0.37, 0.37, 0.54, 0.98), 0.05, NX + 0.005, 0.03), BLK);
  for (let i = -4; i <= 4; i++) A('trim', plate(rect(i * 0.08 - 0.012, i * 0.08 + 0.012, 0.56, 0.96), 0, NX + 0.012, 0.012), CH);
  A('matte', plate(rect(-0.9, 0.9, 0.3, 0.5), 0.06, 2.5, 0.06), DK);
  A('matte', plate(rect(-0.26, 0.26, 0.33, 0.45), 0.015, 2.515, 0.012), WHT);
  A('matte', plate(rect(-0.9, 0.9, 0.3, 0.5), 0.06, 2.48, 0.06, true), DK);
  A('matte', plate(rect(-0.26, 0.26, 0.5, 0.62), 0.015, 2.495, 0.02, true), WHT);
  A('lit', new THREE.BoxGeometry(0.3, 0.14, 0.66).translate(0.9, 1.85, 0).toNonIndexed()); // TAXI roof sign
}

// ---- generic cars (sedan / hatch / suv / van): side-profile extrusions, kept from the previous model set ----
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
  van: {
    e: 2.4, W: 1.9, wr: 0.36, wb: 3.0, sy: [0.45, 1.05], seams: [0.9, -0.9, -2.0],
    body: [[-2.4, 0.32], [2.4, 0.32], [2.44, 0.7], [2.32, 0.98], [1.1, 1.14], [-0.1, 1.18], [-0.1, 2.1], [-2.28, 2.12], [-2.42, 1.98], [-2.44, 0.5]],
    glass: [[1.15, 1.1], [0.7, 1.86], [-0.06, 1.88], [-0.06, 1.1]], gw: 1.66, roof: [-0.14, 0.82, 1.84, 1.94],
    pillars: [[[1.2, 1.12], [1.06, 1.12], [0.6, 1.9], [0.76, 1.9]]],
    mirror: [1.0, 1.2], head: [0.66, 0.85], tail: [0.9], grille: [0.5, 0.78],
  },
};
const OLD = { dark: ['matte', DK], chrome: ['trim', CH], plate: ['matte', '#f4f1ea'], indi: ['matte', AMB] };
function carParts(A, t) {
  const add = (role, g) => OLD[role] ? A(...[OLD[role][0], g, OLD[role][1]]) : A(role, g);
  const { e, W, wr, wb, body, glass, gw, roof, pillars } = t, h = W / 2;
  const n = Math.max(...body.map((p) => p[0])), rr = -Math.min(...body.map((p) => p[0]));
  add('body', slab(body, 0.12, -h, h, 0.05));
  add('dark', slab(rect(-e + 0.15, e - 0.15, 0.2, 0.42), 0.04, -h + 0.12, h - 0.12, 0.03));
  add('glass', slab(glass, 0.07, -gw / 2, gw / 2, 0.03));
  const rw = gw / 2 + 0.05;
  add('body', slab(rect(roof[0], roof[1], roof[2], roof[3]), 0.05, -rw, rw, 0.04));
  for (const q of pillars) { add('body', flat(q, 0.015, gw / 2 - 0.03, gw / 2 + 0.02)); add('body', flat(q, 0.015, -gw / 2 - 0.02, -gw / 2 + 0.03)); }
  for (const x of t.seams) for (const s of [h - 0.012, -h - 0.004]) add('dark', flat(rect(x - 0.008, x + 0.008, t.sy[0], t.sy[1]), 0, s, s + 0.016));
  for (const x of [wb / 2, -wb / 2]) add('dark', arch(x, wr, wr + 0.07, h + 0.006, 0.018));
  for (const s of [-1, 1]) add('body', ell(t.mirror[0], t.mirror[1], s * (h + 0.04), 0.07, 0.055, 0.09, 8));
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
}

// ---- double-deckers: shared shell (base / mid / roof bands around a recessed interior core), glazing, wheels, furniture ----
// The camera sees the right (offside) flank (+z); doors are on the left (nearside, -z) like a UK bus.
function busParts(A, { hero }, S) {
  const bs = hero ? 3 : 1, cs = hero ? 4 : 2, hw = 1.275, hl = S.hl, FX = hl + 0.015;
  const flank = (zs, role, pts, r, zo, t, hex) => A(role, zs > 0 ? flat(pts, r, zo - t, zo) : flat(pts, r, -zo, -zo + t), hex);
  for (const [pts, r] of S.bands) A('body', slab(pts, r, -hw, hw, S.bev, bs, cs));
  A('cabin', slab(rect(-hl + 0.4, hl - 0.4, 1.15, 3.95), 0.1, -0.95, 0.95, 0.04, 1, 2));
  A('matte', slab(rect(-hl + 0.3, hl - 0.3, 0.3, 0.56), 0.05, -1.12, 1.12, 0.03, 1, 2), DK); // skirt
  const L = [1.22, 2.18], U = [3.02, 3.88]; // lower / upper window zones
  const zone = (zs, x0, x1, [y0, y1], post) => { // glass with rails and posts
    flank(zs, 'glass', rect(x0, x1, y0, y1), 0.05, 1.292, 0.03);
    flank(zs, 'matte', rect(x0, x1, y0, y0 + 0.07), 0, 1.3, 0.04, BLK);
    flank(zs, 'matte', rect(x0, x1, y1 - 0.07, y1), 0, 1.3, 0.04, BLK);
    for (let x = x0; x <= x1 + 0.01; x += hero ? post : post * 1.5) flank(zs, 'matte', rect(x - 0.045, x + 0.045, y0, y1), 0, 1.3, 0.04, BLK);
  };
  for (const zs of [1, -1]) {
    zone(zs, -hl + 0.5, hl - 0.5, U, 1.3);
    S.flank(A, zs, { zone, flank, L, U, hw, hero });
  }
  for (const x of S.ax) A('matte', arch(x, S.wr, S.wr + 0.1, hw + 0.006, 0.018), BLK);
  // front + rear glazing, lit destination boards on dark backers
  const pane2 = (x, rear, y0, y1, split) => {
    const g = (a, b) => A('glass', plate(rect(a, b, y0, y1), 0.08, x, 0.03, rear));
    if (split) { g(-1.0, -0.03); g(0.03, 1.0); A('matte', plate(rect(-0.03, 0.03, y0, y1), 0, x + 0.01, 0.04, rear), BLK); } else g(-1.0, 1.0);
  };
  pane2(FX, false, L[0] + 0.03, L[1] - 0.03, S.split); pane2(FX, false, U[0] + 0.03, U[1] - 0.03, S.split);
  pane2(FX, true, U[0] + 0.03, U[1] - 0.03, false);
  A('glass', plate(rect(-0.95, 0.95, 1.4, 2.4), 0.08, FX, 0.03, true));
  A('matte', plate(rect(-0.8, 0.8, S.dest[0] - 0.02, S.dest[1] + 0.02), 0.03, FX + 0.01, 0.03), BLK);
  A('lit', pane('+x', 1.4, 0.22, FX + 0.012, (S.dest[0] + S.dest[1]) / 2));
  A('lit', pane('-x', 0.96, 0.15, -FX - 0.012, 3.9));
  for (const zs of [1, -1]) A('lit', pane(zs > 0 ? '+z' : '-z', 0.96, 0.15, 1.31 * zs, 2.62, hl - 4));
  A('matte', plate(rect(-0.32, 0.32, 0.62, 0.8), 0.02, FX, 0.03, true), '#f2c230'); // rear plate
  A('matte', plate(rect(-0.32, 0.32, 0.62, 0.8), 0.02, FX, 0.03), WHT);
  for (const s of [-1, 1]) {
    A('tail', ell(-hl - 0.01, 1.7, s * 1.02, 0.05, 0.45, 0.07, 8));
    A('matte', ell(hl - 0.1, 0.96, s * 1.0, 0.04, 0.05, 0.1, 6), AMB);
    A('matte', box(hl - 0.3, 2.55, s * 1.36, 0.05, 0.05, 0.2), BLK); // mirror arm
    A('matte', box(hl - 0.3, 2.35, s * 1.45, 0.1, 0.5, 0.07), BLK); // mirror head
    A('trim', box(hl - 0.3, 2.62, s * 1.45, 0.12, 0.06, 0.09), S.mirror);
  }
  for (const x of S.pods) A('trim', ell(x, 4.33, 0, 0.85, 0.11, 0.5, hero ? 10 : 8), WHT);
  S.front(A, { hero, FX, lamp });
  if (hero) { // simplified interior seen through the windows: seat blocks, grab poles
    for (const [fy, n] of [[0.62, 9], [2.32, 11]]) for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const x = -4.1 + i * 0.86;
      A('matte', box(x, fy + 0.42, s * 1.07, 0.46, 0.1, 0.34), S.seat);
      A('matte', box(x - 0.2, fy + 0.7, s * 1.07, 0.08, 0.5, 0.34), S.seat);
    }
    for (const [fy, h] of [[0.6, 1.6], [2.3, 1.6]]) for (const x of [-3.3, -1.2, 1.2, 3.0]) for (const s of [-0.4, 0.4]) A('trim', cylY(x, fy + h / 2, s, 0.025, h, 6), '#d9c25a');
  }
}

// London: New Routemaster. Rounded nose and tail, black lower front mask with round lamps, glazed diagonal staircase bands, white roof pods.
const LONDON = {
  hl: 5.6, bev: 0.2, ax: [3.45, -2.65], wr: 0.52, wid: 0.3, pods: [-3.1, 0.1, 3.0], dest: [3.95, 4.17], mirror: '#f2c230', seat: '#33406b',
  bands: [
    [[[-5.4, 0.5], [5.3, 0.5], [5.6, 0.8], [5.6, 1.22], [-5.6, 1.22], [-5.6, 0.8]], 0.3],
    [rect(-5.6, 5.6, 2.18, 3.02), 0.1],
    [[[-5.6, 3.88], [5.6, 3.88], [5.6, 4.2], [5.4, 4.4], [-5.1, 4.4], [-5.6, 4.2]], 0.3],
  ],
  flank(A, zs, { zone, flank, L, hero }) {
    const near = zs < 0, x1 = 4.0;
    if (near) { // doors on the kerb side: front (ahead of the axle) and centre
      for (const [a, b] of [[4.2, 5.1], [0.1, 1.25]]) {
        flank(zs, 'matte', rect(a - 0.08, b + 0.08, 0.75, 2.22), 0.04, 1.29, 0.03, BLK);
        flank(zs, 'glass', rect(a, (a + b) / 2 - 0.02, 0.82, 2.14), 0.04, 1.31, 0.03);
        flank(zs, 'glass', rect((a + b) / 2 + 0.02, b, 0.82, 2.14), 0.04, 1.31, 0.03);
      }
      zone(zs, -4.7, 0.0, L, 1.3); zone(zs, 1.4, x1, L, 1.3);
    } else {
      zone(zs, -4.7, 4.5, L, 1.3);
      flank(zs, 'matte', rect(4.55, 5.15, 0.8, 2.22), 0.05, 1.29, 0.03, BLK); // driver's door
      flank(zs, 'glass', rect(4.65, 5.05, 1.4, 2.14), 0.04, 1.31, 0.03);
    }
    const diag = (pts, frame) => { flank(zs, 'matte', frame, 0.02, 1.285, 0.02, BLK); flank(zs, 'matte', pts, 0.02, 1.296, 0.03, '#2a3a46'); }; // opaque dark glazing
    diag([[-4.95, 1.35], [-4.2, 1.35], [-2.5, 3.0], [-3.25, 3.0]], [[-5.0, 1.3], [-4.1, 1.3], [-2.35, 3.0], [-3.4, 3.0]]); // rear staircase band
    if (near) diag([[4.95, 2.2], [4.4, 2.2], [3.0, 3.0], [3.55, 3.0]], [[5.0, 2.2], [4.3, 2.2], [2.9, 3.0], [3.65, 3.0]]); // front staircase band
  },
  split: false,
  front(A, { hero, FX, lamp }) {
    A('matte', plate(rect(-0.98, 0.98, 0.58, 1.2), 0.1, FX + 0.03, 0.05), BLK); // black lower mask
    for (const s of [-1, 1]) lamp(A, FX + 0.04, 0.9, s * 0.78, 0.15, hero);
    A('matte', plate(rect(-0.3, 0.3, 0.64, 0.8), 0.02, FX + 0.04, 0.012), WHT);
  },
};
// Glasgow: Wright StreetDeck. Squarer shell, flat front with two-piece windscreens, silver-white front and swoosh, lavender diagonals, yellow mirrors.
const SILVER = '#e9ebf0', LAV = '#bfa3e6';
const GLASGOW = {
  hl: 5.45, bev: 0.1, ax: [3.4, -2.7], wr: 0.52, wid: 0.3, pods: [-3.6, -1.2, 1.2, 3.6], dest: [3.96, 4.18], mirror: '#f5c20b', seat: '#4a2f78',
  bands: [
    [[[-5.3, 0.5], [5.3, 0.5], [5.45, 0.65], [5.45, 1.22], [-5.45, 1.22], [-5.45, 0.65]], 0.12],
    [rect(-5.45, 5.45, 2.18, 3.02), 0.06],
    [rect(-5.45, 5.45, 3.88, 4.3), 0.12],
  ],
  flank(A, zs, { zone, flank, L }) {
    const near = zs < 0;
    if (near) {
      for (const [a, b] of [[4.1, 5.0], [0.0, 1.1]]) {
        flank(zs, 'matte', rect(a - 0.08, b + 0.08, 0.75, 2.22), 0.04, 1.29, 0.03, BLK);
        flank(zs, 'glass', rect(a, b, 0.82, 2.14), 0.04, 1.31, 0.03);
      }
      zone(zs, -4.9, -0.1, L, 1.35); zone(zs, 1.3, 3.9, L, 1.3);
    } else zone(zs, -4.9, 5.0, L, 1.35);
    flank(zs, 'trim', [[5.4, 0.52], [5.4, 1.2], [0.8, 1.2], [-1.6, 0.52]], 0, 1.282, 0.01, SILVER); // swoosh on the base band
    flank(zs, 'trim', [[5.4, 2.2], [5.4, 3.0], [3.1, 3.0], [2.1, 2.2]], 0, 1.282, 0.01, SILVER); // front wedge on the mid band
    for (const x of [-4.4, -3.5, -2.6, -1.7, -0.8]) {
      flank(zs, 'trim', [[x, 2.2], [x + 0.28, 2.2], [x + 1.1, 3.0], [x + 0.82, 3.0]], 0, 1.282, 0.01, LAV); // lavender diagonals
      if (x > -3) flank(zs, 'trim', [[x + 1.4, 0.52], [x + 1.68, 0.52], [x + 2.2, 1.2], [x + 1.92, 1.2]], 0, 1.282, 0.01, LAV);
    }
  },
  split: true,
  front(A, { hero, FX, lamp }) {
    A('trim', plate(rect(-1.03, 1.03, 0.55, 1.2), 0.08, FX + 0.025, 0.04), SILVER);
    A('trim', plate(rect(-1.03, 1.03, 2.2, 3.0), 0.05, FX + 0.025, 0.04), SILVER);
    A('matte', plate(rect(-0.6, 0.6, 0.62, 0.84), 0.04, FX + 0.04, 0.02), BLK); // lower grille
    for (const s of [-1, 1]) lamp(A, FX + 0.04, 1.0, s * 0.82, 0.12, hero);
    A('matte', plate(rect(-0.3, 0.3, 0.84, 0.97), 0.02, FX + 0.04, 0.012), WHT);
  },
};

// ---- spec table ----
const WHEEL_ALLOY = '#aeb3b9';
const carSpec = (k) => { const t = T[k]; return { length: t.e * 2 + 0.1, front: t.e + 0.1, beamY: 0.55, wr: t.wr, wid: t.wid ?? 0.24, ax: [t.wb / 2, -t.wb / 2], wz: t.W / 2 - 0.12 + 0.02, rim: WHEEL_ALLOY, color: '#c9252b', glass: 'glass', build: (A) => carParts(A, t) }; };
export const SPECS = {
  mini: { length: 3.95, front: 1.99, beamY: 0.72, wr: 0.31, wid: 0.2, ax: [1.25, -1.25], wz: 0.78, rim: '#8a8f96', color: '#f1ead9', glass: 'glass', build: miniParts },
  cab: { length: 4.97, front: 2.54, beamY: 0.86, wr: 0.34, wid: 0.22, ax: [1.5, -1.5], wz: 0.86, rim: WHEEL_ALLOY, color: '#272c35', gloss: true, glass: 'glass', lit: 'sign', build: cabParts },
  london: { length: 11.3, front: 5.67, beamY: 0.9, wr: 0.52, wid: 0.3, ax: LONDON.ax, wz: 1.155, rim: WHEEL_ALLOY, color: BUSRED, bus: 1, lit: ['london', '19 Finsbury Park', '#ffb347'], build: (A, o) => busParts(A, o, LONDON) },
  glasgow: { length: 11.0, front: 5.52, beamY: 1.0, wr: 0.52, wid: 0.3, ax: GLASGOW.ax, wz: 1.155, rim: WHEEL_ALLOY, color: '#5b2a86', bus: 1, lit: ['glasgow', '6 Renfrew Street', '#ff7a1a'], build: (A, o) => busParts(A, o, GLASGOW) },
  sedan: carSpec('sedan'), hatch: carSpec('hatch'), suv: carSpec('suv'), van: carSpec('van'),
};

const GEO = {};
function buildGeos(S, hero) {
  const P = {}, A = (role, g, hex) => {
    for (const x of [g].flat()) (P[role] ??= []).push((role === 'trim' || role === 'matte') && !x.attributes.color ? colg(x, hex ?? '#ffffff') : x);
  };
  S.build(A, { hero });
  if (!hero) for (const x of S.ax) for (const s of [-1, 1]) A('matte', wheelGeo(S.wr, S.wid, S.rim, false).clone().translate(x, S.wr, s * S.wz)); // ambient: wheels merged, static
  const m = {};
  let tris = 0;
  for (const role in P) { m[role] = mergeGeometries(P[role]); tris += m[role].attributes.position.count / 3; }
  return { m, tris };
}
export function buildVehicle(type, { hero = false, color } = {}) {
  const S = SPECS[type];
  if (!S) throw new Error('unknown vehicle ' + type);
  const geos = GEO[type + (hero ? 'H' : 'A')] ??= buildGeos(S, hero), group = new THREE.Group();
  group.name = type;
  for (const role in geos.m) {
    const mat = role === 'body' ? paint(color ?? S.color, S.gloss)
      : role === 'lit' ? (S.lit === 'sign' ? fixed('sign') : destMaterial(...S.lit))
      : role === 'glass' ? fixed(S.bus ? (hero ? 'heroGlass' : 'busGlass') : S.glass)
      : fixed(role);
    const mesh = new THREE.Mesh(geos.m[role], mat);
    mesh.castShadow = CAST.has(role) && !mat.transparent; mesh.receiveShadow = role === 'body' || role === 'trim';
    if (role === 'cabin') mesh.material.side = THREE.FrontSide;
    group.add(mesh);
  }
  const wheels = [];
  if (hero) {
    const wg = wheelGeo(S.wr, S.wid, S.rim, true);
    for (const x of S.ax) for (const s of [-1, 1]) {
      const w = new THREE.Group(), mesh = new THREE.Mesh(wg, fixed('matte'));
      mesh.castShadow = true; w.add(mesh); w.position.set(x, S.wr, s * S.wz); w.name = 'wheel';
      group.add(w); wheels.push(w);
    }
  }
  Object.assign(group.userData, { length: S.length, front: S.front, beamY: S.beamY, wheels, tris: geos.tris });
  return group;
}
export const CAR_TYPES = ['sedan', 'hatch', 'suv', 'cab', 'van'];
export const buildCar = (type, color) => buildVehicle(type, { color: type === 'cab' ? undefined : color });
export const buildMini = (hero = true) => buildVehicle('mini', { hero });
export { cylZ, bare };
