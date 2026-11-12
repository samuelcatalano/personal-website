# browser-harness < tests/bridge-finish.browser.py (local preview)
print(js(r'''(async () => {
  const T = await import('three'), { stops } = await import('./js/content.js');
  const L = await import('./js/world/layout.js');
  const { createUnderpass, HX, H, ARCH_HALF_WIDTH: AW } = await import('./js/world/underpass.js');
  const { RIVER_WIDTH } = await import('./js/world/underwater-profile.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const pts = L.routePoints(stops.length), curve = L.routeCurve(T, pts);
  const up = createUnderpass(curve, stops, {x0:L.riverStart(stops,pts),x1:L.riverEnd(stops,pts),z:L.RIVER_Z,width:22});
  const counts = [], segments = 16;
  const ray = new T.Raycaster();
  up.group.updateMatrixWorld(true);
  for (const [i, pass] of up.passes.entries()) {
    const g = up.group.getObjectByName('underpass-' + i);
    check(g.children.length === 7, 'finish preserves seven merged meshes per crossing');
    check(g.children.every((m,j) => m.material === up.group.getObjectByName('underpass-0').children[j].material), 'both crossings share material buckets');
    for (const j of [0,1,2,5]) {
      const shader = {uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
      g.children[j].material.onBeforeCompile(shader);
      check(!/^#define VOXEL_EDGE\b/m.test(shader.fragmentShader), 'metric bridge masonry must not use unit-box edge shading');
      check(shader.fragmentShader.includes('fwidth(cell)'), 'ashlar joints fade with screen footprint');
    }
    const hitAt = (f,t,r) => {
      const p = new T.Vector3(f*20,3.4+(3+r)*Math.sin(t),(AW+r)*Math.cos(t)).applyMatrix4(g.matrixWorld);
      ray.set(p,new T.Vector3(-f,0,0).transformDirection(g.matrixWorld));
      const hit = ray.intersectObjects(g.children)[0];
      return hit && g.worldToLocal(hit.point.clone());
    };
    for (const f of [-1,1]) {
      // The raised outer moulding and recessed inner face need distinct real depths.
      const inner = hitAt(f,Math.PI*4.5/segments,0.10), outer = hitAt(f,Math.PI*4.5/segments,0.40);
      check(inner && outer && Math.abs(Math.abs(outer.x)-Math.abs(inner.x)) > 0.025, 'arch moulding has real rebated depth');
      check(Math.abs(outer.x) <= HX+0.231, 'ring remains within existing exterior plus 8cm finish');
      hitAt(f,Math.PI*4.5/segments,0.165);
      const bevel = ray.intersectObjects(g.children)[0];
      check(bevel && Math.abs(bevel.face.normal.x) < 0.99 && Math.abs(bevel.face.normal.x) > 0.1, 'rebate has real inclined stone faces');
      const joint = hitAt(f,Math.PI*4/segments,0.40);
      check(joint && Math.abs(joint.x) < Math.abs(outer.x)-0.025, 'voussoirs are separated by recessed radial joints');
      for (const [z,y] of [[0,6.35],[3,5.8],[-3,5.8],[5.45,3.3],[-5.45,3.3]]) {
        ray.set(new T.Vector3(f*20,y,z).applyMatrix4(g.matrixWorld),new T.Vector3(-f,0,0).transformDirection(g.matrixWorld));
        check(ray.intersectObjects(g.children).length === 0, 'exact existing arch aperture remains clear');
      }
    }
    // Nothing new supports the bridge inside the boat channel.
    const mid = pass.river.bankAz+RIVER_WIDTH/2;
    ray.set(new T.Vector3(-20,3,pass.river.sigma*mid).applyMatrix4(g.matrixWorld),new T.Vector3(1,0,0).transformDirection(g.matrixWorld));
    check(ray.intersectObjects(g.children).length === 0, 'boat navigation remains clear');
    counts.push(g.children.reduce((n,m) => n+m.geometry.attributes.position.count/3,0));
  }
  const renderer = new T.WebGLRenderer(), scene = new T.Scene(), camera = new T.PerspectiveCamera(40,4/3,.1,200);
  renderer.setSize(128,96);scene.add(up.group,new T.HemisphereLight(0xffffff,0x445566,2));
  const g = up.group.getObjectByName('underpass-0');
  camera.position.copy(new T.Vector3(24,13,28).applyMatrix4(g.matrixWorld));
  camera.lookAt(new T.Vector3(0,4,5).applyMatrix4(g.matrixWorld));
  renderer.render(scene,camera);
  check(renderer.getContext().getError()===0&&renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'bridge relief shader fails in a real render');
  renderer.dispose();
  const resources = new Set();
  up.group.traverse(o => { if(o.geometry) resources.add(o.geometry); if(o.material) for(const m of [].concat(o.material)) resources.add(m); });
  const disposed = new Map();
  for(const r of resources) r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1));
  up.group.userData.dispose(); up.group.userData.dispose();
  check([...disposed.values()].every(n=>n===1), 'bridge resources dispose exactly once');
  check(disposed.size === resources.size, 'all bridge geometries and materials are released');
  return {pass:true,bridges:up.passes.length,triangles:counts,resources:disposed.size,deck:H};
})()'''))
