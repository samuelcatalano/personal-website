# browser-harness < tests/landmarks.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildLandmarks } = await import(`./js/world/landmarks.js?test=${Date.now()}`);
  const { createAmbient } = await import('./js/world/ambient.js');
  const { stops } = await import('./js/content.js');
  const { routePoints, RIVER_Z } = await import('./js/world/layout.js');
  const { CatmullRomCurve3, Vector3, Scene, Box3 } = THREE;
  const pts = routePoints(stops.length), bridgeX = pts[stops.findIndex(stop => stop.id === 'tribal')].x;
  const curve = new CatmullRomCurve3(pts.map(p => new Vector3(p.x, 0, p.z))), ambientScene = new Scene();
  createAmbient(ambientScene, { curve, pts, stops });
  ambientScene.updateMatrixWorld(true);
  const boats = ambientScene.children.filter(o => o.isGroup && o.position.y === 0.1 && Math.abs(o.position.z - RIVER_Z) <= 5.1);
  const boxes = [];
  buildLandmarks((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, pts);
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const nearBridge = boxes.filter(b => Math.abs(b.x - bridgeX) < 17 && Math.abs(b.z - RIVER_Z) < 19);
  const towers = nearBridge.filter(b => b.h >= 20 && b.w >= 5 && b.d >= 5);
  const towerZ = towers.map(b => b.z).sort((a, b) => a - b);
  check(towerZ.length >= 2 && towerZ[0] < RIVER_Z - 5 && towerZ.at(-1) > RIVER_Z + 5,
    `Tower Bridge towers must stand on opposite Thames banks; found z=${towerZ.join(',')}`);
  check(towers.every(b => Math.abs(b.x - bridgeX) < 1), 'Tower Bridge towers must share the crossing centerline');
  const opening = [towerZ[0] + Math.max(...towers.map(b => b.d)) / 2, towerZ.at(-1) - Math.max(...towers.map(b => b.d)) / 2];
  check(boats.length === 3, `Expected all three ambient boats at the bridge; found ${boats.length}`);
  const deck = nearBridge.filter(b => b.y >= 3 && b.y <= 5 && b.h < 2 && b.d > 20);
  const roadDeck = deck.find(b => b.w === 6);
  check(roadDeck && roadDeck.z - roadDeck.d / 2 < RIVER_Z - 11 && roadDeck.z + roadDeck.d / 2 > RIVER_Z + 11,
    'Road deck must continuously span the river and reach both banks');
  const abutments = nearBridge.filter(b => b.y === 0 && b.h === 4 && b.color === '#d8c08a' && Math.abs(b.x - bridgeX) < 1);
  check(abutments.some(b => b.z < RIVER_Z - 11) && abutments.some(b => b.z > RIVER_Z + 11),
    'Bridge must have grounded abutments on both banks');
  check(abutments.every(b => b.y + b.h === roadDeck.y && Math.abs(b.x - roadDeck.x) < (b.w + roadDeck.w) / 2),
    'Grounded abutments must touch the deck underside within its footprint');
  const boatBounds = boats.map(boat => new Box3().setFromObject(boat));
  check(boatBounds.every(b => b.min.z >= opening[0] && b.max.z <= opening[1]), 'All ambient boat hulls must fit between the towers');
  check(boatBounds.every(b => b.max.y < roadDeck.y), 'All ambient boats must clear the road deck vertically');
  check(nearBridge.filter(b => b.y === 19 && b.color === '#6b8fb5').every(b => b.d === 13), 'High walkways must reach the shifted tower inner faces');
  const bigBen = pts[stops.findIndex(s => s.id === 'xdesign')];
  check(boxes.some(b => b.x === bigBen.x && b.z === RIVER_Z - 16 && b.w === 5 && b.h === 18 && b.d === 5),
    'Tower Bridge changes must leave Big Ben in its existing position');
  return { pass: true, bridgeX, riverZ: RIVER_Z, towerZ, boatOpening: opening, boatBounds: boatBounds.map(b => ({ minZ: b.min.z, maxZ: b.max.z, maxY: b.max.y })), deck: deck.map(({ z, d }) => ({ z, d })), abutmentZ: abutments.map(b => b.z), bigBenX: bigBen.x };
})()'''))
