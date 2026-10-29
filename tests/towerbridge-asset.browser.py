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
  const proc = createTowerBridge(0, 0), pb = new THREE.Box3().setFromObject(proc); // the frozen procedural envelope
  const out = [];
  for (const [i, lod] of lods.entries()) {
    const meshes = []; lod.traverse((o) => { if (o.isMesh) meshes.push(o); });
    check(meshes.length === 1, 'one mesh per LOD');
    const m = meshes[0].material, g = meshes[0].geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    check(m.name === 'TowerBridgeAtlas' && !m.transparent, 'single opaque atlas material');
    check(m.map?.isCompressedTexture && m.aoMap?.isCompressedTexture && m.emissiveMap?.isCompressedTexture, 'KTX2 base colour / ORM / emissive');
    check(m.userData.glow === true, 'night glow registered');
    const b = new THREE.Box3().setFromObject(lod);
    check(b.min.x >= pb.min.x - 0.5 && b.max.x <= pb.max.x + 0.5 && b.min.z >= pb.min.z - 0.5 && b.max.z <= pb.max.z + 0.5 && b.min.y > -1.05 && b.max.y <= pb.max.y + 0.3, 'inside the procedural envelope ' + JSON.stringify([b, pb]));
    check(Math.abs(b.max.y - 35.2) < 0.3 && b.max.z > 17 && b.max.x > 3.5, 'spans the full height / length / width');
    check(tris <= (i ? 4500 : 14000), 'triangle budget LOD' + i);
    out.push({ lod: i, tris: Math.round(tris) });
  }
  // LOD swap + hysteresis + procedural fallback hidden
  const group = createTowerBridge(100, -45); // the real landmark group: origin = river centreline
  const procKids = [...group.children]; check(procKids.length > 0, 'procedural child present');
  const api = await upgradeTowerBridge(group, { isDisposed: () => false, track: () => {}, env: null }); check(api, 'upgrade returns an updater');
  const glb = group.children.filter((c) => c.name.startsWith('towerbridge-glb-lod')); check(glb.length === 2, 'two GLB LODs added');
  check(procKids.every((c) => !c.visible), 'procedural hidden while GLB active');
  const at = (z) => api.update(new THREE.Vector3(100, 5, -45 + z)), vis = () => glb.map((c) => c.visible).join();
  at(0); check(vis() === 'true,false', 'near -> LOD0');
  at(17.6 + 155); check(vis() === 'true,false', 'inside hysteresis band stays LOD0');
  at(17.6 + 175); check(vis() === 'false,true', 'far -> LOD1');
  at(17.6 + 155); check(vis() === 'false,true', 'inside hysteresis band stays LOD1');
  at(17.6 + 100); check(vis() === 'true,false', 'back near -> LOD0');
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
