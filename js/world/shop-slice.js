import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

const descriptors=[['frontage-stop-hero--255--1--9','terrace',9,7,9.7],['frontage-stop-hero--255--1-0','terrace',9,7,9.7],['corner-shop','shop',5.5,6,6],
  ['block--295--34','shop',10,10,6.8],['block--282--34','shop',10,10,6.8],
  ['block--269--34','midrise',10,10,9],['infill-1--36','midrise',8,10,9],
  ['frontage-stop-hero--255-1--9','terrace',9,7,6.9],['frontage-stop-hero--255-1-0','terrace',9,7,6.9],
  ['infill--52--34','midrise',10,10,9],
  ['infill--52--14','midrise',10,10,9],['infill--52-14','midrise',10,10,9]];
export const SHOP_LOT_IDS=Object.freeze(descriptors.slice(0,2).map(p=>p[0]));
export const SHOP_INTEGRATION_IDS=Object.freeze(descriptors.slice(3,9).map(p=>p[0]));
export const HERO_CLEANUP_IDS=Object.freeze(descriptors.slice(9,10).map(p=>p[0]));
export const HERO_REGION_IDS=Object.freeze(descriptors.slice(10,12).map(p=>p[0]));
export function shopRecipe(plot,neighbors=[]){
  let seed=2166136261;for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const bays=Math.min(Math.floor(plot.width/2.15),Math.max(2,Math.round(plot.width/2.6)+seed%2));
  const exposed=side=>!neighbors.some(p=>p.id!==plot.id&&Math.abs((p.x-side*p.width/2)-(plot.x+side*plot.width/2))<.4&&Math.abs(p.z-plot.z)<(p.depth+plot.depth)/2);
  return {floors:Math.max(2,Math.round(plot.height/3.15)),ground:Math.min(3.2,plot.height*.5),bays,entry:Math.floor((bays-1)/2)+seed%2*(bays%2===0?1:0),palette:seed%3,windowSeed:seed%7,exposedWest:exposed(-1),exposedEast:exposed(1)};
}
// Four local compositions reuse the commercial family; selection never consumes city RNG.
export function heroShopRecipe(plot,neighbors=[],compositionOverride){
  const r=shopRecipe(plot,neighbors);let seed=2166136261;for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const composition=Number.isInteger(compositionOverride)?((compositionOverride%4)+4)%4:((seed>>>7)+Math.round(plot.x/9)+Math.round(plot.z/7))&3;
  const styles=[
    {bays:2,storeBays:3,entry:1,windowWidth:2.4,windowHeight:1.4,ground:2.9,baseSurface:S.stone,upperSurface:S.plaster,canopy:false,parapet:.24,cornice:'slim',tint:[.78,.94,1.05]},
    {bays:Math.max(3,Math.floor(plot.width/2.4)),storeBays:2,entry:0,windowWidth:1.08,windowHeight:1.9,ground:2.85,baseSurface:S.stone,upperSurface:S.brick,canopy:'entry',parapet:.4,tint:[1.12,.78,.64]},
    {bays:2,storeBays:3,entry:1,windowWidth:2.3,windowHeight:1.24,ground:3.05,baseSurface:S.brick,upperSurface:S.plaster,canopy:true,parapet:.22,roofCap:'stepped',tint:[1.10,.92,.65]},
    {bays:3,storeBays:2,entry:1,windowWidth:1.3,windowHeight:1.65,ground:2.8,baseSurface:S.plaster,upperSurface:S.plaster,canopy:false,wrap:true,parapet:.24,cornice:'slim',roofCap:'pavilion',tint:[.66,.86,.73]},
  ];
  return {...r,...styles[composition],composition};
}
export function createShopSlice(plot,neighbors=[],recipe=shopRecipe(plot,neighbors)){
  const {x,z,width,depth,height}=plot;
  if(!['shop','terrace','midrise'].includes(plot.kind)||(plot.kind==='midrise'&&height>10)||![x,z,width,depth,height].every(Number.isFinite)||width<5||depth<5||height<5.5)throw new TypeError('Invalid mixed low-rise plot');
  const w=width-.24,d=depth-.4,front=d/2,roofY=height-(recipe.roofCap==='pavilion'?.95:.55),upper=(roofY-recipe.ground)/(recipe.floors-1);
  const buckets=Array.from({length:3},()=>({position:[],normal:[],uv:[],aSurface:[],color:[]})),openings=[];
  const colors={[S.plaster]:[[1,.99,.96],[.97,1,1],[1,.96,.90]][recipe.palette],[S.brick]:[[.96,.91,.86],[.83,.92,1],[1,.89,.76]][recipe.palette],[S.stone]:[.93,.97,1],[S.trim]:[1,1,1],[S.roof]:[.62,.72,.79],[S.glass]:[.93,1,1]};
  function quad(points,normal,surface,bucket=0){
    const p=points.map(v=>new THREE.Vector3(...v));
    if(new THREE.Vector3().subVectors(p[1],p[0]).cross(new THREE.Vector3().subVectors(p[2],p[0])).dot(new THREE.Vector3(...normal))<0)p.reverse();
    const b=buckets[bucket],axis=Math.abs(normal[1])>.7?'y':Math.abs(normal[0])>.7?'x':'z';
    for(const i of [0,1,2,0,2,3]){const v=p[i];b.position.push(v.x,v.y,v.z);b.normal.push(...normal);b.aSurface.push(surface);b.color.push(...(colors[surface]||[1,1,1]).map((c,j)=>c*(recipe.tint&&[S.plaster,S.brick].includes(surface)?recipe.tint[j]:1)));b.uv.push(...(axis==='x'?[v.z,v.y]:axis==='y'?[v.x,v.y*normal[2]-v.z*normal[1]]:[v.x,v.y]));}
  }
  function box(cx,cy,cz,bw,bh,bd,surface,bucket=0){
    const X=[cx-bw/2,cx+bw/2],Y=[cy-bh/2,cy+bh/2],Z=[cz-bd/2,cz+bd/2];
    for(const [zz,n]of [[Z[0],-1],[Z[1],1]])quad([[X[0],Y[0],zz],[X[1],Y[0],zz],[X[1],Y[1],zz],[X[0],Y[1],zz]],[0,0,n],surface,bucket);
    for(const [xx,n]of [[X[0],-1],[X[1],1]])quad([[xx,Y[0],Z[0]],[xx,Y[0],Z[1]],[xx,Y[1],Z[1]],[xx,Y[1],Z[0]]],[n,0,0],surface,bucket);
    for(const [yy,n]of [[Y[0],-1],[Y[1],1]])quad([[X[0],yy,Z[0]],[X[1],yy,Z[0]],[X[1],yy,Z[1]],[X[0],yy,Z[1]]],[0,n,0],surface,bucket);
  }
  function facade(face,span,bays,commercial=false){
    const frontFace=face==='front',back=face==='back',side=face==='east'?1:-1,normal=frontFace?[0,0,1]:back?[0,0,-1]:[side,0,0];
    const pt=(u,y,v=0)=>frontFace?[u,y,front+v]:back?[-u,y,-front-v]:[side*(w/2+v),y,u];
    const panel=(u,y,v,pw,ph,surface,bucket=1)=>quad([pt(u-pw/2,y-ph/2,v),pt(u+pw/2,y-ph/2,v),pt(u+pw/2,y+ph/2,v),pt(u-pw/2,y+ph/2,v)],normal,surface,bucket);
    const positions=Array.from({length:bays},(_,i)=>(i-(bays-1)/2)*span/bays),holes=[];
    for(let f=1;f<recipe.floors;f++)for(const u of positions)holes.push({u,y:recipe.ground+(f-.5)*upper,w:Math.min(recipe.windowWidth??1.45,span/bays*(recipe.composition===undefined?.58:.72)),h:Math.min(recipe.windowHeight??1.55,upper*(recipe.composition===undefined?.60:.72)),type:'window'});
    const storeBays=recipe.storeBays??bays,storeWidth=span/storeBays;
    if(commercial)for(let i=0;i<storeBays;i++){const entry=i===recipe.entry;holes.push({u:(i-(storeBays-1)/2)*storeWidth,y:entry?1.40:1.52,w:entry?1.16:storeWidth-.30,h:entry?2.5:2.18,type:entry?'entry':'storefront'});}
    const xs=[...new Set([-span/2,span/2,...holes.flatMap(o=>[o.u-o.w/2,o.u+o.w/2])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,.32,recipe.ground,roofY,...holes.flatMap(o=>[o.y-o.h/2,o.y+o.h/2])])].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
      const u=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;if(holes.some(o=>Math.abs(u-o.u)<o.w/2&&Math.abs(y-o.y)<o.h/2))continue;
      quad([pt(xs[i-1],ys[j-1]),pt(xs[i],ys[j-1]),pt(xs[i],ys[j]),pt(xs[i-1],ys[j])],normal,y<.32?S.stone:y<recipe.ground?(recipe.baseSurface??S.brick):(recipe.upperSurface??S.plaster));
    }
    const lateral=frontFace?[1,0,0]:back?[-1,0,0]:[0,0,1];
    for(const [i,o]of holes.entries()){
      const r=o.type==='window'?.24:.46,a=o.u-o.w/2,b=o.u+o.w/2,lo=o.y-o.h/2,hi=o.y+o.h/2,f=.07;
      openings.push({...o,face,reveal:r});
      for(const [u,n]of [[a,1],[b,-1]])quad([pt(u,lo),pt(u,hi),pt(u,hi,-r),pt(u,lo,-r)],lateral.map(v=>v*n),S.stone);
      for(const [y,n]of [[lo,1],[hi,-1]])quad([pt(a,y),pt(b,y),pt(b,y,-r),pt(a,y,-r)],[0,n,0],S.stone);
      panel(o.u,o.y,-r,o.w,o.h,o.type==='window'&&(i+recipe.windowSeed)%9===0?S.litGlass:S.glass,2);
      for(const u of [a-f/2,b+f/2])panel(u,o.y,.025,f,o.h+2*f,S.trim);
      for(const y of [lo-f/2,hi+f/2])panel(o.u,y,.025,o.w,f,S.trim);
      if(o.type==='window'){
        panel(o.u,o.y,-r+.03,.045,o.h,S.trim);
        if(frontFace)box(o.u,lo-.055,front+.045,o.w+.16,.11,.15,S.stone,1);
        else if(back)box(-o.u,lo-.055,-front-.045,o.w+.16,.11,.15,S.stone,1);
        else box(side*(w/2+.045),lo-.055,o.u,.15,.11,o.w+.16,S.stone,1);
      }else{
        panel(o.u,o.y,-r+.03,.04,o.h,S.roof);
        if(o.type==='entry'){if(frontFace)box(o.u+.36,1.18,front-r+.04,.045,.25,.04,S.trim,1);else panel(o.u+.36,1.18,-r+.04,.045,.25,S.trim);}
      }
    }
  }
  facade('front',w,recipe.bays,true);facade('back',w,Math.max(2,recipe.bays-1));
  for(const [face,exposed,side]of [['west',recipe.exposedWest,-1],['east',recipe.exposedEast,1]]){
    if(exposed)facade(face,d,recipe.composition===undefined?Math.max(2,Math.round(d/2.6)):recipe.bays,!!recipe.wrap);
    else{quad([[side*w/2,0,-front],[side*w/2,0,front],[side*w/2,recipe.ground,front],[side*w/2,recipe.ground,-front]],[side,0,0],recipe.baseSurface??S.brick);quad([[side*w/2,recipe.ground,-front],[side*w/2,recipe.ground,front],[side*w/2,roofY,front],[side*w/2,roofY,-front]],[side,0,0],recipe.upperSurface??S.plaster);}
  }
  if(recipe.arcade){
    const bays=recipe.storeBays??recipe.bays,span=w,step=span/bays,z=front-.03,h=recipe.ground-.18;
    for(let i=0;i<=bays;i++)box(-span/2+i*step,h/2,z,.20,h,.30,S.stone,1);
    box(0,recipe.ground-.09,z,w,.18,.30,S.stone,1);
  }
  box(0,recipe.ground+.04,0,w+.13,.13,d+.13,S.stone,1);
  box(0,roofY-.10,0,w+.18,recipe.cornice==='slim'?.08:.18,d+.18,S.trim);
  box(0,roofY+.025,0,w,.05,d,S.roof);
  const parapet=recipe.parapet??.40;
  for(const zz of [-front+.08,front-.08])box(0,roofY+.03+parapet/2,zz,w,parapet,.16,recipe.upperSurface??S.plaster);
  for(const xx of [-w/2+.08,w/2-.08])box(xx,roofY+.03+parapet/2,0,.16,parapet,d,recipe.upperSurface??S.plaster);
  for(const zz of [-front+.08,front-.08])box(0,roofY+.06+parapet,zz,w+.08,.06,.22,S.stone,1);
  for(const xx of [-w/2+.08,w/2-.08])box(xx,roofY+.06+parapet,0,.22,.06,d-.22,S.stone,1);
  if(recipe.roofCap==='stepped')box(0,roofY+.36,front-.08,w*.42,.28,.20,S.stone);
  if(recipe.roofCap==='pavilion'){box(-w*.15,roofY+.24,-d*.13,w*.48,.42,d*.42,S.roof);box(-w*.15,roofY+.47,-d*.13,w*.52,.04,d*.46,S.stone,1);}
  if(recipe.cornerPub){const x=w*.38,z=front-.40;box(x,roofY+.20,z,.62,.40,.62,S.stone);box(x,roofY+.43,z,.70,.06,.70,S.trim,1);}
  // The awning projects inside the existing lot, so the sidewalk stays clear.
  if(recipe.canopy==='entry'){
    const entry=(recipe.entry-((recipe.storeBays??recipe.bays)-1)/2)*w/(recipe.storeBays??recipe.bays);box(entry,2.84,front-.3,1.8,.12,.85,S.roof);
  }else if(recipe.canopy!==false){
  const aw=recipe.ground-.18;
  quad([[-w*.48,aw,front+.14],[w*.48,aw,front+.14],[w*.48,aw+.18,front-.60],[-w*.48,aw+.18,front-.60]],[0,.74/Math.hypot(.74,.18),.18/Math.hypot(.74,.18)],S.roof);
  box(0,aw-.04,front+.10,w*.96,.11,.08,S.roof);
  }
  const materials=townhouseMaterials(),g=new THREE.Group();g.name=plot.id;g.position.set(x,0,z);
  buckets.forEach((data,k)=>{const geometry=new THREE.BufferGeometry();for(const [key,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],size));geometry.computeBoundingBox();geometry.computeBoundingSphere();const m=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);m.name=['shop-mass','shop-trim','shop-glass'][k];m.castShadow=k===0;m.receiveShadow=true;g.add(m);});
  g.userData={recipe,openings};return g;
}
export function createShopChunk(plots,neighbors=plots){
  const group=new THREE.Group();group.name='hero-shopfronts';group.position.set(-272,0,-32);
  const houses=plots.map(p=>{const spec=descriptors.find(d=>d[0]===p.id);if(!spec||[p.kind,p.width,p.depth,p.height].some((v,i)=>typeof v==='number'?Math.abs(v-spec[i+1])>1e-6:v!==spec[i+1]))throw new TypeError('Incompatible shop lot');return createShopSlice(p,neighbors,[...SHOP_LOT_IDS,...SHOP_INTEGRATION_IDS].includes(p.id)?heroShopRecipe(p,neighbors):shopRecipe(p,neighbors))});
  for(let k=0;k<3;k++){const inputs=houses.map(h=>h.children[k].geometry.translate(h.position.x+272,0,h.position.z+32)),geometry=mergeGeometries(inputs,false);inputs.forEach(g=>g.dispose());if(!geometry)throw new Error('Unable to merge shop bucket');geometry.computeBoundingBox();geometry.computeBoundingSphere();const m=new THREE.Mesh(geometry,houses[0].children[k].material);m.name=['shop-mass','shop-trim','shop-glass'][k];m.castShadow=k===0;m.receiveShadow=true;group.add(m);}
  group.userData={archetype:'shop-slice',plotIds:plots.map(p=>p.id),recipes:houses.map(h=>h.userData.recipe)};return group;
}

export function createShopIntegration(plots,neighbors){
  plots=[...plots].sort((a,b)=>SHOP_INTEGRATION_IDS.indexOf(a.id)-SHOP_INTEGRATION_IDS.indexOf(b.id));
  const group=new THREE.Group();group.name='hero-final-frontages';const cells=new Map();
  for(const p of plots){
    if(!SHOP_INTEGRATION_IDS.includes(p.id))throw new TypeError('Unexpected hero frontage');
    const x=-296+Math.floor((p.x+296)/32)*32,z=-48+Math.floor((p.z+48)/32)*32,key=`${x}:${z}`;
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);
  }
  for(const [key,rows]of cells){const chunk=createShopChunk(rows,neighbors);chunk.name=`hero-final-cell-${key}`;group.add(chunk);}
  let disposed=false;group.userData={archetype:'shop-integration',plotIds:plots.map(p=>p.id),dispose(){if(disposed)return;disposed=true;group.traverse(m=>{if(m.isMesh)m.geometry.dispose()});}};
  return group;
}
