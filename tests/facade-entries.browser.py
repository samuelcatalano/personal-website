# Same-origin fixture; panelled entries must preserve the existing facade/openings.
print(js(r'''(async()=>{
 const T=await import('three'),{createTownhouseSlice,townhouseRecipe}=await import('/js/world/building-slice.js'),{finishArchitecture}=await import('/js/world/building-finish.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)},p={id:'panelled-entry',x:0,z:0,width:8,depth:8,height:12,kind:'terrace',region:'london'};
 const recipe=townhouseRecipe(p,[p]),g=createTownhouseSlice(p,recipe),mass=g.children[0].geometry.attributes.position.array.slice(),glass=g.children[2].geometry.attributes.position.array.slice();
 const geometry=finishArchitecture(g.children.map(m=>m.geometry),p,'townhouse',recipe);
 g.children.forEach((m,k)=>m.geometry=geometry[k]);
 check(geometry[1].userData.propertyDetails.entries===1,'Front door has no physical panel/hardware finish');
 check(mass.every((v,i)=>v===geometry[0].attributes.position.array[i]),'Entry finish moves the facade');
 check(glass.every((v,i)=>v===geometry[2].attributes.position.array[i]),'Entry finish covers or moves glazing');
 const trim=geometry[1],a=trim.attributes.position;
 for(let i=trim.userData.constructionStart;i<a.count;i++)check(Math.abs(a.getX(i))<=p.width/2&&Math.abs(a.getZ(i))<=p.depth/2&&a.getY(i)>=0&&a.getY(i)<=p.height,'Entry finish leaves original lot');
 const n=a.count;finishArchitecture(geometry,p,'townhouse',recipe);check(geometry[1].attributes.position.count===n,'Entry panels duplicate on rebuild');
 const {roomGlassMaterial,addRoomCoordinates,townhouseMaterials}=await import('/js/world/building-slice-materials.js');
 addRoomCoordinates(geometry[2],0,0);g.children[2].material=roomGlassMaterial();
 const r=new T.WebGLRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,100);r.setSize(96,96);scene.add(g,new T.HemisphereLight(0xffffff,0x334455,2));camera.position.set(12,10,16);camera.lookAt(0,5,0);
 for(const night of [0,1]){townhouseMaterials().glass.userData.uNight.value=night;r.render(scene,camera);check(!r.getContext().getError()&&r.info.programs.every(p=>p.diagnostics?.runnable!==false),'Refined facade shader fails');}
 geometry.forEach(g=>g.dispose());r.dispose();return {pass:true,entries:1,trimVertices:n};
})()'''))
