# browser-harness < tests/trees.browser.py (local preview)
print(js(r'''(async () => {
  const T = await import('three');
  const { createTrees } = await import('./js/world/trees.js');
  const { buildCity } = await import('./js/world/city.js');
  const { buildLandmarks } = await import('./js/world/landmarks.js');
  const { PALETTE: P } = await import('./js/world/palette.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const { stops } = await import('./js/content.js');
  const { walkPaths } = await import('./js/world/crowd.js');
  const pts = routePoints(stops.length), placements = [], boxes = [];
  const collect = (x,z,shape) => placements.push({x,z,...shape});
  const add = (...b) => boxes.push(b);
  buildCity(add, stops, pts, routeCurve(T,pts), collect);
  buildLandmarks(add, stops, pts, collect);
  let expected = 0;
  const countTrunk = (...b) => { if (b[6] === P.trunk) expected++; };
  buildCity(countTrunk, stops, pts, routeCurve(T,pts)); buildLandmarks(countTrunk, stops, pts);
  const mesh = await createTrees(placements), check = (ok, msg) => { if (!ok) throw Error(msg); };
  check(mesh.isInstancedMesh && mesh.count === placements.length && mesh.count === expected, 'all trees must share one instanced mesh');
  check(!boxes.some(b => b[6] === P.trunk), 'voxel trees remain');
  check(mesh.castShadow && mesh.receiveShadow && mesh.customDepthMaterial.alphaTest === mesh.material.alphaTest, 'foliage shadow must use alpha');
  const camera = new T.PerspectiveCamera(), m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), scale = new T.Vector3();
  const heights = new Set(), rects = mesh.geometry.getAttribute('aRect'), variants = new Set();
  for (const x of [-260,435,800]) {
    camera.position.set(x,35,35); mesh.userData.update(camera);
    placements.forEach((original,i) => {
      mesh.getMatrixAt(i,m); m.decompose(p,q,scale);
      check(Math.abs(p.x-original.x)<1e-4 && Math.abs(p.z-original.z)<1e-4, 'tree position changed');
      check(scale.x <= original.crown + 1e-5, 'crown grows into paths');
      check(p.y+scale.y <= Math.min((original.base ?? .1)+4.4, original.h+1.2+(original.base ?? .1)), 'tree grows above landmark clearance');
      check(p.y >= 0, 'tree sinks below paving');
      const v=rects.getY(i), vh=rects.getW(i);
      check(v>=0 && v+vh<.5, 'a pine sprite is selected');
      variants.add(rects.getX(i)); heights.add(scale.y.toFixed(2));
      const facing=new T.Vector3(0,0,1).applyQuaternion(q), target=new T.Vector3(x-p.x,0,35-p.z).normalize();
      check(facing.dot(target)>.9999, 'tree does not face camera');
    });
  }
  check(heights.size>20 && variants.size===2, 'rounded trees need varied heights');
  let samples = 0;
  for (const path of walkPaths(stops,pts).filter(p => p.type !== 'lane')) {
    const {x0,x1,z0,z1}=path.rect;
    const lo=path.type === 'loop' ? .6 : .35;
    const hi=path.type === 'loop' ? 1.6 : Math.max(.35,Math.min(6,(Math.min(x1-x0,z1-z0)-1)/2));
    const near=placements.filter(p => p.x+p.crown/2>x0 && p.x-p.crown/2<x1 && p.z+p.crown/2>z0 && p.z-p.crown/2<z1);
    const probe=(x,z) => {
      samples++;
      check(!near.some(p => Math.hypot(x-p.x,z-p.z)<p.crown/2+.22), 'tree canopy enters walking path '+path.name);
    };
    for(const inset of [lo,(lo+hi)/2,hi]) {
      for(let x=x0+inset;x<x1-inset;x+=.4) {probe(x,z0+inset);probe(x,z1-inset);}
      for(let z=z0+inset;z<z1-inset;z+=.4) {probe(x0+inset,z);probe(x1-inset,z);}
    }
  }
  const texture=mesh.material.map;
  check(texture.image.width===1254 && texture.image.height===1254, 'atlas layout changed; update UV rectangles');
  mesh.geometry.dispose(); mesh.customDepthMaterial.dispose(); mesh.material.dispose(); texture.dispose();
  return {pass:true, trees:placements.length, roundedVariants:variants.size, heights:heights.size, drawBatches:1, pathSamples:samples};
})()'''))
