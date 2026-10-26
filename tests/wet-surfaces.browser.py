# python3 -m http.server 8000; browser-harness < tests/wet-surfaces.browser.py
new_tab('about:blank')
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True)
goto_url('http://localhost:8000/?weather=clear')
wait_for_load()
result = js(r'''(async () => {
  const T = await import('three');
  const { untone } = await import('./js/world/sky.js');
  const { createWetSurfaces } = await import('./js/world/wet-surfaces.js');
  const { blockMaterial } = await import('./js/world/textures.js');
  const { townhouseMaterials } = await import('./js/world/building-slice-materials.js');
  const { PALETTE: P } = await import('./js/world/palette.js');
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const renderer = new T.WebGLRenderer({ antialias: false }); renderer.setSize(64, 64);
  const target = new T.WebGLRenderTarget(64, 64, {type:T.FloatType}), pixel = new Float32Array(4), shaders = new Map();
  const scene = new T.Scene(), otherScene = new T.Scene(), camera = new T.OrthographicCamera(-3, 3, 3, -3, .01, 100);
  scene.add(new T.HemisphereLight(0xffffff, 0x777777, 2));
  const sunlight = new T.DirectionalLight(0xffffff, 2); sunlight.position.set(4, 8, 4); scene.add(sunlight);
  const floor = blockMaterial(P.road), architecture = townhouseMaterials().architecture, roof = blockMaterial(P.roof);
  const originals = [floor, architecture, roof].map(material => ({material, before:material.onBeforeCompile, key:material.customProgramCacheKey}));
  for (const {material, before} of originals) material.onBeforeCompile = function(shader, renderer) { before.call(this, shader, renderer); shaders.set(this, shader); };
  const chained = [floor, architecture, roof].map(material => material.onBeforeCompile);
  const geometry = new T.BoxGeometry(6, .2, 6), floorMesh = new T.InstancedMesh(geometry, floor, 1);
  floorMesh.setMatrixAt(0, new T.Matrix4().makeTranslation(.75, 0, 0));
  floorMesh.position.x = -.75; scene.add(floorMesh);
  const atlasGeometry = new T.BoxGeometry(2, 2, 2), count = atlasGeometry.attributes.position.count;
  atlasGeometry.setAttribute('aSurface', new T.Float32BufferAttribute(new Float32Array(count).fill(2), 1));
  atlasGeometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  const atlas = new T.Mesh(atlasGeometry, architecture); atlas.position.set(8, 2, 0); scene.add(atlas);
  const roofMesh = new T.Mesh(geometry, roof); roofMesh.position.set(-8, 3, 0); scene.add(roofMesh);
  const excluded = [new T.MeshStandardMaterial({color:P.glass,name:'slice-glass'}), blockMaterial(P.grass), blockMaterial(P.road,{glow:true}), new T.MeshStandardMaterial({color:P.pave,transparent:true}), new T.MeshBasicMaterial({color:P.road})];
  const excludedHooks = excluded.map(m=>m.onBeforeCompile);
  for (const material of excluded) { const mesh = new T.Mesh(geometry, material); mesh.position.z = -20; scene.add(mesh); }
  const originalSceneHook = scene.onBeforeRender;
  const lamps = [[9,0],[1,0],[8,0],[2,0],[7,0],[3,0],[6,0],[4,0],[5,0],[10,0]];
  const mood = {zen:[.435,.694,.91],hor:[.725,.863,.961]}, bus = new T.Vector3(2, 0, 2);
  let wet, other;
  try {
    wet = createWetSurfaces(scene, {lamps});
    check(excluded.every((m,i)=>m.onBeforeCompile===excludedHooks[i]), 'glass/vegetation/emissive/transparent/basic material must stay untouched');
    wet.update(3, 1, 1, .8, new T.Vector3(), mood, bus, 0, 'high');
    camera.position.set(0, 8, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    renderer.compile(scene, camera);
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    check(shaders.has(floor) && shaders.has(architecture) && shaders.has(roof), 'standard and atlas shaders must really compile');
    check(renderer.info.programs.every(p=>p.diagnostics?.runnable !== false), 'wet shader failed WebGL linking');
    const shader = shaders.get(floor), atlasShader = shaders.get(architecture), u = shader.uniforms;
    check(shader.vertexShader.includes('wetPosition = instanceMatrix * wetPosition') && shader.vertexShader.indexOf('vec4 wetPosition') > shader.vertexShader.indexOf('#include <project_vertex>'), 'world varying must use transformed and instanced position after project_vertex');
    check(shader.fragmentShader.includes('diffuseColor *= texture2D(map, tuv)') && atlasShader.fragmentShader.includes('sliceSample'), 'existing block and metric-atlas shader hooks must remain intact');
    check(shader.fragmentShader.indexOf('diffuseColor.rgb *= 1.0 -') < shader.fragmentShader.indexOf('#include <lights_physical_fragment>'), 'wet albedo must darken before physical lighting');
    check(shader.fragmentShader.includes('smoothstep(0.45, 0.85, wetWorldNormal.y)') && shader.fragmentShader.includes('vWetWorld.y < 0.4'), 'only upward faces get wet, and only ground gets puddles');
    check(u.uWetLamps.value.map(v=>v.x).join(',')==='1,2,3,4', 'reflections must use actual nearest four lamps');
    check(u.uWetBus.value.equals(bus) && u.uWetHeading.value.equals(new T.Vector2(1,0)), 'headlights must track bus position and heading');
    const exactSky={zen:new T.Color(.1,.2,.3),hor:new T.Color(.3,.2,.1)};
    wet.update(3,1,1,.8,new T.Vector3(),exactSky,bus,0,'high');
    check(u.uWetSky.value.equals(exactSky.zen)&&u.uWetHorizon.value.equals(exactSky.hor),'production reflections must use exact final dome colours');
    wet.update(3,1,1,.8,new T.Vector3(),mood,bus,0,'high');
    const reference = untone(new T.Color().setRGB(...mood.zen,T.SRGBColorSpace).lerp(new T.Color('#0b1530'),.8));
    check(u.uWetSky.value.equals(reference), 'authored sky palette must match tone-inverted dome palette');
    const sample = (wetness, top) => {
      camera.position.set(0, top ? 8 : 0, top ? 0 : 10); camera.up.set(0, top ? 0 : 1, top ? -1 : 0); camera.lookAt(0,0,0); camera.updateMatrixWorld();
      wet.update(4,wetness,0,0,camera.position,mood,bus,0);
      renderer.render(scene,camera); renderer.readRenderTargetPixels(target,32,32,1,1,pixel); return Array.from(pixel);
    };
    const dryTop=sample(0,true), wetTop=sample(1,true), dryWall=sample(0,false), wetWall=sample(1,false);
    check(dryTop.slice(0,3).some((v,i)=>Math.abs(v-wetTop[i])>0.0001), 'rendered upward floor must respond to wetness: '+JSON.stringify({dryTop,wetTop}));
    check(dryWall.join()===wetWall.join(), 'rendered vertical face must remain dry');
    wet.update(9,0,1,1,camera.position,mood,bus,Math.PI/2,'low');
    check(u.uWet.value===0 && u.uWetHigh.value===0 && u.uWeatherTime.value===9, 'dry amount and tier downgrade must update without recompiling');
    const sharedMesh = new T.Mesh(geometry,floor); otherScene.add(sharedMesh);
    const singleHook = floor.onBeforeCompile;
    other = createWetSurfaces(otherScene,{reducedMotion:true});
    check(floor.onBeforeCompile===singleHook, 'shared cached materials must not get duplicate shader hooks');
    other.update(100, .4, 1, .2, camera.position, mood, bus,0,'medium');
    otherScene.onBeforeRender(renderer,otherScene,camera,target);
    check(u.uWet.value===.4 && u.uWeatherTime.value===0 && u.uWetAnimate.value===0 && u.uWetHigh.value===0, 'reduced motion must freeze rain normals and splash animation');
    scene.onBeforeRender(renderer,scene,camera,target);
    check(u.uWet.value===0 && u.uWeatherTime.value===9 && u.uWetAnimate.value===1, 'rendering another world must activate that world uniforms');
    wet.dispose(); wet.dispose();
    check(scene.onBeforeRender===originalSceneHook && floor.onBeforeCompile===singleHook, 'disposing one owner must restore scene hook and preserve the other owner');
    other.dispose();
    check(originals.every(({material,key},i)=>material.onBeforeCompile===chained[i] && material.customProgramCacheKey===key), 'last dispose must restore exact material hooks/cache keys');
    const rebuilt = createWetSurfaces(otherScene); rebuilt.dispose();
    check(floor.onBeforeCompile===chained[0], 'cached materials must register cleanly again after disposal');
    return {pass:true,programs:renderer.info.programs.length,dryTop,wetTop,dryWall,wetWall};
  } finally {
    wet?.dispose(); other?.dispose();
    for (const {material,before,key} of originals) {material.onBeforeCompile=before;material.customProgramCacheKey=key;material.needsUpdate=true;}
    renderer.setRenderTarget(null); target.dispose(); renderer.dispose(); geometry.dispose(); atlasGeometry.dispose();
    floor.dispose(); roof.dispose(); excluded.forEach(m=>m.dispose());
  }
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
