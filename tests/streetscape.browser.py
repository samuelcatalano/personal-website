# browser-harness < tests/streetscape.browser.py
new_tab('about:blank');cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
goto_url('http://localhost:8000/tests/fixtures/npc-stage.html?kit=off&kits=shop,midrise');wait_for_load()
print(js(r'''(async()=>{
 const T=await import('three'),{createCityRollout}=await import('../../js/world/city-rollout.js'),{buildProps}=await import('../../js/world/street-props-mesh.js'),{buildMeshes}=await import('../../js/world/voxel.js'),{createShopSpill}=await import('../../js/world/shop-spill.js'),{streetEnvironment}=await import('../../js/world/streetscape-state.js'),{createAuthoredTrees}=await import('../../js/world/authored-trees.js');
 const check=(v,m)=>{if(!v)throw Error(m)},errors=[],old=console.error;console.error=(...a)=>{errors.push(a.map(String).join(' '));old(...a)};
 const plots=[{id:'test-shop',kind:'shop',archetype:'wraparound-shop',x:0,z:0,width:10,depth:10,height:7},{id:'test-midrise',kind:'midrise',x:12,z:0,width:10,depth:10,height:12}];
 const source=JSON.stringify(plots),city=createCityRollout(plots);check(JSON.stringify(plots)===source,'lot data changed');
 let moving=0,staticVertices=0;
 city.traverse(m=>{if(!m.isMesh)return;check(m.geometry.attributes.aFlutter.count===m.geometry.attributes.position.count,'mixed buckets lost awning weights');for(const v of m.geometry.attributes.aFlutter.array){check(v>=0&&v<=1,'invalid weight');if(v>0)moving++;else staticVertices++;}});
 check(staticVertices>moving&&moving>0,'movement must stay limited to awnings');
 const props=buildProps([{kind:'cafe',x:-4,y:.1,z:8,yaw:0,r:1}]);
 props.getObjectByName('prop-cafe').geometry.computeBoundingBox();const cb=props.getObjectByName('prop-cafe').geometry.boundingBox;
 check(cb.min.x>=-.851&&cb.max.x<=.851&&cb.min.z>=-.501&&cb.max.z<=.501,'cafe objects exceed validated footprint');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1.5,.1,300);camera.position.set(15,10,25);camera.lookAt(5,1,0);camera.updateMatrixWorld();scene.add(city,props,new T.HemisphereLight(0xffffff,0x333333,3));
 scene.add(buildMeshes([{x:5,y:0,z:0,w:40,h:.1,d:35,color:'#b9ad98'}]));
 const renderer=new T.WebGLRenderer();renderer.setSize(900,600);const {initGlbLoader}=await import('../../js/world/glb-loader.js');await initGlbLoader(renderer);
 const trees=await createAuthoredTrees([{x:-7,z:0,base:.1,h:3,crown:3}]);scene.add(trees);trees.userData.update(camera,4);check(streetEnvironment.time.value===4,'authored trees ignore shared clock');trees.userData.update({position:new T.Vector3(1000,20,0)},4);for(const b of trees.userData.batches){const m=b.lods[2],padded=m.boundingSphere.radius;m.computeBoundingSphere();check(padded>=m.boundingSphere.radius+.05,'impostor reculling loses wind clearance');m.boundingSphere.radius=padded;}trees.userData.update(camera,4);
 const spill=createShopSpill(scene,[{x:0,z:4.8,width:5}],[]),mesh=scene.getObjectByName('shop-pavement-spill');spill.update(0,0);check(!mesh.visible,'daylight spill');spill.update(1,0);const dry=mesh.material.opacity;check(mesh.visible&&dry>0,'night spill');spill.update(1,1);check(mesh.material.opacity<dry,'wet spill energy');
 const {upgradeFacadeKits}=await import('../../js/world/facade-kit.js');const kits=await upgradeFacadeKits(city,plots,plots);city.userData.update(camera);check(kits.shops===1&&kits.midrises===1&&kits.chunks===1,'authored kit upgrade coverage');city.traverse(m=>{if(m.isMesh)check(m.geometry.attributes.aFlutter.count===m.geometry.attributes.position.count,'authored kit merge lost awning weights')});
 renderer.compile(scene,camera);renderer.render(scene,camera);await new Promise(r=>setTimeout(r,200));check(!errors.length,errors.join('\n'));check(renderer.getContext().getError()===0,'WebGL error');
 const result={pass:true,moving,staticVertices,kits,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:renderer.info.programs.length};
 renderer.domElement.style.cssText='position:fixed;inset:0;width:900px;height:600px';document.body.append(renderer.domElement);
 globalThis.__streetscapeReview={scene,camera,renderer};spill.dispose();check(!scene.getObjectByName('shop-pavement-spill'),'spill disposal');console.error=old;return result;
})()'''))
capture_screenshot('/tmp/scenery-review/detail-stage.png')
