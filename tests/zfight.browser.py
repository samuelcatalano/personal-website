# With the local preview open in browser-harness:
# browser-harness < tests/zfight.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const q = `?z=${Date.now()}`;
  const { buildCity } = await import(`./js/world/city.js${q}`);
  const { buildLandmarks } = await import(`./js/world/landmarks.js${q}`);
  const { buildBus, buildMini, car } = await import(`./js/world/bus.js${q}`);
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const pts = routePoints(stops.length);
  const curve = routeCurve(THREE, pts);
  const world = [], add = (x, y, z, w, h, d, color, ry) => world.push({ x, y, z, w, h, d, color, ry });
  buildCity(add, stops, pts, curve);
  const lm = buildLandmarks(add, stops, pts);
  const lists = [['world', world]];
  // buildMeshes keeps its box list on group.userData.list; each list shares one local space
  const walk = (name, o) => o.traverse(c => { if (c.userData.list) lists.push([name, c.userData.list]); });
  walk('eye', lm.eye); walk('details', lm.details);
  walk('mini', buildMini()); walk('bus', buildBus());
  walk('car', car({ L: 4.4, W: 1.8, c: '#336699', hl: 1, bl: 0.8, ch: 0.6 }));
  walk('taxi', car({ L: 4.6, W: 1.9, c: '#111111', hl: 1, bl: 0.8, ch: 0.6, taxi: 1 }));
  // Plaza, fountain, inlay and trim layers are all world boxes. Same-direction coplanar faces (top, +-x, +-z) of different colours that overlap > 0.02 z-fight.
  const E = 1e-3, ET = 5e-3, ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.02;
  const R = b => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y, y1: b.y + b.h, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
  const bad = [];
  for (const [name, L] of lists) {
    // Sweep only potentially touching X intervals; retain every original face/overlap test.
    const rs = L.map((b, i) => ({ ...R(b), i })).sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const A = rs[i], C = rs[j];
      if (C.x0 > A.x1 + E) break;
      if (L[A.i].color === L[C.i].color || L[A.i].ry || L[C.i].ry) continue; // yawed boxes (kerbs, pavement slabs) have no axis-aligned faces
      const faces = [];
      if (Math.abs(A.y1 - C.y1) < ET && ov(A.x0, A.x1, C.x0, C.x1) && ov(A.z0, A.z1, C.z0, C.z1)) faces.push('top');
      for (const k of ['x0', 'x1']) if (Math.abs(A[k] - C[k]) < E && ov(A.y0, A.y1, C.y0, C.y1) && ov(A.z0, A.z1, C.z0, C.z1)) faces.push(k);
      for (const k of ['z0', 'z1']) if (Math.abs(A[k] - C[k]) < E && ov(A.y0, A.y1, C.y0, C.y1) && ov(A.x0, A.x1, C.x0, C.x1)) faces.push(k);
      for (const f of faces) bad.push(`${name} ${f} ${JSON.stringify([L[A.i], L[C.i]])}`);
    }
  }
  if (bad.length) throw Error(`${bad.length} z-fighting face pairs, e.g. ${bad.slice(0, 5).join('\n')}`);
  return { pass: true, lists: lists.map(([n, l]) => `${n}:${l.length}`) };
})()'''))
