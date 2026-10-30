# With the local preview open: browser-harness < tests/beams.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildVehicle } = await import('./js/world/vehicles.js');
  const { addBeams, refitBeams } = await import('./js/world/beams.js?beam-refit-test');
  const car = buildVehicle('sedan'); addBeams(car, car.userData.front, car.userData.beamY);
  car.updateMatrixWorld(true); const tail = car.children.filter(c => c.name === 'beam').at(-1), tailX = tail.getWorldPosition(new THREE.Vector3()).x;
  const assertTailBounds = () => {
    const glows = tail.children.map(mesh => new THREE.Box3().setFromObject(mesh));
    if (!glows.every(box => box.min.x >= tailX - 0.7 && box.max.x <= tailX + 0.16)) throw Error(`tail road glow must stay under the rear lamps: ${glows.map(box => [box.min.x, box.max.x])}`);
    return glows;
  };
  const glows = assertTailBounds(); tail.userData.swell(2.4); assertTailBounds();
  const anchors = { front: [[2.1, 0.72, -0.58], [2.1, 0.72, 0.58]], rear: [[-2.05, 0.9, -0.52], [-2.05, 0.9, 0.52]] };
  const anchored = buildVehicle('sedan'); addBeams(anchored, anchored.userData.front, anchored.userData.beamY); Object.assign(anchored.userData, { front: 2.1, beamY: 0.72, beamAnchors: anchors }); refitBeams(anchored); anchored.updateMatrixWorld(true);
  const point = anchored.children.filter(c => c.name === 'beam').at(0).children.find(c => c.isPoints), positions = point.geometry.attributes.position, actual = [];
  for (let i = 0; i < positions.count; i++) actual.push(point.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)).toArray());
  const expected = [...anchors.front, ...anchors.rear];
  if (actual.some((p, i) => new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...expected[i])) > 1e-4)) throw Error(`tail and head glows must use asset anchors: ${JSON.stringify(actual)}`);
  return { pass: true, glows: glows.map(box => [box.min.x, box.max.x]), anchored: actual };
})()'''))
