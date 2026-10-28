import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from './palette.js';
import { blockMaterial } from './textures.js';
import { underpassFrames, UNDERPASS } from './layout.js';
// Countryside embankment carrying a two-lane road over the route with a masonry arch underpass across the road at each Glasgow livery boundary (scotRange). The bus is
// completely inside the tunnel for a moment, so scene.js swaps London <-> Glasgow there and the camera never sees the model pop.
// Local frame: x along the road, z across it (embankment), y up. 5 meshes per crossing (stone / light stone / lawn / asphalt / lines), shared block materials.
export const HX = 7.5, W = 9, H = 7.5; // tunnel half length, masonry half width, deck height
const AW = 5.5, AWALL = 3.4, AB = 3.0; // opening: half width, vertical wall height, elliptical crown rise
export const CLEARANCE = AWALL + AB * Math.sqrt(1 - (3.05 / AW) ** 2); // headroom over the outer edge of a bus in its lane (~5.9 m)
export const ROAD_HW = 3; // half width of the overpass road: two 3 m lanes
export const END = UNDERPASS.end;
const FLAT = 11, BASE = UNDERPASS.base, CREST = 4; // crest stays level to |z| = FLAT, then eases down to the fields at END; footprint half width BASE
// ponytail: metres along the road from the scotRange boundary, hand-fitted to the gaps between country.js rows; tests/underpass.browser.py fails if houses, trees or lamps ever overlap
export const crest = (az) => { const u = Math.min(1, Math.max(0, (az - FLAT) / (END - FLAT))); return H * (1 - u * u * (3 - 2 * u)); };
const bare = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
const box = (x0, x1, y0, y1, z0, z1) => bare(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// quad soup: wound so the face normal agrees with `out`
function soup() {
  const p = [];
  const tri = (a, b, c, out) => { const n = b.clone().sub(a).cross(c.clone().sub(a)); (n.dot(out) < 0 ? [a, c, b] : [a, b, c]).forEach((v) => p.push(v.x, v.y, v.z)); };
  return { quad(a, b, c, d, out) { tri(a, b, c, out); tri(a, c, d, out); }, geo() { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; } };
}
// extrude an (across, up) outline along x, from x0 to x0 + d
const along = (shape, d, x0) => bare(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 14 }).rotateY(Math.PI / 2).translate(x0, 0, 0));
function archShape(rt = 0) { // arch outline: rt = 0 the opening itself, rt > 0 the voussoir ring around it
  const s = new THREE.Shape(), a = AW + rt, b = AB + rt;
  s.moveTo(-a, 0); s.lineTo(-a, AWALL); s.absellipse(0, AWALL, a, b, Math.PI, 0, true); s.lineTo(a, 0);
  return s;
}
function parts() {
  const stone = [], light = [], lawn = [], road = [], line = [];
  const body = new THREE.Shape(); // masonry block with the opening cut out of its base
  body.moveTo(-W, 0); body.lineTo(-AW, 0); body.lineTo(-AW, AWALL); body.absellipse(0, AWALL, AW, AB, Math.PI, 0, true); body.lineTo(AW, 0); body.lineTo(W, 0); body.lineTo(W, H); body.lineTo(-W, H); body.closePath();
  stone.push(along(body, 2 * HX, -HX));
  const ring = archShape(0.5); // voussoir ring: outer arch, then back along the opening
  ring.lineTo(AW, 0); ring.lineTo(AW, AWALL); ring.absellipse(0, AWALL, AW, AB, 0, Math.PI, false); ring.lineTo(-AW, 0); ring.closePath();
  for (const f of [1, -1]) {
    light.push(along(ring, 0.15, f > 0 ? HX : -HX - 0.15));
    light.push(box(f * HX - 0.12 * (f > 0 ? 0 : 1), f * HX + 0.12 * (f > 0 ? 1 : 0), 7.0, 7.3, -W - 0.1, W + 0.1)); // string course
    light.push(box(f * (HX - 0.4) - 0.35, f * (HX - 0.4) + 0.35, H + 0.9, H + 1.02, -W, W)); // coping
    stone.push(box(f * (HX - 0.4) - 0.25, f * (HX - 0.4) + 0.25, H, H + 0.9, -W, W)); // parapet
  }
  const lo = soup();
  for (const s of [-1, 1]) { // concrete wings, sloped sides, easing into the fields
    const az = [W - 0.1, FLAT, ...Array.from({ length: 10 }, (_, k) => FLAT + (END - FLAT) * (k + 1) / 10)], prof = az.map((a) => { const y = crest(a), cw = BASE - (BASE - CREST) * y / H; return { z: s * a, y, cw }; });
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      for (const x of [-1, 1]) lo.quad(V(x * BASE, -0.05, a.z), V(x * a.cw, a.y, a.z), V(x * b.cw, b.y, b.z), V(x * BASE, -0.05, b.z), V(x, 0.4, 0));
      lo.quad(V(-a.cw, a.y, a.z), V(a.cw, a.y, a.z), V(b.cw, b.y, b.z), V(-b.cw, b.y, b.z), V(0, 1, 0));
    }
  }
  lawn.push(lo.geo());
  // two-lane road over the crest (level over the masonry, sloping off with the wings): asphalt, centre line, edge lines and low parapets
  const zs = [-END, ...Array.from({ length: 10 }, (_, k) => -(END - (END - FLAT) * (k + 1) / 10)), FLAT, ...Array.from({ length: 10 }, (_, k) => FLAT + (END - FLAT) * (k + 1) / 10)];
  const bed = soup(), mk = soup(), UP = V(0, 1, 0), strip = (g, x0, x1, y, z0, z1, h0, h1) => g.quad(V(x0, h0 + y, z0), V(x1, h0 + y, z0), V(x1, h1 + y, z1), V(x0, h1 + y, z1), UP);
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], y0 = crest(Math.abs(z0)), y1 = crest(Math.abs(z1));
    strip(bed, -ROAD_HW, ROAD_HW, 0.12, z0, z1, y0, y1);
    for (const c of [0, -ROAD_HW + 0.3, ROAD_HW - 0.3]) strip(mk, c - 0.07, c + 0.07, 0.14, z0, z1, y0, y1);
  }
  for (const x of [-1, 1]) {
    stone.push(box(x * ROAD_HW - 0.15, x * ROAD_HW + 0.15, H, H + 0.7, -W, W));
    light.push(box(x * ROAD_HW - 0.25, x * ROAD_HW + 0.25, H + 0.7, H + 0.78, -W, W)); // coping
  }
  road.push(bed.geo()); line.push(mk.geo());
  return { stone, light, lawn, road, line };
}
export function createUnderpass(curve, stops) {
  const colors = { stone: P.stone, light: P.concreteMid, lawn: P.concreteMid, road: P.road, line: P.arch }, mats = {}, geos = [];
  for (const k in colors) mats[k] = blockMaterial(colors[k]);
  const root = new THREE.Group(); root.name = 'underpasses';
  const passes = underpassFrames(curve, stops).map(({ t, tc }, i) => {
    const c = curve.getPointAt(tc), tan = curve.getTangentAt(tc), g = new THREE.Group();
    g.name = 'underpass-' + i; g.position.copy(c); g.rotation.y = Math.atan2(-tan.z, tan.x);
    const pr = parts();
    for (const k in pr) {
      const geo = mergeGeometries(pr[k].map((x) => { if (!x.attributes.normal) x.computeVertexNormals(); return x.index ? x.toNonIndexed() : x; }));
      geos.push(geo);
      const m = new THREE.Mesh(geo, mats[k]);
      m.castShadow = k === 'stone' || k === 'lawn'; m.receiveShadow = true;
      g.add(m);
    }
    root.add(g);
    return { t: tc, boundary: t, x: c.x, z: c.z, tx: tan.x, tz: tan.z, half: HX };
  });
  root.userData.dispose = () => { geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); };
  const offset = (p, x, z) => (x - p.x) * p.tx + (z - p.z) * p.tz; // signed distance along the road from the arch centre
  return { group: root, passes, offset };
}
