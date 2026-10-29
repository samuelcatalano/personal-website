import { ROAD, furnitureSpots, regions, inRegion, ukStart, stopIndex, LANDMARKS, RIVER_Z, WEMBLEY_BENCHMARK, underpassFrames, UNDERPASS } from './layout.js';
import { walkPaths } from './crowd.js';
import { PLAZAS, SQUARES } from './parks.js';
// Street props (Phase 4): bollards, litter bins, hydrants (BR red hydrant / UK yellow marker post), bike racks and UK Belisha beacons.
// Pure data (no three, so the placement rules are testable): placeStreetProps() returns footprints; street-props-mesh.js draws them, one InstancedMesh per type.
// Deterministic: stable hashes only, the city rng is never touched. Roadside props stand on the outer edge of the pavement, past the walking lanes of crowd.js;
// plaza props stand on a line just inside each plaza's walking ring. Everything is rejected against boxes, trees, lamps, kiosks, signs, plots and each other.
// ponytail: circles (rack: circumscribed circle) for the obstacle tests, plots as axis-aligned rects ignoring yaw; swap for exact rects if a plaza ever feels sparse.
export const PROP_DENSITY = Object.freeze({ step: 3, binEvery: 85, hydrantEvery: 130, plazaStep: 4.5, plazaBinEvery: 3, plazaRackEvery: 5 }); // m of route per prop, plaza spacing, every Nth plaza slot
export const WALK_EDGE = ROAD.padIn + 1.05 + 0.3 + 0.2; // outer lane offset + its +-0.3 jitter + body: roadside props stay beyond this lateral distance
export const PLAZA_INSET = 2.25; // plaza props: past the walking ring (crowd.js insets 0.6..1.6, parks.js RING ends at 1.9), inside parks.js KEEP (2.4)
export const FOOT = Object.freeze({ bollard: { r: 0.1 }, bin: { r: 0.25 }, hydrant: { r: 0.17 }, marker: { r: 0.13 }, rack: { hw: 0.58, hd: 0.1 }, beacon: { r: 0.1 } });
const GROUND = 0.22, PAD = 0.1, CELL = 6, TOP = 2.4; // boxes topping out below GROUND are floor; PAD: min gap between props; TOP: tallest prop
const H = (a, b = 0) => Math.abs(Math.sin(a * 12.9898 + b * 78.233 + 91.7) * 43758.5453) % 1;
export function placeStreetProps({ stops, pts, curve, arc, pilotCrossings = [], boxes = [], trees = [], lamps = [], kiosks = [], plots = [], exclude = [] }) {
  const n = stops.length, Lc = curve.getLength(), rgs = regions(stops, pts), ukX = pts[ukStart(stops)].x, W = WEMBLEY_BENCHMARK;
  const ex = pts[stopIndex(stops, LANDMARKS.estaiada)], ups = underpassFrames(curve, stops);
  const out = [], grid = new Map(), cells = (x, z, r) => { const c = []; for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) c.push(i * 100003 + j); return c; };
  const index = (e, x, z, r) => { for (const c of cells(x, z, r)) (grid.get(c) ?? grid.set(c, []).get(c)).push(e); };
  for (const b of boxes) if (b.w * b.d < 4000 && b.y < TOP) index(b, b.x, b.z, b.ry ? Math.hypot(b.w, b.d) / 2 : Math.max(b.w, b.d) / 2); // slabs/walls/beds/fountains
  for (const t of trees) index({ k: 'c', x: t.x, z: t.z, r: 0.25 }, t.x, t.z, 0.25); // trunk
  for (const [x, z] of lamps) index({ k: 'c', x, z, r: 0.35 }, x, z, 0.35);
  for (const [x, z] of kiosks) index({ k: 'c', x, z, r: 0.85 }, x, z, 0.85);
  for (const { xz: [x, z] } of furnitureSpots(stops, curve)) index({ k: 'c', x, z, r: 0.6 }, x, z, 0.6);
  for (const p of plots) if (p.width && p.depth) index({ k: 'c', x: p.x, z: p.z, r: Math.hypot(p.width, p.depth) / 2 }, p.x, p.z, Math.hypot(p.width, p.depth) / 2); // circumscribed
  const paths = walkPaths(stops, pts), loops = paths.filter((p) => p.type === 'loop'), wander = paths.filter((p) => p.type === 'wander');
  const quiet = new Set(PLAZAS.filter((q) => q.quiet).map((q) => q.name));
  const keepOut = [...loops.filter((l) => quiet.has(l.name)).map((l) => l.rect), ...SQUARES.filter((q) => q.low), ...exclude]; // quiet plazas, sightline squares, hero realm
  const inRect = (r, x, z, e) => x > r.x0 - e && x < r.x1 + e && z > r.z0 - e && z < r.z1 + e;
  const zoneOk = (x, z) => !(x > W.x0 - 6 && x < W.x1 + 6 && z > W.z0 - 6 && z < W.z1 + 6) && !(x > ex.x - 16 && x < ex.x + 7 && z > RIVER_Z - 43 && z < ex.z + 1) &&
    !ups.some((u) => { const dx = x - u.x, dz = z - u.z; return Math.abs(dx * u.tx + dz * u.tz) < UNDERPASS.base + 2 && Math.abs(-dx * u.tz + dz * u.tx) < UNDERPASS.end + 3; }) && !keepOut.some((r) => inRect(r, x, z, 1));
  const walkOk = (x, z, ex, ez) => !wander.some((p) => x > p.rect.x0 - ex - 0.4 && x < p.rect.x1 + ex + 0.4 && z > p.rect.z0 - ez - 0.4 && z < p.rect.z1 + ez + 0.4) && !loops.some(({ rect: r }) => inRect(r, x, z, 0.3) && Math.min(x - r.x0 - ex, r.x1 - x - ex, z - r.z0 - ez, r.z1 - z - ez) < 1.95); // ex/ez: half extents of the footprint's bounding box
  const put = (kind, x, z, yaw = 0) => {
    const f = FOOT[kind], r = f.r ?? Math.hypot(f.hw, f.hd), ex = f.r ?? Math.abs(Math.cos(yaw)) * f.hw + Math.abs(Math.sin(yaw)) * f.hd, ez = f.r ?? Math.abs(Math.sin(yaw)) * f.hw + Math.abs(Math.cos(yaw)) * f.hd;
    if (!zoneOk(x, z) || !walkOk(x, z, ex, ez)) return false;
    let ground = 0.07;
    for (const c of cells(x, z, r + PAD)) for (const e of grid.get(c) ?? []) {
      if (e.k === 'c') { if (Math.hypot(e.x - x, e.z - z) < e.r + r + PAD) return false; continue; }
      const dx = x - e.x, dz = z - e.z, c1 = Math.cos(e.ry ?? 0), s1 = Math.sin(e.ry ?? 0), lx = c1 * dx - s1 * dz, lz = s1 * dx + c1 * dz, top = e.y + e.h;
      if (Math.abs(lx) < e.w / 2 && Math.abs(lz) < e.d / 2 && top <= GROUND) ground = Math.max(ground, top);
      else if (top > GROUND && e.y < TOP && Math.abs(lx) < e.w / 2 + r + PAD && Math.abs(lz) < e.d / 2 + r + PAD) return false;
    }
    const e = { k: 'c', x, z, r: r + PAD / 2 }; index(e, x, z, e.r);
    out.push({ kind, x, z, yaw, y: ground - 0.01, r, region: x >= ukX - 15 ? 'uk' : 'br' });
    return true;
  };
  const side = (p, t, s, off, a) => [p.x - t.z * s * off + t.x * a, p.z + t.x * s * off + t.z * a]; // pavement point: off from the route centre line (side s), a along it
  const off = (kind) => WALK_EDGE + (FOOT[kind].r ?? FOOT[kind].hd) + 0.02;
  const crossings = [...stops.map((_, i) => [Math.min(1, i / (n - 1) + 9 / Lc), 1.4]), ...pilotCrossings.map((u) => [u, 1.85])].map(([u, h]) => ({ p: curve.getPointAt(u), t: curve.getTangentAt(u), h }));
  for (const { p, t, h } of crossings) for (const s of [-1, 1]) for (const d of [-1, 1]) { // beacon at each end of the zebra (UK), bollards on the approaches (UK past the beacon, BR at the zebra edge)
    const uk = p.x >= ukX - 15;
    if (uk) put('beacon', ...side(p, t, s, off('beacon'), d * (h + 0.55)));
    put('bollard', ...side(p, t, s, off('bollard'), d * (h + (uk ? 1.9 : 0.55))));
    if (!uk) put('bollard', ...side(p, t, s, off('bollard'), d * (h + 1.9)));
  }
  for (let i = 0; i < n; i++) { const p = curve.getPointAt(i / (n - 1)), t = curve.getTangentAt(i / (n - 1)); put('bin', ...side(p, t, 1, off('bin'), 3.2)); } // waiting side of the stop sign, past it
  const stopMarks = stops.map((_, i) => curve.getPointAt(i / (n - 1)));
  for (let s = 8; s < arc.L - 8; s += PROP_DENSITY.step) {
    const { p, t } = arc.sample(s);
    if (inRegion(rgs, 'ctry', p.x) || stopMarks.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 14) || crossings.some((c) => Math.hypot(c.p.x - p.x, c.p.z - p.z) < c.h + 4)) continue;
    for (const sd of [-1, 1]) {
      const uk = p.x >= ukX - 15;
      if (H(s, sd) < PROP_DENSITY.step / PROP_DENSITY.binEvery) put('bin', ...side(p, t, sd, off('bin'), 0));
      else if (H(s, sd + 7) < PROP_DENSITY.step / PROP_DENSITY.hydrantEvery) { const k = uk ? 'marker' : 'hydrant'; put(k, ...side(p, t, sd, off(k), 0)); }
    }
  }
  for (const { name, rect: r } of loops) { // plaza dressing along the line just inside the walking ring
    if (quiet.has(name)) continue;
    const x0 = r.x0 + PLAZA_INSET, x1 = r.x1 - PLAZA_INSET, z0 = r.z0 + PLAZA_INSET, z1 = r.z1 - PLAZA_INSET;
    let k = 0;
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
      for (let d = 1; d < len - 1; d += PROP_DENSITY.plazaStep, k++) {
        const kind = k % PROP_DENSITY.plazaRackEvery === PROP_DENSITY.plazaRackEvery - 1 ? 'rack' : k % PROP_DENSITY.plazaBinEvery === PROP_DENSITY.plazaBinEvery - 1 ? 'bin' : 'bollard';
        put(kind, ax + (bx - ax) * d / len, az + (bz - az) * d / len, yaw);
      }
    }
  }
  return out;
}
export async function buildStreetProps(items) {
  if (!items.length) return null;
  return (await import('./street-props-mesh.js')).buildProps(items);
}
