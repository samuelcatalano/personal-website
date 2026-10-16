# browser-harness < tests/figure.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildFigure } = await import(`./js/world/figure.js?test=${Date.now()}`);
  let faceReady = false;
  const figure = buildFigure(() => { faceReady = true; });
  figure.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(figure);
  const size = bounds.getSize(new THREE.Vector3());
  const check = (ok, message) => { if (!ok) throw Error(message); };
  check(Math.abs(bounds.min.y) < 0.03, `figure must stand on the ground: ${bounds.min.y}`);
  check(size.y >= 2 && size.y <= 2.2, `figure should be human scale, got ${size.y}m`);
  check(size.x > 0.8 && size.x < 1.3, `figure width is implausible: ${size.x}m`);
  check(size.z > 0.4 && size.z < 0.9, `figure depth is implausible: ${size.z}m`);
  check(figure.children.length >= 9, 'figure needs separate body parts');
  check(figure.children.every(o => Number.isFinite(o.position.x + o.position.y + o.position.z)), 'figure parts must have finite positions');
  const head = figure.getObjectByName('head');
  check(head?.isMesh && head.scale.y * 2 / size.y >= 0.28, 'large 3D head must be present');
  check(figure.getObjectByName('face')?.geometry.type === 'SphereGeometry', 'head needs a rounded Memoji surface');
  check(figure.children.every(o => !o.isMesh || o.geometry.getAttribute('position').array.every(Number.isFinite)), 'figure geometry must be finite');
  check(!figure.children.some(o => o.isSprite), 'figure head must have volume');
  const face = figure.getObjectByName('face');
  for (let i = 0; i < 30 && !face.material.map; i++) await new Promise(resolve => setTimeout(resolve, 50));
  check(face.material.map?.image?.width === 280 && face.material.map.image.height === 280, 'existing Memoji should load onto the 3D face');
  check(faceReady, 'figure should signal when its face texture is ready');
  return { pass: true, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, size: size.toArray(), visibleParts: figure.children.length, head: { type: head.geometry.type, scale: head.scale.toArray() } };
})()'''))
