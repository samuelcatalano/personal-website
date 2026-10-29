import { rng, stopIndex, ukStart, riverStart, riverEnd, copan, regions, inRegion, glasgowSites, LANDMARKS as L } from './layout.js';
import { house } from './houses.js';
import { PALETTE as P } from './palette.js';
import { PARKS } from './parks.js';
import { walkPaths } from './crowd.js';
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
export function draw(add, x, z, [w0, d, n, fh, wall, trim, kind, u], r, q, near, civic, onArchitecturePlot, id = 'block') {
  const floors = civic ? Math.min(n, Math.floor(16 / fh)) : n;
  const w = w0 * u, h = floors * fh, zf = z + d / 2, nb = Math.round(w / 3.4), pw = w / nb, left = x - w / 2;
  const render = onArchitecturePlot ? () => {} : add;
  if (kind > 2) { // London terrace: one townhouse per unit; r() drawn as before so later placements stay put
    for (let i = 0; i < n * 2 * u; i++) r();
    const floorsHere = near ? Math.min(floors, 2) : floors;
    for (let i = 0; i < u; i++) {
      const cx = left + (i + 0.5) * w0;
      if (onArchitecturePlot) onArchitecturePlot({ id: `${id}-${i}`, kind: 'terrace', x: cx, z, width: w0, depth: d, height: floorsHere * fh });
      house(render, q, cx, z, 1, w0, d, floorsHere, fh, near);
    }
    return;
  }
  if (onArchitecturePlot) onArchitecturePlot({ id, kind: kind === 1 ? 'office' : kind === 2 ? 'shop' : 'midrise', x, z, width: w, depth: d, height: h });
  render(x, 0, z, w, h, d, wall);
  render(x, h, z, w + 0.4, 0.4, d + 0.4, kind === 1 ? P.steel : P.roof);
  for (let k = 0; k < n; k++) {
    const y = k * fh;
    if (k && k < floors) render(x, y, z, w + 0.3, 0.3, d + 0.3, trim);
    for (let j = 0; j < nb; j++) {
      const wx = left + (j + 0.5) * pw, lit = r() < 0.08, wy = y + fh * 0.25, wh = fh * 0.55;
      if (k >= floors) continue; // Consume each floor's RNG so later districts keep their layout.
      if (kind === 1) { if (lit) render(wx, wy, zf, pw * 0.7, wh, 0.14, P.lit); continue; }
      if (kind === 2 && !k) { render(wx, 0.3, zf, pw * 0.8, 2.3, 0.14, G); render(wx, 2.6, zf + 0.5, pw * 0.9, 0.3, 1.2, AWN[r() * 3 | 0]); continue; }
      render(wx, wy, zf, pw * 0.45, wh, 0.14, lit ? P.lit : G);
    }
  }
}
// Back rows + skyline. Skips `hard` (river, landmarks + 6 m, plaza), `occ` (houses), 26 m of road; near side and Sé/MASP flanks <= 12 m.
export function buildBlocks(add, stops, pts, curve, occ, onBuildingPlot, onArchitecturePlot) {
  const r = rng(7311), q = rng(5521), { museum: mu, uni } = glasgowSites(stops, pts), site = (o, m) => [o.x - o.w / 2 - m, o.x + o.w / 2 + m, o.z - o.d / 2 - m, o.z + o.d / 2 + m], cp = copan(stops, pts), gl = pts[stopIndex(stops, L.glasgow)], rgs = regions(stops, pts), X = (k) => pts[stopIndex(stops, L[k])].x, ux = pts[ukStart(stops)].x, mv = ux - 15, lz = pts[pts.length - 1].z;
  // Plots touching MASP's west side are dropped after generation (the RNG sequence of the rest of the city stays untouched).
  const maspW = onArchitecturePlot && ((p) => p.x + p.width / 2 > X('masp') - 40 && p.x - p.width / 2 < X('masp') - 19 && p.z + p.depth / 2 > -80 && p.z - p.depth / 2 < -42);
  if (maspW) { const emit = onArchitecturePlot; onArchitecturePlot = (p) => { if (!maspW(p)) emit(p); }; }
  const H = (k, a, b, z0, z1) => [X(k) - a, X(k) + b, z0, z1], path = Array.from({ length: 241 }, (_, i) => curve.getPointAt(i / 240));
  const zAt = (x) => path.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a).z;
  const hard = [
    [riverStart(stops, pts) - 6, riverEnd(stops, pts) + 6, -64, -26], H('masp', 26, 26, -76, -50), H('se', 24, 24, -77, -49), H('estaiada', 16, 16, -80, -12),
    [ux - 18, ux + 18, -38, -14], // ukRiverfront: only preserves the row's RNG sequence (skipped rectangles consume no r()); the infill below fills it
    H('bigben', 10, 43, -76, -48), H('wembley', 30, 30, -92, -50), H('wembley', 14, 14, lz + 10, lz + 45),
    [gl.x - 20, gl.x + 20, gl.z - 43, gl.z - 17], site(mu, 5), site(uni, 16), // museum + university with its hill
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
  const pilotKinds = new Set(), pilotX0 = X('eye') + 10, pilotX1 = X('eye') + 80, pilotZ0 = -100, pilotZ1 = 65;
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
      const kind = b[6] === 3 ? 'terrace' : b[6] === 1 ? 'office' : 'midrise';
      const pilot = onBuildingPlot && x + w() / 2 > pilotX0 && x + w() / 2 < pilotX1 && z() > pilotZ0 && z() < pilotZ1 && !pilotKinds.has(kind);
      if (pilot) {
        pilotKinds.add(kind);
        const floors = civic ? Math.min(b[2], Math.floor(16 / b[3])) : b[2];
        onBuildingPlot({ id: `london-${kind}`, kind, x: x + w() / 2, z: z(), width: w(), depth: b[1], height: (side > 0 && kind === 'terrace' ? Math.min(floors, 2) : floors) * b[3] });
      }
      const cutOut = cut.some((o) => hit(R, o));
      const architecture = onArchitecturePlot && !clear && !cutOut ? onArchitecturePlot : undefined;
      draw(pilot || clear || cutOut || architecture ? () => {} : add, x + w() / 2, z(), b, r, q, side > 0, civic, architecture, `block-${Math.round(x)}-${Math.round(z())}`);
      occ.push(R);
      x += w() + 2 + r() * 3;
    } else x += 6;
  }
  // Fill the three gaps beside the starting park; own RNG preserves every other district.
  const infill = rng(1947);
  for (const [dx, z, w, floors, wall] of [[-52, -14, 10, 3, CR], [-52, 0, 10, 4, SS], [-52, 14, 10, 3, OW], [-52, -34, 10, 3, OC], [1, -36, 8, 3, MN]]) {
    draw(add, pts[0].x + dx, z, [w, 10, floors, 3, wall, W, 0, 1], infill, infill, false, false, onArchitecturePlot, `infill-${dx}-${z}`);
  }
  // Riverfront at the first UK stop (old airport site): a London terrace pair and a 4-floor midrise between the Thames path and the far pavement.
  const riverfront = rng(2019); // own stream: the shared infill rng keeps feeding the Wembley flank blocks unchanged
  for (const [x, w, d, floors, wall, kind, u] of [[ux - 8, 5.5, 6, 3, B, 3, 2], [ux + 6, 10, 6, 4, LS, 0, 1]]) {
    draw(add, x, -26, [w, d, floors, 3, wall, W, kind, u], riverfront, riverfront, false, false, onArchitecturePlot, `riverfront-${x}`);
  }
  for (const [dx, z, floors, wall] of [[-48, -68, 10, SS], [-34, -64, 8, C]]) {
    draw(add, X('wembley') + dx, z, [10, 10, floors, 3, wall, W, 0, 1], infill, infill, false, false, onArchitecturePlot, `wembley-side-${dx}-${z}`);
  }
  // A low rear street adds depth without entering any landmark's foreground.
  const rear = rng(9274);
  for (let x = pts[0].x - 100; x < X('wembley') + 100; x += 15) {
    const w = 8 + rear() * 3, cx = x + w / 2, R = [x - 1, x + w + 1, -113, -103];
    if ([...hard, ...occ].some(o => hit(R, o)) || inRegion(rgs, 'ctry', cx, 30 + w / 2) || Math.abs(cx - mu.x) < (w + mu.w) / 2 + 12) continue;
    const wall = cx < mv ? [CR, OC, SS] : inRegion(rgs, 'scot', cx) ? [P.redSand, SS] : [B, LS, CR];
    draw(add, cx, -108, [w, 8, 2 + (rear() < 0.35 ? 1 : 0), 3, wall[rear() * wall.length | 0], W, 0, 1], rear, rear, false, false, onArchitecturePlot, `rear-${Math.round(cx)}`);
    occ.push(R);
  }
  // London back-lots: own rng + own footprint list, so no existing row, rear house or park shifts. Rows step up with distance:
  // behind Parliament low (the Big Ben roofline stays readable), z -93 gap behind Tower Bridge mid, z -120 skyline row tallest.
  // Heights cap at ~70% of Big Ben (24 m) within 14 m of the tower, keeping a clear sky window around its top.
  const lots = rng(2713), placed = [], bb = X('bigben'), walls = [CR, SS, LS, B, OW, CM, S, TC], x0 = mv + 4, x1 = rgs[0].sub[0] - 4;
  const lot = (x, z, w, d, n, fh, kind, u, tag) => {
    const R = [x - w * u / 2, x + w * u / 2, z - d / 2, z + d / 2], h = n * fh;
    if (h > 24 && Math.abs(x - bb) < 14 + w * u / 2) return false;
    if ([...hard, ...cut, ...placed].some((o) => hit(R, o)) || occ.some((o) => hit(R, o)) || path.some((p) => hit(R, [p.x, p.x, p.z, p.z], 25))) return false;
    placed.push(R);
    draw(add, x, z, [w, d, n, fh, walls[lots() * walls.length | 0], W, kind, u], lots, lots, false, false, onArchitecturePlot, `lot-${tag}-${Math.round(x)}-${z}`);
    return true;
  };
  for (let x = x0; x < x1; x += 4) { // z -83: terrace groups / low midrise in the hard band behind Parliament
    if (x > rgs[0].sub[0] - 30) break;
    const t = lots() < 0.5, w = t ? 6 : 11 + lots() * 3, u = t ? 3 + (lots() * 2 | 0) : 1;
    if (lot(x + w * u / 2, -81.5, w, 8, 4, 3, t ? 3 : 0, u, 'front')) x += w * u - 2 + lots() * 3;
  }
  for (let x = x0; x < x1; x += 4) { // z -93 gap (Tower Bridge side) and any other hole in that row
    const w = 12, n = Math.min(5 + (lots() * 3 | 0), x < 150 ? 5 : 7); // <= 16 m in front of the Eye; taller on the Tower Bridge side
    if (lot(x + w / 2, -93, w, 12, n, 3.2, lots() < 0.55 ? 1 : 0, 1, 'mid')) x += w - 2 + lots() * 3;
  }
  for (let x = x0; x < x1; x += 4) { // z -120 skyline row, taller with distance
    const w = 12 + lots() * 5, n = 5 + (lots() * 5 | 0), d = 8 + (lots() * 0 | 0); // depth 8 at z -117: clears the rear houses (-112) and backdrop row 0 (near edge <= -121)
    if (lot(x + w / 2, -117, w, d, n, 3.2, lots() < 0.45 ? 1 : 0, 1, 'back')) x += w - 2 + lots() * 4;
  }
  // These blocks sit west of both the route cameras and every landmark.
  const side = rng(5165), sx = pts[0].x - 125;
  add(sx, -0.12, -72, 84, 0.14, 72, P.pave);
  for (const z of [-83, -61]) add(sx, 0.025, z, 84, 0.015, 4.6, P.road);
  add(sx, 0.026, -72, 4.6, 0.015, 72, P.road);
  for (const dx of [-30, -10, 10, 30]) for (const z of [-94, -72, -50]) {
    draw(add, sx + dx, z, [10, 10, 2 + (side() * 3 | 0), 3, [CR, SS, OC, OW][side() * 4 | 0], W, 0, 1], side, side, false, false, onArchitecturePlot, `west-${dx}-${z}`);
  }
  occ.push([sx - 42, sx + 42, -108, -36]); // the west district and its street grid

  // Gap fill: last, own rng, so nothing above moves. Small footprints go into holes the main rows could not fit, plus a third row behind them.
  // Camera side (side > 0) stays two floors so landmark views keep their foreground; parks and pedestrian loops/wanders are kept clear.
  const gap = rng(6151), free = [...PARKS.map((o) => [o.x0, o.x1, o.z0, o.z1]), ...walkPaths(stops, pts).filter((o) => o.rect).map(({ rect: o }) => [o.x0, o.x1, o.z0, o.z1])];
  for (const [sd, f] of [[1, 29], [1, 43], [-1, 29], [-1, 43], [-1, 57], [1, 57], [-1, 71], [-1, 86]]) for (let x = pts[0].x - 40; x < X('wembley') + 40; x += 3) {
    const sc = inRegion(rgs, 'scot', x), uk = x > mv, t = uk && !sc && gap() < 0.6, w = t ? 6 : 8 + gap() * 3, u = t ? 2 + (gap() * 2 | 0) : 1, d = t ? 8 : 9;
    const n = sd > 0 ? 2 : f > 60 ? 3 + (gap() * 4 | 0) : 3 + (gap() * 2 | 0), cx = x + w * u / 2, z = zAt(cx) + sd * (f + d / 2), R = [x - 1, x + w * u + 1, z - d / 2 - 1, z + d / 2 + 1];
    if ([...hard, ...cut, ...occ, ...free].some((o) => hit(R, o)) || path.some((p) => hit(R, [p.x, p.x, p.z, p.z], 25))) continue;
    const wall = sc ? [P.redSand, SS, CR] : uk ? [B, LS, CR, OW, SA, SB] : [CR, OC, SS, MN, SA, TC, OW];
    draw(add, cx, z, [w, d, n, 3, wall[gap() * wall.length | 0], W, t ? 3 : 0, u], gap, gap, sd > 0, false, onArchitecturePlot, `gap-${Math.round(cx)}-${Math.round(z)}`);
    occ.push(R); x += w * u + 1 + gap() * 3;
  }
  // São Paulo mid-ground grid (far side, own rng, last): fills the open lots between the route rows and the skyline band.
  // Every rejection list above applies, so landmark envelopes, plazas, parks and walk loops stay clear; taller with distance.
  const sp = rng(7741), spWalls = [CR, OC, SS, MN, SA, TC, OW, C, CM];
  for (const z of [-44, -64, -86]) for (let x = pts[0].x - 240; x < mv - 20;) {
    const w = 12 + sp() * 5, d = 10, n = (z < -70 ? 4 : 3) + (sp() * (z < -70 ? 5 : 3) | 0), cx = x + w / 2, cz = z + (sp() - 0.5) * 2, R = [x - 1, x + w + 1, cz - d / 2 - 1, cz + d / 2 + 1];
    x += w + 2 + sp() * 3;
    if (inRegion(rgs, 'ctry', cx, 30 + w / 2) || [...hard, ...cut, ...occ, ...free, ...placed].some((o) => hit(R, o)) || path.some((p) => hit(R, [p.x, p.x, p.z, p.z], 25))) continue;
    draw(add, cx, cz, [w, d, n, 3, spWalls[sp() * spWalls.length | 0], W, 0, 1], sp, sp, false, false, onArchitecturePlot, `sp-${Math.round(cx)}-${Math.round(cz)}`);
    occ.push(R);
  }

  // Owner-marked vacant lots: reuse existing house/midrise families without moving neighboring streets.
  const markedLots = [
    [-370,-30,9,8,9.6,"midrise"],
    [-357,-30,8,8,9.7,"terrace"],
    [-344,-30,9,8,12.8,"midrise"],
    [225,-75,8,8,9.6,"midrise"],
    [225,-88,8,8,12.8,"midrise"],
    [282,-70,7,8,9.7,"terrace"],
    [282,-86,9,9,12.8,"midrise"],
    [322,-70,6,8,9.7,"terrace"],
    [317,-101,7,8,9.7,"terrace"],
    [248.5,-25,6,7,6.8,"terrace"],
    [268,-24,7,7,6.8,"terrace"],
    [278,-24,8,7,9.7,"terrace"],
    [286,-24,5.5,7,6.8,"terrace"],
    [269,-4,8,7,6.8,"terrace"],
    [286,-4,5,7,6.8,"terrace"],
    [321,-4,6.5,7,6.8,"terrace"],
    [491,-78,12,9,12.8,"midrise"],
    [491,-92,10,9,12.8,"midrise"],
    [519,-101,10,9,12.8,"midrise"],
    [522,-70,6,8,9.7,"terrace"],
  ];
  for (const [i, [x, z, width, depth, height, kind]] of markedLots.entries()) {
    const plot = { id: `marked-infill-${i}`, kind, x, z, width, depth, height, replaceGarden: true };
    if (onArchitecturePlot) onArchitecturePlot(plot);
    else {
      const r = rng(10262026 + i);
      draw(add, x, z, [width, depth, Math.floor(height / 3.1), 3.1, [CR, SS, B, LS][i % 4], W, kind === 'terrace' ? 3 : 0, 1], r, r, height < 7, false);
    }
  }
}
