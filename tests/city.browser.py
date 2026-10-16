# browser-harness < tests/city.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildCity } = await import(`./js/world/city.js?test=${Date.now()}`);
  const { stops } = await import('./js/content.js');
  const { PALETTE } = await import('./js/world/palette.js');
  const { routePoints } = await import('./js/world/layout.js');
  const pts = routePoints(stops.length);
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z)));
  const build = () => {
    const boxes = [];
    buildCity((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, pts, curve);
    return boxes;
  };
  const a = build(), b = build();
  const check = (ok, message) => { if (!ok) throw Error(message); };
  check(JSON.stringify(a) === JSON.stringify(b), 'city generation must be deterministic');
  check(a.every(box => ['x', 'y', 'z', 'w', 'h', 'd'].every(k => Number.isFinite(box[k])) && box.w > 0 && box.h > 0 && box.d > 0), 'all box coordinates must be finite and dimensions positive');
  const hero = a.filter(box => box.x > pts[0].x - 20 && box.x < pts[1].x + 20 && box.z > -30 && box.z < 36);
  const colors = new Set(hero.map(box => box.color.toLowerCase()));
  const heroStone = [PALETTE.cream, PALETTE.stone, PALETTE.taupe];
  for (const color of heroStone) check(colors.has(color), `hero must include approved stone surface ${color}`);
  return { pass: true, boxes: a.length, heroBoxes: hero.length, colors: [...new Set(a.map(b => b.color))].length, heroStone };
})()'''))
