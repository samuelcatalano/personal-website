# browser-harness < tests/holes.browser.py (real Three.js, no timing thresholds)
import os

new_tab('about:blank')
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(os.environ.get('URL', 'http://localhost:8000/'))
wait_for_load()
result = js(r'''(async () => {
  const T = await import('three'), { cutHole } = await import('./js/world/holes.js?hole-test');
  const check = (value, message) => { if (!value) throw Error(message); };
  const scene = new T.Scene(), group = new T.Group();
  group.position.set(12, 0, -8); group.rotation.y = 0.35; scene.add(group);
  const ground = new T.MeshStandardMaterial(), far = new T.MeshStandardMaterial(), skipped = new T.MeshStandardMaterial();
  const stone = new T.MeshStandardMaterial(), upper = new T.MeshStandardMaterial(), disabled = new T.MeshStandardMaterial();
  const geometry = new T.BoxGeometry(1, 1, 1), batch = new T.InstancedMesh(geometry, ground, 3000), matrix = new T.Matrix4();
  for (let i = 0; i < batch.count; i++) {
    matrix.makeScale(1, 0.1, 1); matrix.setPosition(i < 12 ? (i % 6) - 2.5 : 200 + i, 0, i < 12 ? (i / 6 | 0) - 0.5 : 200);
    batch.setMatrixAt(i, matrix);
  }
  group.add(batch);
  const add = (material, x, y, z, parent = group) => { const mesh = new T.Mesh(geometry, material); mesh.position.set(x,y,z); parent.add(mesh); return mesh; };
  add(far, 500, 0, 500); add(stone, 0, -0.2, 0).scale.y = 0.1; add(upper, 0, 4, 0);
  const offLayer = add(disabled, 1, 0, 0); offLayer.scale.y = 0.1; offLayer.layers.set(1);
  const skip = new T.Group(); group.add(skip); add(skipped, 0, 0, 0, skip).scale.y = 0.1;
  const hole = { cx:12, cz:-8, ax:Math.cos(0.35), az:-Math.sin(0.35), hl:4, hw:3, top:0.1 };
  scene.updateMatrixWorld(true);
  // The original probe is the compatibility oracle: identical rays and strict height limits.
  const ray = new T.Raycaster(), from = new T.Vector3(), down = new T.Vector3(0,-1,0), expected = new Set(); ray.far = 60;
  const across = [...new Set([-hole.hw+0.15,hole.hw-0.15,...Array.from({length:Math.floor(2*hole.hw/1.2)},(_,k)=>-hole.hw+0.6+k*1.2),-3.85,3.85,-0.11,0.11].filter(c=>Math.abs(c)<hole.hw))];
  for(let s=-hole.hl+0.3;s<hole.hl;s+=1.5)for(const c of across){
    ray.set(from.set(hole.cx+hole.ax*s-hole.az*c,50,hole.cz+hole.az*s+hole.ax*c),down);
    for(const h of ray.intersectObjects(scene.children,true)){
      let own=false;for(let p=h.object;p;p=p.parent)if(p===skip)own=true;
      if(h.point.y>-1.5&&h.point.y<hole.top&&!own)for(const m of [h.object.material].flat())expected.add(m);
    }
  }
  let batchRaycasts=0, reads=0;
  const originalRaycast=batch.raycast, originalGet=batch.getMatrixAt;
  batch.raycast=function(...args){batchRaycasts++;return originalRaycast.apply(this,args);};
  batch.getMatrixAt=function(...args){reads++;return originalGet.apply(this,args);};
  const count=cutHole(scene,hole,[skip]);
  const materials=[ground,far,skipped,stone,upper,disabled], actual=materials.filter(m=>m.userData.holes);
  check(actual.length===expected.size&&actual.every(m=>expected.has(m)), 'same material selection as original ray probes');
  check(count===expected.size, 'preserve material count');
  check(batchRaycasts===0, 'avoid scanning every instance for every ray');
  check(reads<=batch.count, 'read each instance transform at most once per hole');
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>'};
  ground.onBeforeCompile(shader);
  check(shader.uniforms.holeCount.value===1&&shader.fragmentShader.includes('discard'), 'same clipping shader and shared hole uniforms');
  const second=cutHole(scene,{...hole,cx:hole.cx+1},[skip]);
  check(second>0&&shader.uniforms.holeCount.value===2&&shader.uniforms.holeA.value[1].x===hole.cx+1, 'shared materials keep both registered hole regions');
  return {pass:true,instances:batch.count,batchRaycasts,reads,materials:count};
})()''')
print(result)
