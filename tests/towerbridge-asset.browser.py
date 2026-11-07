# browser-harness < tests/towerbridge-asset.browser.py (local preview; use a fresh cache-disabled tab; URL env override: BASE, default http://localhost:8000)
# Authored Tower Bridge (tools/landmarks/towerbridge): LOD0/LOD1 GLBs (Meshopt + KTX2), one atlas material, triangle budgets, envelope of the procedural
# bridge, night glow flag, LOD swap with hysteresis, procedural fallback hidden when the GLB is active and untouched when it fails to load.
import os
BASE = os.environ.get('BASE', 'http://localhost:8000')
t = new_tab('about:blank'); activate_tab(t if isinstance(t, str) else t.get('targetId', t))
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(BASE + '/'); wait_for_load()
print(js(r'''(async () => {
  const THREE = await import('three');
  const { loadTowerBridgeAsset, upgradeTowerBridge } = await import('/js/world/towerbridge-asset.js?t=' + Date.now());
  const { createTowerBridge } = await import('/js/world/landmark-geometry.js');
  const check = (v, m) => { if (!v) throw Error(m); };
  const { initGlbLoader } = await import('/js/world/glb-loader.js');
  const r = new THREE.WebGLRenderer(); initGlbLoader(r); // KTX2 needs a renderer
  const lods = await loadTowerBridgeAsset(); check(lods && lods.length === 2, 'both LODs load (Meshopt + KTX2)');
    const out = [];
  for (const [i, lod] of lods.entries()) {
    const meshes = []; lod.traverse((o) => { if (o.isMesh) meshes.push(o); });
    check(meshes.length >= 1 && meshes.length <= 4, 'one primitive per material, at most four draw calls per LOD');
    check(meshes[0].material.name === 'TowerBridgeAtlas' && !meshes[0].material.transparent, 'atlas material first, opaque');
    const m = meshes[0].material, tris = meshes.reduce((n, x) => n + (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3, 0);
    check(m.isMeshStandardMaterial && m.vertexColors && !m.map && !m.aoMap && !m.emissiveMap, 'vertex-colour PBR without baked maps');
    check(m.userData.glow !== true, 'the atlas never glows');
    for (const x of meshes.slice(1)) check(x.material.isMeshStandardMaterial && !x.material.map && x.material.userData.glow === true && x.material.userData.glowK > 0, 'night light and floodlit stone glow, without maps');
    const b = new THREE.Box3().setFromObject(lod);
    check(b.min.x >= -5.01 && b.max.x <= 5.01 && b.min.z >= -29.41 && b.max.z <= 29.41 && b.min.y > -1.06 && b.max.y <= 32.01, 'inside the released GLB envelope ' + JSON.stringify(b));
    check(b.max.y > 30.9 && b.max.z > 29 && b.max.x > 4.5, 'full bridge: towers to 31 m, side spans reach the shore abutments');
    check(tris <= (i ? 6000 : 16000), 'triangle budget LOD' + i);
    out.push({ lod: i, tris: Math.round(tris) });
  }
  // LOD swap + hysteresis + procedural fallback hidden
  const group = createTowerBridge(100, -45); // the real landmark group: origin = river centreline
  const procKids = [...group.children]; check(procKids.length > 0, 'procedural child present');
  const api = await upgradeTowerBridge(group, { isDisposed: () => false, track: () => {}, env: null }); check(api, 'upgrade returns an updater');
  const glb = group.children.filter((c) => c.name.startsWith('towerbridge-glb-lod')); check(glb.length === 2, 'two GLB LODs added');
  const procMass = procKids.filter((c) => /(mass|trim|glass)$/.test(c.name));
  const procLights = procKids.filter((c) => /(lightsWarm|lightsCool|wash)$/.test(c.name));
  check(procMass.length >= 1 && procMass.every((c) => !c.visible), 'procedural structure hidden while GLB active');
  check(procLights.length >= 1 && procLights.every((c) => !c.visible), 'old night-light overlays hidden: they sit on the old geometry, the GLB carries the night light');
  const at = (z) => api.update(new THREE.Vector3(100, 5, -45 + z)), vis = () => glb.map((c) => c.visible).join();
  at(0); check(vis() === 'true,false', 'near -> LOD0');
  at(29.4 + 155); check(vis() === 'true,false', 'inside hysteresis band stays LOD0');
  at(29.4 + 175); check(vis() === 'false,true', 'far -> LOD1');
  at(29.4 + 155); check(vis() === 'false,true', 'inside hysteresis band stays LOD1');
  at(29.4 + 100); check(vis() === 'true,false', 'back near -> LOD0');
  return JSON.stringify({ pass: true, out });
})()'''))
# fallback: block the GLBs, a fresh module instance must leave the procedural group visible
cdp('Network.setBlockedURLs', urls=['*towerbridge.lod0.glb*', '*towerbridge.lod1.glb*'])
print(js(r'''(async () => {
  const THREE = await import('three');
  const { upgradeTowerBridge } = await import('/js/world/towerbridge-asset.js?fallback=' + Date.now());
  const { createTowerBridge } = await import('/js/world/landmark-geometry.js');
  const group = createTowerBridge(0, 0), kids = [...group.children];
  const api = await upgradeTowerBridge(group, { isDisposed: () => false, track: () => {}, env: null });
  if (api !== null || group.children.length !== kids.length || !kids.every((c) => c.visible)) throw Error('fallback must leave the procedural bridge untouched');
  return JSON.stringify({ fallback: 'ok' });
})()'''))
cdp('Network.setBlockedURLs', urls=[])
