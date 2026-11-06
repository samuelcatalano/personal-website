# browser-harness < tests/swap-plaza.browser.py (local preview, real Three.js)
import os

new_tab('about:blank')
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(os.environ.get('URL', 'http://localhost:8000/'))
wait_for_load()
result = js(r'''(async () => {
  const THREE = await import('three');
  const { buildSwapPlaza } = await import('./js/world/swap-plaza.js');
  const { createPeople } = await import('./js/world/people.js');
  const { crowdPlan } = await import('./js/world/crowd.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve, swapTunnelFrame, SWAP_TUNNEL } = await import('./js/world/layout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  for (const kerb of [6.75, 5.5]) {
    const half = 8, y = 0.07, plaza = buildSwapPlaza({ half, kerb, y });
    const mesh = plaza.group.getObjectByName('swap-plaza-guardrails');
    check(mesh?.isInstancedMesh, 'both guardrails must share one instanced batch');
    check(plaza.group.getObjectByName('swap-plaza-benches-wood')?.count >= 16, 'two slatted benches share one wood batch');
    check(plaza.group.getObjectByName('swap-plaza-planters')?.isInstancedMesh, 'two low containers share one stone batch');
    check(plaza.group.getObjectByName('swap-plaza-planting')?.count === 2, 'two low shrubs reuse existing plant geometry');
    check(plaza.group.userData.obstacles?.filter(o=>o.kind==='bench').length===2, 'two bench footprints');
    check(plaza.group.userData.obstacles?.filter(o=>o.kind==='planter').length===2, 'two planter footprints');
    check(mesh.material === plaza.group.children.find(o => o.geometry?.type === 'CylinderGeometry').material, 'reuse existing iron material');
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), members = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
      members.push({ x: position.x, y: position.y, z: position.z, w: scale.x, h: scale.y, d: scale.z });
    }
    for (const side of [-1, 1]) {
      const run = members.filter(m => Math.sign(m.x) === side);
      check(run.length > 50, 'each portal edge has a continuous run of bars');
      check(run.every(m => Math.abs(m.x) - m.w / 2 >= half - 0.3 - 1e-5 && Math.abs(m.x) + m.w / 2 <= half + 1e-5), 'members stay on the coping');
      check(run.every(m => Math.abs(m.z) + m.d / 2 <= kerb + 1e-5), 'sidewalk entrances remain open');
      check(Math.abs(Math.max(...run.map(m => m.y + m.h / 2)) - y - 1.1) < 1e-5, 'rail height is 1.10 m');
      const bars = run.filter(m => Math.abs(m.d - 0.035) < 1e-5).sort((a, b) => a.z - b.z);
      check(bars.length > 50, 'vertical infill bars exist');
      for (let i = 1; i < bars.length; i++) check(bars[i].z - bars[i - 1].z - 0.035 <= 0.10001, 'bar gaps are at most 10 cm');
      check(run.filter(m => m.d > kerb).length === 2, 'continuous top and bottom rails');
    }
    let geometryDisposals = 0, materialDisposals = 0, batchDisposals = 0;
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    mesh.material.addEventListener('dispose', () => materialDisposals++);
    mesh.addEventListener('dispose', () => batchDisposals++);
    plaza.dispose();
    check(geometryDisposals === 1 && materialDisposals === 1 && batchDisposals === 1, 'owned geometry, instance buffer and shared iron are disposed once');
  }
  const pts = routePoints(stops.length), curve = routeCurve(THREE, pts), frame = swapTunnelFrame(curve, stops);
  const plan = crowdPlan(stops, pts, 1017), ids = plan.flatMap((p, i) => p.path.name === 'swap-plaza' ? [i] : []);
  check(ids.length === 12, 'exercise all plaza walkers');
  let minimumClearance = Infinity;
  const decorated=buildSwapPlaza({half:SWAP_TUNNEL.half,kerb:6.75,y:.07});
  const idle=ids.filter(i=>plan[i].path.type==='idle');
  check(idle.length===4&&ids.length-idle.length===8,'two standing pairs and eight walkers reuse the twelve NPCs');
  for (const reducedMotion of [false, true]) {
    const people = createPeople({ curve, pts, stops, reducedMotion });
    const initial=idle.map(i=>[people.route.x[i],people.route.z[i]]);
    for (let k = 0; k < 360; k++) {
      people.update(0.25, { x: frame.x, z: frame.z });
      for (const i of ids) {
        const along = (people.route.x[i] - frame.x) * frame.tx + (people.route.z[i] - frame.z) * frame.tz;
        const clearance = SWAP_TUNNEL.half - 0.14 - Math.abs(along) - plan[i].look.height * 0.16;
        minimumClearance = Math.min(minimumClearance, clearance);
        check(clearance > 0.1, 'walkers and separation offsets clear the inside railing faces');
        const across=-(people.route.x[i]-frame.x)*frame.tz+(people.route.z[i]-frame.z)*frame.tx,r=plan[i].look.height*.16;
        for(const {kind,rect:q}of decorated.group.userData.obstacles){
          const dx=Math.max(0,q.x0-along,along-q.x1),dz=Math.max(0,q.z0-across,across-q.z1);
          check(Math.hypot(dx,dz)>r+.1,'pedestrians clear '+kind);
        }
      }
    }
    idle.forEach((i,k)=>check(Math.hypot(people.route.x[i]-initial[k][0],people.route.z[i]-initial[k][1])<1e-6,'standing pairs remain fixed'));
  }
  decorated.dispose();
  return { pass: true, walkers: ids.length, seconds: 90, reducedMotion: 'checked', minimumClearance };
})()''')
print(result)
