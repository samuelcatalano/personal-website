# browser-harness < tests/real-city.browser.py (local preview)
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
result = js(r'''(async () => {
  const T = await import('three');
  const { buildRealCity } = await import('./js/world/real-city.js');
  const { buildCity } = await import('./js/world/city.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const meshes = g => { const m = []; g.traverse(o => { if (o.isMesh) m.push(o); }); return m; };
  const fits = (g, p) => {
    const b = new T.Box3().setFromObject(g), s = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
    check(s.x > 0 && s.y > 0 && s.z > 0, 'empty plot '+p.id);
    check(s.x <= p.width+1e-5 && s.z <= p.depth+1e-5 && s.y <= p.height+1e-5, 'model exceeds plot '+p.id);
    check(Math.abs(c.x-p.x)<1e-5 && Math.abs(c.z-p.z)<1e-5 && Math.abs(b.min.y)<1e-5, 'model origin/grounding incorrect '+p.id);
    check(Math.abs(Math.max(s.x/p.width,s.y/p.height,s.z/p.depth)-1)<1e-5, 'model does not fill its limiting dimension');
  };
  const pts = routePoints(stops.length), plots = [];
  buildCity(() => {}, stops, pts, routeCurve(T,pts), undefined, p => plots.push(p));
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
  return {pass:true, name:'pilot models fit their plot and failed models fall back', plots:plots.length, distinctAssets:new Set(assets.map(e=>e.name)).size, sharedMeshes:a.length, errors};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
