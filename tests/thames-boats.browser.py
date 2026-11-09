# Open tools/vehicles/uber-boat-preview.html, then:
# browser-harness < tests/thames-boats.browser.py
reply = cdp('Runtime.evaluate', expression=r'''(async () => {
  const root = new URL('../../', location.href);
  const T = await import('three');
  const { createAmbient } = await import(new URL('js/world/ambient.js', root));
  const { stops } = await import(new URL('js/content.js', root));
  const L = await import(new URL('js/world/layout.js', root));
  const pts = L.routePoints(stops.length), curve = L.routeCurve(T, pts);
  const scene = new T.Scene(), check = (ok, message) => { if (!ok) throw Error(message); };
  const unit = createAmbient(scene, { curve, pts, stops, reducedMotion: true });
  const boats = scene.children.filter(o => o.name.startsWith('thames-boat'));
  const anchors = boats.map(b => b.position.clone());
  check(unit.boatsReady instanceof Promise, 'Boat replacement exposes its completion');
  await unit.boatsReady;
  const londonEnd = L.regions(stops,pts)[0].sub[1];
  check(boats.filter(b=>b.position.z<L.RIVER_Z).length===3 && boats.filter(b=>b.position.z>L.RIVER_Z).length===2, 'Three eastbound and two westbound vessels in separate lanes');
  check(boats.every(b=>Math.abs(Math.abs(b.position.z-L.RIVER_Z)-4)<1e-6), 'Only two river lanes, no centre-lane vessel');
  check(boats.every(b=>{const direction=new T.Vector3(1,0,0).applyQuaternion(b.quaternion).x;return b.position.z<L.RIVER_Z ? direction>.99 : direction<-.99;}), 'Opposite banks face opposite directions without mirroring');
  const geometries = new Set(), materials = new Set();
  const dimensions = boats.map((b, i) => {
    check(b.userData.boatStyle === 'mercury-clipper', `Boat ${i} uses Mercury`);
    check(b.position.equals(anchors[i]), `Boat ${i} retains its mooring`);
    check(b.children.length === 1 && b.children[0].name === 'mercury-clipper-visual', 'No old body or duplicate foam/reflection root remains');
    const visual = b.children[0];
    check(visual.scale.x === visual.scale.y && visual.scale.y === visual.scale.z, 'Uniform proportions');
    b.traverse(o => { if(o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
    const bounds = new T.Box3().setFromObject(b), size = bounds.getSize(new T.Vector3());
    check(Math.abs(size.x - 14.148) < .01 && Math.abs(size.z - 3.4536) < .01, 'Scene-scale ferry envelope');
    check(bounds.min.x >= pts[L.ukStart(stops)].x-15 && bounds.max.x <= londonEnd, 'Whole hull stays in London; no boats on Pinheiros or Clyde');
    check(bounds.min.y < .1 && bounds.max.y < 3, 'Waterline and bridge clearance');
    return size.toArray();
  });
  check(boats.length === 5 && geometries.size === 6 && materials.size === 6, 'Five boats share six geometries and materials');
  unit.update({time:20,t:.5});
  const still = boats.map(b => ({p:b.position.clone(),r:b.rotation.clone()}));
  unit.update({time:40,t:.5});
  check(boats.every((b,i)=>b.position.equals(still[i].p) && b.rotation.equals(still[i].r)), 'Reduced motion keeps boats at rest');
  unit.dispose();
  const abandoned = new T.Scene(), pending = createAmbient(abandoned,{curve,pts,stops});
  pending.dispose();
  await pending.boatsReady;
  check(abandoned.children.filter(o=>o.name.startsWith('thames-boat')).every(b=>b.userData.boatStyle!=='mercury-clipper'), 'Late load cannot upgrade a disposed scene');
  const originalLoad = T.FileLoader.prototype.load;
  let fallback;
  try {
    T.FileLoader.prototype.load = function(url, onLoad, onProgress, onError) {
      if (String(url).includes('/uber-boat/')) { queueMicrotask(()=>onError(new Error('Expected unavailable boat asset'))); return; }
      return originalLoad.call(this,url,onLoad,onProgress,onError);
    };
    const { createAmbient: unavailable } = await import(new URL('js/world/ambient.js?boat-failure-test',root));
    const fallbackScene = new T.Scene();
    fallback = unavailable(fallbackScene,{curve,pts,stops});
    await fallback.boatsReady;
    const retained = fallbackScene.children.filter(o=>o.name.startsWith('thames-boat'));
    check(retained.length===5 && retained.every(b=>b.children.length>0 && b.userData.boatStyle!=='mercury-clipper'), 'Failed asset retains five procedural boats');
  } finally { T.FileLoader.prototype.load = originalLoad; fallback?.dispose(); }
  return {pass:true,boats:boats.length,sharedGeometries:geometries.size,sharedMaterials:materials.size,dimensions};
})()''', returnByValue=True, awaitPromise=True, _response_timeout=60)
assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
result = reply['result'].get('value')
assert result and result.get('pass'), result
print(result)
