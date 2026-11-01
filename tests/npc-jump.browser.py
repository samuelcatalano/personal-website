# browser-harness < tests/npc-jump.browser.py (local preview; real Three.js and NPC GLB)
import os

URL = os.environ.get('URL', 'http://localhost:8000/').split('?', 1)[0]
tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Emulation.setDeviceMetricsOverride', width=1280, height=800, deviceScaleFactor=1, mobile=False)

for reduced in (False, True):
    cdp('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce' if reduced else 'no-preference'}])
    goto_url(URL)
    wait_for_load()
    result = js(r'''(async () => {
      const THREE = await import('three');
      const { createPeople } = await import('./js/world/people.js');
      const { createNpc3d } = await import('./js/world/npc3d.js');
      const { stops } = await import('./js/content.js');
      const { routePoints, routeCurve } = await import('./js/world/layout.js');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scene = new THREE.Scene(), pts = routePoints(stops.length), curve = routeCurve(THREE, pts);
      const people = createPeople(scene, { curve, pts, stops, reducedMotion: reduced });
      const original = new Set(scene.children);
      const npc = await createNpc3d(scene, { curve, pts, stops, count: 24 });
      const shadow = scene.getObjectByName('npc3d-shadow');
      if (!shadow || people.meshes[0].visible) throw Error('NPC GLB did not load and install');
      const walkers = scene.children.filter(o => !original.has(o) && o !== shadow);
      if (walkers.length !== 24) throw Error('expected 24 real NPC walkers');
      const camera = new THREE.PerspectiveCamera();
      const moveCamera = t => {
        const p = curve.getPointAt(t), ahead = curve.getPointAt(t + 0.001);
        camera.position.set(p.x, 5, p.z); camera.lookAt(ahead.x, 5, ahead.z); camera.updateMatrixWorld();
      };
      const snapshot = () => walkers.filter(w => w.visible).map(w => [w.position.x, w.position.z]);
      const checkNearSprites = positions => {
        const a = people.meshes[0].instanceMatrix.array;
        if (!positions.length) throw Error('no NPCs visible after camera update');
        for (const [x, z] of positions) {
          let distance = Infinity;
          for (let i = 0; i < people.count; i++) if (a[i * 16] !== 0)
            distance = Math.min(distance, Math.hypot(x - a[i * 16 + 12], z - a[i * 16 + 14]));
          if (distance > 0.01) throw Error(`NPC is not at a visible sprite position: ${distance}`);
        }
      };
      const dt = reduced ? 0.5 : 0;
      moveCamera(0.1); people.update(dt, camera.position); npc.update({ camera, dt });
      const before = snapshot(); checkNearSprites(before);
      const firstCamera = camera.position.clone();
      moveCamera(0.8);
      if (camera.position.distanceTo(firstCamera) <= 280) throw Error('chosen camera positions do not make a large jump');
      people.update(dt, camera.position); npc.update({ camera, dt });
      const after = snapshot(); checkNearSprites(after);
      if (after.some(([x, z]) => Math.hypot(x - camera.position.x, z - camera.position.z) > 140.01))
        throw Error('NPC retained outside the sprite visibility radius after the jump');
      return { reduced, dt, before: before.length, after: after.length, cameraJump: camera.position.distanceTo(firstCamera) };
    })()''')
    assert result['reduced'] == reduced, 'media emulation did not take effect'
    print(result)

cdp('Emulation.setEmulatedMedia', features=[])
print({'pass': True, 'scenarios': ['dt=0 camera jump', 'reduced-motion camera jump']})
