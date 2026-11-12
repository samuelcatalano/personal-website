# Same-origin fixture: drainage must not inherit the dark roof/spandrel material.
result=js(r'''(async()=>{
 const {createTownhouseSlice,townhouseRecipe,modularGeometry,loadTownhouseKit}=await import('/js/world/building-slice.js');
 const {SURFACE:S}=await import('/js/world/building-slice-materials.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)},modules=await loadTownhouseKit(),counts=[];
 for(const roof of ['gable','side','hip']){
  const p={id:'drainage-'+roof,kind:'terrace',x:0,z:0,width:6,depth:9,height:12};
  const r={...townhouseRecipe(p),roof},w=p.width-.3,front=(p.depth-.3)/2;
  for(const geometries of [createTownhouseSlice(p,r).children.map(m=>m.geometry),modularGeometry(p,r,modules)]){
   const a=geometries[1].attributes;let count=0;
   for(let i=0;i<a.position.count;i++){
    const x=Math.abs(a.position.getX(i)),y=a.position.getY(i),z=a.position.getZ(i);
    const pipe=Math.abs(x-(w/2-.10))<.034&&y>.04&&y<r.eaves-.04;
    const gutter=y>r.eaves-.246&&y<r.eaves-.154;
    if(z>front+.01&&z<front+.12&&(pipe||gutter)){
     count++;check(a.aSurface.getX(i)===S.trim,'House drainage uses roof/spandrel shading: '+roof);
    }
   }
   check(count>=108,'Drainage regression did not inspect both pipes and gutter');counts.push(count);
   geometries.forEach(g=>g.dispose());
  }
 }
 return {pass:true,drainageVertices:counts};
})()''')
assert result and result.get('pass'),result
print(result)
