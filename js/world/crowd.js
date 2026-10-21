import { rng, stopIndex, towerX, copan, glasgowSites, RIVER_Z, LANDMARKS as L } from './layout.js';
// Pure data (no three): people looks and where they walk. Rendering lives in people.js / sprites.js.
export const SKIN = ['#f6d9c4', '#efc3a0', '#d9a579', '#b9824f', '#8a5a35', '#5e3a22', '#3d2517'];
const HAIR = ['#1b1714', '#3a2415', '#6b4328', '#d9b86a'], GREY = '#b5b5b0';
const TOPS = ['#c0392b', '#2e6fb7', '#2f8f5b', '#e8b930', '#f2f2ee', '#222831', '#8e5ab8', '#e87d3e', '#d96a8c', '#5a6b3a', '#4a90a4'];
const BOTTOMS = ['#2b3a55', '#1f2328', '#4a5a78', '#7a6a55', '#3d3d3d', '#6b4f3a', '#a89c86', '#5b3a5e'];
const SHOES = ['#1a1a1a', '#f2f2ee', '#5a3a22', '#c0392b', '#2e6fb7'];
const pick = (r, a) => a[r() * a.length | 0], between = (r, a, b) => a + r() * (b - a);
export function makeLook(r) {
  const adult = r() < 0.7, female = r() < 0.5;
  const kind = adult ? (female ? 'woman' : 'man') : (female ? 'girl' : 'boy');
  const height = adult ? (female ? between(r, 1.6, 1.8) : between(r, 1.68, 1.9)) : between(r, 1.1, 1.35);
  const x = r(); // hair style roll
  const hairStyle = kind === 'man' ? (x < 0.15 ? 'bald' : 'short')
    : kind === 'woman' ? (x < 0.6 ? 'long' : x < 0.8 ? 'bun' : 'ponytail')
    : kind === 'boy' ? 'short' : (x < 0.6 ? 'long' : 'ponytail');
  const hair = adult && r() < 0.12 ? GREY : pick(r, HAIR); // always draws the same rolls
  return {
    kind, height, skin: pick(r, SKIN), hair, hairStyle, top: pick(r, TOPS), bottom: pick(r, BOTTOMS), shoes: pick(r, SHOES),
    shoulder: height * (female ? 0.24 : adult ? 0.26 : 0.24), speed: adult ? between(r, 1.1, 1.5) : between(r, 0.9, 1.3),
  };
}
// Lane offsets sit between the kerb and the sign posts (7.1) and behind them; inner and outer lanes walk opposite ways.
const LANES = [[5.95, 1], [8.25, -1], [-5.95, -1], [-8.25, 1]];
// Plaza rectangles (world x/z), checked free of boxes with a three stub; z is relative to the river line the landmarks hang on.
export function walkPaths(stops, pts) {
  const X = (k) => pts[stopIndex(stops, L[k])].x, cp = copan(stops, pts), wx = pts[pts.length - 1].x;
  const { museum, uni } = glasgowSites(stops, pts);
  const g = pts[stopIndex(stops, L.glasgow)], squareZ = g.z - 28;
  const rect = (x0, x1, z0, z1) => ({ x0, x1, z0: RIVER_Z + z0, z1: RIVER_Z + z1 });
  return [
    ...LANES.map(([offset, dir]) => ({ type: 'lane', offset, dir })),
    { type: 'loop', name: 'masp', rect: rect(X('masp') - 18, X('masp') + 18, -9, 23) }, // in front of MASP (z -54..-22)
    { type: 'loop', name: 'paulista', rect: rect(cp.x - 18, cp.x + 20, 11, 18) }, // between the houses and the Copan
    { type: 'loop', name: 'thames', rect: rect(X('bigben') - 10, X('eye') + 25, 19, 31) }, // ponytail: starts at xdesign; the riverfront infill and Millimetric houses block 'move'; ends before the countryside
    { type: 'loop', name: 'tower', rect: rect(towerX(stops, pts) - 30, towerX(stops, pts) + 24, 19, 31) }, // Tower Bridge promenade, starts after the thames loop
    { type: 'loop', name: 'wembley', rect: rect(wx + 14, wx + 40, 19, 28) }, // beside the closing figure
    { type: 'loop', name: 'glasgow-uni', rect: rect(museum.x + museum.w / 2 + 2, uni.x + 30, -27, -13) }, // far-bank promenade in front of the university, from the museum's east edge; water is north of z -11, hill front at z -28
    { type: 'loop', name: 'se', rect: rect(X('se') - 20, X('se') + 20, -4, 14) }, // below the cathedral steps, above the existing garden
    ...[
      ['se-inner', X('se') - 18, X('se') + 18, -49, -31, 0.08], ['se-front', X('se') - 12, X('se') + 56, -14, -11],
      ['se-west', X('se') - 20, X('se') - 14, -46, -10], ['se-east', X('se') + 20.5, X('se') + 23, -46, -29],
      ['masp-west', X('masp') - 24.5, X('masp') - 19.5, -53, -19], ['masp-east', X('masp') + 20, X('masp') + 24.5, -53, -19],
      ['masp-front', X('masp') - 24, X('masp') + 24.5, -20, -15],
      ['thames-front', X('bigben') - 10, X('eye') + 12, -13, -10.5], ['tower-front', towerX(stops, pts) - 29, towerX(stops, pts) + 19, -13, -10.5],
      ['glasgow-cross', g.x - 17, g.x + 17, squareZ - 1.25, squareZ + 1.25, 0.21],
      ['glasgow-axis', g.x - 2.3, g.x + 2.3, g.z - 37.5, g.z - 23, 0.21],
      ['glasgow-west', g.x - 26, g.x - 22, g.z - 38, g.z - 12.5], ['glasgow-east', g.x + 20.7, g.x + 22.5, g.z - 38, g.z - 13],
      ['glasgow-front', g.x - 22, g.x + 22, g.z - 15, g.z - 12.5],
      ['wembley-entry', wx - 19, wx + 20, -54, -47.5], ['wembley-east', wx + 20.5, wx + 26, -69, -28], ['wembley-front', wx - 15, wx + 23, -32, -24],
    ].map(([name, x0, x1, z0, z1, y = 0.02]) => ({ type: 'wander', name, rect: { x0, x1, z0, z1 }, y })),
  ];
}
export function crowdPlan(stops, pts, seed, count = 1000) {
  const r = rng(seed), paths = walkPaths(stops, pts), lanes = paths.filter((p) => p.type === 'lane'), loops = paths.filter((p) => p.type === 'loop'), wander = paths.filter((p) => p.type === 'wander');
  const baseCount = Math.min(count, 600);
  const keys = [], plan = Array.from({ length: baseCount }, (_, i) => {
    const look = makeLook(r), onLane = i % 10 < 7;
    let path, key;
    if (onLane) { const l = pick(r, lanes); path = { ...l, offset: l.offset + between(r, -0.3, 0.3) }; key = `lane${l.offset}`; } // spread across the pavement, not single file
    else { const l = pick(r, loops), dir = r() < 0.5 ? 1 : -1; path = { ...l, dir, inset: between(r, 0.6, 1.6) }; key = `${l.name}`; } // loops get a per-person direction and inset
    keys.push(key + path.dir);
    return { look, path, s0: r() };
  });
  const groups = new Map(); // stratify s0 inside each lane / loop so people are evenly spread along it, not clumped
  keys.forEach((k, i) => groups.set(k, [...(groups.get(k) || []), i]));
  for (const ids of groups.values()) ids.forEach((i, j) => { plan[i].s0 = (j + 0.15 + 0.7 * plan[i].s0) / ids.length; });
  const extraKeys = [];
  for (let i = baseCount; i < count; i++) {
    const l = wander[(i - 600) % wander.length], dir = r() < 0.5 ? 1 : -1;
    const minSide = Math.min(l.rect.x1 - l.rect.x0, l.rect.z1 - l.rect.z0);
    const maxInset = Math.max(0.35, Math.min(6, (minSide - 1) / 2));
    const path = { ...l, dir, inset: between(r, 0.35, maxInset) };
    plan.push({ look: makeLook(r), path, s0: r() });
    extraKeys.push(`${l.name}${dir}`);
  }
  const extraGroups = new Map();
  extraKeys.forEach((k, j) => { const i = baseCount + j; extraGroups.set(k, [...(extraGroups.get(k) || []), i]); });
  for (const ids of extraGroups.values()) ids.forEach((i, j) => { plan[i].s0 = (j + 0.15 + 0.7 * plan[i].s0) / ids.length; });
  return plan;
}
// Sprite atlas variants: greedy k-center over a look distance, so every skin tone, kind and hair style shows up; each person maps to the nearest variant.
const KIDS = /boy|girl/;
// Sprite hair shape, derived from the look (so crowd.js keeps its rng stream): men quiff / curly / short / afro (dark skin), boys tousled, girls pigtails.
export function hairShape(l) {
  const h = Math.floor(l.height * 7919) % 3;
  if (l.hairStyle === 'ponytail' && KIDS.test(l.kind)) return 'pigtails';
  if (l.hairStyle !== 'short') return l.hairStyle;
  if (SKIN.indexOf(l.skin) >= 4) return 'afro';
  return l.kind === 'boy' ? 'tousled' : ['quiff', 'curly', 'short'][h];
}
const dist = (a, b) => (a.kind !== b.kind ? 50 + 60 * (KIDS.test(a.kind) !== KIDS.test(b.kind)) : 0) + 14 * Math.abs(SKIN.indexOf(a.skin) - SKIN.indexOf(b.skin))
  + 25 * (hairShape(a) !== hairShape(b)) + 14 * (a.hair !== b.hair) + 10 * (a.top !== b.top) + 6 * (a.bottom !== b.bottom) + 3 * (a.shoes !== b.shoes);
export function chooseVariants(looks, n) {
  const chosen = [0], near = looks.map((l) => dist(l, looks[0])), of = looks.map(() => 0);
  while (chosen.length < Math.min(n, looks.length)) {
    const far = near.indexOf(Math.max(...near)), v = chosen.push(far) - 1;
    looks.forEach((l, i) => { const d = dist(l, looks[far]); if (d < near[i]) { near[i] = d; of[i] = v; } });
  }
  return { variants: chosen.map((i) => looks[i]), of };
}
