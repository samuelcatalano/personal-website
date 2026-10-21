# browser-harness < tests/underpass.browser.py (local preview): railway underpasses fit between country houses, trees and lamps, and leave the road clear
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
  const T = await import('three');
  const { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const { buildCity } = await import('./js/world/city.js');
  const { createUnderpass, CLEARANCE } = await import('./js/world/underpass.js');
  const { walkPaths } = await import('./js/world/crowd.js');
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
  return { pass: true, tris };
})()'''))
