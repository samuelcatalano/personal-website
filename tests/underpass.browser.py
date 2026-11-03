# browser-harness < tests/underpass.browser.py (local preview): railway underpasses fit between country houses, trees and lamps, and leave the road clear
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
  const T = await import('three');
  const { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const { buildCity } = await import('./js/world/city.js');
  const { createUnderpass, CLEARANCE, ARCH_HALF_WIDTH } = await import('./js/world/underpass.js');
  const { walkPaths, crowdPlan } = await import('./js/world/crowd.js');
  const { createPeople } = await import('./js/world/people.js');
  const SP = await import('./js/world/sprites.js');
  const check = (ok, m) => { if (!ok) throw Error(m); };
  const pts = L.routePoints(stops.length), curve = L.routeCurve(T, pts), boxes = [], trees = [], plots = [];
  buildCity((x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }), stops, pts, curve, (x, z, s) => trees.push({ x, z, r: (s.crown || 2) / 2 + 0.3 }), null, (p) => plots.push(p));
  const up = createUnderpass(curve, stops), sr = L.scotRange(stops), bad = [];
  check(up.passes.length === 2 && CLEARANCE >= 5, 'two underpasses, >= 5 m headroom in the bus lane');
  up.group.traverse((o) => { if (o.isMesh) check(o.geometry.attributes.position.count / 3 <= 3000 && o.castShadow !== undefined, 'underpass mesh budget'); });
  let tris = 0; up.group.children.forEach((g) => { let n = 0; g.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); check(n <= 3000, 'underpass <= 3k tris ' + n); tris = n; });
  up.passes.forEach((a, i) => {
    const bt = sr[i], bp = curve.getPointAt(bt), dist = Math.hypot(bp.x - a.x, bp.z - a.z);
    check(dist <= 8, 'underpass within 8 m of the boundary (' + dist.toFixed(2) + ')');
    const rot = (x, z) => [(x - a.x) * a.tx + (z - a.z) * a.tz, -(x - a.x) * a.tz + (z - a.z) * a.tx]; // [along road, across]
    const hit = (cx, cz, hw, hd, tag, top = 99) => { const [u, v] = rot(cx, cz);
            const wing = Math.abs(u) < 6.5 + hw && Math.abs(v) < 33 + hd, block = Math.abs(u) < 7.5 + hw && Math.abs(v) < 9 + hd;
      if (!(wing || block)) return; const buried = Math.abs(u) + hw <= 7 && Math.abs(v) + hd <= 9 || top <= 3.5 && Math.abs(u) + hw < 5.2 && Math.abs(v) < 13;
      if (!buried) bad.push(i + ':' + tag + ' u=' + u.toFixed(1) + ' v=' + v.toFixed(1) + ' hw=' + hw.toFixed(1)); };
    boxes.forEach((b) => { if (b.y + b.h > 0.35) hit(b.x, b.z, b.w / 2, b.d / 2, 'box', b.y + b.h); });
    trees.forEach((t) => hit(t.x, t.z, t.r, t.r, 'tree'));
    plots.forEach((p) => { /* houses */ hit(p.x, p.z, p.width / 2 + 0.2, p.depth / 2 + 0.2, 'plot ' + p.id); });
    for (const p of walkPaths(stops, pts)) { const r = p.rect; if (!r) continue; hit((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 'walk ' + p.name); }
  });
  check(!bad.length, 'underpass overlaps: ' + [...new Set(bad)].slice(0, 6).join(', '));
  const people = createPeople(new T.Scene(), { curve, pts, stops, hd: false }), plan = crowdPlan(stops, pts, 1017), crowd = people.meshes[0], A = crowd.instanceMatrix.array;
  const groups = new Set(plan.filter(p => p.path.type === 'lane').map(p => `${Math.sign(p.path.offset)}:${p.path.dir}`)), crossed = up.passes.map(() => new Set()), prev = new Float32Array(plan.length * 2), aperture = ARCH_HALF_WIDTH, margin = 0.2;
  check(groups.size === 4, 'four sidewalk lane directions');
  const sample = () => {
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]; if (p.path.type !== 'lane') continue;
      const x = A[i * 16 + 12], z = A[i * 16 + 14], half = SP.CELL_W / SP.S * p.look.height / 2;
      up.passes.forEach((a, j) => {
        const dx = x - a.x, dz = z - a.z, along = dx * a.tx + dz * a.tz, across = -dx * a.tz + dz * a.tx;
        if (Math.abs(along) <= a.half + half + margin) {
          check(Math.abs(across) + half + margin <= aperture, `lane NPC clips underpass ${j}: ${Math.abs(across).toFixed(2)} + ${half.toFixed(2)} m`);
          if (Math.abs(along) < a.half - 0.5) {
            check(Math.sign(across) === Math.sign(p.path.offset), `lane NPC changes sidewalk side at underpass ${j}`);
            crossed[j].add(`${Math.sign(p.path.offset)}:${p.path.dir}`);
          }
        }
      });
    }
  };
  sample();
  for (let step = 0; step < 64; step++) {
    for (let i = 0; i < plan.length; i++) { prev[i * 2] = A[i * 16 + 12]; prev[i * 2 + 1] = A[i * 16 + 14]; }
    people.update(0.25, curve.getPointAt(0.5)); sample();
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]; if (p.path.type !== 'lane') continue;
      const x = A[i * 16 + 12], z = A[i * 16 + 14], half = SP.CELL_W / SP.S * p.look.height / 2;
      for (const a of up.passes) {
        const u0 = (prev[i * 2] - a.x) * a.tx + (prev[i * 2 + 1] - a.z) * a.tz, u1 = (x - a.x) * a.tx + (z - a.z) * a.tz;
        if (Math.min(Math.abs(u0), Math.abs(u1)) < a.half + 8 + half + margin) {
          check(Math.hypot(x - prev[i * 2], z - prev[i * 2 + 1]) <= p.look.speed * 0.25 + 0.3, 'lane NPC transition jumps at an underpass');
        }
      }
    }
  }
  for (let j = 0; j < crossed.length; j++) check(crossed[j].size === 4, `underpass ${j} carries both directions on both sidewalks: ${[...crossed[j]]}`);
  return { pass: true, tris, underpasses: crossed.length, laneDirections: groups.size, laneSamples: [...crossed].reduce((n, set) => n + set.size, 0) };
})()'''))
