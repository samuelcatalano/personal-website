const WIDTH = .9, MAX_LENGTH = 30, FALLBACK_MAX_LENGTH = 45;
const rectOf = (a, b, width = WIDTH) => a.x === b.x
  ? { x0: a.x - width / 2, x1: a.x + width / 2, z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }
  : { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: a.z - width / 2, z1: a.z + width / 2 };
const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;
const plotRect = p => ({ x0: p.x - p.width / 2, x1: p.x + p.width / 2, z0: p.z - p.depth / 2, z1: p.z + p.depth / 2 });
const treeRect = t => ({ x0: t.x - .6, x1: t.x + .6, z0: t.z - .6, z1: t.z + .6 });
const centerlinePoint = (s, p) => s.axis === 'x'
  ? { x: Math.max(s.a, Math.min(s.b, p.x)), z: s.c }
  : { x: s.c, z: Math.max(s.a, Math.min(s.b, p.z)) };
const edgeCandidates = (s, door) => {
  const p = centerlinePoint(s, door);
  if (s.axis === 'x') return [-1, 1].map(sign => ({ point: { x: p.x, z: s.c + sign * ((s.width ?? 4.5) / 2) }, side: 'z' }));
  return [-1, 1].map(sign => ({ point: { x: s.c + sign * ((s.width ?? 4.5) / 2), z: p.z }, side: 'x' }));
};
const pathPoints = (start, end, plot) => {
  const routes = [[start, { x: end.x, z: start.z }, end], [start, { x: start.x, z: end.z }, end]];
  for (const sign of [-1, 1]) {
    const sideX = plot.x + sign * (plot.width / 2 + .6);
    routes.push([start, { x: sideX, z: start.z }, { x: sideX, z: end.z }, end]);
  }
  return routes;
};
const pathRects = points => points.slice(1).map((p, i) => rectOf(points[i], p)).filter(r => r.x1 - r.x0 > 1e-6 && r.z1 - r.z0 > 1e-6);
const toOutRect = (r, region) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, d: r.z1 - r.z0, kind: 'access', region });

// A coarse spatial hash keeps per-lot collision checks local in city sized layouts.
function indexRects(rects, size = 16) {
  const cells = new Map();
  for (const item of rects) {
    const r = item.rect;
    for (let x = Math.floor(r.x0 / size); x <= Math.floor(r.x1 / size); x++) for (let z = Math.floor(r.z0 / size); z <= Math.floor(r.z1 / size); z++) {
      const k = `${x},${z}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(item);
    }
  }
  return { near(r) { const out = new Set(); for (let x = Math.floor(r.x0 / size); x <= Math.floor(r.x1 / size); x++) for (let z = Math.floor(r.z0 / size); z <= Math.floor(r.z1 / size); z++) for (const item of cells.get(`${x},${z}`) ?? []) out.add(item); return out; } };
}

const project = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, n = dx * dx + dz * dz;
  const t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / n)) : 0;
  return { x: a.x + dx * t, z: a.z + dz * t };
};
const frontagePoints = plot => plot.front
  ? [plot.front]
  : [0, -.24, .24, -.36, .36].map(offset => ({ x: plot.x + plot.width * offset, z: plot.z + plot.depth / 2 }));
const nearRect = (p, radius) => ({ x0: p.x - radius, x1: p.x + radius, z0: p.z - radius, z1: p.z + radius });
const lineRect = (a, b) => ({ x0: Math.min(a.x, b.x) - WIDTH / 2, x1: Math.max(a.x, b.x) + WIDTH / 2, z0: Math.min(a.z, b.z) - WIDTH / 2, z1: Math.max(a.z, b.z) + WIDTH / 2 });

export function resolveBuildingAccess({ plots = [], segments = [], anchors = [], obstacles = [], protectedRects = [], trees = [] } = {}) {
  const valid = plots.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z) && p.width > 0 && p.depth > 0);
  const hard = [...obstacles, ...protectedRects, ...trees.map(treeRect)].map(rect => ({ rect }));
  const lotItems = valid.map(plot => ({ rect: plotRect(plot), plot }));
  const collisionIndex = indexRects([...hard, ...lotItems]);
  const surfaces = [
    ...segments.map(segment => { const half = (segment.width ?? 4.5) / 2; return { rect: segment.axis === 'x' ? { x0: segment.a, x1: segment.b, z0: segment.c - half, z1: segment.c + half } : { x0: segment.c - half, x1: segment.c + half, z0: segment.a, z1: segment.b }, segment }; }),
    ...anchors.map(anchor => { const half = (anchor.width ?? 4.5) / 2; return { rect: { x0: anchor.x - half, x1: anchor.x + half, z0: anchor.z - half, z1: anchor.z + half }, anchor }; }),
  ];
  const surfaceIndex = indexRects(surfaces);
  const accesses = [], unresolved = [], rects = [];
  const targetItems = [];
  const addAccessTargets = access => {
    if (access.points.length === 1) { const a = access.points[0]; targetItems.push({ rect: lineRect(a, a), a, b: a, region: access.region, lotId: access.lotId }); }
    for (let i = 1; i < access.points.length; i++) {
      const a = access.points[i - 1], b = access.points[i];
      if (Math.hypot(a.x - b.x, a.z - b.z) > 1e-6) targetItems.push({ rect: lineRect(a, b), a, b, region: access.region, lotId: access.lotId });
    }
  };
  const addRects = (paths, region) => rects.push(...paths.map(r => toOutRect(r, region)));
  const clearPaths = (plot, paths) => {
    if (!paths.length) return true;
    const bounds = { x0: Math.min(...paths.map(r => r.x0)), x1: Math.max(...paths.map(r => r.x1)), z0: Math.min(...paths.map(r => r.z0)), z1: Math.max(...paths.map(r => r.z1)) };
    const blockers = [...collisionIndex.near(bounds)];
    return !paths.some(path => blockers.some(b => overlap(path, b.rect)));
  };
  const addServed = (access, paths) => {
    accesses.push(access); addAccessTargets(access); addRects(paths, access.region);
  };
  const ordered = [...valid].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const pending = [];

  for (const plot of ordered) {
    const region = plot.region ?? 'default';
    let connected = false;
    for (const front of frontagePoints(plot)) {
      const door = { x: front.x ?? plot.x, z: front.z ?? (plot.z + plot.depth / 2) };
      const entry = { x: door.x, z: door.z + (door.z >= plot.z ? .5 : -.5) };
      const nearbySurfaces = [...surfaceIndex.near(nearRect(door, MAX_LENGTH + 1))];
      const frontageTargets = [];
      for (const { segment: s } of nearbySurfaces.filter(item => item.segment)) {
        const half = (s.width ?? 4.5) / 2;
        const onSurface = s.axis === 'x' ? door.x >= s.a && door.x <= s.b && Math.abs(door.z - s.c) <= half : door.z >= s.a && door.z <= s.b && Math.abs(door.x - s.c) <= half;
        frontageTargets.push({ point: onSurface ? door : edgeCandidates(s, door)[0].point });
        if (!onSurface) frontageTargets.push(...edgeCandidates(s, door).map(({ point }) => ({ point })));
      }
      for (const { anchor: a } of nearbySurfaces.filter(item => item.anchor)) {
        const half = (a.width ?? 4.5) / 2, inside = Math.abs(door.x - a.x) <= half && Math.abs(door.z - a.z) <= half;
        frontageTargets.push({ point: inside ? door : { x: Math.max(a.x - half, Math.min(a.x + half, door.x)), z: Math.max(a.z - half, Math.min(a.z + half, door.z)) } });
      }
      const existing = frontageTargets.map(t => ({ ...t, distance: Math.hypot(t.point.x - door.x, t.point.z - door.z) }))
        .filter(t => t.distance <= 1.1).sort((a, b) => a.distance - b.distance)[0];
      if (existing) {
        if (existing.distance <= 1e-6) {
          const footprint = { x0: door.x - WIDTH / 2, x1: door.x + WIDTH / 2, z0: door.z - WIDTH / 2, z1: door.z + WIDTH / 2 };
          const clearDoor = ![...collisionIndex.near(footprint)].some(b => b.plot !== plot && overlap(footprint, b.rect));
          if (clearDoor) {
            addServed({ lotId: plot.id, region, points: [door], existing: true }, []);
            connected = true; break;
          }
        } else {
          const frontagePath = choosePath(null, plot, door, entry, existing.point, existing.distance, clearPaths);
          if (frontagePath) {
            addServed({ lotId: plot.id, region, points: frontagePath.points, existing: true }, frontagePath.paths);
            connected = true; break;
          }
        }
      }
      let best = null;
      const roadTargets = [
        ...nearbySurfaces.flatMap(item => item.segment ? edgeCandidates(item.segment, entry) : []),
        ...nearbySurfaces.filter(item => item.anchor).flatMap(item => { const a = item.anchor, half = (a.width ?? 4.5) / 2; return [{ point: { x: Math.max(a.x - half, Math.min(a.x + half, entry.x)), z: Math.max(a.z - half, Math.min(a.z + half, entry.z)) } }]; }),
      ];
      for (const { point } of roadTargets) {
        const distance = Math.hypot(point.x - entry.x, point.z - entry.z);
        if (distance > MAX_LENGTH) continue;
        best = choosePath(best, plot, door, entry, point, distance, clearPaths);
      }
      if (best) {
        addServed({ lotId: plot.id, region, points: best.points, existing: false }, best.paths);
        connected = true; break;
      }
    }
    if (!connected) pending.push(plot);
  }

  // Grow only from street rooted accesses, in stable passes, so provenance cannot form cycles.
  let remaining = pending;
  while (remaining.length && targetItems.length) {
    const targetIndex = indexRects(targetItems);
    const next = []; let added = false;
    for (const plot of remaining) {
      const region = plot.region ?? 'default';
      let connected = false;
      for (const front of frontagePoints(plot)) {
        const door = { x: front.x ?? plot.x, z: front.z ?? (plot.z + plot.depth / 2) };
        const entry = { x: door.x, z: door.z + (door.z >= plot.z ? .5 : -.5) };
        const nearby = [...targetIndex.near(nearRect(entry, MAX_LENGTH))].map(t => ({ target: t, point: project(entry, t.a, t.b) }))
          .map(t => ({ ...t, distance: Math.hypot(t.point.x - entry.x, t.point.z - entry.z) })).filter(t => t.distance <= MAX_LENGTH)
          .sort((a, b) => a.distance - b.distance || String(a.target.lotId).localeCompare(String(b.target.lotId)));
        let best = null;
        for (const { target, point, distance } of nearby) {
          if (best && distance >= best.length) break;
          best = choosePath(best, plot, door, entry, point, distance, clearPaths, target.lotId);
        }
        if (!best) continue;
        addServed({ lotId: plot.id, region, points: best.points, existing: false, viaLotId: best.viaLotId }, best.paths);
        added = true; connected = true; break;
      }
      if (!connected) next.push(plot);
    }
    if (!added) { remaining = next; break; }
    remaining = next;
  }
  let fallbackRemaining = remaining;
  while (fallbackRemaining.length && targetItems.length) {
    const targetIndex = indexRects(targetItems);
    const next = []; let added = false;
    for (const plot of fallbackRemaining) {
      const region = plot.region ?? 'default'; let connected = false;
      for (const front of frontagePoints(plot)) {
        const door = { x: front.x ?? plot.x, z: front.z ?? (plot.z + plot.depth / 2) };
        const entry = { x: door.x, z: door.z + (door.z >= plot.z ? .5 : -.5) };
        const nearbyTargets = [...targetIndex.near(nearRect(entry, FALLBACK_MAX_LENGTH))].map(target => ({ target, point: project(entry, target.a, target.b) }))
          .map(v => ({ ...v, distance: Math.hypot(v.point.x - entry.x, v.point.z - entry.z) })).filter(v => v.distance <= FALLBACK_MAX_LENGTH)
          .sort((a, b) => a.distance - b.distance || String(a.target.lotId).localeCompare(String(b.target.lotId)));
        const rootIds = [...new Set(nearbyTargets.map(v => v.target.lotId))].slice(0, 3);
        const targets = nearbyTargets.filter(v => rootIds.includes(v.target.lotId));
        const fallback = gridPath(plot, door, entry, targets, clearPaths);
        if (!fallback) continue;
        addServed({ lotId: plot.id, region, points: fallback.points, existing: false, viaLotId: fallback.viaLotId }, fallback.paths);
        added = true; connected = true; break;
      }
      if (!connected) next.push(plot);
    }
    if (!added) { fallbackRemaining = next; break; }
    fallbackRemaining = next;
  }
  unresolved.push(...fallbackRemaining.map(plot => plot.id));
  return { accesses, unresolved, rects };
}

function gridPath(plot, door, entry, targets, clearPaths) {
  const doorPath = rectOf(door, entry);
  if (!clearPaths(plot, [doorPath])) return null;
  const lattice = v => [Math.floor(v * 2) / 2, Math.ceil(v * 2) / 2];
  const seeds = new Map();
  for (const x of lattice(entry.x)) for (const z of lattice(entry.z)) {
    const point = { x, z }, stubs = [[entry, { x, z: entry.z }, point], [entry, { x: entry.x, z }, point]];
    let start = null;
    for (const route of stubs) {
      const paths = pathRects(route);
      if (!clearPaths(plot, paths)) continue;
      const cost = route.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - route[i].x) + Math.abs(p.z - route[i].z), .5);
      if (cost < FALLBACK_MAX_LENGTH && (!start || cost < start.cost)) start = { point, route, cost };
    }
    if (start) seeds.set(`${x},${z}`, start);
  }
  if (!seeds.size) return null;
  const queue = [...seeds.keys()], parents = new Map(queue.map(k => [k, null])), costs = new Map([...seeds].map(([k, v]) => [k, v.cost]));
  const initial = new Map([...seeds].map(([k, v]) => [k, v.route]));
  const dirs = [[.5, 0], [0, .5], [-.5, 0], [0, -.5]];
  for (let head = 0; head < queue.length; head++) {
    const key = queue[head], [x, z] = key.split(',').map(Number), node = { x, z }, cost = costs.get(key);
    for (const { target, point } of targets) {
      const endDistance = Math.abs(point.x - x) + Math.abs(point.z - z);
      if (cost + endDistance > FALLBACK_MAX_LENGTH) continue;
      const endings = [[node, { x: point.x, z }, point], [node, { x, z: point.z }, point]];
      for (const endRoute of endings) {
        const endPaths = pathRects(endRoute);
        if (!clearPaths(plot, endPaths)) continue;
        const chain = [];
        for (let at = key; at; at = parents.get(at)) chain.push(at);
        chain.reverse();
        const route = [...initial.get(chain[0]), ...chain.slice(1).map(k => { const [px, pz] = k.split(',').map(Number); return { x: px, z: pz }; }), ...endRoute.slice(1)];
        const points = simplifyPoints([door, ...route]);
        const paths = [...pathRects(points), doorPath];
        const length = points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.z - points[i].z), 0);
        if (length <= FALLBACK_MAX_LENGTH && clearPaths(plot, paths)) return { points, paths, viaLotId: target.lotId };
      }
    }
    for (const [dx, dz] of dirs) {
      const next = { x: x + dx, z: z + dz }, nextKey = `${next.x},${next.z}`, nextCost = cost + .5;
      if (parents.has(nextKey) || nextCost > FALLBACK_MAX_LENGTH) continue;
      if (!clearPaths(plot, [rectOf(node, next)])) continue;
      parents.set(nextKey, key); costs.set(nextKey, nextCost); queue.push(nextKey);
    }
  }
  return null;
}

function simplifyPoints(points) {
  const out = [];
  for (const p of points) {
    if (out.length && Math.hypot(p.x - out.at(-1).x, p.z - out.at(-1).z) < 1e-6) continue;
    while (out.length > 1) {
      const a = out.at(-2), b = out.at(-1);
      if ((Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - p.x) < 1e-6) || (Math.abs(a.z - b.z) < 1e-6 && Math.abs(b.z - p.z) < 1e-6)) out.pop();
      else break;
    }
    out.push(p);
  }
  return out;
}

function choosePath(best, plot, door, entry, point, distance, clearPaths, viaLotId) {
  if (distance > MAX_LENGTH || (best && distance >= best.length)) return best;
  for (const points of pathPoints(entry, point, plot)) {
    const length = .5 + points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0);
    if (length > MAX_LENGTH || (best && length >= best.length)) continue;
    const paths = [...pathRects(points), rectOf(door, entry)];
    if (!clearPaths(plot, paths)) continue;
    best = { points: [door, ...points], paths, length, viaLotId };
  }
  return best;
}
