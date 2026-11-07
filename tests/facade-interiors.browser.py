result = js(r'''(async () => {
  const T = await import('three');
  const { addRoomCoordinates, roomGlassMaterial, townhouseMaterials, SURFACE } =
    await import('./js/world/building-slice-materials.js');
  const { createCityRollout } = await import('./js/world/city-rollout.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const source = new T.PlaneGeometry(1.8, 2.4), plane = source.toNonIndexed();
  source.dispose();
  const positions = [...plane.attributes.position.array];
  plane.setAttribute('aSurface', new T.Float32BufferAttribute(Array(6).fill(SURFACE.litGlass), 1));
  plane.setAttribute('color', new T.Float32BufferAttribute(Array(18).fill(1), 3));
  addRoomCoordinates(plane, 0, 0);
  const room = plane.getAttribute('aRoom');
  check(room.normalized && room.array instanceof Uint16Array && room.count === 6 &&
    room.getW(0) > 0 && room.getZ(0) === room.getZ(5), 'One packed room per pane');
  check(positions.every((n, i) => n === plane.attributes.position.array[i]), 'Preserve pane geometry');

  const irregular = plane.clone();
  irregular.attributes.position.setZ(2, .5);
  addRoomCoordinates(irregular, 0, 0);
  check(irregular.attributes.aRoom.getW(0) === 0, 'Nonplanar panes use the existing glass');
  irregular.dispose();

  const legacy = townhouseMaterials().glass, material = roomGlassMaterial();
  check(material !== legacy && material === roomGlassMaterial() && !material.transparent &&
    material.map === legacy.map && material.emissiveMap === legacy.emissiveMap &&
    material.userData.uNight === legacy.userData.uNight, 'Share atlas and lighting state');
  const city = createCityRollout([
    { id: 'room-test-terrace', kind: 'terrace', x: 7, z: 6, width: 7, depth: 9, height: 12 },
    { id: 'room-test-office', kind: 'office', x: 21, z: 6, width: 11, depth: 11, height: 18 },
  ]);
  const cell = city.children[0];
  check(cell.children.length === 3 && cell.children[2].material === material &&
    cell.userData.lods.every(lod => lod[2].attributes.aRoom.array.some((n, i) => i % 4 === 3 && n > 0)),
    'Both LODs carry room coordinates in the existing glass bucket');
  city.userData.dispose();
  const renderer = new T.WebGLRenderer(), scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, .1, 120);
  const target = new T.WebGLRenderTarget(64, 64), mesh = new T.Mesh(plane, material);
  const night = material.userData.uNight, original = night.value;
  scene.add(mesh);
  renderer.setRenderTarget(target);
  const sample = (x, z) => {
    camera.position.set(x, 0, z);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    const out = new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 32, 32, 1, 1, out);
    return [...out.slice(0, 3)];
  };
  try {
    night.value = 1;
    const face = sample(0, 3), angle = sample(2.8, 2.2);
    check(face.some((v, i) => Math.abs(v - angle[i]) >= 5), 'Oblique view reveals different interior surfaces');
    mesh.material = legacy;
    const flat = sample(0, 3);
    check(face.some((v, i) => Math.abs(v - flat[i]) >= 5), 'Interior is visible behind the glass');
    const farFlat = sample(0, 88);
    mesh.material = material;
    const far = sample(0, 88);
    check(far.every((v, i) => Math.abs(v - farFlat[i]) <= 1), 'Distant rooms blend back to the flat reflection');
    check(renderer.info.programs.every(p => p.diagnostics?.runnable !== false), 'Both glass shaders must compile');
    return { face, angle, flat };
  } finally {
    night.value = original;
    renderer.dispose();
    target.dispose();
    plane.dispose();
  }
})()''')
print(result)
