import { SURFACE as S } from './building-slice-materials.js';
import { place, pick, accumulators } from './kit-place.js';

// Office + tower overlays (tools/buildings/{office,tower}-kit). Same contract as the shop/midrise overlays in facade-kit.js:
// modules are merged into the lot's mass/trim/glass buckets on top of the procedural slice (which stays as LOD1).
// Every facade module is authored <= 0.19 m deep (the lot keeps a 0.2 m margin); the geometry math below mirrors
// office-slice.js / tower-slice.js, so keep them in step. Variants are hash-driven (`hs`), never the city RNG.
const QUARTER = Math.PI / 2;
const glassOf = (hs, shift) => (pick(hs, shift, 2) ? S.litGlass : S.glass); // lit-window subset: night emission follows aSurface

export function officeOverlay(p, r, kit, hs) {
  const acc = accumulators(), w = p.width - .4, d = p.depth - .4, top = p.height - 1.25, lobby = r.lobbyHeight, sp = r.spandrel ?? .56;
  const step = (top - lobby) / (r.floors - 1), sideBays = Math.max(2, Math.round(d / 3.5));
  // ry rotates module +Z (outward) onto each face; `at(u)` is a point on the wall plane. Side runs stop 0.25 m short so corner copings never overlap.
  const faces = [
    { ry: 0, span: w, run: w, bays: r.bays, at: (u) => [u, d / 2] },
    { ry: Math.PI, span: w, run: w, bays: r.bays, at: (u) => [-u, -d / 2] },
    { ry: QUARTER, span: d, run: d - .5, bays: sideBays, at: (u) => [w / 2, u] },
    { ry: -QUARTER, span: d, run: d - .5, bays: sideBays, at: (u) => [-w / 2, u] },
  ];
  const surf = { mass: S.stone, trim: S.trim, glass: S.glass }, dark = { mass: S.roof, trim: S.trim, glass: S.glass };
  const bay = ['bay_square_01', 'bay_blade_02', 'bay_twin_03'][pick(hs, 0, 3)], rib = ['ribbon_frit_01', 'ribbon_louvre_02', 'ribbon_fascia_03'][pick(hs, 3, 3)];
  const cornice = ['cornice_bands_01', 'cornice_dentil_02', 'cornice_corbel_03'][pick(hs, 10, 3)], parapet = pick(hs, 12, 2) ? 'parapet_coping_01' : 'parapet_rail_02';
  for (const f of faces) {
    for (let i = 1; i < f.bays; i++) { // vertical mullion fins from the podium up to the crown
      const [x, z] = f.at(-f.span / 2 + i * f.span / f.bays);
      place(acc, kit, bay, x, lobby, z, 1, (top - lobby) / 3.6, 1, surf, f.ry);
    }
    const [cx, cz] = f.at(0);
    for (let fl = 1; fl < r.floors; fl++) place(acc, kit, rib, cx, lobby + fl * step - sp, cz, f.span / 4, sp, 1, dark, f.ry); // spandrel/ribbon band per storey
    const tiles = Math.max(2, Math.round(f.run / 2));
    for (let i = 0; i < tiles; i++) {
      const [x, z] = f.at((i + .5 - tiles / 2) * f.run / tiles);
      place(acc, kit, cornice, x, lobby - .14, z, f.run / tiles / 2, 1, 1, surf, f.ry);
      place(acc, kit, parapet, x, top + .66, z, f.run / tiles / 2, 1, 1, surf, f.ry);
    }
  }
  const front = faces[0];
  place(acc, kit, ['entrance_revolving_01', 'entrance_glazed_pair_02', 'entrance_portal_03'][pick(hs, 5, 3)], 0, .38, d / 2, 1, 1, 1, { mass: S.door, trim: S.trim, glass: glassOf(hs, 6) }, front.ry);
  place(acc, kit, ['canopy_fascia_01', 'canopy_lit_edge_02'][pick(hs, 7, 2)], 0, 3.15, d / 2, 3.4 / 3.6, 1, 1, { mass: S.stone, trim: S.trim, glass: S.litGlass }, 0);
  // Rooftop plant: two modules per roof (replaces the procedural crown), inside the parapet and under the plot height.
  const set = [['roof_cooling_row_01', 'roof_lift_overrun_02'], ['roof_antennas_03', 'roof_stair_core_05'], ['roof_plant_mixed_04', 'roof_cooling_row_01'], ['roof_lift_overrun_02', 'roof_antennas_03']][pick(hs, 14, 4)];
  const sc = Math.min(1, w * .3 / 2.4, d * .3 / 2.4), roofY = top + .12, spots = [[-w * .2, -d * .18], [w * .2, -d * .2]];
  set.forEach((n, i) => place(acc, kit, n, spots[i][0], roofY, spots[i][1], sc, sc, sc, { mass: S.stone, trim: S.roof, glass: S.glass }, 0));
  return acc;
}

// Octagon-chamfer glazed edges (0,2,4,6 of tower-slice tier()); shift = lateral tier offset.
const glazedEdges = (bw, bd, shift, c) => {
  const q = [[-bw / 2 + c, -bd / 2], [bw / 2 - c, -bd / 2], [bw / 2, -bd / 2 + c], [bw / 2, bd / 2 - c], [bw / 2 - c, bd / 2], [-bw / 2 + c, bd / 2], [-bw / 2, bd / 2 - c], [-bw / 2, -bd / 2 + c]];
  q.forEach((v) => { v[0] += shift; });
  return [0, 2, 4, 6].map((e) => {
    const a = q[e], b = q[(e + 1) % 8], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = [dz / len, -dx / len];
    return { len, n, ry: Math.atan2(n[0], n[1]), dist: a[0] * n[0] + a[1] * n[1], at: (u, off = 0) => [a[0] + dx * u / len + n[0] * off, a[1] + dz * u / len + n[1] * off] };
  });
};

export function towerOverlay(p, r, kit, hs) {
  const acc = accumulators(), w = p.width - .4, d = p.depth - .4, H = p.height, c = r.chamfer, [base, shoulder, crownY] = r.setbacks.map((v) => H * v);
  const sc = r.scales, of = r.offsets, topY = H - 2.9; // recipe.crown === 4 reserves 2.9 m for the kit crown
  const tiers = [
    { y0: .30, y1: base, bw: w, bd: d, shift: 0, rows: 1 },
    { y0: base, y1: shoulder, bw: w * sc[0], bd: d * sc[0], shift: w * of[0], rows: Math.round(r.floors * .64) },
    { y0: shoulder, y1: crownY, bw: w * sc[1], bd: d * sc[1], shift: w * of[1], rows: Math.max(2, Math.round(r.floors * .15)) },
    { y0: crownY, y1: topY, bw: w * sc[2], bd: d * sc[2], shift: w * of[2], rows: 1 },
  ].map((t) => ({ ...t, edges: glazedEdges(t.bw, t.bd, t.shift, c) }));
  const fin = ['fin_square_01', 'fin_blade_02', 'fin_twin_03', 'fin_flanged_04'][pick(hs, 0, 4)], band = ['spandrel_ledge_01', 'spandrel_frit_02', 'spandrel_twin_03'][pick(hs, 3, 3)];
  const louvre = ['louvre_slats_01', 'louvre_vertical_02'][pick(hs, 5, 2)], rail = ['rail_post_01', 'rail_glass_02'][pick(hs, 4, 2)];
  const trimS = { mass: S.trim, trim: S.trim, glass: S.glass }, darkS = { mass: S.roof, trim: S.trim, glass: S.glass };
  for (const ti of [1, 2]) {
    const t = tiers[ti], step = (t.y1 - t.y0) / t.rows;
    for (const e of t.edges) {
      const bays = Math.max(2, Math.round(e.len / (r.bayWidth ?? 3.4))), [mx, mz] = e.at(e.len / 2);
      for (let i = 1; i < bays; i++) {
        const [x, z] = e.at(i * e.len / bays);
        place(acc, kit, fin, x, t.y0, z, 1, (t.y1 - t.y0) / 3, 1, trimS, e.ry);
      }
      for (let f = 0; f < t.rows; f++) {
        const lo = t.y0 + f * step;
        if (ti === 1 && f === t.rows - 1) place(acc, kit, louvre, mx, lo + .15, mz, (e.len - .3) / 4, (step - .3) / 3, 1, darkS, e.ry); // mechanical floor under the first setback
        else place(acc, kit, band, mx, lo + step - .4, mz, (e.len - .3) / 4, 1, 1, darkS, e.ry);
      }
    }
  }
  // Terrace rails on setback ledges deeper than 1 m (straight towers have none).
  for (let ti = 0; ti < 3; ti++) tiers[ti].edges.forEach((e, k) => {
    const ledge = e.dist - tiers[ti + 1].edges[k].dist;
    if (ledge < 1) return;
    const run = e.len - .5, tiles = Math.ceil(run / 2.5);
    for (let i = 0; i < tiles; i++) {
      const [x, z] = e.at(.25 + (i + .5) * run / tiles, -.18);
      place(acc, kit, rail, x, tiers[ti].y1, z, run / tiles / 2, 1, 1, trimS, e.ry);
    }
  });
  // Podium lobby on the front edge (edge 4) with a tall canopy.
  const fe = tiers[0].edges[2], [lx, lz] = fe.at(fe.len / 2);
  place(acc, kit, ['lobby_portal_01', 'lobby_rods_02', 'lobby_finned_03'][pick(hs, 2, 3)], lx, .3, lz, Math.max(.75, Math.min(1.2, fe.len / 9)), 1, 1, { mass: S.roof, trim: S.trim, glass: glassOf(hs, 6) }, fe.ry);
  const ct = tiers[3], cs = Math.max(.3, Math.min(1, (Math.min(ct.bw, ct.bd) - 2 * c - .3) / 5.4));
  place(acc, kit, ['crown_flat_fins_01', 'crown_stepped_02', 'crown_mast_03', 'crown_helipad_04'][pick(hs, 8, 4)], ct.shift, topY + .12, 0, cs, cs, cs, { mass: S.stone, trim: S.trim, glass: S.glass }, 0);
  return acc;
}
