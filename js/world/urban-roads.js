const ROAD_HALF = 1.5, WALK_HALF = 2.25, LOT_CLEAR = .2, MIN_RUN = 24;
const rect = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
const expand = (r, n) => rect(r.x0 - n, r.x1 + n, r.z0 - n, r.z1 + n);
const overlaps = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;
const boxOf = (s) => s.axis === 'x' ? rect(s.a, s.b, s.c - WALK_HALF, s.c + WALK_HALF) : rect(s.c - WALK_HALF, s.c + WALK_HALF, s.a, s.b);
const regionAt = (p, regions) => regions.find(r => p.x >= r.x0 && p.x <= r.x1)?.name ?? p.region ?? 'default';
const blocked = (r, obstacles) => [...obstacles].some(o => overlaps(r, o));
import { resolveBuildingAccess } from './building-access.js';
import { createRectMask } from './spatial-mask.js';
function lotClusters(plots, radius = 16) {
  const size = radius, bins = new Map(), key = (x, z) => `${x},${z}`;
  for (let i = 0; i < plots.length; i++) {
    const p = plots[i], k = key(Math.floor(p.x / size), Math.floor(p.z / size));
    if (!bins.has(k)) bins.set(k, []); bins.get(k).push(i);
  }
  const seen = new Set(), out = [];
  for (let i = 0; i < plots.length; i++) {
    if (seen.has(i)) continue;
    const cluster = [], queue = [i]; seen.add(i);
    while (queue.length) {
      const j = queue.pop(), p = plots[j]; cluster.push(p);
      const bx = Math.floor(p.x / size), bz = Math.floor(p.z / size);
      for (let x = bx - 1; x <= bx + 1; x++) for (let z = bz - 1; z <= bz + 1; z++) for (const k of bins.get(key(x, z)) ?? []) {
        const q = plots[k];
        if (!seen.has(k) && Math.hypot(q.x - p.x, q.z - p.z) <= radius) { seen.add(k); queue.push(k); }
      }
    }
    if (cluster.length >= 4) out.push(cluster);
  }
  return out;
}
function minHeap() {
  const data = [];
  const less = (a, b) => a.f < b.f || (a.f === b.f && a.h < b.h);
  return {
    push(value) { let i = data.push(value) - 1; while (i) { const p = (i - 1) >> 1; if (!less(value, data[p])) break; data[i] = data[p]; i = p; } data[i] = value; },
    pop() { const first = data[0], last = data.pop(); if (data.length) { let i = 0; while (i * 2 + 1 < data.length) { let c = i * 2 + 1; if (c + 1 < data.length && less(data[c + 1], data[c])) c++; if (!less(data[c], last)) break; data[i] = data[c]; i = c; } data[i] = last; } return first; },
    get size() { return data.length; },
  };
}
const freeRuns = (axis, a, b, c, blockers) => {
  const cuts = blockers.filter(o => axis === 'x'
    ? o.z0 < c + WALK_HALF && o.z1 > c - WALK_HALF
    : o.x0 < c + WALK_HALF && o.x1 > c - WALK_HALF)
    .map(o => axis === 'x' ? [o.x0, o.x1] : [o.z0, o.z1]).sort((x, y) => x[0] - y[0]);
  const out = []; let at = a;
  for (const [lo, hi] of cuts) {
    if (hi <= at || lo >= b) continue;
    if (lo - at >= MIN_RUN) out.push([at, Math.min(lo, b)]);
    at = Math.max(at, hi);
    if (at >= b) break;
  }
  if (b - at >= MIN_RUN) out.push([at, b]);
  return out;
};

// Derive shared streets from open gaps between lot rows/columns; individual frontages stay pedestrian.
export function planUrbanRoads({ plots = [], trees = [], obstacles = [], protectedRects = [], accessProtectedRects = protectedRects, anchors = [], existingAsphaltRects = [], regions = [], seed = 2026 } = {}) {
  const lots = plots.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z) && p.width > 0 && p.depth > 0);
  const treeRects = trees.map(t => rect(t.x - .6, t.x + .6, t.z - .6, t.z + .6));
  const hard = [...obstacles, ...protectedRects, ...treeRects];
  const planningHard = hard;
  const lotRects = lots.map(p => rect(p.x - p.width / 2, p.x + p.width / 2, p.z - p.depth / 2, p.z + p.depth / 2));
  const planningLots = lotRects.map(r => expand(r, LOT_CLEAR));
  const planningMask = createRectMask([...planningHard, ...planningLots]);
  const regionList = regions.length ? regions : [{ name: 'default', x0: -Infinity, x1: Infinity }];
  const candidates = [];
  let rand = seed >>> 0;
  const tie = () => { rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0; return rand / 4294967296; };

  for (const region of regionList) {
    const local = lots.filter(p => regionAt(p, regions) === region.name && p.x >= region.x0 && p.x <= region.x1);
    const blockers = [...planningHard, ...planningLots];
    const add = (axis, a, b, c) => {
      for (const [start, end] of freeRuns(axis, a, b, c, blockers)) {
        const s = { axis, a: start, b: end, c, region: region.name, tie: tie() };
        if (!planningMask.intersects(boxOf(s))) candidates.push(s);
      }
    };
    if (local.length < 4) continue;
    const bounds = { x0: Math.min(...local.map(p => p.x - p.width / 2)), x1: Math.max(...local.map(p => p.x + p.width / 2)), z0: Math.min(...local.map(p => p.z - p.depth / 2)), z1: Math.max(...local.map(p => p.z + p.depth / 2)) };
    for (let z = Math.ceil(bounds.z0 / 2) * 2; z <= bounds.z1; z += 2) {
      if (local.filter(p => p.z < z && p.z >= z - 20).length < 2 || local.filter(p => p.z > z && p.z <= z + 20).length < 2) continue;
      add('x', bounds.x0, bounds.x1, z);
    }
    for (let x = Math.ceil(bounds.x0 / 2) * 2; x <= bounds.x1; x += 2) {
      if (local.filter(p => p.x < x && p.x >= x - 20).length < 2 || local.filter(p => p.x > x && p.x <= x + 20).length < 2) continue;
      add('z', bounds.z0 - WALK_HALF - LOT_CLEAR - .01, bounds.z1 + WALK_HALF + LOT_CLEAR + .01, x);
    }
    const zGaps = new Set(), xGaps = new Set();
    for (let i = 0; i < local.length; i++) for (let j = i + 1; j < local.length; j++) {
      const a = local[i], b = local[j];
      const [south, north] = a.z <= b.z ? [a, b] : [b, a], zgap = north.z - north.depth / 2 - south.z - south.depth / 2;
      if (Math.abs(a.z - b.z) <= 30 && a.x + a.width / 2 > b.x - b.width / 2 && b.x + b.width / 2 > a.x - a.width / 2 && zgap >= WALK_HALF * 2 + LOT_CLEAR * 2) zGaps.add((south.z + south.depth / 2 + north.z - north.depth / 2) / 2);
      const [west, east] = a.x <= b.x ? [a, b] : [b, a], xgap = east.x - east.width / 2 - west.x - west.width / 2;
      if (Math.abs(a.x - b.x) <= 30 && a.z + a.depth / 2 > b.z - b.depth / 2 && b.z + b.depth / 2 > a.z - a.depth / 2 && xgap >= WALK_HALF * 2 + LOT_CLEAR * 2) xGaps.add((west.x + west.width / 2 + east.x - east.width / 2) / 2);
    }
    for (const z of zGaps) add('x', bounds.x0, bounds.x1, z);
    for (const x of xGaps) add('z', bounds.z0 - WALK_HALF - LOT_CLEAR - .01, bounds.z1 + WALK_HALF + LOT_CLEAR + .01, x);
    for (const cluster of lotClusters(local)) {
      const b = { x0: Math.min(...cluster.map(p => p.x - p.width / 2)), x1: Math.max(...cluster.map(p => p.x + p.width / 2)), z0: Math.min(...cluster.map(p => p.z - p.depth / 2)), z1: Math.max(...cluster.map(p => p.z + p.depth / 2)) };
      const pad = WALK_HALF + LOT_CLEAR + .01;
      for (const z of [b.z0 - pad, b.z1 + pad]) for (const [a, e] of freeRuns('x', b.x0, b.x1, z, blockers)) {
        const s = { axis: 'x', a, b: e, c: z, region: region.name, tie: tie(), collector: true };
        if (!planningMask.intersects(boxOf(s))) candidates.push(s);
      }
      for (const x of [b.x0 - pad, b.x1 + pad]) for (const [a, e] of freeRuns('z', b.z0 - pad, b.z1 + pad, x, blockers)) {
        const s = { axis: 'z', a, b: e, c: x, region: region.name, tie: tie(), collector: true };
        if (!planningMask.intersects(boxOf(s))) candidates.push(s);
      }
    }
    add('x', bounds.x0, bounds.x1, bounds.z0 - WALK_HALF - LOT_CLEAR - .01);
    add('x', bounds.x0, bounds.x1, bounds.z1 + WALK_HALF + LOT_CLEAR + .01);
    add('z', bounds.z0 - WALK_HALF - LOT_CLEAR - .01, bounds.z1 + WALK_HALF + LOT_CLEAR + .01, bounds.x0 - WALK_HALF - LOT_CLEAR - .01);
    add('z', bounds.z0 - WALK_HALF - LOT_CLEAR - .01, bounds.z1 + WALK_HALF + LOT_CLEAR + .01, bounds.x1 + WALK_HALF + LOT_CLEAR + .01);
  }
  const covers = (s, side) => {
    const near = lots.filter(p => regionAt(p, regions) === s.region && (s.axis === 'x'
      ? (side < 0 ? p.z < s.c && p.z >= s.c - 20 : p.z > s.c && p.z <= s.c + 20) && p.x + p.width / 2 > s.a && p.x - p.width / 2 < s.b
      : (side < 0 ? p.x < s.c && p.x >= s.c - 20 : p.x > s.c && p.x <= s.c + 20) && p.z + p.depth / 2 > s.a && p.z - p.depth / 2 < s.b));
    const intervals = near.map(p => s.axis === 'x' ? [Math.max(s.a, p.x - p.width / 2), Math.min(s.b, p.x + p.width / 2)] : [Math.max(s.a, p.z - p.depth / 2), Math.min(s.b, p.z + p.depth / 2)]).sort((a, b) => a[0] - b[0]);
    let end = -Infinity, total = 0;
    for (const [a, b] of intervals) { total += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
    return total;
  };
  const edge = s => {
    if (s.collector) return true;
    const local = lots.filter(p => regionAt(p, regions) === s.region);
    const lo = s.axis === 'x' ? Math.min(...local.map(p => p.z - p.depth / 2)) : Math.min(...local.map(p => p.x - p.width / 2));
    const hi = s.axis === 'x' ? Math.max(...local.map(p => p.z + p.depth / 2)) : Math.max(...local.map(p => p.x + p.width / 2));
    return Math.abs(s.c - lo + WALK_HALF + LOT_CLEAR + .01) < .2 || Math.abs(s.c - hi - WALK_HALF - LOT_CLEAR - .01) < .2;
  };
  const ranked = candidates.filter(s => edge(s) ? Math.max(covers(s, -1), covers(s, 1)) >= Math.min(18, (s.b - s.a) * .35)
    : covers(s, -1) >= Math.min(18, (s.b - s.a) * .35) && covers(s, 1) >= Math.min(18, (s.b - s.a) * .35))
    .sort((a, b) => (b.b - b.a) - (a.b - a.a) || a.tie - b.tie);
  candidates.length = 0;
  for (const s of ranked) {
    const duplicate = candidates.some(q => q.region === s.region && q.axis === s.axis && Math.abs(q.c - s.c) < 12 && Math.max(0, Math.min(q.b, s.b) - Math.max(q.a, s.a)) / Math.min(q.b - q.a, s.b - s.a) > .45);
    if (!duplicate) candidates.push(s);
  }

  // Connect each candidate to its nearest sampled existing street with a clear Manhattan connector.
  const segmentPoint = (s, p) => s.axis === 'x' ? { x: Math.max(s.a, Math.min(s.b, p.x)), z: s.c } : { x: s.c, z: Math.max(s.a, Math.min(s.b, p.z)) };
  const clearSegment = s => !planningMask.intersects(boxOf(s));
  const routeFreeCache = new Map();
  let routeAttempts = 0, routeSuccesses = 0, routeAttached = 0;
  const routeBetween = (start, goal, region) => {
    routeAttempts++;
    const margin = 30, minX = Math.floor((Math.min(start.x, goal.x) - margin) * 2), maxX = Math.ceil((Math.max(start.x, goal.x) + margin) * 2);
    const minZ = Math.floor((Math.min(start.z, goal.z) - margin) * 2), maxZ = Math.ceil((Math.max(start.z, goal.z) + margin) * 2);
    const isFree = (ix, iz) => {
      const key = `${ix},${iz}`;
      if (!routeFreeCache.has(key)) { const x = ix / 2, z = iz / 2; routeFreeCache.set(key, !planningMask.intersects(rect(x - WALK_HALF, x + WALK_HALF, z - WALK_HALF, z + WALK_HALF))); }
      return routeFreeCache.get(key);
    };
    const snap = p => {
      const x0 = Math.round(p.x * 2), z0 = Math.round(p.z * 2), choices = [];
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (isFree(x0 + dx, z0 + dz)) choices.push({ x: x0 + dx, z: z0 + dz, d: Math.hypot(dx, dz) });
      return choices.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z)[0];
    };
    const src = snap(start), dst = snap(goal);
    if (!src || !dst) return null;
    const point = p => ({ x: p.x / 2, z: p.z / 2 });
    const endpoints = [start, point(src), point(dst), goal];
    const legs = (a, b) => {
      if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.z - b.z) < 1e-6) return [a, b];
      for (const c of [{ x: b.x, z: a.z }, { x: a.x, z: b.z }]) {
        const points = [a, c, b], tests = points.slice(1).map((p, i) => {
          const q = points[i];
          return Math.abs(p.x - q.x) > 1e-6
            ? { axis: 'x', a: Math.min(q.x, p.x), b: Math.max(q.x, p.x), c: q.z, region, connector: true }
            : { axis: 'z', a: Math.min(q.z, p.z), b: Math.max(q.z, p.z), c: q.x, region, connector: true };
        }).filter(s => s.b - s.a > 1e-6);
        if (tests.every(clearSegment)) return [a, c, b];
      }
      return null;
    };
    const startStub = legs(endpoints[0], endpoints[1]), endStub = legs(endpoints[2], endpoints[3]);
    if (!startStub || !endStub) return null;
    const sid = `${src.x},${src.z},-1`, h = p => (Math.abs(p.x - dst.x) + Math.abs(p.z - dst.z)) / 2;
    const open = minHeap(), score = new Map([[sid, 0]]), prev = new Map(), state = new Map([[sid, src]]);
    open.push({ key: sid, p: src, dir: -1, g: 0, h: h(src), f: h(src) });
    let found = null, visits = 0;
    const maxCost = h(src) + 30;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]], offset = (seed >>> 0) % 4;
    while (open.size) {
      const cur = open.pop();
      if (++visits > 60000) break;
      if (cur.g !== score.get(cur.key)) continue;
      if (cur.p.x === dst.x && cur.p.z === dst.z) { found = cur.key; break; }
      for (let k = 0; k < 4; k++) {
        const dir = (k + offset) % 4, [dx, dz] = dirs[dir], p = { x: cur.p.x + dx, z: cur.p.z + dz }, key = `${p.x},${p.z},${dir}`, g = cur.g + .5 + (cur.dir >= 0 && cur.dir !== dir ? .2 : 0);
        if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ || g > maxCost || !isFree(p.x, p.z) || g >= (score.get(key) ?? Infinity)) continue;
        const estimate = h(p);
        score.set(key, g); prev.set(key, cur.key); state.set(key, p); open.push({ key, p, dir, g, h: estimate, f: g + estimate });
      }
    }
    if (!found) return null;
    const path = []; let key = found;
    while (key) { path.push(point(state.get(key))); if (key === sid) break; key = prev.get(key); }
    path.reverse();
    const points = [...startStub, ...path.slice(1), ...endStub.slice(1)];
    const clean = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const a = clean.at(-1), b = points[i], c = points[i + 1];
      if ((a.x === b.x && b.x === c.x) || (a.z === b.z && b.z === c.z)) continue;
      clean.push(b);
    }
    clean.push(points.at(-1));
    const result = [];
    for (let i = 1; i < clean.length; i++) {
      const a = clean[i - 1], b = clean[i];
      if (Math.abs(a.x - b.x) > 1e-6) result.push({ axis: 'x', a: Math.min(a.x, b.x), b: Math.max(a.x, b.x), c: a.z, region, connector: true });
      else if (Math.abs(a.z - b.z) > 1e-6) result.push({ axis: 'z', a: Math.min(a.z, b.z), b: Math.max(a.z, b.z), c: a.x, region, connector: true });
    }
    if (result.length && result.every(clearSegment)) { routeSuccesses++; return result; }
    return null;
  };
  const connected = new Set(), queue = [];
  const intersection = (a, b) => {
    if (a.axis === b.axis) return null;
    const x = a.axis === 'x' ? b.c : a.c, z = a.axis === 'x' ? a.c : b.c;
    return x >= (a.axis === 'x' ? a.a : b.a) - 1e-6 && x <= (a.axis === 'x' ? a.b : b.b) + 1e-6 &&
      z >= (a.axis === 'x' ? b.a : a.a) - 1e-6 && z <= (a.axis === 'x' ? b.b : a.b) + 1e-6 ? { x, z } : null;
  };
  const adjacent = (a, b) => intersection(a, b) || (a.axis === b.axis && Math.abs(a.c - b.c) < 1e-6 && Math.min(a.b, b.b) >= Math.max(a.a, b.a) - 1e-6);
  const anchorAttachments = [];
  const sourceCount = candidates.length;
  for (let i = 0; i < sourceCount; i++) {
    const s = candidates[i];
    const nearby = anchors.slice().sort((a, b) => Math.hypot(segmentPoint(s, a).x - a.x, segmentPoint(s, a).z - a.z) - Math.hypot(segmentPoint(s, b).x - b.x, segmentPoint(s, b).z - b.z)).slice(0, 16);
    for (const near of nearby) {
      const target = segmentPoint(s, near), distance = Math.hypot(target.x - near.x, target.z - near.z);
      if (distance <= 2.25) { anchorAttachments.push({ index: i, segment: s, point: target, anchor: near, region: s.region, overlap: true }); break; }
      const orders = [
        [[near.x, target.x, near.z], [near.z, target.z, target.x]],
        [[near.x, target.x, target.z], [target.z, near.z, near.x]],
      ];
      let path;
      for (const order of orders) {
        const legs = order.map(([a, b, c], k) => ({ axis: k === 0 ? 'x' : 'z', a: Math.min(a, b), b: Math.max(a, b), c, region: s.region, tie: tie(), connector: true })).filter(q => q.b - q.a > .5);
        if (legs.length && legs.every(clearSegment)) { path = legs; break; }
      }
      if (!path) continue;
      const indices = path.map(q => { const j = candidates.length; candidates.push(q); return j; });
      anchorAttachments.push({ index: indices.at(-1), segment: candidates[indices.at(-1)], point: target, anchor: near, region: s.region, overlap: false });
      break;
    }
  }
  const addToGraph = (i, links) => { if (!connected.has(i)) { connected.add(i); queue.push(i); } };
  const linkAll = () => candidates.map((s, i) => candidates.flatMap((q, j) => i !== j && adjacent(s, q) ? [j] : []));
  const flood = links => {
    queue.length = 0;
    for (const i of connected) queue.push(i);
    for (const a of anchorAttachments) addToGraph(a.index, links);
    while (queue.length) for (const j of links[queue.shift()] ?? []) if (!connected.has(j)) addToGraph(j, links);
  };
  let links = linkAll(); flood(links);
  // First attach unrooted candidate components with cheap two-elbow paths.
  const remainingComponents = () => {
    const seen = new Set(), components = [];
    for (let i = 0; i < sourceCount; i++) {
      if (connected.has(i) || seen.has(i)) continue;
      const component = [], pending = [i]; seen.add(i);
      while (pending.length) {
        const at = pending.pop(); component.push(at);
        for (const j of links[at] ?? []) if (j < sourceCount && !connected.has(j) && !seen.has(j)) { seen.add(j); pending.push(j); }
      }
      components.push(component);
    }
    return components;
  };
  const elbowConnector = (s, q) => {
    const mid = q.axis === 'x' ? { x: (q.a + q.b) / 2, z: q.c } : { x: q.c, z: (q.a + q.b) / 2 };
    const end = segmentPoint(s, mid), from = segmentPoint(q, end);
    if (Math.abs(end.x - from.x) + Math.abs(end.z - from.z) > 45) return null;
    const orders = [
      [{ x: from.x, z: from.z }, { x: end.x, z: from.z }, end],
      [{ x: from.x, z: from.z }, { x: from.x, z: end.z }, end],
    ];
    for (const points of orders) {
      const path = [];
      for (let k = 1; k < points.length; k++) {
        const a = points[k - 1], b = points[k];
        if (Math.abs(a.x - b.x) > .5) path.push({ axis: 'x', a: Math.min(a.x, b.x), b: Math.max(a.x, b.x), c: a.z, region: s.region, connector: true });
        else if (Math.abs(a.z - b.z) > .5) path.push({ axis: 'z', a: Math.min(a.z, b.z), b: Math.max(a.z, b.z), c: a.x, region: s.region, connector: true });
      }
      if (path.length && path.every(clearSegment)) return path;
    }
    return null;
  };
  let components = remainingComponents();
  for (const component of components) {
    if (component.some(i => connected.has(i))) continue;
    const members = component.map(i => candidates[i]);
    const pairs = [];
    for (const i of component) for (const j of connected) {
      const s = candidates[i], q = candidates[j];
      if (!q) continue;
      const mid = q.axis === 'x' ? { x: (q.a + q.b) / 2, z: q.c } : { x: q.c, z: (q.a + q.b) / 2 };
      const p = segmentPoint(s, mid), t = segmentPoint(q, p);
      pairs.push({ i, j, s, q, p, t, d: Math.abs(p.x - t.x) + Math.abs(p.z - t.z) });
    }
    pairs.sort((a, b) => a.d - b.d || (a.s.tie ?? 0) - (b.s.tie ?? 0) || (a.q.tie ?? 0) - (b.q.tie ?? 0));
    let joined = false;
    for (const pair of pairs.slice(0, 16)) {
      const path = elbowConnector(pair.s, pair.q);
      if (!path) continue;
      candidates.push(...path); links = linkAll(); flood(links);
      if (component.some(i => connected.has(i))) { joined = true; break; }
    }
    if (joined) continue;
    // A* is bounded to three nearest boundary pairs per disconnected component.
    for (const pair of pairs.slice(0, 3)) {
      const path = routeBetween(pair.p, pair.t, pair.s.region);
      if (!path) continue;
      candidates.push(...path); links = linkAll(); flood(links);
      if (component.some(i => connected.has(i))) { routeAttached += component.filter(i => connected.has(i)).length; joined = true; break; }
    }
  }
  const kept = candidates.filter((_, i) => connected.has(i));

  // Raster union creates one mutually exclusive road/sidewalk surface at intersections, then greedy rectangle packing.
  // shortcut: metre-grid paving gives tight mews one-sided sidewalks; use polygon clipping for street-level kerb detail.
  const cells = new Map();
  const surfaceBlockers = [...hard, ...lots.map(p => rect(p.x - p.width / 2, p.x + p.width / 2, p.z - p.depth / 2, p.z + p.depth / 2))];
  const surfaceMask = createRectMask(surfaceBlockers);
  const accessSurfaceMask = createRectMask([...obstacles, ...accessProtectedRects, ...treeRects, ...lots.map(p => rect(p.x - p.width / 2, p.x + p.width / 2, p.z - p.depth / 2, p.z + p.depth / 2))]);
  const existingAsphaltMask = createRectMask([...existingAsphaltRects, ...anchors.map(a => { const half = (a.width ?? 3) / 2; return rect(a.x - half, a.x + half, a.z - half, a.z + half); })]);
  let rasterSegments = kept, surfaceSegments = [];
  const put = (x, z, kind, region) => {
    const ix = Math.floor(x), iz = Math.floor(z), key = `${ix},${iz}`;
    const cell = rect(ix, ix + 1, iz, iz + 1);
    if (cells.has(key) || (kind === 'access' ? accessSurfaceMask : surfaceMask).intersects(cell)) return;
    const road = kind === 'road' || (kind !== 'access' && rasterSegments.some(s => (s.axis === 'x'
      ? ix + 1 > s.a && ix < s.b && iz >= Math.floor(s.c - ROAD_HALF) && iz < Math.floor(s.c - ROAD_HALF) + 3
      : iz + 1 > s.a && iz < s.b && ix >= Math.floor(s.c - ROAD_HALF) && ix < Math.floor(s.c - ROAD_HALF) + 3)));
    // Existing asphalt owns junction mouths; raised paving must stop before its footprint.
    if ((kind === 'access' || !road) && existingAsphaltMask.intersects(cell)) return;
    cells.set(key, { x: ix, z: iz, kind: kind === 'access' ? 'access' : road ? 'road' : 'sidewalk', region });
  };
  for (const s of kept) {
    const r = boxOf(s);
    for (let x = Math.floor(r.x0); x < r.x1; x++) for (let z = Math.floor(r.z0); z < r.z1; z++) put(x + .5, z + .5, 'sidewalk', s.region);
  }
  for (const s of kept) {
    const spans = [...cells.values()].filter(c => c.kind === 'road' && (s.axis === 'x'
      ? s.c >= c.z - 1e-6 && s.c <= c.z + 1 + 1e-6
      : s.c >= c.x - 1e-6 && s.c <= c.x + 1 + 1e-6))
      .map(c => s.axis === 'x' ? [Math.max(s.a, c.x), Math.min(s.b, c.x + 1)] : [Math.max(s.a, c.z), Math.min(s.b, c.z + 1)])
      .filter(([a, b]) => b > a + 1e-6).sort((a, b) => a[0] - b[0]);
    let lo = null, hi = null;
    for (const [a, b] of spans) {
      if (lo === null) { lo = a; hi = b; }
      else if (a <= hi + 1e-6) hi = Math.max(hi, b);
      else { if (hi - lo > .5) surfaceSegments.push({ ...s, a: lo, b: hi, source: s }); lo = a; hi = b; }
    }
    if (lo !== null && hi - lo > .5) surfaceSegments.push({ ...s, a: lo, b: hi, source: s });
  }
  let graphAttachments = anchorAttachments.flatMap(a => {
    const s = surfaceSegments.find(q => q.source === a.segment && (q.axis === 'x' ? a.point.x >= q.a - 1e-6 && a.point.x <= q.b + 1e-6 : a.point.z >= q.a - 1e-6 && a.point.z <= q.b + 1e-6));
    return s ? [{ ...a, segment: s }] : [];
  });
  const segmentLinks = surfaceSegments.map(s => surfaceSegments.flatMap((q, j) => s !== q && adjacent(s, q) ? [j] : []));
  const reachableSegments = new Set(), segmentQueue = [];
  for (const a of graphAttachments) {
    const i = surfaceSegments.indexOf(a.segment);
    if (i >= 0 && !reachableSegments.has(i)) { reachableSegments.add(i); segmentQueue.push(i); }
  }
  while (segmentQueue.length) for (const j of segmentLinks[segmentQueue.shift()]) if (!reachableSegments.has(j)) { reachableSegments.add(j); segmentQueue.push(j); }
  const unanchoredSurfaceSegments = surfaceSegments.length - reachableSegments.size;
  surfaceSegments = surfaceSegments.filter((_, i) => reachableSegments.has(i));
  graphAttachments = graphAttachments.filter(a => surfaceSegments.includes(a.segment));
  rasterSegments = surfaceSegments;
  cells.clear();
  for (const s of surfaceSegments) {
    const r = boxOf(s);
    for (let x = Math.floor(r.x0); x < r.x1; x++) for (let z = Math.floor(r.z0); z < r.z1; z++) put(x + .5, z + .5, 'sidewalk', s.region);
  }
  const accessResult = resolveBuildingAccess({
    plots: lots.map(p => ({ ...p, region: regionAt(p, regions) })),
    segments: surfaceSegments, anchors: anchors.map(a => ({ ...a, region: regionAt(a, regions) })), obstacles, protectedRects: accessProtectedRects, trees,
  });
  for (const r of accessResult.rects) {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    for (let x = Math.floor(x0); x < x1; x++) for (let z = Math.floor(z0); z < z1; z++) put(x + .5, z + .5, 'access', r.region);
  }
  const rects = [];
  const remaining = new Map(cells);
  while (remaining.size) {
    const first = remaining.values().next().value;
    let w = 1; while (remaining.has(`${first.x + w},${first.z}`) && remaining.get(`${first.x + w},${first.z}`).kind === first.kind && remaining.get(`${first.x + w},${first.z}`).region === first.region) w++;
    let d = 1, extend = true;
    while (extend) { for (let x = 0; x < w; x++) { const c = remaining.get(`${first.x + x},${first.z + d}`); if (!c || c.kind !== first.kind || c.region !== first.region) { extend = false; break; } } if (extend) d++; }
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) remaining.delete(`${first.x + x},${first.z + z}`);
    rects.push({ x: first.x + w / 2, z: first.z + d / 2, w, d, kind: first.kind, region: first.region });
  }

  // Split lines at actual intersections so graph connectivity agrees with the paved union.
  const nodes = [], edges = [], pointId = new Map();
    const node = (x, z, region) => { const key = `${x.toFixed(3)},${z.toFixed(3)}`; if (!pointId.has(key)) { pointId.set(key, nodes.length); nodes.push({ x, z, region, anchor: false }); } return pointId.get(key); };
  for (const s of surfaceSegments) {
    const cuts = [s.a, s.b,
      ...surfaceSegments.filter(q => q !== s).flatMap(q => {
        const p = intersection(s, q);
        if (p) return [s.axis === 'x' ? p.x : p.z];
        if (q.axis === s.axis && Math.abs(q.c - s.c) < 1e-6 && Math.min(q.b, s.b) >= Math.max(q.a, s.a) - 1e-6) return [Math.max(q.a, s.a), Math.min(q.b, s.b)];
        return [];
      }),
      ...graphAttachments.filter(a => a.segment === s).map(a => s.axis === 'x' ? a.point.x : a.point.z),
    ].filter(v => v >= s.a && v <= s.b).sort((a, b) => a - b);
    const unique = cuts.filter((v, i) => !i || Math.abs(v - cuts[i - 1]) > 1e-6);
    for (let i = 0; i < unique.length - 1; i++) {
      const p = v => s.axis === 'x' ? [v, s.c] : [s.c, v];
      const a = p(unique[i]), b = p(unique[i + 1]);
      edges.push({ from: node(...a, s.region), to: node(...b, s.region), region: s.region, kind: 'road', width: ROAD_HALF * 2, orientation: s.axis, category: s.collector ? 'collector' : s.connector ? 'link' : 'residential' });
    }
  }
  for (const a of graphAttachments) {
    if (!connected.has(a.index)) continue;
    const from = node(a.anchor.x, a.anchor.z, a.region), to = node(a.point.x, a.point.z, a.region);
    nodes[from].anchor = true;
    if (a.overlap && from !== to) edges.push({ from, to, region: a.region, kind: 'connection', width: Math.min(ROAD_HALF * 2, a.anchor.width ?? ROAD_HALF * 2), orientation: 'junction', category: 'link' });
  }
  const keptSources = surfaceSegments.filter(s => !s.connector).length;
  return { rects, nodes, edges, accesses: accessResult.accesses, unresolved: accessResult.unresolved, stats: { candidateSegments: sourceCount, connectedSegments: keptSources, disconnectedSegments: sourceCount - keptSources, connectorSegments: surfaceSegments.filter(s => s.connector).length, discardedSurfaceFragments: unanchoredSurfaceSegments, routeAttempts, routeSuccesses, routeAttached, pavedCells: cells.size, seed: seed >>> 0 } };
}
