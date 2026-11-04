# With the local preview open: browser-harness < tests/vehicle-fade.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
  const THREE = await import('three');
  const { fadeVehicle, disposeFade } = await import('./js/world/fade.js');
  const { addBeams, refitBeams, updateBeams } = await import('./js/world/beams.js');
  const { adoptVisual, reskinBus } = await import('./js/world/vehicle-assets.js');
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const body = () => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial()); mesh.userData.role = 'BusBody'; mesh.castShadow = true; return mesh; };
  const vehicle = new THREE.Group(), other = new THREE.Group(), old = body(), otherBody = body();
  vehicle.name = 'bus'; vehicle.add(old); other.add(otherBody);
  reskinBus(vehicle, 'london'); reskinBus(other, 'glasgow');
  addBeams(vehicle, 2); addBeams(other, 2); updateBeams(1);
  const oldPaint = old.material, otherPaint = otherBody.material;
  const otherPool = other.children.find(c => c.name === 'beam');
  const sharedPool = otherPool.material, sharedGlow = otherPool.children.find(c => c.isPoints).material;
  fadeVehicle(vehicle, 0.5);
  const replacement = new THREE.Group(), newBody = body(); replacement.add(newBody);
  reskinBus(replacement, 'london');
  adoptVisual(vehicle, replacement, ['beam']);
  check(!old.parent && newBody.material !== oldPaint && near(newBody.material.opacity, 0.5), 'replacement inherits active fade');
  check(!newBody.castShadow && oldPaint.opacity === 1, 'fade preserves shared paint and disables shadow');
  Object.assign(vehicle.userData, { front: 2.2, beamY: 0.7, fleetModel: 'test', beamAnchors: { front: [[2.2, 0.7, -0.6], [2.2, 0.7, 0.6]], rear: [[-2, 0.7, -0.6], [-2, 0.7, 0.6]] } });
  const oldBeams = vehicle.children.filter(c => c.name === 'beam');
  refitBeams(vehicle);
  const beams = vehicle.children.filter(c => c.name === 'beam'), pool = beams[0], glow = pool.children.find(c => c.isPoints);
  check(oldBeams.every(b => !b.parent) && beams.length === 2, 'refit replaces beams');
  check(pool.material !== sharedPool && near(pool.material.opacity, sharedPool.opacity * 0.5), 'new pool inherits fade');
  check(glow.material !== sharedGlow && near(glow.material.uniforms.uOp.value, sharedGlow.uniforms.uOp.value * 0.5), 'new glow shader inherits fade');
  check(near(pool.position.x, 1.9) && beams[1].position.x === -2, 'refit uses new anchors');
  reskinBus(vehicle, 'glasgow');
  check(newBody.material !== otherPaint && near(newBody.material.opacity, 0.5) && newBody.material.color.equals(otherPaint.color), 'reskin keeps new paint faded');
  check(otherBody.material === otherPaint && otherPaint.opacity === 1 && near(sharedPool.opacity, 0.16) && near(sharedGlow.uniforms.uOp.value, 0.8), 'shared materials remain unchanged');
  fadeVehicle(vehicle, 1);
  check(newBody.material === otherPaint && newBody.castShadow, 'fade completion restores new shared paint and shadow');
  check(pool.material === sharedPool && glow.material === sharedGlow, 'fade completion restores beam materials');
  disposeFade(vehicle);
  return { pass: true };
})()'''))
