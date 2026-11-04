# With the local preview open in browser-harness:
# browser-harness < tests/people-arrival.browser.py
# Pedestrians must already be drawn on arrival: the camera jumps to the MASP stop and the drawn crowd is complete by 0.1 s and unchanged at 3 s,
# and it matches the crowd already drawn at the route start (no spawn while the camera approaches).
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { createPeople } = await import('./js/world/people.js?arrival=' + Date.now()); // fresh module, never a cached older copy
  const { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const S = await import('./js/scroll.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const pts = L.routePoints(stops.length), curve = L.routeCurve(THREE, pts), marks = S.stopMarks(pts);
  const masp = L.stopIndex(stops, L.LANDMARKS.masp);
  const drawn = (people) => { const a = people.meshes[0].instanceMatrix.array; let c = 0; for (let i = 0; i < people.count; i++) if (a[i * 16] > 0) c++; return c; };
  const at = (k) => { const p = curve.getPointAt(marks[k]); return { x: p.x, y: 3, z: p.z }; };
  const run = (people, cam, frames) => { const out = {}; for (let f = 1; f <= frames; f++) { people.update(1 / 60, cam); if (f === 6) out.t01 = drawn(people); } out.t3 = drawn(people); return out; };
  const people = createPeople(new THREE.Scene(), { curve, pts, stops, hd: false });
  const start = run(people, at(0), 180); // steady state at the route start
  const arrival = run(people, at(masp), 180); // the camera jumps to the MASP stop
  check(Math.abs(arrival.t3 - arrival.t01) <= 0.1 * arrival.t3, `MASP arrival: ${arrival.t01} drawn at 0.1 s, ${arrival.t3} at 3 s (over 10% change)`);
  check(Math.abs(arrival.t01 - start.t3) <= 0.1 * start.t3, `crowd grows on approach: ${start.t3} drawn at the route start, ${arrival.t01} at the MASP after the jump`);
  return { pass: true, masp_stop: masp, route_start_drawn: start.t3, arrival_0p1s: arrival.t01, arrival_3s: arrival.t3 };
})()'''))
