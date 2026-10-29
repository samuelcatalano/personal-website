import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stops } from '../content.js';
import { routePoints } from './layout.js';
import { SURFACE as S } from './building-slice-materials.js';
import { classifyPlot, rolloutRecipe, building, tint } from './city-rollout.js';
import { createShopSlice } from './shop-slice.js';
import { createMidriseSlice } from './midrise-slice.js';
import { createOfficeSlice } from './office-slice.js';
import { createTowerSlice } from './tower-slice.js';
import { loadKit } from './kit-loader.js';
import { place, hash, pick, accumulators, geometryOf } from './kit-place.js';
import { officeOverlay, towerOverlay } from './hirise-kit.js';

// Shop + midrise facade kits (tools/buildings/{shop,midrise}-kit). The rollout builds every chunk procedurally first;
// once the kits load, chunks that hold kit lots are rebuilt with module geometry merged into the same mass/trim/glass
// buckets (no new draw calls, no new materials). The procedural geometry stays as LOD1, so the existing hysteresis switch
// (rollout.update, 120/129/111 m) swaps kit detail out at distance. Roll back with createCityBuildings(plots,{kits:false})
// or ?kits=0.
// Everything stays inside the 0.2 m facade margin of the lot (modules are authored <= 0.19 m deep).
const URLS = {
  office: new URL('../../assets/processed/buildings/office-kit.glb?v=1', import.meta.url).href,
  tower: new URL('../../assets/processed/buildings/tower-kit.glb?v=1', import.meta.url).href,
  shop: new URL('../../assets/processed/buildings/shop-kit.glb?v=1', import.meta.url).href,
  midrise: new URL('../../assets/processed/buildings/midrise-kit.glb?v=1', import.meta.url).href,
};
export const KIT_RADIUS = 1e4; // metres from the route polyline: midrises nearer than this get modules; measured budget fits every rollout midrise
function shopOverlay(p, recipe, h, kit, hs) {
  const acc = accumulators(), w = p.width - .24, d = p.depth - .4, front = d / 2, roofY = p.height - .55, ground = recipe.ground;
  const front_ = h.userData.openings.filter((o) => o.face === 'front');
  const signSurface = [S.door, S.roof, S.brick, S.stone][pick(hs, 11, 4)], awnSurface = [S.brick, S.roof, S.door, S.stone][pick(hs, 17, 4)];
  const litEntry = pick(hs, 6, 2) ? S.litGlass : S.glass;
  let entry = null;
  front_.forEach((o, i) => {
    if (o.type === 'storefront') {
      const v = (pick(hs, 3, 4) + (i % 2) * pick(hs, 5, 2)) % 4 + 1;
      place(acc, kit, ['storefront_timber_01', 'storefront_broad_02', 'storefront_slim_iron_03', 'storefront_capital_04'][v - 1], o.u, o.y - o.h / 2, front, o.w / 2.4, o.h / 2.18, 1, { mass: S.stone, trim: S.trim });
      place(acc, kit, ['awning_slope_01', 'awning_flat_02', 'awning_bracket_03', 'awning_scallop_04', 'awning_box_05'][pick(hs, 7, 5)], o.u, ground - .02, front, (o.w + .22) / 2.3, 1, 1, { mass: awnSurface, trim: S.trim });
    } else if (o.type === 'entry') {
      entry = o;
      place(acc, kit, ['entry_door_glazed_top_01', 'entry_door_full_glass_02', 'entry_door_kick_fan_03'][pick(hs, 2, 3)], o.u, o.y - o.h / 2, front, o.w / 1.16, o.h / 2.5, 1, { mass: S.door, trim: S.trim, glass: litEntry });
    }
  });
  const pil = Math.max(.9, (ground + .0) / 2.92);
  for (const s of [-1, 1]) place(acc, kit, ['pilaster_plain_01', 'pilaster_fluted_02'][pick(hs, 9, 2)], s * (w / 2 - .1), 0, front, .5, pil, 1.2, { mass: S.stone, trim: S.stone });
  const sx = entry?.u ?? 0, sv = pick(hs, 12, 4);
  if (sv === 0) place(acc, kit, 'signboard_fascia_01', 0, ground + .14, front, (w - .9) / 2.4, 1, 1, { mass: signSurface, trim: S.trim });
  else if (sv === 1) place(acc, kit, 'signboard_plaque_02', sx, ground + .16, front, 1, 1, 1, { mass: signSurface, trim: S.trim });
  else if (sv === 2) place(acc, kit, 'signboard_arched_03', sx, ground + .12, front, 1.1, 1, 1, { mass: signSurface, trim: S.trim });
  else place(acc, kit, 'signboard_lightbox_04', sx, ground + .14, front, 1.3, 1, 1, { mass: signSurface, trim: S.trim, glass: S.litGlass });
  const tiles = Math.max(2, Math.round(w / 2)), cn = ['cornice_dentil_01', 'cornice_bracket_02', 'cornice_cavetto_03', 'cornice_plain_04'][pick(hs, 14, 4)];
  for (let i = 0; i < tiles; i++) place(acc, kit, cn, (i + .5 - tiles / 2) * w / tiles, roofY - .52, front, w / tiles / 2, 1, 1, { mass: S.stone, trim: S.trim });
  const capTop = roofY + .49, rv = pick(hs, 16, 3);
  if (rv === 0) place(acc, kit, 'roof_pediment_01', sx * .5, capTop, front - .08, 1, 1, 1, { mass: S.stone, trim: S.trim });
  else if (rv === 1) for (let i = 0; i < tiles; i++) place(acc, kit, 'roof_balustrade_02', (i + .5 - tiles / 2) * w / tiles, capTop, front - .08, w / tiles / 2, 1, 1, { trim: S.stone });
  const rk = ['roof_hatch_03', 'roof_vents_04', 'roof_ac_cluster_05'][pick(hs, 19, 3)];
  place(acc, kit, rk, -w * .22, roofY + .05, -d * .2, .8, .8, .8, { mass: S.stone, trim: S.roof });
  return acc;
}

function midriseOverlay(p, recipe, h, kit, hs) {
  const acc = accumulators(), w = p.width - .4, d = p.depth - .4, wall = d / 2, roofY = p.height - 1.1, ground = recipe.ground;
  const upper = (roofY - ground) / (recipe.floors - 1), style = pick(hs, 0, 4);
  const front_ = h.userData.openings.filter((o) => o.face === 'front');
  const doorOpen = front_.find((o) => o.type === 'door');
  const floorOf = (o) => Math.round((o.y - ground) / upper + .5);
  const cols = [...new Set(front_.filter((o) => o.type === 'window' && o.y > ground).map((o) => o.u))].sort((a, b) => a - b);
  for (const o of front_) {
    if (o.type !== 'window' || o.y <= ground) continue;
    const f = floorOf(o), col = cols.indexOf(o.u), center = Math.abs(col - (cols.length - 1) / 2) <= .5;
    let name = null;
    if (style === 0) name = f % 2 ? 'window_juliet_rail_01' : 'window_bracketed_sill_06';
    else if (style === 1) name = center ? 'window_balcony_ledge_02' : (f === 1 ? 'window_hood_surround_04' : null);
    else if (style === 2) name = f === 1 && center ? 'window_planter_ledge_03' : ((f + col) % 2 ? 'window_shuttered_05' : null);
    else name = f === recipe.floors - 1 ? 'window_hood_surround_04' : null;
    if (name) place(acc, kit, name, o.u, o.y - o.h / 2, wall, o.w / 1.58, o.h / 1.8, 1, { mass: S.stone, trim: S.trim, glass: S.glass });
  }
  if (style === 3 && cols.length >= 2 && recipe.floors >= 3) {
    const c = cols.length >> 1;
    for (const u of [cols[c - 1], cols[c]]) place(acc, kit, ['loggia_piers_rail_01', 'loggia_portal_frame_02', 'loggia_piers_bars_03'][pick(hs, 4, 3)], u, ground + upper * .5 - .9, wall, 1, upper / 3, 1, { mass: S.stone, trim: S.trim, glass: S.glass });
  }
  if (doorOpen) {
    place(acc, kit, ['lobby_door_glazed_pair_01', 'lobby_door_plain_pair_02', 'lobby_door_framed_pair_03'][pick(hs, 2, 3)], doorOpen.u, doorOpen.y - doorOpen.h / 2, wall, doorOpen.w / 1.5, doorOpen.h / 2.6, 1, { mass: S.door, trim: S.trim, glass: pick(hs, 6, 2) ? S.litGlass : S.glass });
    place(acc, kit, ['canopy_slab_01', 'canopy_glass_02', 'canopy_fascia_03'][pick(hs, 8, 3)], doorOpen.u, 3.0, wall, 1, 1, 1, { mass: S.roof, trim: S.trim, glass: S.glass });
  }
  const tiles = Math.max(2, Math.round(w / 2)), cn = ['cornice_corbel_01', 'cornice_dentil_02', 'cornice_band_03'][pick(hs, 10, 3)];
  for (let i = 0; i < tiles; i++) place(acc, kit, cn, (i + .5 - tiles / 2) * w / tiles, roofY - .52, wall, w / tiles / 2, 1, 1, { mass: S.stone, trim: S.trim });
  for (let i = 0; i < tiles; i++) place(acc, kit, pick(hs, 12, 2) ? 'parapet_coping_01' : 'parapet_safety_rail_02', (i + .5 - tiles / 2) * w / tiles, roofY + .69, wall - .09, w / tiles / 2, 1, 1, { mass: S.stone, trim: S.trim });
  const set = [['roof_stair_core_01', 'roof_ac_row_02'], ['roof_water_tank_03', 'roof_lift_overrun_04'], ['roof_stair_core_01', 'roof_water_tank_03'], ['roof_ac_mixed_05', 'roof_lift_overrun_04']][pick(hs, 14, 4)];
  const sc = recipe.compact ? .7 : .85, spots = [[-w * .2, -d * .18], [w * .2, -d * .2]];
  set.forEach((n, i) => place(acc, kit, n, spots[i][0], roofY + .05, spots[i][1], sc, sc, sc, { mass: S.stone, trim: S.roof }));
  return acc;
}

const distToRoute = (pts, p) => { // metres to the route polyline in XZ
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return best;
};
export function selectKitLots(plots, radius = KIT_RADIUS, pts = routePoints(stops.length)) {
  const shops = [], midrises = [], offices = [], towers = [];
  for (const p of plots) {
    const kind = classifyPlot(p);
    if (kind === 'shop') shops.push(p);
    else if (kind === 'midrise' && distToRoute(pts, p) <= radius) midrises.push(p);
    else if (kind === 'office' && distToRoute(pts, p) <= radius) offices.push(p);
    else if (kind === 'tower' && distToRoute(pts, p) <= radius) towers.push(p);
  }
  return { shops, midrises, offices, towers };
}

function buildChunk(chunk, byId, neighbors, kits, kitIds) {
  const cx = chunk.position.x, cz = chunk.position.z, merged = [[], [], []], overlays = [];
  for (const id of chunk.userData.plotIds) {
    const p = byId.get(id), kind = classifyPlot(p);
    let h;
    if (kitIds.has(id)) {
      const hs = hash(id), r = rolloutRecipe(p, kind, neighbors);
      if (kind === 'shop') {
        const recipe = { ...r, canopy: false };
        h = createShopSlice(p, neighbors, recipe);
        overlays.push([h, shopOverlay(p, recipe, h, kits.shop, hs)]);
      } else if (kind === 'office') {
        const recipe = { ...r, rooftop: false };
        h = createOfficeSlice(p, recipe);
        overlays.push([h, officeOverlay(p, recipe, kits.office, hs)]);
      } else if (kind === 'tower') {
        const recipe = { ...r, crown: 4 }; // crown 4: bare lantern with 2.9 m of headroom for the kit crown
        h = createTowerSlice(p, recipe);
        overlays.push([h, towerOverlay(p, recipe, kits.tower, hs)]);
      } else {
        const recipe = { ...r, rooftop: false, penthouse: 0, noCanopy: true };
        h = createMidriseSlice(p, recipe);
        overlays.push([h, midriseOverlay(p, recipe, h, kits.midrise, hs)]);
      }
      h.children.forEach((m, k) => {
        const extra = geometryOf(overlays.at(-1)[1][k]);
        if (!extra) return;
        const g = mergeGeometries([m.geometry, extra], false);
        m.geometry.dispose(); extra.dispose(); m.geometry = g;
      });
      tint(h, p);
    } else {
      h = building(p, kind, neighbors, 0); tint(h, p);
    }
    h.children.forEach((m) => m.geometry.translate(p.x - cx, 0, p.z - cz));
    for (let k = 0; k < 3; k++) merged[k].push(h.children[k].geometry);
  }
  return merged.map((items) => {
    const g = mergeGeometries(items, false);
    items.forEach((i) => i.dispose());
    if (!g) throw new Error('Incompatible facade kit bucket');
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  });
}

// Async: resolves with coverage stats; the scene keeps rendering the procedural chunks until each swap.
// ?kits=0 disables every kit; ?kits=shop,midrise,office,tower enables only the listed ones (default: all).
export const enabledKits = (search = typeof location !== 'undefined' ? location.search : '') => {
  const v = /[?&]kits=([^&]*)/.exec(search)?.[1];
  const all = ['shop', 'midrise', 'office', 'tower'];
  return v === undefined ? all : v === '0' ? [] : all.filter((k) => v.split(',').includes(k));
};
export async function upgradeFacadeKits(rollout, rolloutPlots, neighbors = rolloutPlots, { radius = KIT_RADIUS } = {}) {
  const on = new Set(enabledKits());
  if (!on.size) return null;
  let dead = false;
  const dispose = rollout.userData.dispose;
  rollout.userData.dispose = () => { dead = true; dispose?.(); };
  const sel = selectKitLots(rolloutPlots, radius), lots = { shop: sel.shops, midrise: sel.midrises, office: sel.offices, tower: sel.towers };
  for (const k of Object.keys(lots)) if (!on.has(k)) lots[k] = [];
  const kitIds = new Set(Object.values(lots).flat().map((p) => p.id)), byId = new Map(rolloutPlots.map((p) => [p.id, p]));
  const names = Object.keys(lots).filter((k) => lots[k].length), loaded = await Promise.all(names.map((k) => loadKit(URLS[k])));
  const kits = Object.fromEntries(names.map((k, i) => [k, loaded[i]])), stats = { shops: lots.shop.length, midrises: lots.midrise.length, offices: lots.office.length, towers: lots.tower.length, chunks: 0, radius, buildMs: 0 };
  rollout.userData.kit = stats;
  for (const chunk of rollout.children.filter((c) => c.userData.plotIds.some((id) => kitIds.has(id)))) {
    await new Promise((r) => setTimeout(r, 0)); // one chunk per task: no long main-thread stall
    if (dead) return stats;
    const t0 = performance.now(), d = chunk.userData, next = buildChunk(chunk, byId, neighbors, kits, kitIds);
    if (dead) { next.forEach((g) => g.dispose()); return stats; }
    // Procedural level-0 geometry becomes (or stays) the far level, so the existing hysteresis switch hides kit detail at distance.
    if (d.lods.length === 1) d.lods.push(d.lods[0]); else d.lods[0].forEach((g) => g.dispose());
    d.lods[0] = next;
    if (d.level === null || d.level === 0) { chunk.children.forEach((m, k) => m.geometry = next[k]); }
    d.bounds.makeEmpty(); d.lods.flat().forEach((g) => d.bounds.union(g.boundingBox)); d.bounds.translate(chunk.position);
    stats.chunks++; stats.buildMs += performance.now() - t0;
  }
  return stats;
}
