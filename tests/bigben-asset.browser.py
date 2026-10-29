# browser-harness < tests/bigben-asset.browser.py (local preview; use a fresh cache-disabled tab)
# Authored Big Ben (tools/landmarks/bigben): loads LOD0/LOD1 GLBs (Meshopt + KTX2), one atlas material, envelope, night glow flag, procedural fallback hidden.
import time
t = new_tab('about:blank'); activate_tab(t if isinstance(t, str) else t.get('targetId', t))
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url('http://localhost:8000/'); wait_for_load()
print(js(r'''(async () => {
  const THREE = await import('three');
  const { loadBigBenAsset } = await import('/js/world/bigben-asset.js?t=' + Date.now());
  const check = (v, m) => { if (!v) throw Error(m); };
  const { initGlbLoader } = await import('/js/world/glb-loader.js');
  const r = new THREE.WebGLRenderer(); initGlbLoader(r); // KTX2 needs a renderer
  const lods = await loadBigBenAsset(); check(lods && lods.length === 2, 'both LODs load (Meshopt + KTX2)');
  const out = [];
  for (const [i, lod] of lods.entries()) {
    const meshes = []; lod.traverse((o) => { if (o.isMesh) meshes.push(o); });
    check(meshes.length === 1, 'one mesh per LOD');
    const m = meshes[0].material, g = meshes[0].geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    check(m.name === 'BigBenAtlas' && !m.transparent, 'single opaque atlas material');
    check(m.map?.isCompressedTexture && m.aoMap?.isCompressedTexture && m.emissiveMap?.isCompressedTexture, 'KTX2 base colour / ORM / emissive');
    check(m.userData.glow === true, 'night glow registered');
    const b = new THREE.Box3().setFromObject(lod);
    check(b.min.x > -3.2 && b.max.x < 37.1 && b.min.z > -4.1 && b.max.z < 4.7 && b.min.y > -0.05 && b.max.y < 34.1, 'inside the landmark envelope ' + JSON.stringify(b));
    check(tris <= (i ? 4000 : 12000), 'triangle budget LOD' + i);
    out.push({ lod: i, tris: Math.round(tris) });
  }
  return JSON.stringify({ pass: true, out });
})()'''))
