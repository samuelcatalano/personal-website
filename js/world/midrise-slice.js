import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

export const MIDRISE_LOT_ID = 'block--279--49';
export const MIDRISE_REPLICATION_IDS = Object.freeze(['block--295--80', 'block--247--93']);

export function midriseRecipe(plot) {
  let seed=2166136261;
  for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  return {floors:Math.min(8,Math.max(4,Math.round(plot.height/3.3))),bays:Math.max(3,Math.round(plot.width/2.8)),ground:3.6,reveal:.34,roof:'parapet',windowSeed:seed%5,palette:seed%3};
}

// One archetype-specific slice; integration owns the lot allowlist, not the recipe.
export function createMidriseSlice(plot,recipe=midriseRecipe(plot)) {
  const {x,z,width,depth,height}=plot;
  if(plot.kind!=='midrise'||![x,z,width,depth,height].every(Number.isFinite)||width<8||depth<6||(height<12&&!recipe.compact)||height<6)throw new TypeError('Invalid midrise slice plot');
  const w=width-.4,d=depth-.4,roofY=height-1.1,upper=(roofY-recipe.ground)/(recipe.floors-1);
  const buckets=Array.from({length:3},()=>({position:[],normal:[],uv:[],aSurface:[],color:[]})),openings=[];
  const plaster=[[1,.99,.96],[.97,.99,1],[1,.98,.94]][recipe.palette];
  const colors={[S.plaster]:plaster,[S.brick]:[.83,.87,.90],[S.stone]:[.90,.93,.96],[S.roof]:[.78,.83,.88]};
  function quad(points,normal,surface,bucket=0,uv) {
    const p=points.map(v=>new THREE.Vector3(...v));
    if(new THREE.Vector3().subVectors(p[1],p[0]).cross(new THREE.Vector3().subVectors(p[2],p[0])).dot(new THREE.Vector3(...normal))<0){p.reverse();if(uv)uv=uv.slice().reverse();}
    const b=buckets[bucket],axis=Math.abs(normal[1])>.7?'y':Math.abs(normal[0])>.7?'x':'z';
    for(const i of [0,1,2,0,2,3]){const v=p[i];b.position.push(v.x,v.y,v.z);b.normal.push(...normal);b.aSurface.push(surface);b.color.push(...(colors[surface]||[1,1,1]));b.uv.push(...(uv?.[i]||(axis==='x'?[v.z,v.y]:axis==='y'?[v.x,v.z]:[v.x,v.y])));}
  }
  function box(cx,cy,cz,bw,bh,bd,surface,bucket=0){
    const X=[cx-bw/2,cx+bw/2],Y=[cy-bh/2,cy+bh/2],Z=[cz-bd/2,cz+bd/2];
    for(const [zz,n]of [[Z[0],-1],[Z[1],1]])quad([[X[0],Y[0],zz],[X[1],Y[0],zz],[X[1],Y[1],zz],[X[0],Y[1],zz]],[0,0,n],surface,bucket);
    for(const [xx,n]of [[X[0],-1],[X[1],1]])quad([[xx,Y[0],Z[0]],[xx,Y[0],Z[1]],[xx,Y[1],Z[1]],[xx,Y[1],Z[0]]],[n,0,0],surface,bucket);
    for(const [yy,n]of [[Y[0],-1],[Y[1],1]])quad([[X[0],yy,Z[0]],[X[1],yy,Z[0]],[X[1],yy,Z[1]],[X[0],yy,Z[1]]],[0,n,0],surface,bucket);
  }
  function facade(face,span,bays){
    const front=face==='front',side=face==='east'?1:-1,normal=front?[0,0,1]:[side,0,0];
    const pt=(u,y,v=0)=>front?[u,y,d/2+v]:[side*(w/2+v),y,u];
    const panel=(u,y,v,pw,ph,surface,bucket=1)=>quad([pt(u-pw/2,y-ph/2,v),pt(u+pw/2,y-ph/2,v),pt(u+pw/2,y+ph/2,v),pt(u-pw/2,y+ph/2,v)],normal,surface,bucket);
    const positions=Array.from({length:bays},(_,i)=>(i-(bays-1)/2)*span/bays),holes=[];
    for(let f=1;f<recipe.floors;f++)for(const u of positions)holes.push({u,y:recipe.ground+(f-.5)*upper,w:front?1.58:1.42,h:recipe.windowHeight??1.8,type:'window'});
    for(let i=0;i<bays;i++){const door=front&&i===Math.floor(bays/2);holes.push({u:positions[i],y:door?1.42:(recipe.compact?Math.min(1.72,recipe.ground*.52):1.72),w:door?1.5:1.7,h:door?2.6:Math.min(2.25,recipe.ground-.4),type:door?'door':'window'});}
    const xs=[...new Set([-span/2,span/2,...holes.flatMap(o=>[o.u-o.w/2,o.u+o.w/2])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,.3,recipe.ground,roofY,...holes.flatMap(o=>[o.y-o.h/2,o.y+o.h/2])])].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
      const u=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;
      if(holes.some(o=>Math.abs(u-o.u)<o.w/2&&Math.abs(y-o.y)<o.h/2))continue;
      quad([pt(xs[i-1],ys[j-1]),pt(xs[i],ys[j-1]),pt(xs[i],ys[j]),pt(xs[i-1],ys[j])],normal,y<recipe.ground?S.stone:S.plaster);
    }
    for(const [i,o]of holes.entries()){
      const a=o.u-o.w/2,b=o.u+o.w/2,lo=o.y-o.h/2,hi=o.y+o.h/2,r=recipe.reveal+(o.type==='door'?.12:0),f=.085;
      openings.push({...o,face,reveal:r});
      const lateral=front?[1,0,0]:[0,0,1];
      for(const [u,n]of [[a,1],[b,-1]])quad([pt(u,lo),pt(u,hi),pt(u,hi,-r),pt(u,lo,-r)],lateral.map(v=>v*n),S.stone);
      for(const [y,n]of [[lo,1],[hi,-1]])quad([pt(a,y),pt(b,y),pt(b,y,-r),pt(a,y,-r)],[0,n,0],S.stone);
      for(const u of [a-f/2,b+f/2])panel(u,o.y,.035,f,o.h+2*f,S.trim);
      for(const y of [lo-f/2,hi+f/2])panel(o.u,y,.035,o.w,f,S.trim);
      if(o.type==='door')panel(o.u,o.y,-r,o.w,o.h,S.door,0);
      else{
        const lit=(i+recipe.windowSeed+(front?0:2))%7===0;
        panel(o.u,o.y,-r,o.w,o.h,lit?S.litGlass:S.glass,2);
        panel(o.u,o.y,-r+.06,.055,o.h,S.trim);
        // Only the sill has projection; frames reuse the depth of the real reveal.
        if(!recipe.simplified){
        if(front)box(o.u,lo-.075,d/2+.045,o.w+.18,.12,.16,S.stone,1);
        else box(side*(w/2+.045),lo-.075,o.u,.16,.12,o.w+.18,S.stone,1);
        }
        if(lo>recipe.ground)panel(o.u,lo-.30,.012,o.w,.34,S.brick,0);
      }
    }
    if(recipe.bayWindows&&front)for(const o of holes)if(o.type==='window'&&o.y>recipe.ground){
      box(o.u,o.y,d/2+.03,o.w+.28,o.h+.24,.28,S.stone,1);
      box(o.u,o.y,d/2+.03,o.w,o.h,.18,S.glass,2);
    }
    if(recipe.brise&&front)for(let f=1;f<recipe.floors;f++)box(0,recipe.ground+f*upper-.08,d/2,w+.08,.14,.32,S.stone,1);
    // Continuous piers establish a vertical order distinct from the terrace rhythm.
    if(recipe.emphasis!=='horizontal')for(let i=0;i<=bays;i++){
      const u=-span/2+.14+i*(span-.28)/bays,y=(recipe.ground+roofY)/2,h=roofY-recipe.ground;
      if(front)box(u,y,d/2+.045,.16,h,.12,S.trim,0);
      else box(side*(w/2+.045),y,u,.12,h,.16,S.trim,0);
    }
  }
  facade('front',w,recipe.bays);facade('east',d,3);facade('west',d,3);
  quad([[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,roofY,-d/2],[-w/2,roofY,-d/2]],[0,0,-1],S.plaster);
  if(!recipe.simplified)for(let f=0;f<recipe.floors;f++)box(0,recipe.ground+f*upper-.055,0,w+.16,.11,d+.16,S.trim,1);
  box(0,roofY-.10,0,w+.22,.20,d+.22,S.stone);
  box(0,roofY+.025,0,w,.05,d,S.roof);
  for(const zz of [-d/2+.09,d/2-.09])box(0,roofY+.32,zz,w,.64,.18,S.plaster);
  for(const xx of [-w/2+.09,w/2-.09])box(xx,roofY+.32,0,.18,.64,d,S.plaster);
  for(const zz of [-d/2+.09,d/2-.09])box(0,roofY+.66,zz,w+.08,.06,.24,S.stone,1);
  for(const xx of [-w/2+.09,w/2-.09])box(xx,roofY+.66,0,.24,.06,d+.08,S.stone,1);
  if(recipe.rooftop!==false){
  box(-w*.20,roofY+.40,-d*.18,w*.27,.80,d*.25,S.stone);
  box(-w*.20,roofY+.83,-d*.18,w*.28,.06,d*.26,S.roof);
  box(w*.23,roofY+.26,-d*.22,1.25,.52,1.7,S.roof);
  }
  // Roof silhouette variants: setback penthouse (1), tank + stair pair (2); 0 keeps the plain parapet roof.
  if(recipe.penthouse===1){box(w*.08,roofY+.55,-d*.12,w*.58,1.0,d*.46,S.plaster);box(w*.08,roofY+1.03,-d*.12,w*.62,.07,d*.5,S.stone,1);}
  else if(recipe.penthouse===2){box(-w*.24,roofY+.5,d*.1,1.9,1.0,1.9,S.roof);box(w*.22,roofY+.4,-d*.1,2.2,.8,1.6,S.stone);}
  if(recipe.mansion){
    const base=roofY+.64,peak=roofY+.98,z=d/2-.08,half=w*.28;
    box(0,roofY+.78,d*.18,w*.42,.28,d*.5,S.plaster);
    box(0,base-.07,z,half*2+.18,.14,.20,S.stone,1);
    quad([[-half,base,z],[half,base,z],[0,peak,z],[0,peak,z]],[0,0,1],S.stone,1);
  }
  if(recipe.steppedRoof){
    const base=roofY+.36,z=d/2-.18,span=w/3;
    for(let i=0;i<3;i++){const h=i===1?.56:.28,x=(i-1)*span;box(x,base+h/2,z,span,h,.30,S.brick);box(x,base+h-.035,z,span,.07,.34,S.stone,1);}
  }
  if(recipe.gardenRoof){
    for(const x of [-w*.34,w*.34])box(x,roofY+.48,-d*.12,.82,.34,.72,S.stone);
    for(const x of [-w*.24,w*.24])for(const z of [-d*.18,d*.18])box(x,roofY+.77,z,.10,.24,.10,S.stone,1);
    for(const x of [-w*.24,w*.24])box(x,roofY+.91,0,.10,.08,d*.42,S.trim,1);
  }
  // Recessed human-scale entrance and canopy stay inside the source footprint.
  const entrance=(Math.floor(recipe.bays/2)-(recipe.bays-1)/2)*w/recipe.bays;
  if(!recipe.noCanopy)box(entrance,2.92,d/2-.27,2.65,.14,.82,S.roof);
  box(entrance,.06,d/2-.22,2.5,.12,.72,S.stone);
  const materials=townhouseMaterials(),g=new THREE.Group();g.name=plot.id;g.position.set(x,0,z);
  buckets.forEach((data,k)=>{
    const geometry=new THREE.BufferGeometry();
    for(const [key,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],size));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);mesh.name=['midrise-mass','midrise-trim','midrise-glass'][k];mesh.castShadow=k===0;mesh.receiveShadow=true;g.add(mesh);
  });
  g.userData={archetype:'midrise-slice',plotId:plot.id,recipe,openings};return g;
}

// shortcut: one bounded two-lot patch; wider rollout needs the approved cell policy.
export function createMidriseReplication(plots) {
  const bounds=new THREE.Box3();
  for(const p of plots)bounds.expandByPoint(new THREE.Vector3(p.x,0,p.z));
  const origin=bounds.getCenter(new THREE.Vector3()),group=new THREE.Group();
  group.name='midrise-replication';group.position.copy(origin);
  const houses=plots.map(p=>createMidriseSlice(p));
  for(let k=0;k<3;k++){
    const geometries=houses.map(h=>h.children[k].geometry.translate(h.position.x-origin.x,0,h.position.z-origin.z));
    const geometry=mergeGeometries(geometries,false);
    geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Unable to merge midrise bucket');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,houses[0].children[k].material);
    mesh.name=houses[0].children[k].name;mesh.castShadow=k===0;mesh.receiveShadow=true;
    group.add(mesh);
  }
  group.userData={archetype:'midrise-slice',plotIds:plots.map(p=>p.id),recipes:houses.map(h=>h.userData.recipe)};
  return group;
}
