import * as THREE from 'three';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

export const OFFICE_LOT_ID = 'block--183--37';

export function officeRecipe(plot) {
  let seed=2166136261;
  for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  return {floors:Math.max(3,Math.round((plot.height-4.2)/3.6)+1),bays:Math.max(2,Math.round((plot.width-.4)/3.5)),lobbyHeight:4.2,reveal:.32,windowSeed:seed%11};
}
// Stop-5 tower only (building-kit.js). Other office lots keep the plain recipe and geometry.
export const officeDepthRecipe = plot => ({...officeRecipe(plot), depth:true, reveal:.6});

export function createOfficeSlice(plot,recipe=officeRecipe(plot)) {
  const {x,z,width,depth,height}=plot;
  if(plot.kind!=='office'||![x,z,width,depth,height].every(Number.isFinite)||width<8||depth<8||height<12)throw new TypeError('Invalid office slice plot');
  // The depth variant insets the core 0.3 m per side so its 0.4 m fins and 0.45 m slab edges stay inside the 11 m lot.
  const inset=recipe.depth?.3:0,w=width-.4-2*inset,d=depth-.4-2*inset,top=height-1.25,step=(top-recipe.lobbyHeight)/(recipe.floors-1);
  const buckets=Array.from({length:3},()=>({position:[],normal:[],uv:[],aSurface:[],color:[]}));
  const colors={[S.stone]:[.84,.91,.97],[S.trim]:[.81,.91,1],[S.roof]:[.55,.69,.83],[S.plaster]:[.88,.95,1],[S.glass]:[.93,1,1],[S.litGlass]:[1,.96,.88]};
  function quad(points,normal,surface,bucket=0,color=colors[surface]||[1,1,1]){
    const p=points.map(v=>new THREE.Vector3(...v));
    if(new THREE.Vector3().subVectors(p[1],p[0]).cross(new THREE.Vector3().subVectors(p[2],p[0])).dot(new THREE.Vector3(...normal))<0)p.reverse();
    const b=buckets[bucket],axis=Math.abs(normal[1])>.7?'y':Math.abs(normal[0])>.7?'x':'z';
    for(const i of [0,1,2,0,2,3]){const v=p[i];b.position.push(v.x,v.y,v.z);b.normal.push(...normal);b.aSurface.push(surface);b.color.push(...color);b.uv.push(...(axis==='x'?[v.z,v.y]:axis==='y'?[v.x,v.z]:[v.x,v.y]));}
  }
  function box(cx,cy,cz,bw,bh,bd,surface,bucket=0){
    const X=[cx-bw/2,cx+bw/2],Y=[cy-bh/2,cy+bh/2],Z=[cz-bd/2,cz+bd/2];
    for(const [zz,n]of [[Z[0],-1],[Z[1],1]])quad([[X[0],Y[0],zz],[X[1],Y[0],zz],[X[1],Y[1],zz],[X[0],Y[1],zz]],[0,0,n],surface,bucket);
    for(const [xx,n]of [[X[0],-1],[X[1],1]])quad([[xx,Y[0],Z[0]],[xx,Y[0],Z[1]],[xx,Y[1],Z[1]],[xx,Y[1],Z[0]]],[n,0,0],surface,bucket);
    for(const [yy,n]of [[Y[0],-1],[Y[1],1]])quad([[X[0],yy,Z[0]],[X[1],yy,Z[0]],[X[1],yy,Z[1]],[X[0],yy,Z[1]]],[0,n,0],surface,bucket);
  }
  function facade(face,span,bays){
    const front=face==='front',back=face==='back',side=face==='east'?1:-1;
    const normal=front?[0,0,1]:back?[0,0,-1]:[side,0,0];
    const pt=(u,y,v=0)=>front?[u,y,d/2+v]:back?[-u,y,-d/2-v]:[side*(w/2+v),y,u];
    const panel=(a,b,lo,hi,v,surface,bucket=0)=>quad([pt(a,lo,v),pt(b,lo,v),pt(b,hi,v),pt(a,hi,v)],normal,surface,bucket);
    const lateral=front?[1,0,0]:back?[-1,0,0]:[0,0,1];
    const bay=span/bays;
    // One structural grid, with inset curtain wall and opaque spandrels, not residential punched windows.
    for(let f=0;f<recipe.floors;f++){
      const lo=f===0?.3:recipe.lobbyHeight+(f-1)*step,hi=f===0?recipe.lobbyHeight:lo+step;
      const bottom=lo+(f===0?.10:.22),upper=hi-(f===0?.24:(recipe.spandrel??.56));
      panel(-span/2-.12,span/2+.12,lo,bottom,.12,S.stone);
      panel(-span/2-.12,span/2+.12,upper,hi,.12,f===0?S.stone:S.roof);
      for(let i=0;i<bays;i++){
        const a=-span/2+i*bay+.16,b=-span/2+(i+1)*bay-.16,r=f===0?.50:recipe.reveal;
        for(const [u,n]of [[a,1],[b,-1]])quad([pt(u,bottom,.12),pt(u,upper,.12),pt(u,upper,-r),pt(u,bottom,-r)],lateral.map(v=>v*n),S.trim);
        for(const [y,n]of [[bottom,1],[upper,-1]])quad([pt(a,y,.12),pt(b,y,.12),pt(b,y,-r),pt(a,y,-r)],[0,n,0],S.trim);
        const lit=f>0&&(f*7+i+recipe.windowSeed)%17===0;
        panel(a,b,bottom,upper,-r,lit?S.litGlass:S.glass,2);
        panel((a+b)/2-.025,(a+b)/2+.025,bottom,upper,-r+.035,S.trim,1);
        if(front&&f===0&&i===Math.floor(bays/2)){
          for(const u of [-.72,0,.72])panel(u-.035,u+.035,bottom,Math.min(2.8,upper),-r+.07,S.trim,1);
          panel(-.755,.755,2.76,2.83,-r+.07,S.trim,1);
        }
      }
      // Flat transoms share a bucket; floor lines remain subordinate to the vertical piers.
      panel(-span/2-.16,span/2+.16,hi-.065,hi,.16,S.trim,1);
    }
    for(let i=0;i<=bays;i++){
      const u=-span/2+i*bay;
      panel(i===0?-span/2-.12:u-.16,i===bays?span/2+.12:u+.16,.3,top,.12,recipe.emphasis==='horizontal'?S.roof:S.trim);
    }
  }
  // Depth variant (recipe.depth): fins and slab edges stand proud of the wall plane, the panes sit deeper, soffits are dark shadow bands,
  // the ground floor is darker and the roof and parapet overhang. Same buckets, surfaces and envelope as facade().
  function depthFacade(face,span,bays){
    const front=face==='front',back=face==='back',side=face==='east'?1:-1;
    const normal=front?[0,0,1]:back?[0,0,-1]:[side,0,0];
    const pt=(u,y,v=0)=>front?[u,y,d/2+v]:back?[-u,y,-d/2-v]:[side*(w/2+v),y,u];
    const lateral=front?[1,0,0]:back?[-1,0,0]:[0,0,1];
    const half=span/2,bay=span/bays,lobby=recipe.lobbyHeight,r=recipe.reveal,rLobby=.8,FIN=.4,SLAB=.45,SHADOW=[.42,.52,.62],JAMB=[.66,.73,.8],SPANDREL=[.36,.42,.5];
    const floorTone=f=>{const n=Math.sin((f+1)*12.9898+recipe.windowSeed*78.233)*43758.5453;return .96+.08*(n-Math.floor(n));};
    const wallQ=(u0,u1,y0,y1,v,surface,bucket=0,color)=>quad([pt(u0,y0,v),pt(u1,y0,v),pt(u1,y1,v),pt(u0,y1,v)],normal,surface,bucket,color);
    const flatQ=(u0,u1,v0,v1,y,n,surface,bucket=0,color)=>quad([pt(u0,y,v0),pt(u1,y,v0),pt(u1,y,v1),pt(u0,y,v1)],[0,n,0],surface,bucket,color);
    const jambQ=(u,v0,v1,y0,y1,n)=>quad([pt(u,y0,v0),pt(u,y1,v0),pt(u,y1,v1),pt(u,y0,v1)],lateral.map(c=>c*n),S.trim,0,JAMB);
    const pierSurface=recipe.emphasis==='horizontal'?S.roof:S.trim;
    for(let f=0;f<recipe.floors;f++){
      const lo=f===0?.3:lobby+(f-1)*step,hi=f===0?lobby:lo+step;
      const bottom=lo+(f===0?.10:.22),upper=hi-(f===0?.24:(recipe.spandrel??.56)),depth=f===0?rLobby:r;
      const t=floorTone(f),glass=f===0?[.52,.64,.68]:[.93*t,t,t];
      wallQ(-half,half,lo,bottom,SLAB,S.stone);                 // slab edge proud of the deep-set plane
      flatQ(-half,half,-depth,SLAB,bottom,1,S.trim);            // sill top, from the pane line out to the slab edge
      flatQ(-half,half,-depth,SLAB,lo,-1,S.roof,0,SHADOW);      // slab soffit: dark shadow band over the spandrel
      wallQ(-half,half,upper,hi,-depth,f===0?S.stone:S.roof,0,f===0?undefined:SPANDREL); // spandrel, deep-set with the panes: the dark band under each slab edge
      for(let i=0;i<bays;i++){
        const a=-half+i*bay+.16,b=-half+(i+1)*bay-.16,m=(a+b)/2,lit=f>0&&(f*7+i+recipe.windowSeed)%17===0;
        wallQ(a,b,bottom,upper,-depth,lit?S.litGlass:S.glass,2,lit?undefined:glass);
        wallQ(m-.025,m+.025,bottom,upper,-depth+.035,S.trim,1);
        if(front&&f===0&&i===Math.floor(bays/2)){
          for(const u of [-.72,0,.72])wallQ(u-.035,u+.035,bottom,Math.min(2.8,upper),-depth+.07,S.trim,1);
          wallQ(-.755,.755,2.76,2.83,-depth+.07,S.trim,1);
        }
      }
    }
    // Full-height fins on every bay line, proud of the wall plane; each jamb runs back to the pane (lobby depth, then tower depth).
    for(let i=0;i<=bays;i++){
      const u=-half+i*bay;
      wallQ(Math.max(-half,u-.16),Math.min(half,u+.16),.3,top,FIN,pierSurface);
      if(i>0){jambQ(u-.16,-rLobby,FIN,.3,lobby,-1);jambQ(u-.16,-r,FIN,lobby,top,-1);}
      if(i<bays){jambQ(u+.16,-rLobby,FIN,.3,lobby,1);jambQ(u+.16,-r,FIN,lobby,top,1);}
    }
  }
  const facadeFor=recipe.depth?depthFacade:facade;
  facadeFor('front',w,recipe.bays);facadeFor('back',w,recipe.bays);
  const sideBays=Math.max(2,Math.round(d/3.5));facadeFor('east',d,sideBays);facadeFor('west',d,sideBays);
  box(0,.15,0,w,.3,d,S.stone);
  box(0,recipe.lobbyHeight-.08,0,w+.12,.16,d+.12,S.stone);
  // An inset mechanical crown and capped parapet keep the office silhouette inside its lot.
  const overhang=recipe.depth?.4:0;
  box(0,top+.06,0,w+overhang,.12,d+overhang,S.roof);
  for(const zz of [-d/2+.10,d/2-.10])box(0,top+.36,zz,w,.60,.20,S.stone);
  for(const xx of [-w/2+.10,w/2-.10])box(xx,top+.36,0,.20,.60,d,S.stone);
  if(recipe.depth)box(0,top+.69,0,w+.4,.06,d+.4,S.trim,1); // parapet cap overhangs the wall plane
  if(recipe.rooftop!==false){
  const y=top+.12; // every variant stays under `height` (the plot envelope)
  // Crown variants share the same surfaces: slab plant (0), stepped drum (1), corner plant + stair (2), low cap with a short mast (3).
  switch(recipe.crown??0){
    case 1:box(0,y+.3,-d*.08,w*.66,.6,d*.5,S.roof);box(w*.06,y+.8,-d*.1,w*.36,.4,d*.28,S.stone);box(w*.06,y+1.02,-d*.1,w*.38,.07,d*.30,S.trim,1);break;
    case 2:box(w*.2,y+.5,-d*.18,w*.38,1.0,d*.34,S.roof);box(-w*.26,y+.35,d*.16,1.7,.7,1.7,S.stone);box(w*.2,y+1.03,-d*.18,w*.40,.06,d*.36,S.trim,1);break;
    case 3:box(0,y+.3,0,w*.3,.6,d*.3,S.stone);box(w*.1,y+.85,0,.18,.5,.18,S.trim,1);break;
    default:box(0,top+.71,-d*.1,w*.56,1.02,d*.42,S.roof);box(0,top+.71+.51,-d*.1,w*.58,.04,d*.44,S.trim,1);
  }
  }
  box(0,3.24,d/2-.30,3.4,.18,.94,S.roof);
  box(0,.34,d/2-.26,3.3,.08,.78,S.stone);
  const materials=townhouseMaterials(),g=new THREE.Group();g.name=plot.id;g.position.set(x,0,z);
  buckets.forEach((data,k)=>{
    const geometry=new THREE.BufferGeometry();
    for(const [key,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],size));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);mesh.name=['office-mass','office-trim','office-glass'][k];mesh.castShadow=k===0;mesh.receiveShadow=true;g.add(mesh);
  });
  g.userData={archetype:'office-slice',plotId:plot.id,recipe};return g;
}
