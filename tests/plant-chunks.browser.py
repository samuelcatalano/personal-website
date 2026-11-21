# Desktop local fixture: exact plant preservation and spatial culling.
print(js(r'''(async () => {
  const T = await import('three'), { buildMeshes } = await import('/js/world/voxel.js');
  const records = [-400, 0, 400].flatMap(x => ['grass', 'shrub'].flatMap(plant => Array.from({ length: 3 }, (_, i) => ({ plant, x: x + i, y: .1, z: 4, w: 1 + i / 10, h: .2 + i / 10, d: .8, tint: '#789456', yaw: i / 3 }))));
  const group = buildMeshes(records), batches = group.children, expected = new T.Matrix4(), actual = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const check = (ok, message) => { if (!ok) throw Error(message); };
  check(batches.length >= 6, 'Distant plant clusters must have independently culled batches');
  const seen = new Set();
  for (const mesh of batches) {
    check(mesh.boundingSphere && mesh.frustumCulled, 'Each batch needs bounds before the first render');
    check(mesh.receiveShadow && mesh.castShadow === (mesh.userData.plantKind !== 'grass'), 'Shadow roles must be preserved');
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, actual);
      const index = records.findIndex((r, j) => !seen.has(j) && r.plant === mesh.userData.plantKind && Math.abs(r.x - actual.elements[12]) < .001);
      check(index >= 0, 'No instances may be added or duplicated'); seen.add(index);
      const r = records[index];
      expected.compose(p.set(r.x, r.y, r.z), q.setFromAxisAngle(up, r.yaw), s.set(r.w, r.h, r.d));
      check(actual.elements.every((v, j) => Math.abs(v - expected.elements[j]) < 1e-5), 'Instance transform changed');
      const color = new T.Color(); mesh.getColorAt(i, color);
      check(color.toArray().every((v,j) => Math.abs(v-new T.Color(r.tint).toArray()[j])<1e-5), 'Instance tint changed');
    }
  }
  check(seen.size === records.length, 'No plants may be lost');
  for (const kind of ['grass', 'shrub']) {
    const meshes = batches.filter(m => m.userData.plantKind === kind);
    check(new Set(meshes.map(m => m.geometry)).size === 1 && new Set(meshes.map(m => m.material)).size === 1, 'Cells must share geometry and material');
  }
  group.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(40, 1, .1, 100); camera.position.set(0, 5, 20); camera.lookAt(0, 0, 4); camera.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const visible = batches.filter(m => frustum.intersectsObject(m));
  check(visible.length > 0 && visible.reduce((n,m) => n + m.count, 0) === 6, 'Off-camera clusters must be excluded without losing nearby plants');
  return { pass: true, plants: seen.size, batches: batches.length, visibleInstances: 6 };
})()'''))
