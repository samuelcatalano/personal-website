# browser-harness < tests/figure.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildFigure } = await import(`./js/world/figure.js?test=${Date.now()}`);
  const figure = buildFigure();
  figure.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(figure);
  const size = bounds.getSize(new THREE.Vector3());
  const check = (ok, message) => { if (!ok) throw Error(message); };
  check(Math.abs(bounds.min.y) < 0.03, `figure must stand on the ground: ${bounds.min.y}`);
  check(size.y >= 1.9 && size.y <= 2.2, `figure should be human scale, got ${size.y}m`);
  check(size.x > 0.8 && size.x < 1.3, `figure width is implausible: ${size.x}m`);
  check(size.z > 0.4 && size.z < 0.9, `figure depth is implausible: ${size.z}m`);
  check(figure.children.length >= 9, 'figure needs separate body parts');
  check(figure.children.every(o => Number.isFinite(o.position.x + o.position.y + o.position.z)), 'figure parts must have finite positions');
  const head = figure.children.find(o => o.isSprite);
  check(head?.material.map, 'identity avatar head must be present');
  await new Promise(resolve => setTimeout(resolve, 300));
  const texture = head.material.map;
  check(texture?.image?.width === 280 && texture.image.height === 280, 'avatar should load through the head crop');
  return { pass: true, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, size: size.toArray(), visibleParts: figure.children.length };
})()'''))
