# browser-harness < tests/landmark-assets.browser.py (Desktop only; local preview; BASE may override http://localhost:8000)
import os
BASE = os.environ.get('BASE', 'http://localhost:8000')
t = new_tab('about:blank'); activate_tab(t if isinstance(t, str) else t.get('targetId', t))
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(BASE + '/'); wait_for_load()
print(js(r'''(async () => {
  const THREE = await import('three');
  const { upgradeAuthoredLandmark, upgradeLondonEye } = await import('/js/world/authored-landmarks.js?t=' + Date.now());
  const { createCopan, createLondonEye, createRiverside, createUniversity, createWembley } = await import('/js/world/landmark-geometry.js');
  const { finishLondonEye } = await import('/js/world/landmark-materials.js');
  const check = (v, m) => { if (!v) throw Error(m); };
  const stats = (root) => {
    let triangles = 0, meshes = 0;
    root.traverse((o) => { if (o.isMesh) { meshes++; triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    return { triangles, meshes };
  };
  const checkUniversityClockFaces = (root, bucket) => {
    root.updateWorldMatrix(true, true);
    const rays = [
      [new THREE.Vector3(.7, 17.9, 12), new THREE.Vector3(0, 0, -1), 'z', 7.05], [new THREE.Vector3(.7, 17.9, -8), new THREE.Vector3(0, 0, 1), 'z', -1.05],
      [new THREE.Vector3(8, 17.9, 3.7), new THREE.Vector3(-1, 0, 0), 'x', 4.05], [new THREE.Vector3(-8, 17.9, 3.7), new THREE.Vector3(1, 0, 0), 'x', -4.05],
    ];
    check(root.getObjectByName(bucket) && rays.every(([origin, direction, axis, face]) => {
      const hit = new THREE.Raycaster(origin, direction).intersectObject(root, true)[0];
      return hit && Math.abs(hit.point.y - 17.9) < 0.02 && Math.abs(hit.point[axis] - face) < 0.02;
    }), 'University central tower has a visible clock face on each side');
  };
  const options = { isDisposed: () => false, track: () => {}, env: { register: (m, { k }) => { m.userData.envK = k; } } };
  const copan = createCopan({ x: -57, z: -45, len: 40, amp: 5, depth: 9.2, h: 38.4 });
  check(copan.scale.x === -1 && copan.position.x === -57 && copan.position.z === -45, 'Copan mirrors horizontally around its existing site position');
  const proc = [...copan.children], api = await upgradeAuthoredLandmark(copan, 'copan', options);
  check(api && copan.children.filter((o) => o.name.startsWith('copan-glb-lod')).length === 2, 'Copan loads both authored LODs');
  const structure = proc.filter((o) => /-(mass|trim|glass)$/.test(o.name));
  const lights = proc.filter((o) => /-(lightsWarm|lightsCool|wash)$/.test(o.name));
  const copanLods = copan.children.filter((o) => o.name.startsWith('copan-glb-lod'));
  check(structure.length === 3 && structure.every((o) => !o.visible), 'Copan procedural structure is replaced');
  check(lights.every((o) => o.visible), 'Copan night strips stay visible');
  const copanGlass = [];
  copanLods[0].traverse((o) => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m.name === 'Glass') copanGlass.push(m); });
  const copanMass = copanLods[0].children.find((o) => o.material?.name === 'Mass')?.material;
  const copanTrim = copanLods[0].children.find((o) => o.material?.name === 'Trim')?.material;
  check(copanMass?.color.getHexString() === 'c0af8d' && copanTrim?.color.getHexString() === 'd1bd91', 'Copan day palette keeps warm sandstone mass and yellow fins');
  check(copanGlass.length > 0 && copanGlass.every((m) => m.color.getHexString() === '4b4945' && Math.abs(m.roughness - 0.34) < 1e-5 && m.userData.glow === true && m.userData.glowColor.getHex() === 0xffffff && m.emissiveMap?.image?.width === 384 && m.userData.glowK === 1.4 && m.emissive.getHex() === 0), 'Copan neutral gray glass stays dark by day and glows only at mapped windows by night');
  for (const [i, lod] of copanLods.entries()) { const s = stats(lod); check(s.triangles <= (i ? 4000 : 8000) && s.meshes <= 3, 'Copan LOD budget'); }
  const near = new THREE.Vector3(-57, 5, -45), far = new THREE.Vector3(-57, 5, 300);
  api.update(near); check(copanLods[0].visible && !copanLods[1].visible, 'Copan near uses LOD0');
  api.update(far); check(!copanLods[0].visible && copanLods[1].visible, 'Copan far uses LOD1');
  api.update(new THREE.Vector3(-57, 5, 120)); check(!copanLods[0].visible && copanLods[1].visible, 'Copan LOD hysteresis holds in the transition band');
  api.update(near); check(copanLods[0].visible && !copanLods[1].visible, 'Copan returns to LOD0');

  const eye = createLondonEye(28, -45), frame = eye.frame.getObjectByName('eyeframe-geometry'); finishLondonEye(eye.wheel);
  eye.wheel.rotation.z = .73;
  const eyeApi = await upgradeLondonEye(eye.wheel, frame, options);
  check(eyeApi && Math.abs(eye.wheel.rotation.z - .73) < 1e-6, 'Eye keeps its existing wheel animation transform');
  const wheelLods = eye.wheel.children.filter((o) => o.name.startsWith('london-eye-wheel-lod'));
  const frameLods = frame.children.filter((o) => o.name.startsWith('london-eye-frame-lod'));
  check(wheelLods.length === 2 && frameLods.length === 2, 'Eye loads both wheel and static-frame LODs');
  check(wheelLods[0].getObjectByName('eye-pods')?.isMesh, 'Eye capsule mesh loads');
  check(wheelLods[0].getObjectByName('eye-rim').material.userData.glowK === 0.45 && wheelLods[0].getObjectByName('eye-pods').material.userData.glowK === 0.3, 'Eye authored materials keep the existing night-light levels');
  const eyeProc = frame.children.filter((o) => /-(mass|trim|glass)$/.test(o.name));
  check(eyeProc.length > 0 && eyeProc.every((o) => !o.visible), 'Eye procedural frame is replaced');
  eyeApi.update(new THREE.Vector3(28, 5, -45)); check(wheelLods[0].visible && frameLods[0].visible, 'Eye near uses LOD0 together');
  eyeApi.update(new THREE.Vector3(28, 5, 300)); check(wheelLods[1].visible && frameLods[1].visible, 'Eye far uses LOD1 together');
  eyeApi.update(new THREE.Vector3(28, 5, 120)); check(wheelLods[1].visible && frameLods[1].visible, 'Eye wheel and frame hold the transition LOD together');
  let eyeDisposed = 0; wheelLods[0].traverse((o) => { if (o.isMesh) o.geometry.addEventListener('dispose', () => eyeDisposed++); });
  eye.wheel.userData.dispose(); frame.userData.dispose();
  check(eyeDisposed > 0, 'Eye wheel disposal releases its authored geometry');
  const models = [];
  for (const [name, group] of [['riverside', createRiverside(0, 0)], ['university', createUniversity(0, 0, 2)], ['wembley', createWembley(0, 0)]]) {
    const pos = group.position.clone(), scale = group.scale.clone(), proc = [...group.children];
    if (name === 'university') checkUniversityClockFaces(group, 'university-trim');
    if (name === 'riverside') {
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      check(Math.abs(size.x - 36) < 0.2 && Math.abs(size.y - 18.3375) < 0.2 && Math.abs(size.z - 16.875) < 0.2, 'Riverside fallback expands around its existing anchor: ' + size.toArray());
    }
    const lod = await upgradeAuthoredLandmark(group, name, options), roots = group.children.filter((o) => o.name.startsWith(name + '-glb-lod'));
    check(lod && roots.length === 2, name + ' loads both authored LODs');
    check(proc.filter((o) => /-(mass|trim|glass)$/.test(o.name)).every((o) => !o.visible), name + ' procedural structure is replaced');
    check(proc.filter((o) => /-(lightsWarm|lightsCool|wash)$/.test(o.name)).every((o) => o.visible), name + ' preserves the one arch light overlay and other night-light overlays');
    check(group.position.equals(pos) && group.scale.equals(scale), name + ' preserves its placement and scale');
    for (const [i, root] of roots.entries()) { const s = stats(root); check(s.triangles <= (i ? 4500 : 8000) && s.meshes <= 8, name + ' LOD budget'); }
    if (name === 'wembley') {
      const glass = roots[0].children.find((o) => o.material?.name === 'Glass')?.material;
      check(proc.find((o) => o.name === 'wembley-lightsCool')?.visible === true, 'the single arch centerline retains its cyan night lighting');
      check(glass?.userData.glow === true && glass.userData.glowColor.getHexString() === 'c7dcf0' && Math.abs(glass.userData.glowK - 0.32) < 1e-5, 'Wembley glazing gains a restrained cool interior glow at night');
    }
    if (name === 'university') roots.forEach((root) => checkUniversityClockFaces(root, 'Trim'));
    if (name === 'riverside') {
      const glass = roots[0].children.find((o) => o.material?.name === 'Glass')?.material;
      check(glass?.transmission >= 0.75 && Math.abs(glass.ior - 1.52) < 1e-3 && glass.roughness <= 0.1 && Math.abs(glass.userData.envK - 1.2) < 1e-5, 'Riverside glazing uses clear physical glass with stronger sky reflections: ' + [glass?.transmission, glass?.ior, glass?.roughness, glass?.userData.envK]);
    }
    lod.update(new THREE.Vector3(0, 5, 0)); check(roots[0].visible && !roots[1].visible, name + ' near uses LOD0');
    lod.update(new THREE.Vector3(0, 5, 300)); check(!roots[0].visible && roots[1].visible, name + ' far uses LOD1');
    models.push({ name, lod0: stats(roots[0]), lod1: stats(roots[1]) });
    let disposed = 0; roots[0].traverse((o) => { if (o.isMesh) o.geometry.addEventListener('dispose', () => disposed++); });
    group.userData.dispose(); check(disposed > 0, name + ' disposal releases authored geometry');
  }
  return JSON.stringify({ pass: true, models });
})()'''))
cdp('Network.setBlockedURLs', urls=['*copan.lod0.glb*', '*copan.lod1.glb*'])
print(js(r'''(async () => {
  const THREE = await import('three');
  const { upgradeAuthoredLandmark } = await import('/js/world/authored-landmarks.js?fallback=' + Date.now());
  const { createCopan } = await import('/js/world/landmark-geometry.js');
  const group = createCopan({ x: 0, z: 0, len: 40, amp: 5, depth: 9.2, h: 38.4 }), children = [...group.children];
  const lod = await upgradeAuthoredLandmark(group, 'copan', { isDisposed: () => false, track: () => {}, env: null });
  if (lod !== null || group.children.length !== children.length || !children.every((o) => o.visible) || group.scale.x !== -1) throw Error('failed GLB load must preserve mirrored procedural Copan');
  return JSON.stringify({ fallback: 'ok' });
})()'''))
cdp('Network.setBlockedURLs', urls=[])
