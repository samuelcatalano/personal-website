# browser-harness < tests/masp-asset.browser.py (local preview; use a fresh cache-disabled tab; URL env overrides http://localhost:8000/)
# Authored MASP (tools/landmarks/masp): LOD0/LOD1 GLBs (Meshopt + KTX2), one atlas material, envelope, night glow flag, LOD swap by distance, procedural fallback.
import os, time
URL = os.environ.get('URL', 'http://localhost:8000/')
t = new_tab('about:blank'); activate_tab(t if isinstance(t, str) else t.get('targetId', t))
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(URL); wait_for_load()
print(js(r'''(async () => {
  const THREE = await import('three');
  const { loadMaspAsset } = await import('/js/world/masp-asset.js?t=' + Date.now());
  const check = (v, m) => { if (!v) throw Error(m); };
  const { initGlbLoader } = await import('/js/world/glb-loader.js');
  const r = new THREE.WebGLRenderer(); initGlbLoader(r); // KTX2 needs a renderer
  const lods = await loadMaspAsset(); check(lods && lods.length === 2, 'both LODs load (Meshopt + KTX2)');
  const out = [];
  for (const [i, lod] of lods.entries()) {
    const meshes = []; lod.traverse((o) => { if (o.isMesh) meshes.push(o); });
    check(meshes.length === 1, 'one mesh per LOD');
    const m = meshes[0].material, g = meshes[0].geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    check(m.name === 'MaspAtlas' && !m.transparent, 'single opaque atlas material');
    check(m.map?.isCompressedTexture && m.aoMap?.isCompressedTexture && m.emissiveMap?.isCompressedTexture, 'KTX2 base colour / ORM / emissive');
    check(m.userData.glow === true, 'night glow registered');
    const b = new THREE.Box3().setFromObject(lod);
    check(b.min.x > -20.05 && b.max.x < 20.05 && b.min.z > -6.55 && b.max.z < 6.55 && b.min.y > -0.05 && b.max.y < 15.65, 'inside the procedural envelope ' + JSON.stringify(b));
    check(b.max.y > 15 && b.max.x > 19.5 && b.max.z > 6, 'fills the envelope (beams, portals, stairs)');
    check(tris <= (i ? 2500 : 8000), 'triangle budget LOD' + i);
    out.push({ lod: i, tris: Math.round(tris) });
  }
  return JSON.stringify({ pass: true, out });
})()'''))
# integration: procedural group hidden under the GLB, LOD swap with hysteresis, fallback on a failed load, ?landmarks=procedural
print(js(r"""(async () => {
  const THREE = await import('three');
  const check = (v, m) => { if (!v) throw Error(m); };
  const { createMasp } = await import('/js/world/landmark-geometry.js');
  const mod = await import('/js/world/masp-asset.js?u=' + Date.now());
  const group = createMasp(100, 0), proc = [...group.children], tracked = [], regs = [];
  const lod = await mod.upgradeMasp(group, { isDisposed: () => false, track: (m) => tracked.push(m), env: { register: (m, o) => regs.push([m, o]) } });
  check(lod, 'upgrade returns an updater');
  check(proc.every((c) => !c.visible), 'procedural meshes hidden when the GLB is active');
  const glb = group.children.filter((c) => c.name.startsWith('masp-glb-lod')); check(glb.length === 2, 'two LOD roots added');
  check(tracked.length === 2 && regs.length === 2 && regs.every(([, o]) => o.metal === 1), 'glow materials tracked (sky) and registered with the landmark env');
  const at = (x, y, z) => { lod.update(new THREE.Vector3(x, y, z)); return glb.map((g) => g.visible ? 1 : 0).join(''); };
  // box front edge is z=6.6 (local), so camera z = 6.6 + d
  const L = [at(100, 0, 6.6 + 100), at(100, 0, 6.6 + 155), at(100, 0, 6.6 + 200), at(100, 0, 6.6 + 155), at(100, 0, 6.6 + 100)];
  check(L.join() === '10,10,01,01,10', 'LOD0 near, hysteresis band keeps the previous level, LOD1 far: ' + L.join());
  // failed load -> null and the procedural group stays visible
  const realFetch = window.fetch; window.fetch = () => Promise.reject(new Error('offline'));
  let kept;
  try {
    const bad = await import('/js/world/masp-asset.js?v=' + Date.now()), g2 = createMasp(0, 0);
    kept = (await bad.upgradeMasp(g2, { isDisposed: () => false })) === null && g2.children.every((c) => c.visible);
  } finally { window.fetch = realFetch; }
  check(kept, 'procedural fallback stays visible when the GLB fails to load');
  check(mod.maspForced() === false, 'not forced by default');
  return JSON.stringify({ pass: true, lod: L });
})()""")) 
goto_url(URL + '?landmarks=procedural'); wait_for_load()
print(js("(async () => (await import('/js/world/masp-asset.js?f=' + Date.now())).maspForced())()"))
