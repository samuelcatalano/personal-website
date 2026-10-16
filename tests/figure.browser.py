# browser-harness < tests/figure.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
print(js(r'''(async () => {
  const THREE = await import('three');
  const { buildFigure } = await import(`./js/world/figure.js?test=${Date.now()}`);
  const check = (ok, message) => { if (!ok) throw Error(message); };
  let ready = false;
  const figure = buildFigure(() => { ready = true; });
  const body = figure.getObjectByName('memoji');
  check(figure.isGroup && body?.isMesh && body.geometry.type === 'PlaneGeometry', 'figure must be a Group with a Memoji plane');
  figure.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  const aspect = size.x / size.y;
  check(Math.abs(box.min.y) < 0.01, `feet must be on the ground: ${box.min.y}`);
  check(size.y > 2.1 && size.y < 2.3, `human height expected, got ${size.y}m`);
  check(Math.abs(aspect - 204 / 512) < 0.02, `aspect must match the cut-out: ${aspect}`);
  const material = body.material;
  for (let i = 0; i < 40 && !material.map?.image; i++) await new Promise(resolve => setTimeout(resolve, 50));
  const image = material.map?.image;
  check(image, 'Memoji texture should load');
  check(ready, 'figure should signal when its texture is ready');
  check(image.width === 204 && image.height === 512, `unexpected image size ${image.width}x${image.height}`);
  check(material.alphaTest >= 0.3, 'cut-out needs alphaTest');
  check(body.castShadow === false, 'billboard must not cast a shadow');
  const ctx = Object.assign(document.createElement('canvas'), { width: 204, height: 512 }).getContext('2d');
  ctx.drawImage(image, 0, 0);
  check(ctx.getImageData(0, 0, 1, 1).data[3] === 0, 'corner must be transparent');
  check(ctx.getImageData(102, 300, 1, 1).data[3] === 255, 'torso must be opaque');
  const normal = () => new THREE.Vector3(0, 0, 1).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()));
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(10, 5, 0);
  body.onBeforeRender(null, null, cam);
  check(normal().x > 0.99, 'must face a camera on +X');
  cam.position.set(0, 5, 10);
  body.onBeforeRender(null, null, cam);
  check(normal().z > 0.99, 'must face a camera on +Z');
  check(figure.getObjectByName('memoji-shadow'), 'soft shadow disc is missing');
  return { pass: true, size: size.toArray(), aspect, image: [image.width, image.height] };
})()'''))
