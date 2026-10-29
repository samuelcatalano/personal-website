# With the local preview open in browser-harness:  browser-harness < tests/street-props.browser.py
# Rebuilds the city data like scene.js, places the street props, and asserts the rules with footprints: no overlap with each other, boxes, trees, lamps, kiosks, signs, plots,
# the pavement walking lanes (crowd.js), plaza walking rings / wander rects, bays/road; quiet plazas stay empty; placement is deterministic; the Belisha globe glows.
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const T = await import('three');
  const q = `?sp=${Date.now()}`;
  const { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const { buildCity } = await import(`./js/world/city.js${q}`);
  const { buildLandmarks } = await import(`./js/world/landmarks.js${q}`);
  const { lampSpots } = await import('./js/world/street-lamp.js');
  const { kioskSpots } = await import('./js/world/phone.js');
  const { parkingBays } = await import('./js/world/bays.js');
  const { walkPaths } = await import('./js/world/crowd.js');
  const SP = await import('./js/world/street-props.js');
  const { PLAZAS } = await import('./js/world/parks.js');
  const pts = L.routePoints(stops.length), curve = L.routeCurve(T, pts), boxes = [], trees = [], plots = [], zones = [];
  const add = (x, y, z, w, h, d, color, ry) => boxes.push({ x, y, z, w, h, d, color, ry });
  const tree = (x, z, s) => trees.push({ x, z, ...s });
  const { pilotCrossings } = buildCity(add, stops, pts, curve, tree, p => plots.push(p), p => plots.push(p), z => zones.push(z));
  buildLandmarks(add, stops, pts, tree);
  const arc = parkingBays(curve, pts, stops, pilotCrossings), lamps = lampSpots(), kiosks = kioskSpots();
  const input = { stops, pts, curve, arc, pilotCrossings, boxes, trees, lamps, kiosks, plots, exclude: zones };
  const items = SP.placeStreetProps(input);
  if (JSON.stringify(items) !== JSON.stringify(SP.placeStreetProps(input))) throw Error('placement is not deterministic');
  const counts = {}; for (const i of items) counts[i.kind] = (counts[i.kind] || 0) + 1;
  const per = {}; for (const lp of walkPaths(stops, pts).filter(p => p.type === 'loop')) per[lp.name] = items.filter(i => i.x > lp.rect.x0 && i.x < lp.rect.x1 && i.z > lp.rect.z0 && i.z < lp.rect.z1).map(i => i.kind).join(',');
  if (globalThis.__dbg) return per;
  for (const k of Object.keys(SP.FOOT)) if (!counts[k]) throw Error('no ' + k + ' placed ' + JSON.stringify(counts));
  const bad = [], fail = (what, a, b) => { if (bad.length < 12) bad.push({ what, a: [a.kind, +a.x.toFixed(2), +a.z.toFixed(2)], b }); };
  const F = i => SP.FOOT[i.kind], ex = i => F(i).r ?? Math.abs(Math.cos(i.yaw)) * F(i).hw + Math.abs(Math.sin(i.yaw)) * F(i).hd, ez = i => F(i).r ?? Math.abs(Math.sin(i.yaw)) * F(i).hw + Math.abs(Math.cos(i.yaw)) * F(i).hd;
  // 1. props vs props (circumscribed circles)
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) if (Math.hypot(items[a].x - items[b].x, items[a].z - items[b].z) < items[a].r + items[b].r) fail('prop-prop', items[a], [items[b].kind, items[b].x, items[b].z]);
  // 2. obstacles
  for (const i of items) {
    for (const b of boxes) {
      if (b.y + b.h <= 0.22 || b.y >= 2.4 || b.w * b.d >= 4000) continue;
      const dx = i.x - b.x, dz = i.z - b.z, c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0), lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (Math.abs(lx) < b.w / 2 + i.r && Math.abs(lz) < b.d / 2 + i.r) fail('box', i, [b.color, b.x, b.z]);
    }
    for (const t of trees) if (Math.hypot(t.x - i.x, t.z - i.z) < 0.16 + i.r) fail('tree', i, [t.x, t.z]);
    for (const [x, z] of lamps) if (Math.hypot(x - i.x, z - i.z) < 0.2 + i.r) fail('lamp', i, [x, z]);
    for (const [x, z] of kiosks) if (Math.abs(x - i.x) < 0.55 + i.r && Math.abs(z - i.z) < 0.55 + i.r) fail('kiosk', i, [x, z]);
    for (const { xz: [x, z] } of L.furnitureSpots(stops, curve)) if (Math.hypot(x - i.x, z - i.z) < 0.4 + i.r) fail('sign', i, [x, z]);
    for (const p of plots) if (p.width && Math.abs(p.x - i.x) < p.width / 2 + i.r && Math.abs(p.z - i.z) < p.depth / 2 + i.r) fail('plot', i, [p.kind, p.x, p.z]);
  }
  // 3. walking (0.1 m tolerance: lateral is measured against a 0.35 m polyline of the curve; WALK_EDGE already holds 0.2 m of body margin): lanes (offset from the route centre line), wander rects, plaza rings, quiet plazas
  const fine = curve.getPoints(6000), paths = walkPaths(stops, pts), quiet = PLAZAS.filter(p => p.quiet).map(p => p.name);
  for (const i of items) {
    let b = 0, bd = 1e9; fine.forEach((p, k) => { const d = (p.x - i.x) ** 2 + (p.z - i.z) ** 2; if (d < bd) { bd = d; b = k; } });
    if (bd < 14 * 14) { const a = fine[Math.max(0, b - 1)], c = fine[Math.min(fine.length - 1, b + 1)], tl = Math.hypot(c.x - a.x, c.z - a.z), lat = Math.abs(((i.x - fine[b].x) * -(c.z - a.z) + (i.z - fine[b].z) * (c.x - a.x)) / tl);
      if (lat - Math.max(ex(i), ez(i)) < SP.WALK_EDGE - 0.1 && lat < 12) fail('lane/road ' + lat.toFixed(2), i, null); }
    for (const p of paths) {
      const r = p.rect; if (!r) continue; const a = ex(i), c = ez(i);
      if (p.type === 'wander' && i.x > r.x0 - a - 0.4 && i.x < r.x1 + a + 0.4 && i.z > r.z0 - c - 0.4 && i.z < r.z1 + c + 0.4) fail('wander ' + p.name, i, null);
      if (p.type === 'loop' && i.x > r.x0 && i.x < r.x1 && i.z > r.z0 && i.z < r.z1 && Math.min(i.x - r.x0 - a, r.x1 - i.x - a, i.z - r.z0 - c, r.z1 - i.z - c) < 1.95) fail('ring ' + p.name, i, null);
      if (p.type === 'loop' && quiet.includes(p.name) && i.x > r.x0 && i.x < r.x1 && i.z > r.z0 && i.z < r.z1) fail('quiet ' + p.name, i, null);
    }
  }
  if (bad.length) throw Error(JSON.stringify(bad));
  // 4. meshes: one InstancedMesh per type, Belisha globe glows at night
  const group = await SP.buildStreetProps(items), meshes = []; group.traverse(o => { if (o.isInstancedMesh) meshes.push([o.name, o.count, o.material.userData.glow || false]); });
  const globe = meshes.find(m => m[0] === 'prop-beacon-glass');
  if (!globe || !globe[2] || globe[1] !== counts.beacon) throw Error('beacon globe not glowing/instanced: ' + JSON.stringify(meshes));
  return { pass: true, total: items.length, counts, byRegion: items.reduce((a, i) => (a[i.region] = (a[i.region] || 0) + 1, a), {}), meshes: meshes.length };
})()'''))
