# Wheel audit for every vehicle type in the pool: static geometry (pivot, axis, radius, tyre contact, tyre triangles left in the body),
# rolling (rotation per metre of travel) and a moving run through the real createAmbient update (omega * r / v), at a São Paulo and a London route position.
# Run from the repository root with the preview served (python3 -m http.server 8000):
#   browser-harness < tests/vehicles-wheels.browser.py
# Fleet truth comes from the GLB geometry (tools/vehicles/regional-fleet/measure_axles.py --json), never from the catalog it audits.
import json, subprocess, time

TRUTH = json.loads(subprocess.run(['python3', '-I', 'tools/vehicles/regional-fleet/measure_axles.py', '--json'],
                                  capture_output=True, text=True, check=True).stdout)

def js(expression):
    r = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=900)
    if 'exceptionDetails' in r: raise RuntimeError(str(r['exceptionDetails'])[:600])
    return r['result'].get('value')

tab = new_tab('http://localhost:8000/?wheel-audit=1')
TAB = tab if isinstance(tab, str) else tab.get('targetId', tab)
activate_tab(TAB)
wait_for_load()
try:
    for _ in range(120):
        if js("document.readyState") == 'complete': break
        time.sleep(0.5)
    report = js(r'''(async () => {
  const THREE = await import('three');
  const A = await import('./js/world/vehicle-assets.js?wheel-audit-3');
  const V = await import('./js/world/vehicles.js');
  const { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const { createAmbient } = await import('./js/world/ambient.js?wheel-audit-3');
  const TR = __TRUTH__;
  const cat = await A.loadFleetCatalog();
  const v3 = new THREE.Vector3();
  // One wheel group, split by side (an axle group holds both wheels): each side's box in vehicle space, over indexed triangles only
  // (shared-buffer parts reuse the whole car's vertex array).
  const sides = (w) => {
    const box = { '+': new THREE.Box3(), '-': new THREE.Box3() }, count = { '+': 0, '-': 0 };
    w.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, p = g.attributes.position, idx = g.index?.array, n = idx ? idx.length : p.count;
      for (let k = 0; k < n; k++) { const i = idx ? idx[k] : k; v3.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const s = v3.z >= 0 ? '+' : '-'; box[s].expandByPoint(v3); count[s]++; }
    });
    return ['+', '-'].filter((s) => count[s] > 0).map((s) => {
      const b = box[s], sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), ext = [sz.x, sz.y, sz.z], axis = ext.indexOf(Math.min(...ext));
      return { side: s, tris: count[s] / 3, axis: 'xyz'[axis], radiusParts: Math.max(...ext.filter((_, i) => i !== axis)) / 2, cx: c.x, cy: c.y, minY: b.min.y };
    });
  };
  const tyreTris = (root, groups, t) => { // triangles whose centroid sits in a tyre circle: inside a wheel group (turning) or left in the body (static)
    const gs = new Set(groups); let stuck = 0, inG = 0;
    const inside = (x, y, z) => t.axles.some((a) => Math.hypot(x - a.x, y - a.y) <= t.R + 0.01 && Math.abs(z) >= t.halfTrack - 0.3);
    root.traverse((o) => {
      if (!o.isMesh) return;
      let grouped = false; for (let p = o; p; p = p.parent) if (gs.has(p)) { grouped = true; break; }
      const pos = o.geometry.attributes.position, idx = o.geometry.index?.array, n = idx ? idx.length / 3 : pos.count / 3;
      for (let k = 0; k < n; k++) {
        const a = idx ? idx[3 * k] : 3 * k, b = idx ? idx[3 * k + 1] : 3 * k + 1, c = idx ? idx[3 * k + 2] : 3 * k + 2;
        if (!inside((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3)) continue;
        if (grouped) inG++; else if (t.mats.has(o.material.name)) stuck++;
      }
    });
    return { stuck, inG };
  };
  const types = [
    ['hero mini', async () => { const v = V.buildVehicle('mini', { hero: true }); await A.upgradeMini(v, { hero: true }); return v; }, null],
    ['hero london bus', async () => { const v = V.buildVehicle('london', { hero: true }); await A.upgradeBus(v, 'london', { hero: true }); return v; }, null],
    ['ambient mini', async () => { const v = V.buildVehicle('mini'); await A.upgradeMini(v, { hero: false }); return v; }, null],
    ['ambient cab', async () => { const v = V.buildVehicle('cab'); await A.upgradeCab(v); return v; }, null],
    ['ambient london bus', async () => { const v = V.buildVehicle('london'); await A.upgradeBus(v, 'london', { hero: false }); return v; }, null],
    ['ambient glasgow bus', async () => { const v = V.buildVehicle('glasgow'); await A.upgradeBus(v, 'glasgow', { hero: false }); return v; }, null],
    ['ambient caio bus', async () => { const v = V.buildVehicle('london'); await A.upgradeBus(v, 'sao-paulo', { hero: false, asset: 'sao-paulo' }); return v; }, null],
    ...cat.map((m) => [m.id, async () => { const g = new THREE.Group(); await A.upgradeFleet(g, m, { body: '#f1f1ee' }); return g; }, m.id]),
    ...cat.map((m) => [m.id + ' parked', async () => { const g = new THREE.Group(); await A.upgradeFleet(g, m, { body: '#6c7177', parked: true }); return g; }, m.id]),
  ];
  const rows = [];
  for (const [type, make, fleet] of types) {
    const root = await make(); root.updateMatrixWorld(true);
    const groups = root.userData.wheels ?? [], fails = [], parked = type.endsWith('parked');
    const t = fleet ? { axles: TR[fleet].axles, R: TR[fleet].wheelRadius, halfTrack: TR[fleet].halfTrack, mats: new Set(TR[fleet].wheelMaterials) } : null;
    const per = groups.map(sides);
    let pivotMm = 0, contactMm = 0, radiusUsed = null, radiusMeasured = null, axes = '', stuckFrac = null, rollErr = 0;
    if (parked) { // parked cars keep their authored wheels in the body (hero path): no turning group, the geometry stays put
      if (groups.length) fails.push('parked car has wheel groups that could turn');
    } else {
      if (groups.length < 2) fails.push('fewer than 2 wheel groups');
      groups.forEach((w, i) => {
        const r = w.userData.radius ?? w.position.y; radiusUsed ??= +r.toFixed(3);
        if (!per[i].length) { fails.push(`group ${i} has no geometry (static)`); return; }
        for (const s of per[i]) {
          axes += s.axis;
          const off = Math.hypot(s.cx - w.position.x, s.cy - w.position.y) * 1000;
          pivotMm = Math.max(pivotMm, off); contactMm = Math.max(contactMm, Math.abs(s.minY) * 1000);
          radiusMeasured ??= +s.radiusParts.toFixed(3);
          if (s.axis !== 'z') fails.push(`group ${i} ${s.side} side turns about a non-axle axis (thinnest extent ${s.axis})`);
          if (off > 10) fails.push(`group ${i} ${s.side} side pivot ${off.toFixed(0)} mm off its own tyre`);
          if (Math.abs(r - s.radiusParts) > 0.03 * s.radiusParts) fails.push(`group ${i} ${s.side} side radius ${r.toFixed(3)} vs tyre ${s.radiusParts.toFixed(3)}`);
          if (Math.abs(s.minY) > 0.01) fails.push(`group ${i} ${s.side} side tyre bottom ${(s.minY * 1000).toFixed(0)} mm off the road`);
        }
        if (t) {
          const ax = t.axles.reduce((a, b) => (Math.abs(b.x - w.position.x) < Math.abs(a.x - w.position.x) ? b : a));
          const truthMm = Math.hypot(w.position.x - ax.x, w.position.y - ax.y) * 1000;
          if (truthMm > 5) fails.push(`group ${i} pivot ${truthMm.toFixed(0)} mm off the measured tyre centre`);
          if (Math.abs(r - t.R) > 0.01) fails.push(`group ${i} radius ${r.toFixed(3)} vs measured tyre ${t.R.toFixed(3)}`);
        }
      });
      if (t) {
        const { stuck, inG } = tyreTris(root, groups, t); stuckFrac = stuck / Math.max(1, inG + stuck);
        if (stuckFrac > 0.005) fails.push(`${stuck} tyre triangles stay static in the body (${(stuckFrac * 100).toFixed(1)}%)`);
      }
      const before = groups.map((w) => w.rotation.z); A.rollWheels(groups, 1);
      groups.forEach((w, i) => { const d = w.rotation.z - before[i], e = -1 / (w.userData.radius ?? w.position.y); rollErr = Math.max(rollErr, Math.abs(d / e - 1)); });
      A.rollWheels(groups, -1);
      if (rollErr > 0.1) fails.push(`rolling is off by ${(rollErr * 100).toFixed(0)}% per metre`);
    }
    rows.push({ type, groups: groups.length, axes, pivotMm: +pivotMm.toFixed(1), radiusUsed, radiusMeasured: t ? +t.R.toFixed(3) : radiusMeasured, contactMm: +contactMm.toFixed(1), stuckFrac: stuckFrac === null ? null : +stuckFrac.toFixed(4), rollErr: +rollErr.toFixed(4), fails });
  }
  // moving: the real createAmbient update drives the traffic (0.3 = São Paulo loop, 0.75 = London and Glasgow); each wheel group's turn is compared with
  // the distance its car travelled over 6 s at 60 fps
  const pts = L.routePoints(stops.length), curve = L.routeCurve(THREE, pts);
  const moving = {};
  for (const t0 of [0.3, 0.75]) {
    const scene = new THREE.Scene(), amb = createAmbient(scene, { curve, pts, stops });
    await amb.ready;
    amb.update({ time: 0, t: t0, dt: 0 });
    const vs = scene.children.filter((o) => o.userData.wheels && o.userData.length);
    const st = vs.map((v) => ({ v, x: v.position.x, z: v.position.z, th: v.userData.wheels.map((w) => w.rotation.z), S: 0 }));
    let time = 0; const dt = 1 / 60;
    for (let f = 0; f < 360; f++) {
      time += dt; amb.update({ time, t: t0, dt });
      if (f < 30) { for (const s of st) { s.x = s.v.position.x; s.z = s.v.position.z; s.th = s.v.userData.wheels.map((w) => w.rotation.z); } continue; }
      for (const s of st) {
        const ds = (s.v.position.x - s.x) * Math.cos(s.v.rotation.y) - (s.v.position.z - s.z) * Math.sin(s.v.rotation.y);
        if (s.v.visible && Math.abs(ds) < 5) s.S += ds;
        s.x = s.v.position.x; s.z = s.v.position.z;
      }
    }
    for (const s of st) {
      const key = s.v.userData.visualAsset || s.v.userData.fleetModel || s.v.name, fleet = TR[key] ?? null;
      const m = (moving[key] ??= { vehicles: 0, ratios: [], fails: [] });
      if (Math.abs(s.S) < 1) continue;
      m.vehicles++;
      s.v.userData.wheels.forEach((w, i) => {
        const turn = w.rotation.z - s.th[i];
        if (Math.abs(turn) < 1e-6) { m.fails.push('wheel static while the car moves'); return; }
        const r = fleet ? fleet.wheelRadius : sides(w)[0]?.radiusParts;
        m.ratios.push((-turn / s.S) * r);
      });
    }
  }
  for (const k of Object.keys(moving)) {
    const m = moving[k], lo = m.ratios.length ? Math.min(...m.ratios) : 0, hi = m.ratios.length ? Math.max(...m.ratios) : 0;
    if (m.ratios.length && (lo < 0.9 || hi > 1.1)) m.fails.push(`omega x r / v in [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    m.range = m.ratios.length ? [+lo.toFixed(3), +hi.toFixed(3)] : null;
    m.fails = [...new Set(m.fails)]; delete m.ratios;
  }
  return { rows, moving };
})()'''.replace('__TRUTH__', json.dumps(TRUTH)))
finally:
    close_tab(TAB)

failures = []
print(f"{'type':26} {'grp':>3} {'axes':>5} {'pivot mm':>8} {'r used':>7} {'r meas':>7} {'contact mm':>10} {'static %':>8} {'roll err':>8}")
for r in report['rows']:
    sf = '-' if r['stuckFrac'] is None else f"{r['stuckFrac'] * 100:.1f}"
    print(f"{r['type']:26} {r['groups']:>3} {r['axes']:>5} {r['pivotMm']:>8} {str(r['radiusUsed']):>7} {str(r['radiusMeasured']):>7} {r['contactMm']:>10} {sf:>8} {r['rollErr'] * 100:>7.1f}%")
    failures += [f"{r['type']}: {f}" for f in r['fails']]
print('moving (createAmbient, 6 s at 60 fps; route 0.3 and 0.75):')
for k, m in report['moving'].items():
    print(f"  {k:26} cars moved {m['vehicles']:>2}  omega*r/v {m['range']}")
    failures += [f"{k} moving: {f}" for f in m['fails']]
assert not failures, 'wheel audit failed:\n  ' + '\n  '.join(dict.fromkeys(failures))
print('wheel audit passed:', len(report['rows']), 'static types,', len(report['moving']), 'moving types')
