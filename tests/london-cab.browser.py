# With the local preview open: browser-harness < tests/london-cab.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const assets = await import('./js/world/vehicle-assets.js');
  const { buildVehicle } = await import('./js/world/vehicles.js');
  const { addBeams } = await import('./js/world/beams.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  check(typeof assets.upgradeCab === 'function', 'cab GLB upgrade must be exported');
  const promise = assets.loadVehicleAsset('cab');
  check(promise === assets.loadVehicleAsset('cab'), 'cab load promise is cached');
  const src = await promise;
  check(src, 'authored cab GLB loads');
  const roles = ['CabBody', 'CabGlass', 'CabRubber', 'CabTrim', 'CabInterior', 'CabLights'];
  const meshes = (root) => { const out = []; root.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
  const WHEELS = ['FL', 'FR', 'RL', 'RR'], inWheel = (m) => { for (let o = m; o; o = o.parent) if (WHEELS.includes(o.name)) return true; return false; };
  const all = meshes(src), source = all.filter(m => !inWheel(m)), bounds = new THREE.Box3().setFromObject(src), size = bounds.getSize(new THREE.Vector3());
  check(source.length === 6 && roles.every(n => source.some(m => m.name === n && m.material.name === n)), 'six semantic static cab meshes/materials');
  check(WHEELS.every(n => src.getObjectByName(n) && Math.abs(src.getObjectByName(n).position.y - 0.35) < 0.01), 'cab has authored FL FR RL RR wheel nodes at axle height');
  check(Math.abs(size.x - 4.572) < 0.025 && Math.abs(size.y - 1.932) < 0.025 && Math.abs(size.z - 2.211) < 0.025 && Math.abs(bounds.min.y) < 0.005, `cab real dimensions/ground origin: ${size.toArray()}`);
  const triangles = all.reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3, 0);
  check(triangles <= 10000, `cab triangle ceiling: ${triangles}`);
  for (const m of all) {
    const { position, normal, color } = m.geometry.attributes;
    check(normal?.count === position.count && color?.count === position.count, `${m.name}: normals and vertex colors preserved`);
    for (let i = 0; i < normal.count; i++) check(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 0.01, `${m.name}: unit normals`);
  }
  const lights = source.find(m => m.name === 'CabLights').geometry.attributes;
  let frontWhite = false, rearRed = false, amber = false;
  for (let i = 0; i < lights.position.count; i++) {
    const r = lights.color.getX(i), g = lights.color.getY(i), b = lights.color.getZ(i), x = lights.position.getX(i);
    frontWhite ||= x > 1 && r > 0.4 && g > 0.3 && b > 0.2;
    rearRed ||= x < -1 && r > 0.3 && r > g * 3 && r > b * 3;
    amber ||= r > 0.3 && g > 0.05 && r > g && g > b * 2;
  }
  check(frontWhite && rearRed && amber, '+X headlights / -X tail lights / amber colors');
  const cabs = Array.from({ length: 4 }, () => buildVehicle('cab'));
  const beams = cabs.map(c => { addBeams(c, c.userData.front, c.userData.beamY); return c.children.filter(o => o.name === 'beam'); });
  await Promise.all(cabs.map(c => assets.upgradeCab(c)));
  const visuals = cabs.map(c => c.getObjectByName('cab-glb'));
  check(visuals.every(Boolean), 'all four cab bodies upgraded');
  for (const [i, c] of cabs.entries()) {
    check(c.userData.length === 4.95 && c.userData.front === 2.55 && c.userData.wheels.length === 2 && c.userData.wheels.every(w => w.name === 'wheel'), 'legacy movement envelope preserved, two spinning axles');
    check(beams[i].every(b => b.parent === c) && c.children.length === 3, 'original beams and brake glow survive adoption');
    check(visuals[i].scale.equals(new THREE.Vector3(1, 1, 1)), 'no cab scale correction');
    for (const m of meshes(visuals[i]).filter(m => m.parent.name !== 'wheel')) {
      const original = source.find(o => o.name === m.name), first = visuals[0].getObjectByName(m.name);
      check((m.geometry === original.geometry || /Rubber|Trim/.test(m.name)) && m.geometry === first.geometry && m.material === first.material, 'clones share source (or wheel-split) geometry and cached role materials');
      check(m.material.vertexColors && m.material.side === THREE.FrontSide && m.frustumCulled && m.receiveShadow, 'vertex colors, front sides and culling preserved');
      check(m.castShadow === (m.name === 'CabBody'), 'only cab shell casts shadows');
    }
  }
  const body = visuals[0].getObjectByName('CabBody').material, lamp = visuals[0].getObjectByName('CabLights').material;
  const glass = visuals[0].getObjectByName('CabGlass').material, trim = visuals[0].getObjectByName('CabTrim').material;
  check(body.emissive.getHex() === 0 && body.color.r < 0.04 && Math.abs(body.color.r - body.color.g) < 0.01, 'neutral dark body is non-emissive');
  assets.updateVehicleEnv(0); const day = lamp.emissiveIntensity;
  check(body.envMapIntensity === 0.4 && glass.envMapIntensity === 0.6 && trim.envMapIntensity === 0.7, 'cab day reflection unchanged');
  assets.updateVehicleEnv(1);
  check(body.envMapIntensity === 0.16 && glass.envMapIntensity === 0.28 && trim.envMapIntensity === 0.18 && body.emissive.getHex() === 0, 'cab night reflection floors keep body non-emissive');
  check(lamp.emissive.r === lamp.emissive.g && lamp.emissive.g === lamp.emissive.b && lamp.emissiveIntensity > day, 'neutral light emission preserves vertex red/amber/white at night');
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <emissivemap_fragment>' }; lamp.onBeforeCompile(shader);
  check(shader.fragmentShader.includes('totalEmissiveRadiance *= vColor.rgb'), 'lamp shader tints emission with authored vertex colors');
  assets.updateVehicleEnv(0);
  const renderer = new THREE.WebGLRenderer(); renderer.setSize(64, 64);
  const cullScene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const cullCab = visuals[0].clone(true); cullScene.add(cullCab);
  camera.position.set(8, 5, 8); camera.lookAt(0, 0.9, 0);
  try {
    renderer.render(cullScene, camera); const inside = renderer.info.render.calls;
    cullCab.position.x = 1000; renderer.render(cullScene, camera);
    check(inside === 10 && renderer.info.render.calls === 0, `actual cab culling: ${inside} inside / ${renderer.info.render.calls} outside`);
  } finally { renderer.dispose(); }
  const { createAmbient } = await import('./js/world/ambient.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const pts = routePoints(stops.length), scene = new THREE.Scene();
  const ambient = createAmbient(scene, { curve: routeCurve(THREE, pts), pts, stops });
  await new Promise(resolve => setTimeout(resolve, 0));
  const natural = scene.children.filter(c => c.name === 'cab');
  check(natural.length === 7 && natural.every(c => c.getObjectByName('cab-glb')), 'seven natural ambient cabs upgraded');
  ambient.update({ time: 1, t: 0.5, dt: 1 / 30 });
  check(natural.every(c => Number.isFinite(c.position.x) && Number.isFinite(c.rotation.y)), 'ambient movement remains finite');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const load = GLTFLoader.prototype.loadAsync;
  try {
    GLTFLoader.prototype.loadAsync = () => Promise.reject(Error('intentional unavailable asset'));
    const failed = await import('./js/world/vehicle-assets.js?cab-fallback-contract');
    const fallback = buildVehicle('cab'), original = [...fallback.children];
    await failed.upgradeCab(fallback);
    check(original.every((c, i) => fallback.children[i] === c), 'failed GLB retains procedural fallback');
  } finally { GLTFLoader.prototype.loadAsync = load; }
  return { pass: true, triangles, roles: roles.length, cabs: natural.length, dimensions: size.toArray() };
})()'''))
