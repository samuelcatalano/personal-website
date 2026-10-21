import { furnitureSpots, GAPS, GAP_TOTAL, STOP_SPACING, RIVER_Z, LANDMARKS, rng, riverEnd, riverStart, stopIndex, ukStart, regions, towerX, isWembleyBenchmark } from './layout.js';
import { house } from './houses.js';
import { phoneBox } from './phone.js';
import { PALETTE as P } from './palette.js';
import { buildBlocks } from './blocks.js';
import { buildParks } from './parks.js';
import { buildCountry } from './country.js';
import { buildGlasgowEdges } from './glasgow.js';
const PATCH = P.patch, ROAD = P.road, LINE = P.cream;
const BANK = P.taupe, PATH = P.stone, CREAM = P.cream;
const UK_WALLS = [CREAM, '#d8d0c2', P.stone, P.terracotta, P.ochre, P.mint, P.salmon, P.skyBlue, P.offWhite];
const BR_WALLS = [P.stone, '#d8d0c2', '#bdb3a4', P.concreteDark, P.concreteMid, P.terracotta, P.ochre, P.mint, P.salmon, P.skyBlue, P.offWhite];
const ROOF = P.roof, ROOFS = [P.brick, P.roof, P.oak, P.steel], // ponytail: tint by position keeps r() sequence
   GLASS = P.glass, WINDOW_LIT = P.lit;
export const CLEAR = 4.5;
const TRUNK = P.trunk, LEAF = P.leaf, LEAF_SHADE = P.grass;
function townhouse(add, x, z, side, br, r, roofStacks) {
  const w = 9, d = 7, floors = side === 1 ? 2 : br ? 2 + (r() < 0.25) : 2 + (r() < 0.6 ? 1 : 0);
  const h = floors * 2.8, wall = (br ? BR_WALLS : UK_WALLS)[Math.floor(r() * (br ? BR_WALLS.length : UK_WALLS.length))];
  const face = z - side * (d / 2 + 0.08);
  add(x, 0, z, w, h, d, wall);
  add(x, 0, z, w + 0.2, 0.38, d + 0.2, ROOF);
  add(x, h - 0.25, z, w + 0.45, 0.3, d + 0.45, CREAM);
  const rc = ROOFS[Math.abs(Math.round(x * 0.37 + z * 0.11)) % ROOFS.length];
  add(x, h, z, w, 0.42, d + 0.7, rc); // roof abuts its neighbour: no coplanar overlap
  add(x, h + 0.42, z, w * 0.74, 0.32, d * 0.72, rc);
  const stacks = roofStacks && side === 1;
  if (!br && r() < 0.5) { const sx = r() < 0.5 ? -2.4 : 2.4; if (!stacks) add(x + sx, h + 0.7, z, 0.65, 1.1, 0.7, ROOF); }
  if (stacks) {
    for (const dx of [-(w * 0.37 - 0.5), w * 0.37 - 0.5]) {
      add(x + dx, h + 0.74, z, 0.9, 1.1, 0.7, BANK);
      add(x + dx, h + 1.84, z, 0.3, 0.35, 0.3, ROOF);
    }
    add(x, h + 0.74, z - side * (d * 0.36 - 0.12), w * 0.74, 0.28, 0.16, CREAM);
  }
  for (const dx of [-w / 2 + 0.18, w / 2 - 0.18]) add(x + dx, 0.42, face, 0.22, h - 0.72, 0.18, BANK);
  for (let floor = 0; floor < floors; floor++) {
    add(x, 0.42 + floor * 2.8, face, w + 0.06, 0.12, 0.22, BANK);
    for (const dx of [-2.15, 2.15]) {
      const y = 0.65 + floor * 2.8, lit = r() < 0.08;
      add(x + dx, y, face, 1.5, 1.9, 0.16, CREAM);
      add(x + dx, y + 0.18, face - side * 0.1, 1.12, 1.48, 0.08, lit ? WINDOW_LIT : GLASS);
      add(x + dx, y + 0.18, face - side * 0.15, 0.12, 1.52, 0.12, BANK);
      add(x + dx, y + 0.86, face - side * 0.15, 1.16, 0.12, 0.12, BANK);
      add(x + dx, y + 0.08, face - side * 0.2, 1.7, 0.18, 0.42, BANK);
      if (br && floor > 0) add(x + dx, y - 0.18, face - side * 0.24, 1.65, 0.16, 0.5, PATH);
    }
  }
  add(x, 0.12, face, 1.55, 2.38, 0.2, CREAM);
  add(x, 0.25, face - side * 0.14, 1.12, 2.02, 0.1, ROOF);
  add(x, 1.7, face - side * 0.21, 0.18, 0.18, 0.08, WINDOW_LIT);
  add(x, 2.48, face - side * 0.12, 1.7, 0.2, 0.34, BANK);
  add(x, 0.22, face - side * 0.12, 1.72, 0.18, 0.34, BANK);
  return { kind: 'terrace', x, z, width: w, depth: d, height: h + (stacks ? 2.2 : 1.3) };
}
const broadleaf = (r) => ({ h: 2.6 + r() * 0.6, crown: 1.8 + r() * 0.5 });
export function tree(add, x, z, { h, crown, base = 0.1 }) {
  add(x, base, z, 0.32, h - base, 0.32, TRUNK); // starts on the paving top: no coplanar sides with it
  add(x, h - 0.4, z, crown, 1.1, crown, LEAF);
  add(x - crown * 0.22, h + 0.2, z + crown * 0.16, crown * 0.52, 1, crown * 0.52, LEAF_SHADE);
  add(x + crown * 0.2, h + 0.15, z - crown * 0.2, crown * 0.48, 0.9, crown * 0.48, LEAF);
}
export function buildCity(add, stops, pts, curve, onTree, onBuildingPlot, onArchitecturePlot, onPublicRealm) {
  const drawTree = onTree ? (_add, x, z, shape) => onTree(x, z, shape) : tree;
  const spots = furnitureSpots(stops, curve).map((o) => o.xz);
  const free = (x, z) => spots.every(([a, b]) => Math.hypot(a - x, b - z) > CLEAR); // ponytail: skip, not shift
  const lamps = [], occ = [], obst = [], r = rng(2026), hq = rng(8821), hq2 = rng(4417), noop = () => {}, mx = pts[stopIndex(stops, LANDMARKS.masp)].x, gl = pts[stopIndex(stops, LANDMARKS.glasgow)], ukId = stops[ukStart(stops)].id, LM = new Set([...Object.values(LANDMARKS), ukId]); // ukId: far side of the first UK stop keeps skipping frontage draws (blocks.js riverfront infill owns it)
  const span = pts.length * STOP_SPACING + GAP_TOTAL + 120, rgs = regions(stops, pts);
  const seX = pts[stopIndex(stops, LANDMARKS.se)].x, ukX = pts[ukStart(stops)].x;
  add(GAP_TOTAL / 2, -1, 0, span, 1, 200, P.pave);
  // Samples along the curve every ~`step` m (curve param is per stop, so count follows each segment's length)
  const ticks = (step) => [...pts.slice(1).flatMap((q, s) => {
    const m = Math.ceil(Math.hypot(q.x - pts[s].x, q.z - pts[s].z) / step);
    return Array.from({ length: m }, (_, k) => (s + k / m) / (pts.length - 1));
  }), 1];
  const x0 = riverStart(stops, pts), rEnd = riverEnd(stops, pts), mid = (x0 + rEnd) / 2, len = rEnd - x0;
  const pilotX0 = pts[stopIndex(stops, LANDMARKS.eye)].x + 12, pilotX1 = towerX(stops, pts) - 20;
  for (const side of [-1, 1]) {
    const edge = RIVER_Z + side * 12;
    add(mid, -0.08, edge, len, 0.18, 2.2, BANK);
    add(mid, 0.02, edge + side * 2.1, len - 0.1, 0.12, 3.2, PATH);
    for (let x = x0 + 7; x < rEnd; x += 18) {
      add(x, 0.02, edge + side * 3.1, 1.2, 0.42, 0.7, PATCH);
      add(x + 1.3, 0.02, edge + side * 3.1, 0.55, 0.7, 0.55, LEAF);
    }
  }
  let crossings = 0;
  ticks(1.4).forEach((u, i) => {
    if (i % 2) return;
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    const nx = -t.z, nz = t.x;
    const local = isWembleyBenchmark({ x: p.x, z: p.z });
    add(p.x, -0.18, p.z, 8.5, 0.25, 8.5, ROAD);
    // painted lines: roadmarks.js
    if (crossings < 2 && p.x >= (crossings ? pilotX1 - 4 : pilotX0 + 4) && p.x <= pilotX1 - 2) {
      for (let k = -2; k <= 2; k++) {
        const x = p.x + t.x * k * 0.8, z = p.z + t.z * k * 0.8;
        add(x, -0.035, z, Math.abs(t.x) >= Math.abs(t.z) ? 0.45 : 8.5, 0.02, Math.abs(t.x) >= Math.abs(t.z) ? 8.5 : 0.45, LINE);
      }
      crossings++;
    }
    if (i % 16 === 8) {
      for (const side of [-1, 1]) {
        const x = p.x + nx * side * 9.4, z = p.z + nz * side * 9.4;
        if (!free(x, z)) continue;
      const local = isWembleyBenchmark({ x, z });
      add(x, 0, z, 0.16, 3, 0.16, local ? P.stone : ROOF);
        add(x, 3, z, 0.7, 0.2, 0.7, WINDOW_LIT);
        obst.push([x, z]);
        lamps.push([x, z]);
      }
    }
  });
  for (const [i, u] of ticks(0.7).entries()) {
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    const nx = -t.z, nz = t.x;
    const pilot = p.x >= pilotX0 + 1.65 && p.x <= pilotX1 - 1.65;
    for (const side of [-1, 1]) {
      const cw = Math.abs(t.x)*.76+Math.abs(t.z)*.18, cd = Math.abs(t.z)*.76+Math.abs(t.x)*.18;
      const curbX = p.x + nx * side * 4.55, curbZ = p.z + nz * side * 4.55;
      add(curbX, 0.07, curbZ, cw, 0.1, cd, P.pave);
      const px = p.x + nx * side * 7.1, pz = p.z + nz * side * 7.1;
      add(px, -0.02, pz, 3.34, 0.12, 3.34, P.stone);
      if (pilot && i % 9 === 0) add(px, 0.1005, pz, 0.55, 0.004, 0.55, P.gravel);
    }
  }
  // Frontage sites: every stop plus filler sites (same 30 m rhythm) along the gaps; the long gaps only keep the London ones (country.js builds the outskirts between)
  const filler = GAPS.flatMap((g, gi) => Array.from({ length: g.size < 100 ? g.size / STOP_SPACING - 1 : g.size / STOP_SPACING }, (_, k) => k + 1).map((k) => ({ g, k, x: pts[g.after].x + k * STOP_SPACING, rg: rgs[gi - 1] })).filter(({ g, x, rg }) => g.size < 100 || (gi === 1 ? x <= rg.sub[1] + 10 : x >= rg.sub[0] - 10)).map(({ g, x, rg }) => { // out leg: London from the Eye to the sub edge; return leg: sub edge to Tribal
    const q = curve.getPointAt(ticks(0.7).reduce((a, u) => Math.abs(curve.getPointAt(u).x - x) < Math.abs(curve.getPointAt(a).x - x) ? u : a, 0));
    return { p: { x, z: q.z }, i: g.after, filler: true, sparse: !!rg && (g.after === 10 ? x >= rg.sub[1] : x < rg.sub[0]) };
  }));
  // North Star canopy rhythm: extra verge trees on the same grass strip, placed by stable hash (layout rng untouched)
  const canopy = (p, side) => {
    for (const dx of [-11.5, -3.2, 3.2, 11.5]) {
      const x = p.x + dx, z = p.z + side * 10.3, hsh = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      if (!free(x, z) || obst.some(([a, b]) => Math.hypot(a - x, b - z) < 3.4)) continue;
      drawTree(add, x, z, { h: 3 + hsh * 0.6, crown: 3 + hsh * 0.5 }); obst.push([x, z]);
    }
  };
  [...pts.map((p, i) => ({ p, i })), ...filler].forEach(({ p, i, filler, sparse }) => {
    const br = stops[i].country === 'BR' && i >= 2;
    for (const side of [-1, 1]) {
      add(p.x, 0, p.z + side * 10.5, 25, 0.035, 3.2, PATCH);
      if (side === -1 && !filler && LM.has(stops[i].id)) { if (stops[i].id === ukId) canopy(p, side); continue; }
      for (const dx of sparse ? [0] : [-9, 0, 9]) { // sparse: last London houses before the fields
        if (side === 1 && stops[i].id === 'contact' && dx === 0) continue;
        const x = p.x + dx, hz = p.z + side * (side === 1 ? 21 : 17);
        // MASP and Glasgow need clear far-side sightlines; townhouse still runs on a no-op so r() stays aligned.
        const glasgowSquare = side === -1 && Math.abs(p.x + dx - gl.x) < 25 && hz + 4.5 > gl.z - 43 && hz - 4.5 < gl.z - 17, tower = side === -1 && Math.abs(p.x + dx - towerX(stops, pts) + 3) < 33; // the Tower Bridge promenade loop
        const show = !tower && !(side === 1 && Math.abs(x - ukX) < 23) && Math.abs(p.x + dx - seX) >= 29.5 && !(side === -1 && (Math.abs(p.x + dx - mx) < 29.5 || glasgowSquare)) && !(side === 1 && Math.abs(p.x + dx - pts[pts.length - 1].x) < 35);
        const uk = stops[i].country === 'UK', hr = Math.abs(x - ukX) < 23 ? hq2 : hq; // hr: plots the old airport hid get their own rng so every other house keeps its draws
        const id = `frontage-${filler ? 'gap' : 'stop'}-${stops[i].id}-${Math.round(p.x)}-${side}-${dx}`;
        const townhousePlot = townhouse(show && !uk && !onArchitecturePlot ? add : noop, x, hz, side, br, r, i >= 2);
        if (show && !uk && onArchitecturePlot) onArchitecturePlot({ ...townhousePlot, id });
        if (show && uk) {
          const floors = side === 1 ? 2 : 3 + (hr() < 0.4);
          if (onArchitecturePlot) onArchitecturePlot({ id, kind: 'terrace', x, z: hz, width: 9, depth: 7, height: floors * 3.1 + (side === 1 ? 0.6 : 2.7) });
          house(onArchitecturePlot ? noop : add, hr, x, hz, -side, 9, 7, floors, 3.1, side === 1);
        }
        occ.push([p.x + dx - 5, p.x + dx + 5, hz - 4.5, hz + 4.5]);
      }
      for (const dx of [-8, 8]) {
        const x = p.x + dx + (r() - 0.5) * 2, z = p.z + side * 10.2;
        const h = broadleaf(r); // always draw rng so layout stays stable
        if (free(x, z)) { drawTree(add, x, z, h); obst.push([x, z]); }
      }
      canopy(p, side);
    }
  });
  // London kiosks on the pavement (own rng: nothing else shifts)
  const kq = rng(6403), u0 = (ukStart(stops) - 0.3) / (stops.length - 1), kiosks = [];
  for (let tries = 0; kiosks.length < 15 && tries < 400; tries++) {
    const u = u0 + kq() * (1 - u0), side = kq() < 0.5 ? -1 : 1, p = curve.getPointAt(u), t = curve.getTangentAt(u);
    const x = p.x - t.z * side * 7.1, z = p.z + t.x * side * 7.1;
    if (!free(x, z) || [...obst, ...kiosks].some(([a, b]) => Math.hypot(a - x, b - z) < 3.5)) continue;
    phoneBox(add, x, z);
    kiosks.push([x, z]);
  }
  const rotors = rgs.flatMap((rg, leg) => buildCountry(add, curve, drawTree, rg.ctry, leg, onArchitecturePlot));
  buildGlasgowEdges(add, stops, pts, curve, drawTree, onArchitecturePlot);
  buildBlocks(add, stops, pts, curve, occ, onBuildingPlot, onArchitecturePlot);
  buildParks(add, stops, pts, curve, occ, onTree, onPublicRealm); // after the blocks: own rng, reads the free plazas, never shifts a block
  return { rotors, lamps }; // turbine hub positions [x, y, z]
}
