# Same-origin browser fixture. Verifies actual geometry, material isolation and rendered room layers.
result = js(r'''(async()=>{
 const T=await import('three'),{townhouseMaterials,roomGlassMaterial}=await import('./js/world/building-slice-materials.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const ordinary=townhouseMaterials(),landmark=townhouseMaterials({landmark:true});
 check(ordinary.architecture.map!==landmark.architecture.map,'Ordinary finish still changes landmark atlas');
 check(ordinary.architecture.map.image.width===1024&&landmark.architecture.map.image.width===512,'Ordinary texture resolution/legacy isolation lost');
 const hashes={};
 for(const k of ['map','normalMap','roughnessMap']){
  const t=landmark.architecture[k],d=t.image.getContext('2d').getImageData(0,0,512,512).data;let h=2166136261;
  for(const n of d)h=Math.imul(h^n,16777619)>>>0;hashes[k]=h;
 }
 check(hashes.map===1485052815&&hashes.normalMap===4103241495&&hashes.roughnessMap===3868138199,'Landmark atlas pixels changed');
 const legacyShader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 landmark.architecture.onBeforeCompile(legacyShader);
 check(legacyShader.fragmentShader.includes('smoothstep(6.3, 14.0,')&&!legacyShader.fragmentShader.includes('float spandrel='),'Ordinary shader finish leaked into landmark');
 const {finishArchitecture,finishLegacyBuilding}=await import('./js/world/building-finish.js'),{building}=await import('./js/world/city-rollout.js');
 const plot={id:'finish-fixture',kind:'terrace',x:0,z:0,width:7,depth:9,height:12};
 const group=building(plot,'townhouse',[plot]),geometries=group.children.map(m=>m.geometry);
 const before=geometries[1].attributes.position.count,glass=geometries[2].attributes.position.array.slice();
 check(geometries[1].userData.constructionFinish,'Construction finish did not reach ordinary assembly');
 check([...geometries[1].attributes.normal.array].some(v=>Math.abs(v)>.05&&Math.abs(v)<.95),'Profiles have no actual beveled normals');
 finishArchitecture(geometries,plot,'townhouse',group.userData.recipe);
 check(geometries[1].attributes.position.count===before,'Repeated finish duplicates construction');
 check(glass.every((v,i)=>v===geometries[2].attributes.position.array[i]),'Finish changed glazing/openings');
 check(group.children.length===3,'Finish creates individual detail meshes');
 for(const g of geometries)for(const a of Object.values(g.attributes))check(a.count===g.attributes.position.count,'Attribute count mismatch');
 const added=geometries[1].attributes.position;
 for(let i=geometries[1].userData.constructionStart;i<added.count;i++)check(Math.abs(added.getX(i))<=plot.width/2&&Math.abs(added.getZ(i))<=plot.depth/2&&added.getY(i)>0&&added.getY(i)<=plot.height,'New construction exceeds plot');
 const {addRoomCoordinates}=await import('./js/world/building-slice-materials.js');addRoomCoordinates(geometries[2],0,0);group.children[2].material=roomGlassMaterial();
 const bayPlot={...plot,id:'london-bay-finish',x:100,archetype:'london-bay-terrace'},bay=building(bayPlot,'townhouse',[bayPlot]),bg=bay.children[1].geometry,br=bay.userData.recipe;
 for(let i=bg.userData.constructionStart;i<bg.attributes.position.count;i++)if(bg.attributes.position.getY(i)>br.eaves)
  check(Math.abs(bg.attributes.position.getZ(i))<=(bayPlot.depth-.5)/2-.02+.0001,'Bay terrace roof courses overhang the real roof');
 bay.children.forEach(m=>m.geometry.dispose());
 const {createBuilding}=await import('./js/world/building-kit.js');
 const legacyPlot={id:'legacy-finish',kind:'midrise',x:0,z:0,width:6,depth:5,height:5};
 const legacySource=createBuilding(legacyPlot),bounds=new T.Box3().setFromObject(legacySource),legacyGroup=finishLegacyBuilding(legacySource,legacyPlot);
 check(legacyGroup.children.length===3&&legacyGroup.children[0].material===ordinary.architecture&&legacyGroup.children[2].material===roomGlassMaterial(),'Legacy buildings retain old material path');
 const legacyBounds=new T.Box3().setFromObject(legacyGroup);
 check(bounds.min.distanceTo(legacyBounds.min)<.001&&bounds.max.distanceTo(legacyBounds.max)<.001,'Legacy finish changes silhouette/envelope');
 check(legacyGroup.children[2].geometry.attributes.aRoom.array.some((n,i)=>i%4===3&&n>0),'Legacy glass lacks room coordinates');
 const {WEMBLEY_BENCHMARK:B}=await import('./js/world/layout.js');
 const benchmarkPlot={...legacyPlot,id:'benchmark-finish',x:(B.x0+B.x1)/2,z:(B.z0+B.z1)/2,width:10,depth:10,height:14};
 const benchmarkSource=createBuilding(benchmarkPlot,true),benchmark=finishLegacyBuilding(benchmarkSource,benchmarkPlot);
 check(benchmark.children[2].geometry.attributes.position.count>0&&benchmark.children[2].geometry.attributes.aRoom.array.some((n,i)=>i%4===3&&n>0),'Benchmark panes were converted to opaque trim');
 benchmark.children.forEach(m=>m.geometry.dispose());
 const {createCityBuildings}=await import('./js/world/building-kit.js'),{TOWNHOUSE_LOT_IDS}=await import('./js/world/building-slice.js'),{east}=await import('./js/world/layout.js');
 const owned=createCityBuildings(TOWNHOUSE_LOT_IDS.map((id,i)=>({...plot,id,x:east(823+i*6),z:-70,width:6})));
 const chunk=owned.children.find(g=>g.userData.archetype==='townhouse-benchmark-chunk'),disposals=[];
 check(chunk,'Townhouse owned geometry is not registered for teardown');
 for(const m of chunk.children){const event={count:0};m.geometry.addEventListener('dispose',()=>event.count++);disposals.push(event);}
 owned.userData.dispose();owned.userData.dispose();check(disposals.every(d=>d.count===1),'Townhouse construction is not disposed exactly once');
 const town=await import('./js/world/building-slice.js');
 const nine=town.EXPERIMENT_LOT_IDS.map((id,i)=>({...plot,id,x:east(i<5?681+i*6:713+(i-5)*6),z:-80,width:6}));
 const experiment=town.createTownhouseExperiment(nine,nine),initial=experiment.children[0].userData.lods[0][2];
 await town.loadTownhouseKit();await Promise.resolve();
 for(const chunk of experiment.children){const g=chunk.userData.lods[0][2];check(g!==initial&&g.attributes.aRoom?.array.some((n,i)=>i%4===3&&n>0),'Loaded control townhouse kit loses packed rooms');check([...chunk.userData.lods[0][1].attributes.normal.array].some(v=>Math.abs(v)>.05&&Math.abs(v)<.95),'Loaded control kit loses construction profiles');}
 experiment.userData.dispose();
 const renderer=new T.WebGLRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,100),target=new T.WebGLRenderTarget(64,64);
 scene.add(group,new T.HemisphereLight(0xffffff,0x334455,2));camera.position.set(12,10,16);camera.lookAt(0,6,0);renderer.setRenderTarget(target);renderer.render(scene,camera);
 check(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)&&renderer.getContext().getError()===0,'Construction/material/room shaders fail');
 scene.remove(group);scene.add(legacyGroup);renderer.render(scene,camera);check(renderer.getContext().getError()===0,'Legacy finish render failed');legacyGroup.children.forEach(m=>m.geometry.dispose());
 target.dispose();renderer.dispose();geometries.forEach(g=>g.dispose());
 return {pass:true,hashes,ordinaryResolution:ordinary.architecture.map.image.width,trimVertices:before};
})()''')
assert result and result.get('pass'),result
print(result)
