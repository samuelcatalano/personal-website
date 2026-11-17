# Same-origin browser fixture (local preview): facade articulation added by finishArchitecture.
# Cornice/dentils, quoins, banded base and tower fins/floor plates: counted, inside the lot envelope,
# never in front of glazing, never on shared walls, idempotent, and the far LOD keeps only the cheap set.
result = js(r'''(async()=>{
 const {building}=await import('./js/world/city-rollout.js'),{finishArchitecture}=await import('./js/world/building-finish.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const make=(kind,p0,neighbors,level=0)=>{const p={...p0,id:p0.id??`art-${kind}-${p0.x}-${p0.z}`},g=building(p,kind,neighbors?.(p)??[p],level);return {p,g,geo:g.children.map(m=>m.geometry),d:g.children[1].geometry.userData.propertyDetails??{}};};
 // Every added triangle stays inside the lot and never sits in front of a glazed pane.
 const audit=({p,geo},label)=>{
  const t=geo[1],a=t.attributes.position,start=t.userData.constructionStart??a.count,gl=geo[2].attributes,panes=[];
  for(let i=start;i<a.count;i++)check(Math.abs(a.getX(i))<=p.width/2&&Math.abs(a.getZ(i))<=p.depth/2&&a.getY(i)>0&&a.getY(i)<=p.height,`${label}: construction exceeds plot`);
  for(let q=0;q+5<gl.position.count;q+=6){
   const nx=gl.normal.getX(q),nz=gl.normal.getZ(q);if(Math.abs(nx)<.99&&Math.abs(nz)<.99)continue;
   let lo=1e9,hi=-1e9,y0=1e9,y1=-1e9,plane=0;
   for(let j=q;j<q+6;j++){const x=gl.position.getX(j),z=gl.position.getZ(j),u=nz*x-nx*z;lo=Math.min(lo,u);hi=Math.max(hi,u);y0=Math.min(y0,gl.position.getY(j));y1=Math.max(y1,gl.position.getY(j));plane+=(nx*x+nz*z)/6;}
   if(hi-lo>.3&&y1-y0>.3)panes.push({nx,nz,lo,hi,y0,y1,plane});
  }
  for(let i=t.userData.propertyDetails.articulationStart;i+2<a.count;i+=3){
   const x=(a.getX(i)+a.getX(i+1)+a.getX(i+2))/3,y=(a.getY(i)+a.getY(i+1)+a.getY(i+2))/3,z=(a.getZ(i)+a.getZ(i+1)+a.getZ(i+2))/3;
   for(const o of panes){const u=o.nz*x-o.nx*z,dz=o.nx*x+o.nz*z-o.plane;
    check(!(dz>-.05&&dz<.7&&u>o.lo+.03&&u<o.hi-.03&&y>o.y0+.03&&y<o.y1-.03),`${label}: articulation covers glazing at ${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`);}
  }
 };
 const mid=make('midrise',{kind:'midrise',width:14,depth:12,height:22,x:60,z:-40}),midFar=make('midrise',{kind:'midrise',width:14,depth:12,height:22,x:60,z:-40},null,1);
 check(mid.d.cornice>0&&mid.d.dentils>8&&mid.d.quoins>8&&mid.d.rustication>4,`Midrise LOD0 articulation missing ${JSON.stringify(mid.d)}`);
 check(midFar.d.cornice>0&&!midFar.d.dentils&&!midFar.d.quoins&&!midFar.d.rustication,`Midrise LOD1 must keep only the cornice ${JSON.stringify(midFar.d)}`);
 audit(mid,'midrise');audit(midFar,'midrise far');
 const before=mid.geo[1].attributes.position.count;finishArchitecture(mid.geo,mid.p,'midrise',mid.g.userData.recipe);
 check(mid.geo[1].attributes.position.count===before,'Repeated finish duplicates articulation');
 const house=make('townhouse',{kind:'terrace',width:7,depth:9,height:12,x:60,z:-40});
 check(house.d.quoins>4&&!house.d.cornice,`Detached townhouse needs quoins only ${JSON.stringify(house.d)}`);audit(house,'townhouse');
 const row=[-7,0,7].map(dx=>({kind:'terrace',width:7,depth:9,height:12,x:60+dx,z:-40,id:`art-row-${dx}`}));
 const inner=make('townhouse',row[1],()=>row);
 check(!inner.d.quoins,`Mid-terrace house quoins a shared corner ${JSON.stringify(inner.d)}`);
 const tower=make('tower',{kind:'tower',width:16,depth:16,height:70,x:-60,z:-40}),towerFar=make('tower',{kind:'tower',width:16,depth:16,height:70,x:-60,z:-40},null,1);
 check(tower.d.fins>4&&tower.d.floorPlates>8,`Tower fins/floor plates missing ${JSON.stringify(tower.d)}`);
 check(towerFar.d.fins===tower.d.fins&&towerFar.d.floorPlates===tower.d.floorPlates,'Tower skyline articulation must survive LOD1');
 check(!tower.d.quoins&&!tower.d.cornice,'Glass tower received masonry articulation');
 audit(tower,'tower');audit(towerFar,'tower far');
 for(const b of [mid,midFar,house,inner,tower,towerFar])b.geo.forEach(g=>{for(const at of Object.values(g.attributes))check(at.count===g.attributes.position.count,'Attribute count mismatch');g.dispose();});
 return {pass:true,mid:mid.d,midFar:midFar.d,house:house.d,tower:tower.d};
})()''')
assert result and result.get('pass'),result
print(result)
