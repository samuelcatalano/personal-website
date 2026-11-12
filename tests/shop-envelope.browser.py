# browser-harness < tests/shop-envelope.browser.py
result=js(r'''(async()=>{
 const {building}=await import('./js/world/city-rollout.js'),{createShopSlice,heroShopRecipe}=await import('./js/world/shop-slice.js');
 const check=(ok,message)=>{if(!ok)throw Error(message)};
 let fixtures=0,vertices=0;
 function envelope(group,p,label){
  check(group.children.length===3,'mass/trim/glass buckets '+label);
  for(const mesh of group.children){
   const a=mesh.geometry.attributes.position;
   for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);vertices++;
    check(Math.abs(x)<=p.width/2+.001&&Math.abs(z)<=p.depth/2+.001&&y>=-.001&&y<=p.height+.001,'shop source envelope '+label+' '+JSON.stringify({x,y,z,height:p.height}));
   }
   mesh.geometry.dispose();
  }
  fixtures++;
 }
 const inherited={id:'block--104-49',kind:'shop',x:-99,z:49,width:10,depth:10,height:6.8};
 for(const level of [0,1])envelope(building(inherited,'shop',[inherited],level),inherited,'inherited pavilion LOD'+level);
 for(const height of [5.5,6.8,9.45,12])for(const x of [-99,99])for(const width of [5,10])for(let seed=0;seed<8;seed++){
  const p={id:'shop-envelope-'+seed,kind:'shop',x,z:49,width,depth:width,height},source=JSON.stringify(p);
  for(const composition of [0,1,2,3])envelope(createShopSlice(p,[p],heroShopRecipe(p,[p],composition)),p,'composition '+composition+' '+p.id);
  for(const level of [0,1])envelope(building(p,'shop',[p],level),p,'rollout LOD'+level+' '+p.id);
  check(JSON.stringify(p)===source,'source descriptor mutated');
 }
 return {pass:true,fixtures,vertices};
})()''')
print(result)
assert isinstance(result,dict) and result.get('pass'),result
