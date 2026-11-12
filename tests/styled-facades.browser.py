# Same-origin fixture: material hierarchy must survive both procedural and kit assembly.
result = js(r'''(async()=>{
 const T=await import('three'),{tint}=await import('/js/world/lot-tint.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const sample=(kind)=>{
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Array(12).fill(0),3));
  g.setAttribute('normal',new T.Float32BufferAttribute(Array(4).fill([0,0,1]).flat(),3));
  g.setAttribute('color',new T.Float32BufferAttribute(Array(12).fill(1),3));
  g.setAttribute('aSurface',new T.Float32BufferAttribute([0,4,3,6],1));
  tint({children:[{geometry:g}]},{id:'styled-material-contrast',region:'london',kind,height:kind==='office'?30:12});
  const c=g.attributes.color,out=Array.from({length:4},(_,i)=>[c.getX(i),c.getY(i),c.getZ(i)]);g.dispose();return out;
 };
 const commercial=sample('office'),home=sample('terrace'),lum=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
 check(lum(commercial[2])<lum(commercial[1])*.60,'Commercial metal still reads as pale mineral trim');
 check(lum(home[2])>lum(home[0])*1.05,'Painted frames do not separate from residential walls');
 const {townhouseMaterials,roomGlassMaterial}=await import('/js/world/building-slice-materials.js');
 const ordinary=townhouseMaterials(),landmark=townhouseMaterials({landmark:true});
 check(ordinary.architecture!==landmark.architecture&&ordinary.architecture.map!==landmark.architecture.map,'Styled finish leaks into landmarks');
 const renderer=new T.WebGLRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,100),target=new T.WebGLRenderTarget(64,64);
 const {building}=await import('/js/world/city-rollout.js');scene.add(new T.HemisphereLight(0xffffff,0x334455,2));camera.position.set(15,13,19);camera.lookAt(0,8,0);renderer.setRenderTarget(target);
 for(const kind of ['townhouse','shop','midrise','office','tower']){
  const p={id:'styled-'+kind,kind:kind==='townhouse'?'terrace':kind,x:0,z:0,width:14,depth:13,height:kind==='tower'?48:18},g=building(p,kind,[p]);
  g.children[2].material=roomGlassMaterial();scene.add(g);renderer.render(scene,camera);
  check(renderer.getContext().getError()===0&&renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'Styled '+kind+' shader fails');
  scene.remove(g);g.children.forEach(m=>m.geometry.dispose());
 }
 renderer.dispose();target.dispose();return {pass:true,commercialTrim:commercial[2],residentialTrim:home[2]};
})()''')
assert result and result.get('pass'), result
print(result)
