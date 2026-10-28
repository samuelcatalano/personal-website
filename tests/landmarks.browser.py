# browser-harness < tests/landmarks.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildLandmarks } = await import(`./js/world/landmarks.js?test=${Date.now()}`);
  const { createAmbient } = await import('./js/world/ambient.js');
  const { buildCity } = await import('./js/world/city.js');
  const { stops } = await import('./js/content.js');
  const { PALETTE } = await import('./js/world/palette.js');
  const { routePoints, routeCurve, RIVER_Z, towerX } = await import('./js/world/layout.js');
  const { CatmullRomCurve3, Vector3, Scene, Box3 } = THREE;
  const pts = routePoints(stops.length), bridgeX = towerX(stops, pts);
  const curve = routeCurve(THREE, pts), ambientScene = new Scene();
  const check = (ok, message) => { if (!ok) throw Error(message); };
  createAmbient(ambientScene, { curve, pts, stops });
  ambientScene.updateMatrixWorld(true);
  const boats = ambientScene.children.filter(o => o.isGroup && o.position.y === 0.1 && Math.abs(o.position.z - RIVER_Z) <= 5.1);
  const expectedBoatStyles = ['launch', 'cruiser', 'service', 'launch', 'cruiser', 'service', 'launch'];
  check(boats.map(boat => boat.userData.boatStyle).join(',') === expectedBoatStyles.join(','), 'Seven Thames boats must retain their ordered launch/cruiser/service assignment');
  const boxes = [];
  const landmarkParts = buildLandmarks((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, pts);
  const tb = landmarkParts.details.getObjectByName('towerbridge-geometry'), lay = tb?.userData.layout;
  check(tb && lay, 'Tower Bridge must be built through the geometry module');
  tb.updateMatrixWorld(true);
  const box = new Box3().setFromObject(tb), tz = lay.towerZ.map(z => z + RIVER_Z);
  check(tz[0] < RIVER_Z - 5 && tz[1] > RIVER_Z + 5 && lay.towerHeight >= 20, `Tower Bridge towers must stand on opposite Thames banks; found z=${tz.join(',')}`);
  check(Math.abs(tb.position.x - bridgeX) < 1e-6 && Math.abs(tb.position.z - RIVER_Z) < 1e-6, 'Tower Bridge must stay on the crossing centerline');
  check(box.max.y >= 33 && box.max.y <= 36, `Tower height envelope; got ${box.max.y}`);
  const opening = [tz[0] + 3, tz[1] - 3];
  check(boats.length === 7, `Expected seven Thames boats, all within the bridge opening in z; found ${boats.length}`);
  const styles = new Set(boats.map(boat => boat.userData.boatStyle));
  const signatures = [...styles].map(style => {
    const boat = boats.find(boat => boat.userData.boatStyle === style), counts = [];
    boat.traverse(o => { if (o.isMesh) counts.push(o.geometry.attributes.position.count); });
    return counts.sort((a, b) => a - b).join(',');
  });
  check(styles.size === 3 && ['launch', 'cruiser', 'service'].every(style => styles.has(style)), `Expected launch, cruiser, and service boat styles; found ${[...styles].join(',')}`);
  check(signatures.length === 3 && new Set(signatures).size === 3 && signatures.every(Boolean), 'Each boat style must have a distinct mesh position-count signature');
  check(box.min.z < RIVER_Z - 15 && box.max.z > RIVER_Z + 15, 'Road deck and abutments must span the river and reach both banks');
  const roadDeck = { y: lay.deckY };
  const boatBounds = boats.map(boat => new Box3().setFromObject(boat));
  const profiles = ['cruiser', 'launch', 'service'].map(style => Math.max(...boats.filter(boat => boat.userData.boatStyle === style).map(boat => new Box3().setFromObject(boat).max.y)));
  check(profiles[1] - profiles[0] >= .45 && profiles[2] - profiles[1] >= .45, `Boat profiles must rise cruiser < launch < service by at least 0.45m; got ${profiles.join(',')}`);
  check(boatBounds.every(b => b.min.z >= opening[0] && b.max.z <= opening[1]), 'All ambient boat hulls must fit between the towers');
  check(boatBounds.every(b => b.max.y < roadDeck.y), 'All ambient boats must clear the road deck vertically');
  check(lay.walkways === 2 && lay.walkwayZ === 0 && lay.pinnacles === 8, 'Two walkways between the towers and eight corner pinnacles');
  const mesh = n => tb.getObjectByName('towerbridge-' + n);
  check(mesh('mass') && mesh('trim') && mesh('glass'), 'Tower Bridge needs mass/trim/glass buckets');
  const clock = landmarkParts.details.getObjectByName('bigben-four-clock-faces');
  check(clock?.isInstancedMesh && clock.count === 4, 'Big Ben must build four clock faces through the real landmark builder');
  const face = clock.material.map.image, pixels = face.getContext('2d').getImageData(0, 0, 256, 256).data;
  const darkPixel = (x, y) => pixels[(y * 256 + x) * 4] < 150;
  check(darkPixel(90, 106) && darkPixel(187, 94), 'Rendered clock texture must contain the upper-left hour hand and upper-right minute hand for 10:10');
  check([darkPixel(128, 25), darkPixel(228, 128), darkPixel(128, 228), darkPixel(28, 128)].every(Boolean), 'Rendered clock texture must mark the four cardinal hours');
  const bigBen = pts[stops.findIndex(s => s.id === 'xdesign')];
  check(landmarkParts.details.getObjectByName('bigben-geometry')?.position.x === bigBen.x && landmarkParts.details.getObjectByName('bigben-geometry')?.position.z === RIVER_Z - 16,
    'Tower Bridge changes must leave Big Ben in its existing position');
  const glasgow = pts[stops.findIndex(s => s.id === 'glasgow')];
  const chambers = landmarkParts.details.getObjectByName('chambers-geometry'), statue = landmarkParts.details.getObjectByName('wellington-geometry');
  check(chambers?.position.x === glasgow.x && chambers.position.z === glasgow.z - 41 && chambers.children.length >= 3,
    'Glasgow must add the City Chambers geometry at its route stop');
  check(statue?.position.x === glasgow.x && statue.position.z === glasgow.z - 20 && statue.children.length >= 1,
    'Glasgow must add the Duke of Wellington statue geometry');
  // The old airport site is ordinary riverside: no heathrow-* objects, and the infill plots exist.
  let heathrowNamed = 0; landmarkParts.details.traverse(o => { if (/^heathrow/.test(o.name)) heathrowNamed++; });
  check(heathrowNamed === 0, 'no heathrow-* object may remain');
  const uk = pts[stops.findIndex(s => s.country === 'UK')];
  const sitePlots = []; buildCity(() => {}, stops, pts, curve, undefined, undefined, p => { if (Math.abs(p.x - uk.x) <= 18 && p.z >= -38 && p.z <= -14) sitePlots.push(p); });
  check(sitePlots.length >= 2, `old airport site needs >= 2 architecture plots, got ${sitePlots.length}`);
  return { pass: true, bridgeX, riverZ: RIVER_Z, towerZ: tz, boatOpening: opening, boatBounds: boatBounds.map(b => ({ minZ: b.min.z, maxZ: b.max.z, maxY: b.max.y })), clockFaces: clock.count, bigBenX: bigBen.x };
})()'''))
