# browser-harness < tests/real-city.browser.py (local preview)
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
result = js(r'''(async () => {
  const T = await import('three');
  const { buildRealCity } = await import('./js/world/real-city.js');
  const { buildCity } = await import('./js/world/city.js?pilot-street='+Date.now());
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve, towerX } = await import('./js/world/layout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const assertPilotStreetSeparatesRoadwayFromContinuousPedestrianPaths = (additions, plots, curve, safeStart, safeEnd, bridgeX) => {
    const minX = Math.min(...plots.map(p => p.x - p.width / 2)), maxX = Math.max(...plots.map(p => p.x + p.width / 2));
    const inPilot = ([x,,z,w,,d]) => x + w / 2 >= minX && x - w / 2 <= maxX && Math.abs(z - curve.getPointAt(0.5).z) < 30;
    const local = additions.filter(inPilot).filter(([, , ,w,,d]) => w < 50 && d < 50);
    const curbs = local.filter(([,y,,w,h,d]) => h >= 0.08 && h <= 0.18 && Math.max(w,d) <= 0.8 && Math.min(w,d) >= 0.15 && y < 0.2);
    const stripes = local.filter(([,y,,w,h,d,c]) => c === '#e6dcc4' && h <= 0.06 && w >= 0.8 && w <= 1.5 && d < 0.7);
    const crosses = local.filter(([,y,,w,h,d,c]) => c === '#e6dcc4' && h <= 0.06 && Math.max(w,d) > 8 && Math.min(w,d) < 0.7);
    const pilotOnly = additions.filter(([,y,,w,h,d,c]) =>
      c === '#7d7468' && Math.abs(h-0.1)<1e-5 && Math.abs(Math.max(w,d)-0.72)<1e-5 && Math.abs(Math.min(w,d)-0.16)<1e-5 ||
      c === '#d8cfb8' && Math.abs(h-0.12)<1e-5 && Math.abs(w-3.3)<1e-5 && Math.abs(d-3.3)<1e-5 ||
      c === '#e6dcc4' && Math.abs(h-0.02)<1e-5 && Math.max(w,d)>8 && Math.min(w,d)<0.7);
    const paths = additions.filter(([, , ,w,h,d]) => w >= 3.1 && w <= 3.5 && d >= 3.1 && d <= 3.5 && h <= 0.14);
    const localPaths = local.filter(([, , ,w,h,d]) => w >= 3.1 && w <= 3.5 && d >= 3.1 && d <= 3.5 && h <= 0.14);
    const pathContinuity = [];
    for (let i = 0; i <= 12; i++) {
      const targetX = minX + (maxX - minX) * i / 12;
      const u = Array.from({length: 101}, (_,j) => j / 100).reduce((best,v) => Math.abs(curve.getPointAt(v).x-targetX) < Math.abs(curve.getPointAt(best).x-targetX) ? v : best, 0);
      const p = curve.getPointAt(u), t = curve.getTangentAt(u), nx = -t.z, nz = t.x;
      const nearby = [-1,1].every(side => paths.some(([x,,z]) => Math.hypot(x - (p.x + nx * side * 7.1), z - (p.z + nz * side * 7.1)) < 2));
      pathContinuity.push(nearby);
    }
    check(curbs.length >= 4, 'pilot street needs low curb geometry on both sides');
    check(stripes.length >= 3, 'pilot street needs restrained lane markings');
    check(crosses.length >= 8, 'pilot street needs two crossing sets');
    check(pilotOnly.length > 0, 'pilot street details must exist');
    check(pilotOnly.every(([x,, ,w,,d]) => x-w/2 >= safeStart && x+w/2 <= safeEnd), 'pilot-only details must stay inside the safe street segment');
    check(pilotOnly.every(([x,, ,w,,d]) => x+w/2 <= bridgeX-20 || x-w/2 >= bridgeX+20), 'pilot-only details must stay outside the Tower Bridge span');
    check(pathContinuity.every(Boolean), 'pilot pedestrian paths must stay continuous through the block');
    check(new Set(localPaths.map(box => box[6])).has('#d8cfb8'), 'pilot pavement needs subtle surface variation');
    for (const p of plots) for (const [x,,z,w,,d] of local) check(Math.abs(x-p.x) > (w+p.width)/2 || Math.abs(z-p.z) > (d+p.depth)/2, 'street detail intersects a pilot building');
    const routeDistance = ([x,,z]) => Math.min(...Array.from({length: 101}, (_,i) => { const q=curve.getPointAt(i/100); return Math.hypot(x-q.x,z-q.z); }));
    check(curbs.every(box => box[4] <= 0.12 && routeDistance(box) > 3.1), 'curbs must stay outside the vehicle envelope');
    check(localPaths.every(box => routeDistance(box) > 5), 'pedestrian path must remain clear of the vehicle envelope');
    check(crosses.every(([, , , ,h]) => h <= 0.03), 'crossings must stay flush with the roadway');
    return { name: 'pilot street separates roadway from continuous pedestrian paths', curbs: curbs.length, laneMarks: stripes.length, crossings: crosses.length, pathContinuity };
  };
  const meshes = g => { const m = []; g.traverse(o => { if (o.isMesh) m.push(o); }); return m; };
  const fits = (g, p) => {
    const b = new T.Box3().setFromObject(g), s = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
    check(s.x > 0 && s.y > 0 && s.z > 0, 'empty plot '+p.id);
    check(s.x <= p.width+1e-5 && s.z <= p.depth+1e-5 && s.y <= p.height+1e-5, 'model exceeds plot '+p.id);
    check(Math.abs(c.x-p.x)<1e-5 && Math.abs(c.z-p.z)<1e-5 && Math.abs(b.min.y)<1e-5, 'model origin/grounding incorrect '+p.id);
    check(Math.abs(Math.max(s.x/p.width,s.y/p.height,s.z/p.depth)-1)<1e-5, 'model does not fill its limiting dimension');
  };
  const pts = routePoints(stops.length), plots = [], street = [], curve = routeCurve(T,pts);
  buildCity((...box) => street.push(box), stops, pts, curve, undefined, p => plots.push(p));
  const bridgeX = towerX(stops, pts), safeStart = pts[stops.findIndex(s => s.id === 'olm')].x + 12, safeEnd = bridgeX - 20;
  const streetDetails = assertPilotStreetSeparatesRoadwayFromContinuousPedestrianPaths(street, plots, curve, safeStart, safeEnd, bridgeX);
  const errors = [], onError = e => errors.push(e.message), originalConsoleError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); originalConsoleError(...args); };
  addEventListener('error', onError);
  const city = await buildRealCity(plots);
  check(city.children.length === 3, 'expected three pilot buildings');
  city.children.forEach((g,i) => {
    fits(g,plots[i]); check(!g.userData.fallback,'model unexpectedly fell back');
    check(meshes(g).every(m=>m.material.map?.image?.width>0), 'embedded model texture did not load');
  });
  const repeated = await buildRealCity([plots[0], {...plots[0],id:'repeat',x:plots[0].x+100}, ...plots]);
  check(repeated.children.length === 3, 'pilot must cap instances at three');
  const a = meshes(repeated.children[0]), b = meshes(repeated.children[1]);
  check(a.length && a.length===b.length && a.every((m,i) => m.geometry===b[i].geometry && m.material===b[i].material), 'repeated models duplicate resources');
  check(a[0].geometry===meshes(city.children[0])[0].geometry, 'model cache does not span calls');
  const assets = performance.getEntriesByType('resource').filter(e => /\/assets\/city\/pilot\/.*\.glb/.test(e.name));
  check(new Set(assets.map(e=>e.name)).size <= 3, 'more than three model assets loaded');
  const originalFetch = globalThis.fetch;
  let failedURL = '';
  try {
    globalThis.fetch = (request,...args) => {
      const url = typeof request==='string' ? request : request.url;
      if (url.includes('/assets/city/pilot/terrace.glb')) {
        failedURL = url;
        return Promise.resolve(new Response('missing pilot model', {status:404}));
      }
      return originalFetch(request,...args);
    };
    const fresh = await import('./js/world/real-city.js?failure='+Date.now());
    const fallback = await fresh.buildRealCity(plots);
    const failed = plots.findIndex(p => p.kind==='terrace');
    check(failedURL && fallback.children[failed].userData.fallback, 'failed URL did not trigger per-plot fallback');
    fallback.children.forEach((g,i) => fits(g,plots[i]));
    check(fallback.children.every((g,i)=>i===failed || !g.userData.fallback), 'one failure replaced healthy models');
    check(meshes(fallback.children[failed]).length>1, 'fallback must have visible facade geometry');
  } finally { globalThis.fetch = originalFetch; console.error = originalConsoleError; removeEventListener('error', onError); }
  check(errors.length===0, 'uncaught browser errors: '+errors.join(', '));
  return {pass:true, name:'pilot models fit their plot and failed models fall back', street:streetDetails, plots:plots.length, distinctAssets:new Set(assets.map(e=>e.name)).size, sharedMeshes:a.length, errors};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
