import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from './palette.js';
import { buildLamps } from './lamp-mesh.js';
import { createLampPools } from './lamps.js';
import { blockMaterial } from './textures.js';
import { underpassFrames, UNDERPASS } from './layout.js';
import { createBridgeStreet, bridgeStreetGeometry } from './bridge-street.js';
import { riverProfile, RIVER_RUN, RIVER_WIDTH, RIVER_CUT_HW, DECK_T, BRIDGE_H, PARAPET_H, PARAPET_T, CAP_T, CAP_OVERHANG, parapetHeight } from './underwater-profile.js';
// Countryside embankment carrying a two-lane road over the route with a masonry arch underpass across the road at each Glasgow livery boundary (scotRange). The bus is
// completely inside the tunnel for a moment, so scene.js swaps London <-> Glasgow there and the camera never sees the model pop.
// Local frame: x along the route, z across it, y up. Shared material buckets, instanced lanterns and deck light pools.
export const HX = 7.5, W = 9, H = BRIDGE_H, ARCH_HALF_WIDTH = 5.5; // tunnel half length, masonry half width, deck height, clear arch half width
const AW = ARCH_HALF_WIDTH, AWALL = 3.4, AB = 3.0; // opening half width, vertical wall height, elliptical crown rise
const ARCH_SEGMENTS = 16;
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
export const deckHeight = (z, river) => river && z * river.sigma >= 0 ? riverProfile(Math.abs(z), river.bankAz) : crest(Math.abs(z));
// Finish is shared by both bridges; joints fade with pixel footprint instead of sparkling at distance.
function finishMaterial(mat, masonry) {
  const compile = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => key + '-bridge-finish-2-' + masonry;
  mat.onBeforeCompile = (sh) => {
    compile(sh);
    // Merged metric geometry has no unit-box edges; its own coursing supplies the relief.
    sh.fragmentShader = sh.fragmentShader.replace('#define VOXEL_EDGE\n', '');
    sh.fragmentShader = sh.fragmentShader.replace('diffuseColor *= texture2D(map, tuv);', 'diffuseColor *= mix(vec4(1.0), texture2D(map, tuv * 0.45), 0.18);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `
      vec2 face = abs(vLN.x) > abs(vLN.z) ? vLP.zy : vLP.xy;
      float course = floor(face.y / 0.62);
      vec2 cell = vec2(face.x / 1.6 + mod(course, 2.0) * 0.5, face.y / 0.62);
      vec2 edge = min(fract(cell), 1.0-fract(cell));
      vec2 aa = max(fwidth(cell), vec2(0.001));
      float joint = 1.0 - min(smoothstep(0.005, 0.005+aa.x, edge.x), smoothstep(0.012, 0.012+aa.y, edge.y));
      float detail = 1.0 - smoothstep(0.08, 0.35, max(aa.x, aa.y));
      float blockTint = fract(sin(dot(floor(cell), vec2(31.1, 71.7))) * 14531.7);
      float verticalFace = 1.0 - smoothstep(0.3, 0.8, abs(vLN.y));
      diffuseColor.rgb *= 1.0 - ${masonry ? '0.23' : '0.08'} * joint * detail * verticalFace;
      diffuseColor.rgb *= vec3(1.0) + ${masonry ? 'vec3(0.09,0.065,0.035)' : 'vec3(0.035,0.027,0.018)'} * (blockTint-0.5) * detail;
      float damp = (1.0-smoothstep(0.05, 0.65, vLP.y)) * verticalFace;
      diffuseColor.rgb *= 1.0 - damp * 0.12;
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (joint * 0.06 + (blockTint-0.5)*0.055) * detail, 0.76, 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float stoneRelief = min(smoothstep(0.005,0.014,edge.x),smoothstep(0.012,0.035,edge.y)) * ${masonry ? '0.004' : '0.0015'};
      vec3 bridgeDx = dFdx(-vViewPosition), bridgeDy = dFdy(-vViewPosition);
      vec3 bridgeRx = cross(bridgeDy,normal), bridgeRy = cross(normal,bridgeDx);
      float bridgeDet = dot(bridgeDx,bridgeRx);
      vec3 bridgeGrad = sign(bridgeDet) * (dFdx(stoneRelief)*bridgeRx + dFdy(stoneRelief)*bridgeRy) * detail * verticalFace;
      normal = normalize(max(abs(bridgeDet),1e-8)*normal - bridgeGrad);`);
  };
  return mat;
}
function parts(river) {
  const stone = [], light = [], lawn = [], road = [], line = [], para = [];
  const body = new THREE.Shape(); // masonry block with the opening cut out of its base
  body.moveTo(-W, 0); body.lineTo(-AW, 0); body.lineTo(-AW, AWALL); body.absellipse(0, AWALL, AW, AB, Math.PI, 0, true); body.lineTo(AW, 0); body.lineTo(W, 0); body.lineTo(W, H); body.lineTo(-W, H); body.closePath();
  stone.push(along(body, 2 * HX, -HX));
  const ring = archShape(0.5); // voussoir ring: outer arch, then back along the opening
  ring.lineTo(AW, 0); ring.lineTo(AW, AWALL); ring.absellipse(0, AWALL, AW, AB, 0, Math.PI, false); ring.lineTo(-AW, 0); ring.closePath();
  for (const f of [1, -1]) {
    light.push(along(ring, 0.10, f > 0 ? HX : -HX - 0.10));
    const moulding = soup(), profiles = [[0.04,0.12],[0.09,0.16],[0.15,0.16],[0.20,0.22],[0.40,0.22],[0.46,0.15],[0.50,0.15]];
    const point = (t,r,d) => V(f*(HX+d), AWALL+(AB+r)*Math.sin(t), (AW+r)*Math.cos(t));
    for (let k = 0; k < ARCH_SEGMENTS; k++) {
      const a = k*Math.PI/ARCH_SEGMENTS+0.003, b = (k+1)*Math.PI/ARCH_SEGMENTS-0.003;
      for (let j = 0; j < profiles.length-1; j++) {
        const [r,d] = profiles[j], [r1,d1] = profiles[j+1];
        moulding.quad(point(a,r,d),point(b,r,d),point(b,r1,d1),point(a,r1,d1),V(f,0,0));
        for (const [t,out] of [[a,V(0,-Math.cos(a),Math.sin(a))],[b,V(0,Math.cos(b),-Math.sin(b))]])
          moulding.quad(point(t,r,0.10),point(t,r,d),point(t,r1,d1),point(t,r1,0.10),out);
      }
      for (const [r,d] of [profiles[0],profiles.at(-1)])
        moulding.quad(point(a,r,0.10),point(b,r,0.10),point(b,r,d),point(a,r,d),V(0,Math.sin(a),Math.cos(a)).multiplyScalar(r < 0.1 ? -1 : 1));
    }
    light.push(moulding.geo());
    const crown = new THREE.Shape();
    crown.moveTo(-0.18,AWALL+AB+0.04); crown.lineTo(0.18,AWALL+AB+0.04); crown.lineTo(0.36,AWALL+AB+0.60); crown.lineTo(-0.36,AWALL+AB+0.60); crown.closePath();
    light.push(along(crown,0.17,f > 0 ? HX+0.13 : -HX-0.30));
    for (const side of [-1,1]) {
      const faceBox = (depth,y0,y1,z0,z1) => box(f > 0 ? HX : -HX-depth,f > 0 ? HX+depth : -HX,y0,y1,Math.min(side*z0,side*z1),Math.max(side*z0,side*z1));
      for (let k = 0; k < 7; k++) light.push(faceBox(0.065,0.38+k*0.94,0.88+k*0.94,W-(k%2 ? 0.55 : 0.80),W-0.03));
      // Raised surrounds leave a quiet recessed panel on each existing solid pier.
      for (const [z0,z1] of [[6.50,6.60],[8.02,8.12]]) stone.push(faceBox(0.055,1.05,5.90,z0,z1));
      for (const [y0,y1] of [[1.05,1.15],[5.80,5.90]]) stone.push(faceBox(0.055,y0,y1,6.50,8.12));
    }
    for (const side of [-1,1]) light.push(box(f*HX-0.07,f*HX+0.07,0.02,0.28,side*(AW+0.8)-0.4,side*(AW+0.8)+0.4));
    light.push(box(f * HX - 0.12 * (f > 0 ? 0 : 1), f * HX + 0.12 * (f > 0 ? 1 : 0), 7.0, 7.3, -W - 0.1, W + 0.1)); // string course
    light.push(box(f * (HX - 0.4) - 0.35, f * (HX - 0.4) + 0.35, H + 0.9, H + 1.02, -W, W)); // coping
    stone.push(box(f * (HX - 0.4) - 0.25, f * (HX - 0.4) + 0.25, H, H + 0.9, -W, W)); // parapet
  }
  const lo = soup(), riverWalls = soup();
  for (const s of [-1, 1]) { // concrete wings, sloped sides, easing into the fields
    const az = [W - 0.1, FLAT, ...Array.from({ length: 10 }, (_, k) => FLAT + (END - FLAT) * (k + 1) / 10)], prof = az.map((a) => { const y = deckHeight(s * a, river), cw = river && s === river.sigma ? RIVER_CUT_HW : BASE - (BASE - CREST) * y / H; return { z: s * a, y, cw }; });
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      for (const x of [-1, 1]) {
        if (river && s === river.sigma) riverWalls.quad(V(x * RIVER_CUT_HW, -0.05, a.z), V(x * RIVER_CUT_HW, a.y + 0.07, a.z), V(x * RIVER_CUT_HW, b.y + 0.07, b.z), V(x * RIVER_CUT_HW, -0.05, b.z), V(x, 0, 0));
        else lo.quad(V(x * BASE, -0.05, a.z), V(x * a.cw, a.y, a.z), V(x * b.cw, b.y, b.z), V(x * BASE, -0.05, b.z), V(x, 0.4, 0));
      }
      lo.quad(V(-a.cw, a.y, a.z), V(a.cw, a.y, a.z), V(b.cw, b.y, b.z), V(-b.cw, b.y, b.z), V(0, 1, 0));
    }
  }
  lawn.push(lo.geo());
  if (river) stone.push(riverWalls.geo());
  // two-lane road over the crest (level over the masonry, sloping off with the wings): asphalt, centre line, edge lines and low parapets
  const zs = [-END, ...Array.from({ length: 10 }, (_, k) => -(END - (END - FLAT) * (k + 1) / 10)), FLAT, ...Array.from({ length: 10 }, (_, k) => FLAT + (END - FLAT) * (k + 1) / 10)];
  const bed = soup(), mk = soup(), UP = V(0, 1, 0), strip = (g, x0, x1, y, z0, z1, h0, h1) => g.quad(V(x0, h0 + y, z0), V(x1, h0 + y, z0), V(x1, h1 + y, z1), V(x0, h1 + y, z1), UP);
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], y0 = deckHeight(z0, river), y1 = deckHeight(z1, river);
    strip(bed, -ROAD_HW, ROAD_HW, 0.12, z0, z1, y0, y1);
    for (const c of [0, -ROAD_HW + 0.3, ROAD_HW - 0.3]) strip(mk, c - 0.07, c + 0.07, 0.14, z0, z1, y0, y1);
  }
  for (const x of [-1, 1]) {
    const outer = river ? RIVER_CUT_HW : ROAD_HW + 0.15;
    const inner = outer - (river ? PARAPET_T : 0.3), x0 = x < 0 ? -outer : inner, x1 = x < 0 ? -inner : outer;
    (river ? para : stone).push(box(x0, x1, H + 0.07, H + PARAPET_H - CAP_T, -W, W));
    (river ? para : light).push(box(x0 - CAP_OVERHANG, x1 + CAP_OVERHANG, H + PARAPET_H - CAP_T, H + PARAPET_H, -W, W));
  }
  road.push(bed.geo()); line.push(mk.geo());
  return { stone, light, lawn, road, line, ...(river ? { para } : {}) };
}
// River leg stays level with the arch crest across the channel and comes
// down the exit past the far bank (underwater-profile.js). Land approaches have vertical retaining walls; the channel has a thin stone slab.
// The stone abutments at the banks carry it; no pier stands in the water. Light curbs, walkways and pale parapets with a cap run the whole length.
// Local frame of the pass: x along the route, z across it; `sigma` is the side the river lies on (-1 for both current crossings).
// Parapet wall and cap share the same profile on the arch and river approaches.
function riverBridge(sigma, bankAz) {
  const far = bankAz + RIVER_RUN + 2, b0 = bankAz, b1 = bankAz + RIVER_WIDTH, UP = V(0, 1, 0), DOWN = V(0, -1, 0);
  const az = [...new Set([W, END, ...Array.from({ length: Math.ceil(far - W) + 1 }, (_, i) => Math.min(far, W + i)), b0, b1])].sort((p, q) => p - q);
  const road = soup(), line = soup(), stone = soup(), light = soup(), pave = soup(); // light = pale parapet stone (own 'para' mesh)
  const h = (a) => riverProfile(a, bankAz), top = (a) => h(a) + 0.12, Z = (a) => sigma * a, HW = RIVER_CUT_HW, KW = ROAD_HW + 0.25, PI = HW - PARAPET_T;
  const strip = (g, x0, x1, ya, yb, a, b, n = UP) => g.quad(V(x0, ya, Z(a)), V(x1, ya, Z(a)), V(x1, yb, Z(b)), V(x0, yb, Z(b)), n);
  const wall = (g, x, y0a, y1a, y0b, y1b, a, b, out) => g.quad(V(x, y0a, Z(a)), V(x, y1a, Z(a)), V(x, y1b, Z(b)), V(x, y0b, Z(b)), V(out, 0, 0));
  for (let i = 0; i < az.length - 1; i++) {
    const a = az[i], b = az[i + 1], ya = top(a), yb = top(b), pa = parapetHeight(a, bankAz) - 0.12 - CAP_T, pb = parapetHeight(b, bankAz) - 0.12 - CAP_T, wet = a >= b0 && b <= b1;
    if (a >= END) { // existing arch approach already supplies the asphalt and markings
      strip(road, -ROAD_HW, ROAD_HW, ya, yb, a, b);
      for (const c of [0, -ROAD_HW + 0.3, ROAD_HW - 0.3]) strip(line, c - 0.07, c + 0.07, ya + 0.02, yb + 0.02, a, b);
    }
    for (const x of [-1, 1]) {
      const [k0, k1] = x < 0 ? [-KW, -ROAD_HW] : [ROAD_HW, KW], [w0, w1] = x < 0 ? [-PI, -KW] : [KW, PI], [p0, p1] = x < 0 ? [-HW - CAP_OVERHANG, -PI + CAP_OVERHANG] : [PI - CAP_OVERHANG, HW + CAP_OVERHANG];
      strip(line, k0, k1, ya + 0.12, yb + 0.12, a, b); // light curb
      wall(line, x * ROAD_HW, ya, ya + 0.12, yb, yb + 0.12, a, b, -x); // curb face toward the road
      strip(pave, w0, w1, ya + 0.12, yb + 0.12, a, b); // walkway in bank pavers
      wall(light, x * PI, ya + 0.12, ya + pa, yb + 0.12, yb + pb, a, b, -x); // parapet, inner face
      wall(light, x * HW, ya - 0.05, ya + pa, yb - 0.05, yb + pb, a, b, x); // parapet, outer face
      strip(light, p0, p1, ya + pa + CAP_T, yb + pb + CAP_T, a, b); // cap, slightly wider than the parapet
      for (const [xc, o] of [[p0, -1], [p1, 1]]) wall(light, xc, ya + pa, ya + pa + CAP_T, yb + pb, yb + pb + CAP_T, a, b, o);
      if (wet) wall(stone, x * HW, ya - DECK_T, ya - 0.05, yb - DECK_T, yb - 0.05, a, b, x); // slab edge
      else if (a >= END) wall(stone, x * HW, -0.05, ya - 0.05, -0.05, yb - 0.05, a, b, x); // vertical retaining wall keeps the approaches inside the deck footprint
    }
    if (wet) strip(stone, -HW, HW, ya - DECK_T, yb - DECK_T, a, b, DOWN); // soffit
  }
  for (const side of [-1, 1]) {
    const inner = side * PI, outer = side * HW, y = top(far), p = parapetHeight(far, bankAz) - 0.12;
    light.quad(V(inner,y-0.05,Z(far)),V(outer,y-0.05,Z(far)),V(outer,y+p,Z(far)),V(inner,y+p,Z(far)),V(0,0,sigma));
  }
  for (const [a, out] of [[b0, sigma], [b1, -sigma]]) { // abutments: stone face from the ground to the soffit, as wide as the embankment foot
    const y = top(a) - DECK_T;
    stone.quad(V(-HW, -0.05, Z(a)), V(HW, -0.05, Z(a)), V(HW, y, Z(a)), V(-HW, y, Z(a)), V(0, 0, out));
  }
  return { road: road.geo(), line: line.geo(), stone: stone.geo(), para: light.geo(), pave: pave.geo() };
}
export function createUnderpass(curve, stops, river = null) {
  const colors = { stone: '#b6afa0', light: '#dfd9cb', lawn: '#b6afa0', road: P.road, line: P.arch, pave: P.paverWarm, para: '#d1cbbd' }, mats = {}, geos = [];
  for (const k in colors) mats[k] = blockMaterial(colors[k]);
  mats.pave.color.set('#a9a69b');
  for (const k of ['stone', 'lawn', 'para', 'light']) finishMaterial(mats[k], k === 'stone' || k === 'lawn');
  const root = new THREE.Group(), lampSpots = [], spillSpots = []; root.name = 'underpasses';
  const passes = underpassFrames(curve, stops).map(({ t, tc }, i) => {
    const c = curve.getPointAt(tc), tan = curve.getTangentAt(tc), g = new THREE.Group();
    g.name = 'underpass-' + i; g.position.copy(c); g.rotation.y = Math.atan2(-tan.z, tan.x);
    // river crossing: the centre sits inside the river's x-range; the near bank is 11 m (half the channel) from the river centreline
    const onRiver = !!river && c.x > river.x0 && c.x < river.x1;
    const bankAz = onRiver ? Math.abs(river.z + Math.sign(c.z - river.z) * river.width / 2 - c.z) * Math.abs(tan.x) : 0;
    const sigma = onRiver ? Math.sign(river.z - c.z) * Math.sign(tan.x) : 1;
    const riverLeg = onRiver ? { bankAz, sigma, inAz: bankAz + RIVER_RUN + 2 } : null;
    const street = onRiver ? createBridgeStreet({x:c.x,z:c.z,tx:tan.x,tz:tan.z},riverLeg,i) : null;
    const pr = parts(riverLeg);
    if (onRiver) {
      const shoulder = soup();
      for (const side of [-1, 1]) {
        shoulder.quad(V(side*HX,0,sigma*W),V(side*HX,H+0.07,sigma*W),V(side*RIVER_CUT_HW,H+0.07,sigma*(W+4)),V(side*RIVER_CUT_HW,0,sigma*(W+4)),V(side,0,0));
      }
      shoulder.quad(V(-HX,H+0.07,sigma*W),V(HX,H+0.07,sigma*W),V(RIVER_CUT_HW,H+0.07,sigma*(W+4)),V(-RIVER_CUT_HW,H+0.07,sigma*(W+4)),V(0,1,0));
      pr.stone.push(shoulder.geo());
      const br = riverBridge(sigma, bankAz); for (const k in br) (pr[k] ??= []).push(br[k]);
      for (const [k,geo] of Object.entries(bridgeStreetGeometry(street))) (pr[k] ??= []).push(geo);
      const farBank = bankAz + RIVER_WIDTH, end = bankAz + RIVER_RUN;
      for (const side of [-1, 1]) {
        const x = side * RIVER_CUT_HW;
        // Cornice and base courses follow each bank approach; nothing narrows the navigable channel.
        for (let a = W; a < end; a += 1) {
          const b = Math.min(end, a + 1), ya = riverProfile(a, bankAz), yb = riverProfile(b, bankAz);
          const band = soup();
          band.quad(V(x + side*0.055, ya-0.16, sigma*a), V(x + side*0.055, ya+0.035, sigma*a), V(x + side*0.055, yb+0.035, sigma*b), V(x + side*0.055, yb-0.16, sigma*b), V(side,0,0));
          pr.light.push(band.geo());
          if (a < bankAz || a >= farBank) {
            const bh = Math.min(0.3, ya), base = soup();
            base.quad(V(x+side*0.06,0,sigma*a), V(x+side*0.06,bh,sigma*a), V(x+side*0.06,Math.min(0.3,yb),sigma*b), V(x+side*0.06,0,sigma*b), V(side,0,0));
            pr.light.push(base.geo());
          }
        }
        for (let az = 16; az < end-3; az += 8) {
          if (az > bankAz-1 && az < farBank+1) continue;
          const y = riverProfile(az, bankAz);
          if (y < 0.7) continue;
          pr.stone.push(box(Math.min(x,x+side*0.1),Math.max(x,x+side*0.1),0.25,y-0.18,sigma*az-0.23,sigma*az+0.23));
        }
      }
    }
    for (const k in pr) {
      const geo = mergeGeometries(pr[k].map((x) => { if (!x.attributes.normal) x.computeVertexNormals(); return x.index ? x.toNonIndexed() : x; }));
      const masonry = ['stone','light','lawn','para'].includes(k);
      const tint = new THREE.Color(...(masonry ? (i === 0 ? [0.99, 1.005, 1.015] : [1.035, 1.005, 0.975]) : [1,1,1]));
      const color = new Float32Array(geo.attributes.position.count * 3);
      for (let v = 0; v < geo.attributes.position.count; v++) tint.toArray(color,v*3);
      geo.setAttribute('color',new THREE.BufferAttribute(color,3)); mats[k].vertexColors = true;
      geos.push(geo);
      const m = new THREE.Mesh(geo, mats[k]);
      m.castShadow = k === 'stone' || k === 'lawn'; m.receiveShadow = true;
      g.add(m);
    }
    if (onRiver) {
      g.updateMatrix();
      for (let az = 0; az < bankAz + RIVER_RUN - 3; az += 12) {
        // Low heritage lanterns follow the continuous parapet caps.
        for (const side of [-1, 1]) {
          const x = side * (RIVER_CUT_HW - PARAPET_T / 2);
          const y = deckHeight(sigma * az, riverLeg) + parapetHeight(az, bankAz);
          const p = V(x, y, sigma * az).applyMatrix4(g.matrix);
          lampSpots.push([p.x, p.z, 0, 'uk', p.y, 0.38]);
          if (az <= bankAz + RIVER_WIDTH) {
            const q = V(side * 2.55, H + 0.15, sigma * az).applyMatrix4(g.matrix);
            spillSpots.push([q.x, q.z, 1, q.y]);
          }
        }
      }
    }
    root.add(g);
    return { t: tc, boundary: t, x: c.x, z: c.z, tx: tan.x, tz: tan.z, half: HX, river: riverLeg, street };
  });
  const lamps = lampSpots.length ? buildLamps(lampSpots) : null;
  if (lamps) root.add(lamps);
  const spill = createLampPools(root, spillSpots, 1.8, [], false);
  root.userData.setNight = (n) => { lamps?.userData.setNight(n); spill.update(n); };
  let disposed = false;
  root.userData.dispose = () => { if (disposed) return; disposed = true; spill.dispose(); lamps?.userData.dispose(); geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); };
  const offset = (p, x, z) => (x - p.x) * p.tx + (z - p.z) * p.tz; // signed distance along the road from the arch centre
  return { group: root, passes, offset };
}
