# With the local preview open in browser-harness:
# browser-harness < tests/people.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { createPeople } = await import('./js/world/people.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const pts = routePoints(stops.length), curve = routeCurve(THREE, pts), cam = curve.getPointAt(0.5);
  const run = (reducedMotion) => {
    const scene = new THREE.Scene(), people = createPeople(scene, { curve, pts, stops, reducedMotion });
    const before = people.meshes.map((m) => Float32Array.from(m.instanceMatrix.array));
    people.update(0.5, cam);
    const changed = people.meshes.some((m, i) => m.instanceMatrix.array.some((v, k) => v !== before[i][k]));
    return { scene, people, changed };
  };
  const { scene, people, changed } = run(false);
  check(people.count >= 150, 'expected at least 150 people');
  check(changed, 'update(0.5) must move some people');
  check(!run(true).changed, 'reduced motion must not move anyone');
  const meshes = []; scene.traverse((o) => { if (o.isInstancedMesh) meshes.push(o); });
  check(meshes.length <= 16, 'at most 16 instanced meshes');
  const samples = Array.from({ length: 3001 }, (_, i) => curve.getPoint(i / 3000)), head = meshes.find((m) => m.name === 'head'), a = head.instanceMatrix.array;
  let nearest = Infinity, shown = 0;
  for (let i = 0; i < people.count; i++) {
    const x = a[i * 16 + 12], z = a[i * 16 + 14];
    if (a[i * 16] === 0) continue; // hidden (zero scale)
    shown++;
    nearest = Math.min(nearest, ...samples.map((p) => Math.hypot(p.x - x, p.z - z)));
  }
  check(shown > 0 && nearest >= 5.45, `a visible person is within 5.45 of the road centre (${nearest})`);
  return { pass: true, count: people.count, meshes: meshes.length, shown, nearest: Number(nearest.toFixed(2)) };
})()'''))
