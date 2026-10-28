import { ROAD, furnitureSpots, rng, isWembleyBenchmark } from './layout.js';
import { walkPaths } from './crowd.js';
import { PALETTE as P } from './palette.js';
import { tree, CLEAR } from './city.js';
import { lampPost } from './street-lamp.js'; // ponytail: import cycle is fine, both are function declarations used after load
// Parks on the big bare paving. Rects were found with an occupancy grid of city + landmarks (tests/parks.test.mjs re-checks the plaza loops);
// x/z are world metres. Axis u = longer side. uk: black railings + K6-free London look; pond/fountain: centre piece.
export const PARKS = [ // stops after the Eye sit further east (OUT_GAP + LONG_GAP): the last four parks moved with them
  { x0: -235, x1: -165, z0: -27, z1: -15, fountain: 1, trees: 7, cafe: 1 }, // Sé side
  { x0: -293, x1: -273, z0: -24, z1: 24, fountain: 1, trees: 7 }, // behind the start
  { x0: -266, x1: -246, z0: 8, z1: 18, trees: 5, late: 1 }, // hero foreground: breaks up the bare slab south of the start garden
  { x0: -262, x1: -238, z0: 28, z1: 38, trees: 5, late: 1 }, // hero foreground, south (mobile frame)
  { x0: -314, x1: -296, z0: 10, z1: 24, trees: 5, late: 1 }, // hero foreground, left of the start garden
  { x0: -197, x1: -165, z0: -57, z1: -47, trees: 5 },
  { x0: -88, x1: -62, z0: 13, z1: 23, trees: 4 }, // south of Paulista
  { x0: -88, x1: -62, z0: -23, z1: -15, trees: 3 }, // north, in front of the Copan: low trees only
  { x0: -103, x1: -62, z0: -69, z1: -63, trees: 4 }, // behind the Copan
  { x0: -27, x1: -3, z0: 21, z1: 27, trees: 3 },
  { x0: 5, x1: 57, z0: 21, z1: 27, uk: 1, rail: 1, trees: 5 },
  { x0: 681, x1: 717, z0: -29, z1: -21, uk: 1, rail: 1, trees: 4 },
  { x0: 681, x1: 761, z0: -69, z1: -61, uk: 1, rail: 1, trees: 6, benchmarkTrees: 1 },
  { x0: 731, x1: 807, z0: -43, z1: -35, uk: 1, rail: 1, trees: 6 }, // in front of Wembley: trees stay <= 4.4 m
  { x0: 817, x1: 841, z0: -12, z1: 24, uk: 1, rail: 1, pond: 1, trees: 7, cafe: 1 },
];
// Pedestrian loops become plazas: walking ring, everything else >= 2.4 m inside the rect.
export const WALK_INSET = [0.6, 1.6]; // ponytail: mirrors crowd.js between(r, 0.6, 1.6) / people.js INSET; keep in sync
export const RING = [0.3, 1.9], KEEP = 2.4; // ring covers WALK_INSET with 0.3 to spare each side
export const PLAZAS = [
  { name: 'masp', trees: 0, beds: 4, quiet: 1 }, // MASP view corridor: nothing above 1 m except lamps
  { name: 'paulista', trees: 0, beds: 1, quiet: 1 },
  { name: 'thames', trees: 4, fountain: 1, nopath: 1, cafe: 1 },
  { name: 'tower', trees: 3, beds: 1, nopath: 1, cafe: 1 },
  { name: 'wembley', trees: 2, beds: 1 },
  { name: 'glasgow-uni', trees: 0, quiet: 1, nopath: 1, paved: P.pave }, // far-bank promenade: paved, not a lawn; keeps the gravel ring
  { name: 'se', paved: P.stone },
];
// Open paved lots outside every park/plaza (found with an occupancy grid of city boxes + roads; tests/squares.test.mjs re-checks them).
// x0..x1 along the road; mix = one letter per 8 m slot: B flowerbed, T two planted trees, U umbrella cluster, S striped stall, P pergola, F tiered fountain.
// low: inside a landmark sightline, so only flat paving and beds under 1 m.
export const SQUARES = [
  { x0: -236, x1: -213, z0: 23, z1: 46, mix: 'FTBU' }, // south of the Sé side park
  { x0: -150, x1: -113, z0: 30, z1: 44, mix: 'BUSTBU' },
  { x0: -7, x1: 27, z0: 3, z1: 19, mix: 'UBTSBU' }, // behind the London verge at stops 6-7
  { x0: 59, x1: 90, z0: 26, z1: 33, mix: 'BUSB' },
  { x0: 190, x1: 230, z0: -30, z1: -13, mix: 'FBUSTP' }, // east of the Tower promenade
  { x0: 459, x1: 525, z0: -30, z1: -22, mix: 'UBSTBUSB' }, // Glasgow, east of the square
  { x0: 515, x1: 561, z0: -18, z1: -11, mix: 'BUSB' },
  { x0: 414, x1: 454, z0: -10, z1: -4, mix: 'BBBB', low: 1 },
  { x0: -238, x1: -201, z0: -10, z1: -5, mix: 'BBBB', low: 1 }, // Sé front strip between the park and the road: flat paving and low beds only
  { x0: -159, x1: -111, z0: -14, z1: -8, mix: 'BBBBBB', low: 1 }, // MASP front (quiet)
  { x0: 66, x1: 118, z0: -9.3, z1: -5, mix: 'BTBSBTBU' }, // London riverside, in front of the Thames plaza
  { x0: 132, x1: 189, z0: -9, z1: -2, mix: 'BTSBTUBS' }, // London riverside, east of the Eye
  { x0: 231, x1: 288, z0: -19, z1: -12, mix: 'BTBSBT' }, // in front of the Glasgow square view
];
const TILE = [P.tileCream, P.tileTerra], BED = [P.red, P.tulip, P.white, P.violet, P.bloomPink], AWN = [[P.red, P.white], [P.teal, P.white], [P.tulip, P.white], [P.violet, P.white]], UMB = [P.red, P.tulip, P.violet, P.white, P.teal];
const { patch: LAWN, gravel: GRAVEL, hedge: HEDGE, leaf: LEAF, stone: STONE, oak: OAK, iron: IRON, glass: WATER, dirt: SOIL } = P;
const BLOOM = [P.red, P.tulip, P.violet, P.red], FRESH = P.gravel;
export function buildParks(draw, stops, pts, curve, occ, onTree, onPublicRealm) {
  const spots = furnitureSpots(stops, curve).map((o) => o.xz), r = rng(9157), made = [];
  const loops = walkPaths(stops, pts).filter((p) => p.type === 'loop');
  const plazas = PLAZAS.map((q) => ({ ...q, ...loops.find((l) => l.name === q.name).rect, ring: 1 }));
  // late parks run after every original one, so they never shift the shared rng that places the older parks' and plazas' trees.
  for (const orig of [...PARKS.filter((q) => !q.late), ...plazas, ...PARKS.filter((q) => q.late)]) {
    const hero = !!onPublicRealm && orig === PARKS[1];
    const add = hero ? () => {} : draw; // Consume the same RNG and tree callbacks; replace only this park's boxes.
    if (orig.name === 'se') {
      const z0 = orig.z0 - 7;
      add((orig.x0 + orig.x1) / 2, 0.02, (z0 + orig.z1) / 2, orig.x1 - orig.x0, 0.05, orig.z1 - z0, orig.paved);
      made.push(orig);
      continue;
    }
    const ring = orig.ring, i = ring ? RING[1] : 0, park = { ...orig, x0: orig.x0 + i, x1: orig.x1 - i, z0: orig.z0 + i, z1: orig.z1 - i }; // ring parks: lawn = rect inset 1.9
    const wide = park.x1 - park.x0 >= park.z1 - park.z0, L = wide ? park.x1 - park.x0 : park.z1 - park.z0, S = wide ? park.z1 - park.z0 : park.x1 - park.x0;
    const cx = (park.x0 + park.x1) / 2, cz = (park.z0 + park.z1) / 2;
    const benchmark = isWembleyBenchmark({ x: (orig.x0 + orig.x1) / 2, z: (orig.z0 + orig.z1) / 2, width: orig.x1 - orig.x0, depth: orig.z1 - orig.z0 });
    const pathMaterial = STONE;
    // box in park space: u along the long side, v across; lu/lv are its sizes
    const B = (u, v, y, lu, h, lv, c) => (wide ? add(cx + u, y, cz + v, lu, h, lv, c) : add(cx + v, y, cz + u, lv, h, lu, c));
    const world = (u, v) => (wide ? [cx + u, cz + v] : [cx + v, cz + u]);
    const clearOfSigns = (u, v) => { const [x, z] = world(u, v); return spots.every(([a, b]) => Math.hypot(a - x, b - z) > CLEAR); };
    const fur = [], benches = []; // plaza dressing footprints [u0,u1,v0,v1]: the extras below only go where nothing stands
    const mainPath = !park.nopath && S >= 6, cross = mainPath && S >= 10 && L >= 16, plaza = park.fountain || park.pond, taken = [];
    const e = !ring && !park.paved ? 0.04 : 0; // bordered lawns sit
    B(0, 0, 0.02, L - e, 0.05, S - e, park.paved || LAWN); // 0.02 inside their border strips, so buildings that share the park edge do not share its planes
    if (!ring && !park.paved) {
      for (const f of [-1, 1]) {
        B(0, f * (S / 2 + 0.205), 0.02, L + 0.86, 0.05, 0.45, benchmark ? P.stone : P.pave);
        B(f * (L / 2 + 0.205), 0, 0.02, 0.45, 0.05, S - 0.05, benchmark ? P.stone : P.pave);
      }
    }
    if (ring) { // gravel ring over inset 0.3..1.9 of the loop rect
      const [a, b] = RING, w = b - a, W = orig.x1 - orig.x0, D = orig.z1 - orig.z0, m = (a + b) / 2;
      for (const f of [-1, 1]) {
        add((orig.x0 + orig.x1) / 2, 0.02, f < 0 ? orig.z0 + m : orig.z1 - m, W - 2 * a, 0.05, w, pathMaterial);
        add(f < 0 ? orig.x0 + m : orig.x1 - m, 0.02, (orig.z0 + orig.z1) / 2, w, 0.05, D - 2 * b, pathMaterial);
      }
    }
    if (mainPath) B(0, 0, 0.04, L + 0.6, 0.06, 1.6, pathMaterial); // paths overhang the lawn, so no coplanar end faces
    if (cross) B(0, 0, 0.045, 1.4, 0.06, S + 0.6, pathMaterial);
    const basin = (u, v, w, d, rim) => { // stone rim around a water box
      B(u, v - d / 2 + 0.25, 0.04, w, rim, 0.5, STONE); B(u, v + d / 2 - 0.25, 0.04, w, rim, 0.5, STONE);
      B(u - w / 2 + 0.25, v, 0.04, 0.5, rim, d - 1, STONE); B(u + w / 2 - 0.25, v, 0.04, 0.5, rim, d - 1, STONE);
      B(u, v, 0.04, w - 0.9, rim - 0.12, d - 0.9, WATER); // 0.05 into the rim walls: no shared inner planes
    };
    if (park.fountain) {
      B(0, 0, 0.05, 6.4, 0.06, 6.4, GRAVEL); taken.push([0, 0, 5]); fur.push([-3.4, 3.4, -3.4, 3.4]);
      basin(0, 0, 4.4, 4.4, 0.55);
      B(0, 0, 0.1, 0.6, 1.3, 0.6, STONE); B(0, 0, 0.9, 1.6, 0.14, 1.6, STONE); B(0, 0, 1.4, 0.18, 0.5, 0.18, WATER);
    }
    if (park.pond) { // off the crossing, in the first free quadrant
      const u = L * 0.22, v = S * -0.22; basin(u, v, 9, 6, 0.3); taken.push([u, v, 6]); fur.push([u - 4.8, u + 4.8, v - 3.3, v + 3.3]);
    }
    const spot = (clear, tries = 30, half = 0) => { // random lawn spot off the paths, off other features and (for tall things) off the signs
      const e = ring ? 2 * (KEEP - RING[1] + half) : 3; // ring parks: the whole object stays >= KEEP from the loop rect
      for (let i = 0; i < tries; i++) {
        const u = (r() - 0.5) * (L - e), v = (r() - 0.5) * (S - e);
        if (mainPath && Math.abs(v) < 1.9 + clear || (cross && Math.abs(u) < 1.9 + clear) || taken.some(([a, b, d]) => Math.hypot(a - u, b - v) < d + clear) || !clearOfSigns(u, v)) continue;
        taken.push([u, v, clear + 0.6]); return [u, v];
      }
    };
    for (let i = 0; i < park.trees; i++) {
      const at = spot(1.9, 30, 1.15), h = 2.6 + r() * 0.6, crown = 1.8 + r() * 0.5; // always draw rng
      if (at) {
        const [x, z] = world(...at);
        if (onTree) onTree(x, z, { h, crown });
        else tree(add, x, z, { h, crown });
      }
    }
    if (park.benchmarkTrees && onTree) for (const [x, scale] of [[688, 0.84], [708, 1], [728, 1.12]]) onTree(x, park.z1 - 1.5, { h: 2.7 * scale, crown: 1.8 * scale });
    const beds = park.beds ?? (cross ? 2 : 1);
    for (let i = 0; i < beds; i++) { // flower beds: soil strip with four colour blocks
      const at = spot(1.6, 40, 0.65); if (!at) continue;
      const [u, v] = at;
      B(u, v, 0.05, 2.6, 0.12, 1.2, SOIL);
      for(const f of [-1,1]) { B(u,v+f*.56,.05,2.64,.16,.12,STONE);B(u+f*1.26,v,.05,.12,.16,1,STONE); } // rims sit 0.02 proud of the soil: no shared planes
      BLOOM.forEach((c, k) => B(u - 0.825 + k * 0.55, v, 0.12, 0.5, 0.28, 0.95, c));
    }
    for (let i = 0; i < Math.max(2, Math.round(L / 9)); i++) { // bushes and low hedge runs
      const run = i % 3 === 0 && !park.quiet, at = spot(0.9, 20, run ? 2.6 : 0.7); if (!at) continue; // hedge runs are up to 5 m long: keep their whole length inside
      const [u, v] = at;
      if (run) B(u, v, 0.05, 3 + r() * 2, 0.8, 0.7, HEDGE); else B(u, v, 0.05, 1 + r() * 0.5, 0.7 + r() * 0.3, 1 + r() * 0.4, i % 2 ? LEAF : HEDGE);
    }
    const bench = (u, v, f) => { for (const s of [-1, 0, 1]) { B(u, v + s * 0.15, 0.45, 1.6, 0.075, 0.12, OAK); B(u, v + f * 0.2, 0.58 + (s + 1) * 0.12, 1.6, 0.085, 0.08, OAK); }
      for (const d of [-0.65, 0.65]) B(u + d, v, 0.09, 0.12, 0.36, 0.38, IRON); fur.push([u - 0.9, u + 0.9, v - 0.4, v + 0.4]); benches.push([u, v]); };
    const nb = Math.max(ring ? 2 : 1, Math.round(L / 22)); // benches beside the main path, backs to the lawn
    for (let i = 0; i < nb; i++) for (const f of [-1, 1]) {
      if (S < (ring ? 4 : 7) && f > 0) continue;
      const u = (i + 0.5) / nb * (L - 8) - (L - 8) / 2 + (f > 0 ? 3 : 0), v = f * (ring ? Math.min(1.9, S / 2 - 0.75) : 1.9);
      if (cross && Math.abs(u) < 3.5 || (plaza && Math.abs(u) < 5)) continue;
      bench(u, v, f);
    }
    for (let u = -L / 2 + 5; u < L / 2 - 3; u += 15) for (const f of [-1, 1]) { // lamps, head P.lit so it glows at night
      const lv = f * (ring ? S / 2 - 0.9 : 1.4);
      if (!ring && S < 7 && f > 0 || !clearOfSigns(u, lv)) continue;
      const [x, z] = world(u, lv); lampPost(x, z, 0, park.uk ? 'uk' : 'br'); fur.push([u - 0.3, u + 0.3, lv - 0.3, lv + 0.3]);
    }
    if (park.rail) { // black railings round the park with gates where the paths enter
      const hu = L / 2 + 0.9, hv = S / 2 + 0.9;
      const run = (axis, fixed, a, b) => { // axis 'u' or 'v'
        for (let t = a; t <= b + 0.01; t += 3) axis === 'u' ? B(t, fixed, 0, 0.1, 0.95, 0.1, IRON) : B(fixed, t, 0, 0.1, 0.95, 0.1, IRON);
        axis === 'u' ? B((a + b) / 2, fixed, 0.7, b - a, 0.08, 0.08, IRON) : B(fixed, (a + b) / 2, 0.7, 0.08, 0.08, b - a, IRON);
      };
      for (const f of [-1, 1]) {
        run('v', f * hu, -hv, -1.3); run('v', f * hu, 1.3, hv); // gates for the main path
        if (cross) { run('u', f * hv, -hu, -1.3); run('u', f * hv, 1.3, hu); } else run('u', f * hv, -hu, hu);
      }
    }
    // Plaza dressing: paving inlay, cafe kiosk, extra benches + bins, planters. Deterministic (no rng draws), after beds/benches/lamps and before the edge-row trees, which skip these footprints.
    // Everything above 0.12 m keeps the same margin from the lawn edge as the beds (ring plazas: >= KEEP from the loop rect); flat inlay tops out at 0.12.
    const m = ring ? 0.5 : 0.6, hit = (u, v, hu, hv, g = 0.3) => fur.some(([a, b, c, d]) => u + hu + g > a && u - hu - g < b && v + hv + g > c && v - hv - g < d);
    const fits = (u, v, hu, hv) => Math.abs(u) + hu <= L / 2 - m && Math.abs(v) + hv <= S / 2 - m && !(mainPath && Math.abs(v) - hv < 1.1) && !(cross && Math.abs(u) - hu < 1.0)
      && !hit(u, v, hu, hv) && !taken.some(([a, b, d]) => Math.hypot(a - u, b - v) < d * 0.6 + Math.max(hu, hv)) && clearOfSigns(u, v);
    const planter = (u, v, k, lu = 1.6, lv = 0.8) => { // raised stone box, soil, then blooms (or a clipped hedge every third)
      B(u, v, 0.05, lu, 0.42, lv, STONE); B(u, v, 0.48, lu - 0.12, 0.04, lv - 0.12, SOIL);
      if (k % 3 === 2) B(u, v, 0.5, lu - 0.3, 0.45, lv - 0.3, HEDGE);
      else for (const s of [-1, 1]) B(u + s * (lu - 0.3) / 4, v, 0.5, (lu - 0.3) / 2, 0.2, lv - 0.3, BLOOM[(k + (s > 0)) % 4]);
      fur.push([u - lu / 2, u + lu / 2, v - lv / 2, v + lv / 2]);
    };
    if (park.paved) for (let u = -L / 2 + 3; u < L / 2 - 1.5; u += 6) B(u, 0, 0.06, 0.9, 0.03, S - 0.4, (Math.round((u + L / 2) / 6) % 2) ? FRESH : STONE); // paved promenade: alternating bands
    else if (!park.fountain && !park.pond && L >= 8 && S >= 8 && !hit(0, 0, 2.3, 2.3, 0) && !taken.some(([a, b, d]) => Math.hypot(a, b) < d * 0.6 + 2.4)) { // central inlay, tops 0.11 / 0.12 clear of the path crossing
      B(0, 0, 0.09, 4.6, 0.04, 4.6, FRESH); B(0, 0, 0.13, 3.2, 0.02, 3.2, STONE); B(0, 0, 0.15, 1.6, 0.02, 1.6, FRESH); fur.push([-2.3, 2.3, -2.3, 2.3]);
    }
    if (mainPath) for (let u = -L / 2 + 1.2, k = 0; u < L / 2 - 1.2; u += 2.4, k++) { // running-bond tiles on the main path (skip fountain pad / crossing)
      if (park.fountain && Math.abs(u) < 3.6 || cross && Math.abs(u) < 2.0) continue;
      B(u, k % 2 ? 0.4 : -0.4, 0.1, 2.2, 0.02, 0.7, FRESH);
    }
    if (park.cafe && !park.quiet && S >= 8) cafe: for (const fu of [0.3, -0.3, 0.15, -0.15]) for (const f of [-1, 1]) { // news kiosk + two umbrella tables, along the long side so narrow parks fit
      const u = fu * L, v = f * (S / 2 - m - 1.3);
      if (!fits(u, v, 4, 1.2)) continue;
      B(u, v, 0.05, 2.2, 2.2, 1.5, P.teal); B(u, v, 2.25, 2.7, 0.14, 1.9, P.red); B(u, v - f * 0.9, 1.7, 2.3, 0.1, 0.7, P.white); B(u, v - f * 0.8, 0.05, 2, 1, 0.4, OAK); // hut, roof, awning, counter (front faces the lawn side)
      for (const s of [-1, 1]) { B(u + s * 2.7, v, 0.05, 0.1, 2.1, 0.1, IRON); B(u + s * 2.7, v, 2.1, 1.9, 0.1, 1.9, s > 0 ? P.red : P.white); B(u + s * 2.7, v, 0.75, 0.9, 0.05, 0.9, P.white); }
      fur.push([u - 3.5, u + 3.5, v - 1.2, v + 1.2]); break cafe;
    }
    if (mainPath) for (let i = 0; i < nb; i++) for (const f of [-1, 1]) { // second bench row, between the first, backs to the lawn
      if (S < (ring ? 4 : 7) && f > 0) continue;
      const u = (i + 1) / nb * (L - 8) - (L - 8) / 2 - 3 + (f > 0 ? 3 : 0), v = f * (ring ? Math.min(1.9, S / 2 - 0.75) : 1.9);
      if (Math.abs(u) + 0.9 <= L / 2 - m && !(cross && Math.abs(u) < 3.5) && !(plaza && Math.abs(u) < 5) && !hit(u, v, 0.9, 0.4)) bench(u, v, f);
    }
    for (const [u, v] of benches) if (fits(u + 1.25, v, 0.25, 0.25)) { B(u + 1.25, v, 0.05, 0.45, 0.85, 0.45, P.ink); B(u + 1.25, v, 0.9, 0.55, 0.06, 0.55, IRON); fur.push([u + 1, u + 1.5, v - 0.25, v + 0.25]); } // litter bin by each bench
    for (const rowV of mainPath && S >= 9 ? [S / 2 - 1.0, 3.5] : [S / 2 - 1.0]) for (const f of [-1, 1]) for (let u = -L / 2 + 2.5, k = 0; u < L / 2 - 2; u += 9, k++) {
      if (fits(u, f * rowV, 0.8, 0.4)) planter(u, f * rowV, k + (f > 0));
    }
    if (park.trees > 0 && onTree) for (let u = -L / 2 + 4; u <= L / 2 - 3.5; u += 8) for (const f of [-1, 1]) { // edge rows along both long sides of planted parks/plazas (hash jitter: park rng untouched)
      const v = f * (S / 2 - 1.3), hs = Math.abs(Math.sin(u * 12.9898 + v * 78.233 + park.x0) * 43758.5453) % 1, [x, z] = world(u, v);
      if (S < 7 || (mainPath && Math.abs(v) < 3.2) || (cross && Math.abs(u) < 3.2) || !clearOfSigns(u, v) || hit(u, v, 1.2, 1.2, 0) || taken.some(([a, b, d]) => Math.hypot(a - u, b - v) < d + 1.6)) continue;
      taken.push([u, v, 1.6]); onTree(x, z, { h: 2.7 + hs * 0.5, crown: 2 + hs * 0.4 });
    }
    if (hero) onPublicRealm(orig);
    made.push(park);
  }

  // Squares: two-tone large-format paving plus slot furniture; deterministic, drawn last so nothing above shifts.
  const walks = walkPaths(stops, pts).filter((w) => w.rect).map((w) => w.rect);
  const road = Array.from({ length: 1501 }, (_, i) => curve.getPointAt(i / 1500)), CLEAR_ROAD = ROAD.padOut + 0.3; // paving stays behind the widened pavement (+0.3 m)
  const offRoad = (x0, x1, z0, z1) => road.every((p) => Math.hypot(p.x - Math.min(x1, Math.max(x0, p.x)), p.z - Math.min(z1, Math.max(z0, p.z))) >= CLEAR_ROAD); // ponytail: 1500-point polyline, ~1 m spacing
  for (const q of SQUARES) {
    const W = q.x1 - q.x0, D = q.z1 - q.z0, cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2, ix = 1.4, iz = D < 8 ? 0.6 : 1.4, L = W - 2 * ix;
    for (let u = 0; u < W; u += 4) for (let v = 0; v < D; v += 4) { // checker, 4 m tiles, last row/column trimmed; tiles that reach the road band are cut into 1 m cells and the near ones dropped
      const w = Math.min(4, W - u), d = Math.min(4, D - v), tile = TILE[(u / 4 + v / 4) & 1], x0 = q.x0 + u, z0 = q.z0 + v;
      if (offRoad(x0, x0 + w, z0, z0 + d)) draw(x0 + w / 2, 0.02, z0 + d / 2, w - 0.06, 0.06, d - 0.06, tile);
      else for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) { const cw = Math.min(1, w - a), cd = Math.min(1, d - b); if (offRoad(x0 + a, x0 + a + cw, z0 + b, z0 + b + cd)) draw(x0 + a + cw / 2, 0.02, z0 + b + cd / 2, cw - 0.02, 0.06, cd - 0.02, tile); }
    }
    const n = Math.floor(L / 8), rows = D - 2 * iz >= 11 ? [-0.25, 0.25] : [0];
    rows.forEach((rf, ri) => {
      for (let i = 0; i < n; i++) {
        const c = q.mix[(i + ri * 3) % q.mix.length], x = q.x0 + ix + (i + 0.5) * (L / n), z = cz + rf * (D - 2 * iz), k = i + ri;
        const tall = !q.low && c !== 'B';
        const hit = (hx, hz) => !offRoad(x - hx, x + hx, z - hz, z + hz) || walks.some((r) => x - hx < r.x1 + 0.5 && x + hx > r.x0 - 0.5 && z - hz < r.z1 + 0.5 && z + hz > r.z0 - 0.5) || (tall && !spots.every(([a, b]) => Math.hypot(a - x, b - z) > CLEAR));
        const fit = (hx, hz) => hz <= (D - 2 * iz) / 2 + 0.01 && !hit(hx, hz);
        if (c === 'B' && fit(2.6, 1) && !(rows.length === 1 && D < 5)) { // raised bed, five saturated colour blocks
          draw(x, 0.05, z, 5.2, 0.55, 1.8, STONE); draw(x, 0.55, z, 5, 0.06, 1.6, SOIL);
          for (let b = 0; b < 5; b++) draw(x - 2 + b, 0.6, z, 0.96, 0.5, 1.5, BED[(b + k) % 5]);
        } else if (c === 'T' && tall && fit(3.4, 1)) for (const s of [-1, 1]) { // planted tree in a square planter
          const tx = x + s * 2.2; draw(tx, 0.05, z, 1.5, 0.47, 1.5, STONE); draw(tx, 0.48, z, 1.3, 0.05, 1.3, SOIL);
          const sh = { h: 2.9 + ((k * 7 + s) & 3) * 0.12, crown: 2.1 };
          if (onTree) onTree(tx, z, sh); else tree(draw, tx, z, sh);
        } else if (c === 'U' && tall && fit(3.4, 2.4)) { // café cluster: three umbrellas, colours by slot
          [[-2, -0.7], [0, 0.9], [2, -0.5]].forEach(([dx, dz], j) => { const px = x + dx, pz = z + dz;
            draw(px, 0.05, pz, 0.12, 2.5, 0.12, IRON); draw(px, 2.45 + j * 0.03, pz, 2.5, 0.12, 2.5, UMB[(k + j) % 5]); draw(px, 0.05, pz, 0.9, 0.75, 0.9, P.white); });
        } else if (c === 'S' && tall && fit(2.2, 1.6)) { // market stall: striped awning, counter, crates
          const [a, b] = AWN[k % 4];
          draw(x, 0.05, z - 0.7, 3.6, 1, 0.9, P.oak); draw(x, 0.05, z - 1.0, 3.8, 2.5, 0.12, P.cream);
          for (let t = 0; t < 7; t++) draw(x - 1.8 + t * 0.6, 2.5, z - 0.2, 0.6, 0.1, 2.4, t & 1 ? b : a);
          for (const s of [-1, 1]) draw(x + s * 1.85, 0.05, z + 0.85, 0.1, 2.4, 0.1, IRON);
          draw(x - 1, 0.05, z + 0.5, 0.8, 0.5, 0.6, P.terracotta); draw(x + 1, 0.05, z + 0.5, 0.8, 0.5, 0.6, LEAF);
        } else if (c === 'P' && tall && D - 2 * iz >= 4 && fit(3.2, 1.7)) { // pergola with a bench under it
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) draw(x + sx * 2.8, 0.05, z + sz * 1.3, 0.22, 2.8, 0.22, P.white);
          for (const sz of [-1, 1]) draw(x, 2.8, z + sz * 1.3, 6.2, 0.2, 0.22, P.white);
          for (let t = 0; t < 8; t++) draw(x - 2.8 + t * 0.8, 3.0, z, 0.14, 0.1, 3.2, P.oak);
          draw(x, 0.45, z, 2, 0.08, 0.5, OAK); draw(x, 0.09, z, 1.8, 0.36, 0.3, IRON);
        } else if (c === 'F' && D - 2 * iz >= 8 && fit(3.6, 3.6)) { // tiered fountain, 3 basins
          const bowl = (w, y, t) => { // floor, four rim walls, water that runs 0.05 into the walls: top 0.13 under the rim, no shared planes
            draw(x, y, z, w, 0.25, w, STONE);
            for (const f of [-1, 1]) { draw(x, y + 0.25, z + f * (w - t) / 2, w, 0.3, t, STONE); draw(x + f * (w - t) / 2, y + 0.25, z, t, 0.3, w - 2 * t, STONE); }
            draw(x, y + 0.25, z, w - 2 * t + 0.1, 0.17, w - 2 * t + 0.1, WATER);
          };
          draw(x, 0.05, z, 7, 0.07, 7, GRAVEL); bowl(6, 0.12, 0.4); draw(x, 0.37, z, 1.6, 0.6, 1.6, STONE);
          bowl(3.2, 0.97, 0.3); draw(x, 1.22, z, 0.9, 0.5, 0.9, STONE); bowl(1.8, 1.72, 0.3); draw(x, 1.97, z, 0.25, 1.0, 0.25, WATER);
          draw(x, 0.65, z, 3, 0.6, 3, STONE); draw(x, 1.2, z, 2.6, 0.1, 2.6, WATER); draw(x, 1.3, z, 1.4, 0.55, 1.4, STONE); draw(x, 1.8, z, 1.0, 0.1, 1.0, WATER); draw(x, 1.85, z, 0.25, 1.0, 0.25, WATER);
        }
      }
    });
  }
  return made;
}
