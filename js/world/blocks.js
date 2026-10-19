import { rng, stopIndex, riverStart, riverEnd, copan, regions, inRegion, glasgowSites, LANDMARKS as L } from './layout.js';
import { house } from './houses.js';
import { PALETTE as P } from './palette.js';
const { concrete: C, cream: CR, white: W, stone: S, sandstone: SS, brick: B, glass: G, terracotta: TC, ochre: OC, mint: MN, salmon: SA, skyBlue: SB, offWhite: OW, concreteDark: CD, concreteMid: CM, redBrown: RB, londonStock: LS, teal: TL, bronze: BZ } = P, AWN = [P.red, P.slate, P.sand];
// [unit w, depth, floors lo..hi, floor h, walls, trim, kind: 0 flats 1 glass 2 shops 3 terrace]. Walls are picked with the existing r() draw.
const PRE = [
  [10, 10, 3, 4, 3, [CR, SS, S, TC, OC, OW], W, 0], [10, 10, 2, 2, 3.4, [CR, SS, W, MN, SA, SB], S, 2], [14, 12, 8, 15, 3, [C, SS, CR, CD, CM], W, 0],
  [11, 11, 8, 13, 3.5, [G, TL, BZ], C, 1], [6, 9, 3, 4, 3, [B, CR, B], W, 3], [16, 11, 4, 6, 3.2, [B, RB, LS, SS], CR, 0], [12, 12, 10, 24, 3.6, [G, TL, BZ], C, 1],
];
// [side (0: fixed z), front offset or z, SP mix, London mix]; mix[0] = low fallback
const ROWS = [
  [1, 29, [1, 0, 1], [4]], [1, 43, [0, 1, 0], [4]], [-1, 29, [1, 2, 2, 3, 0], [4, 5, 5]], [-1, 43, [0, 2, 3, 2], [4, 5, 6]],
  [0, -80, [0, 2, 3, 2], [4, 5, 6]], [0, -93, [3, 2, 3, 3], [6, 6, 5, 6]],
];
export function draw(add, x, z, [w0, d, n, fh, wall, trim, kind, u], r, q, near, civic) {
  const floors = civic ? Math.min(n, Math.floor(16 / fh)) : n;
  const w = w0 * u, h = floors * fh, zf = z + d / 2, nb = Math.round(w / 3.4), pw = w / nb, left = x - w / 2;
  if (kind > 2) { // London terrace: one townhouse per unit; r() drawn as before so later placements stay put
    for (let i = 0; i < n * 2 * u; i++) r();
    for (let i = 0; i < u; i++) house(add, q, left + (i + 0.5) * w0, z, 1, w0, d, near ? Math.min(floors, 2) : floors, fh, near);
    return;
  }
  add(x, 0, z, w, h, d, wall);
  add(x, h, z, w + 0.4, 0.4, d + 0.4, kind === 1 ? P.steel : P.roof);
  for (let k = 0; k < n; k++) {
    const y = k * fh;
    if (k && k < floors) add(x, y, z, w + 0.3, 0.3, d + 0.3, trim);
    for (let j = 0; j < nb; j++) {
      const wx = left + (j + 0.5) * pw, lit = r() < 0.08, wy = y + fh * 0.25, wh = fh * 0.55;
      if (k >= floors) continue; // Consume each floor's RNG so later districts keep their layout.
      if (kind === 1) { if (lit) add(wx, wy, zf, pw * 0.7, wh, 0.14, P.lit); continue; }
      if (kind === 2 && !k) { add(wx, 0.3, zf, pw * 0.8, 2.3, 0.14, G); add(wx, 2.6, zf + 0.5, pw * 0.9, 0.3, 1.2, AWN[r() * 3 | 0]); continue; }
      add(wx, wy, zf, pw * 0.45, wh, 0.14, lit ? P.lit : G);
    }
  }
}
// Back rows + skyline. Skips `hard` (river, landmarks + 6 m, plaza), `occ` (houses), 26 m of road; near side and Sé/MASP flanks <= 12 m.
export function buildBlocks(add, stops, pts, curve, occ) {
  const r = rng(7311), q = rng(5521), { museum: mu, uni } = glasgowSites(stops, pts), site = (o, m) => [o.x - o.w / 2 - m, o.x + o.w / 2 + m, o.z - o.d / 2 - m, o.z + o.d / 2 + m], cp = copan(stops, pts), gl = pts[stopIndex(stops, L.glasgow)], rgs = regions(stops, pts), X = (k) => pts[stopIndex(stops, L[k])].x, mv = X('heathrow') - 15, lz = pts[pts.length - 1].z;
  const H = (k, a, b, z0, z1) => [X(k) - a, X(k) + b, z0, z1], path = Array.from({ length: 241 }, (_, i) => curve.getPointAt(i / 240));
  const zAt = (x) => path.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a).z;
  const hard = [
    [riverStart(stops, pts) - 6, riverEnd(stops, pts) + 6, -64, -26], H('masp', 26, 26, -76, -50), H('se', 24, 24, -77, -49), H('estaiada', 16, 16, -80, -12),
    H('heathrow', 18, 18, -38, -14), H('bigben', 10, 43, -76, -48), H('wembley', 30, 30, -92, -50), H('wembley', 14, 14, lz + 10, lz + 45),
    [gl.x - 20, gl.x + 20, gl.z - 43, gl.z - 17], site(mu, 5), site({ ...uni, w: uni.w + 12, d: 30 }, 4), // museum + university with its hill
 ...rgs.map((rg) => [rg.ctry[0], rg.ctry[1], -400, 400]), // countryside: country.js owns it
    ...pts.slice(0, 6).map((p) => [p.x - 16, p.x + 16, -80, -58]),
  ];
  // Reserved after the fact: blocks that would land here still draw r() but add nothing, so every other block keeps its place.
  const cut = [
    [cp.x - cp.len / 2 - 3, cp.x + cp.len / 2 + 3, cp.z - cp.amp - cp.depth / 2 - 1.5, cp.z + cp.amp + cp.depth / 2 + 1.5],
    [X('masp') - 25, X('masp') + 25, -50, 12], // clear view of MASP from the taqtile camera
    H('se', 24, 24, -56, 40), // open forecourt and view of the cathedral steps
    H('wembley', 30, 30, -49, -33), // stadium frontage stays visible between the side buildings
    [mu.x - mu.w / 2 - 4, mu.x + mu.w / 2 + 4, -100, mu.z - 8], // open backdrop behind the Riverside Museum (r() still drawn, nothing added)
  ];
  const hit = (a, b, e = 0) => a[0] < b[1] + e && b[0] - e < a[1] && a[2] < b[3] + e && b[2] - e < a[3];
  for (const [side, f, sp, uk] of ROWS) for (let x = pts[0].x - 40; x < X('wembley') + 40;) {
    const sc = inRegion(rgs, 'scot', x), sub = inRegion(rgs, 'sub', x), mix = sc ? [0] : x > mv ? uk : sp; // Scottish edge: low red-sandstone flats
    const make = (s) => [s[0], s[1], s[2] + (r() * (s[3] - s[2] + 1) | 0), s[4], sc && !s[7] ? (r(), P.redSand) : s[5][r() * s[5].length | 0], s[6], s[7], s[7] > 2 ? 3 + (r() * 3 | 0) : 1];
    const low = side && (side > 0 || sc || sub || x < mv && [X('se'), X('masp')].some((l) => Math.abs(x - l) < 34));
    let b = make(PRE[mix[r() * mix.length | 0]]);
    const z = () => (side ? zAt(x + w() / 2) + side * (f + b[1] / 2) : f), w = () => b[0] * b[7], bad = () => low && b[2] * b[3] > 12;
    if (bad()) b = make(PRE[mix[0]]);
    const R = [x - 1, x + w() + 1, z() - b[1] / 2 - 1, z() + b[1] / 2 + 1];
    if (!bad() && ![...hard, ...occ].some((o) => hit(R, o)) && !path.some((p) => hit(R, [p.x, p.x, p.z, p.z], 25))) {
      const clear = side > 0 && Math.abs(x + w() / 2 - X('wembley')) < 35; // camera side of the last stop stays open
      const civic = z() <= -65 && (x + w() >= X('bigben') - 20 && x <= rgs[0].sub[1] || x + w() >= rgs[0].scot[0] && x <= rgs[1].scot[1]); // London landmark stretch + Glasgow (both edges) only
      draw(clear || cut.some((o) => hit(R, o)) ? () => {} : add, x + w() / 2, z(), b, r, q, side > 0, civic);
      occ.push(R);
      x += w() + 2 + r() * 3;
    } else x += 6;
  }
  // Fill the three gaps beside the starting park; own RNG preserves every other district.
  const infill = rng(1947);
  for (const [dx, z, w, floors, wall] of [[-52, -14, 10, 3, CR], [-52, 0, 10, 4, SS], [-52, 14, 10, 3, OW], [-52, -34, 10, 3, OC], [1, -36, 8, 3, MN]]) {
    draw(add, pts[0].x + dx, z, [w, 10, floors, 3, wall, W, 0, 1], infill, infill, false, false);
  }
  for (const [dx, z, floors, wall] of [[-48, -68, 10, SS], [-34, -64, 8, C]]) {
    draw(add, X('wembley') + dx, z, [10, 10, floors, 3, wall, W, 0, 1], infill, infill, false, false);
  }
}
