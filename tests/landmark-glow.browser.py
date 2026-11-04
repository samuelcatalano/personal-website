# Night glow and Eye finish for the Estaiada, Riverside and London Eye landmarks.
# Run from a fresh tab on the local preview: (echo "t=new_tab('http://localhost:8000/')"; echo "activate_tab(t if isinstance(t,str) else t.get('targetId',t))"; cat tests/landmark-glow.browser.py) | browser-harness
# Runs in the tab the runner prepared (already loaded): no reload here.
result = js(r'''(async () => {
  const T = await import('three');
  const { buildLandmarks } = await import('./js/world/landmarks.js');
  const { createLondonEye } = await import('./js/world/landmark-geometry.js');
  const { finishLondonEye } = await import('./js/world/landmark-materials.js');
  const { stops } = await import('./js/content.js');
  const { routePoints } = await import('./js/world/layout.js');
  const pts = routePoints(stops.length), boxes = [];
  const parts = buildLandmarks((...b) => boxes.push(b), stops, pts);
  const check = (ok, msg) => { if (!ok) throw Error(msg); };
  const lum = (c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; // BT.601 weights of the bloom high-pass
  const BLOOM = 0.95, metrics = {};
  // Night strips: emissive = glowColor * glowK * vertex brightness (sky.js). Peak luminance must stay under the bloom threshold.
  for (const name of ['estaiada', 'riverside']) {
    const g = parts.details.getObjectByName(name + '-geometry');
    check(g, 'Missing ' + name + ' geometry');
    const strips = []; g.traverse((o) => { if (o.isMesh && o.name.endsWith('-lightsCool')) strips.push(o); });
    check(strips.length >= 1, name + ' has no cool strip mesh');
    let peak = 0;
    for (const m of strips) {
      const col = m.geometry.attributes.color, k = m.material.userData.glowK;
      check(k === 3.2, name + ' shared cool strip material was changed (glowK ' + k + ')');
      for (let i = 0; i < col.count; i++) peak = Math.max(peak, lum(new T.Color(col.getX(i), col.getY(i), col.getZ(i)).multiply(m.material.userData.glowColor)) * k);
    }
    check(peak <= BLOOM, name + ' night strip luminance ' + peak.toFixed(3) + ' exceeds bloom threshold ' + BLOOM);
    check(peak >= 0.3, name + ' night strips too dim ' + peak.toFixed(3));
    metrics[name] = { strips: strips.length, peakEmissiveLum: +peak.toFixed(3) };
  }
  // London Eye: same meshes as before (no duplicates or extra instances), darker-glass pods, emissive rim, darker rim in rain.
  {
    const w = parts.eye, rim = w.getObjectByName('eye-rim'), pods = w.getObjectByName('eye-pods');
    check(rim && pods && w.children.length === 3, 'Eye must keep exactly rim, spokes and pods');
    check(pods.isInstancedMesh && pods.count === 32, 'Eye pod instance count');
    check(rim.material.userData.glowK <= 0.5, 'Eye rim night emissive too strong ' + rim.material.userData.glowK);
    check(pods.material.userData.glowK <= 0.6, 'Eye pod night emissive too strong ' + pods.material.userData.glowK);
    check(lum(pods.material.color) <= 0.3, 'Eye pod body must read as dark glass');
    const clear = createLondonEye(0, 0).wheel, wet = createLondonEye(0, 0).wheel;
    finishLondonEye(clear, { rain: 0 }); finishLondonEye(wet, { rain: 0.65 });
    const lc = lum(clear.getObjectByName('eye-rim').material.color), lr = lum(wet.getObjectByName('eye-rim').material.color);
    check(lr <= 0.2 && lr < 0.5 * lc, 'Eye rim in rain not darker than the overcast sky: clear ' + lc.toFixed(3) + ' rain ' + lr.toFixed(3));
    metrics.eye = { rimGlowK: rim.material.userData.glowK, podGlowK: pods.material.userData.glowK, rimLumClear: +lc.toFixed(3), rimLumRain: +lr.toFixed(3) };
  }
  return { pass: true, metrics };
})()''')
print(result)
