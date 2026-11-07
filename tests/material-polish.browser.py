result=js(r'''(async()=>{
const T=await import('three'),{townhouseMaterials,SURFACE}=await import('./js/world/building-slice-materials.js'),{createWater}=await import('./js/world/water.js');const check=(v,m)=>{if(!v)throw Error(m)},m=townhouseMaterials();check(m.glass.userData.analyticReflection===true,'shared analytic glass');check(m.glass===townhouseMaterials().glass&&!m.glass.transparent&&m.glass.depthWrite,'opaque shared identity');const textures=new Set;for(const mat of Object.values(m))Object.values(mat).forEach(v=>{if(v?.isTexture)textures.add(v)});check(textures.size===4,'same four maps');const sh={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.glass.onBeforeCompile(sh);check(sh.uniforms.uGlassNight===m.glass.userData.uNight&&sh.fragmentShader.includes('glassReflection'),'night/reflection contract');check(sh.fragmentShader.includes('floor((vFloodP.x - b.x) / 1.5)')&&sh.fragmentShader.includes('floor(gridY / 3.0)')&&sh.fragmentShader.includes('step(0.98, r)')&&!sh.fragmentShader.includes('vec3(0.95, 0.97, 1.0)'),'Copan uses aligned apartment bays and sparse warm lobby panes');
const water=createWater({x0:0,x1:50,z:-45,width:22});check(water.mesh.geometry.index.count===6&&!water.mesh.material.transparent,'one opaque water plane');check(water.mesh.material.uniforms.uHalfWidth.value===11,'shore depth uses existing river width');water.update(2,.8);check(water.mesh.material.uniforms.uTime.value===2&&water.mesh.material.uniforms.uNight.value===.8,'existing animation/night API');check(water.mesh.material.fragmentShader.includes('mix(uShallow, uDeep,'),'continuous shore-depth water colour');
const {polishLandmarkMaterials}=await import('./js/world/landmark-materials.js'),{createBoxes,buildMeshes}=await import('./js/world/voxel.js'),{PALETTE:P}=await import('./js/world/palette.js'),{stops}=await import('./js/content.js'),{routePoints}=await import('./js/world/layout.js'),{buildLandmarks}=await import('./js/world/landmarks.js'),{buildCity}=await import('./js/world/city.js'),{routeCurve}=await import('./js/world/layout.js');const b=createBoxes(),rp=routePoints(stops.length);buildCity(b.add,stops,rp,routeCurve(T,rp));const landmarks=buildLandmarks(b.add,stops,rp),copanGlass=landmarks.details.getObjectByName('copan-geometry').getObjectByName('copan-glass').geometry;let lobbyVertices=0;for(let i=0;i<copanGlass.attributes.position.count;i++)if(copanGlass.attributes.position.getY(i)<3.2){lobbyVertices++;check(copanGlass.attributes.aSurface.getX(i)===SURFACE.glass,'Copan lobby glass must not use the lit-glass atlas surface');}check(lobbyVertices>0,'Copan lobby glass vertices');landmarks.details.getObjectByName('copan-geometry').userData.dispose();// production polishes the whole voxel world (city + landmarks)
const g=buildMeshes(b.list),before=g.children.map(o=>[o.count,Array.from(o.instanceMatrix.array)]),materials=g.children.map(o=>o.material);polishLandmarkMaterials(g,stops,routePoints(stops.length));check(g.children.some(o=>o.material.userData.landmarkFinish),'landmark finish applied');g.userData.updateLandmarkNight(.8);check(g.children.filter(o=>o.material.userData.uLandmarkNight).every(o=>o.material.userData.uLandmarkNight.value===.8),'landmark night control');check(JSON.stringify(before)===JSON.stringify(g.children.map(o=>[o.count,Array.from(o.instanceMatrix.array)]))&&materials.every((mat,i)=>mat===g.children[i].material),'landmark batches/matrices/material identities unchanged');return {pass:true,materials:2,maps:textures.size,waterTriangles:2,landmarkBatches:g.children.length};})()''')
print(result)
assert isinstance(result,dict) and result.get('pass'),result

facades = js(r'''(async () => {
  const T = await import('three');
  const { townhouseMaterials } = await import('./js/world/building-slice-materials.js');
  const city = townhouseMaterials(), landmark = townhouseMaterials({ landmark: true });
  const check = (ok, msg) => { if (!ok) throw Error(msg); };
  check(landmark === townhouseMaterials({ landmark: true }) && landmark.architecture !== city.architecture,
    'City weathering should have a separate cached material from monuments');
  check(landmark.glass === city.glass &&
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap'].every(k => city.architecture[k] === landmark.architecture[k]),
    'City and monuments should reuse every texture');
  const fragment = material => {
    const shader = { vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader, uniforms: {} };
    material.onBeforeCompile(shader);
    return shader.fragmentShader;
  };
  check(city.architecture.customProgramCacheKey() !== landmark.architecture.customProgramCacheKey() &&
    fragment(city.architecture).includes('facadeMoisture') && !fragment(landmark.architecture).includes('facadeMoisture'),
    'Dampness and masonry relief should be limited to the city material');
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(45, 1, .1, 10), renderer = new T.WebGLRenderer();
  const plane = new T.PlaneGeometry();
  plane.setAttribute('aSurface', new T.Float32BufferAttribute([1, 1, 1, 1], 1));
  plane.setAttribute('color', new T.Float32BufferAttribute(Array(12).fill(1), 3));
  scene.add(new T.Mesh(plane, city.architecture), new T.Mesh(plane, landmark.architecture));
  camera.position.z = 3;
  renderer.setSize(32, 32);
  renderer.render(scene, camera);
  const valid = renderer.info.programs.length === 2 && renderer.info.programs.every(p => p.diagnostics?.runnable !== false);
  plane.dispose();
  renderer.dispose();
  check(valid, 'Both facade materials must compile in WebGL');
  return true;
})()''')
assert facades
