import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';
import { loadGlb } from './glb-loader.js';

export const SLICE_LOT_ID = 'block-827--54-0';
export const TOWNHOUSE_LOT_IDS=Object.freeze([SLICE_LOT_ID,'block-827--54-1','block-827--54-2']);
const profile=Object.freeze({ground:3.2,upper:3,eaves:9.2,ridge:11.52,reveal:.2,frame:.085,windowWidth:1.15,windowHeight:1.6});

// Local hashes never advance the layout RNG. Palettes tint shared atlas samples in linear space.
const palettes=[{},
  {[S.plaster]:[.96,.985,1],[S.brick]:[1,.98,.94],[S.roof]:[.94,.97,1],[S.trim]:[1,1,.98],[S.glass]:[.97,.99,1],[S.litGlass]:[.97,.99,1]},
  {[S.plaster]:[1,.97,.93],[S.brick]:[.96,.96,1],[S.roof]:[1,.96,.91],[S.trim]:[1,.985,.96],[S.glass]:[1,.98,.95],[S.litGlass]:[1,.98,.95]}];
export function townhouseRecipe(plot,neighbors=[]) {
  let seed=2166136261;
  for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const alternate=seed%2===1;
  const exposedWest=!neighbors.some(p=>p.id!==plot.id&&Math.abs((p.x+p.width/2)-(plot.x-plot.width/2))<.5&&Math.abs(p.z-plot.z)<(p.depth+plot.depth)/2);
  return {...profile,structural:alternate?'B':'A',floors:3,bays:2,roof:'gable',entrySide:alternate?-1:1,bayOffset:alternate?.20:.24,windowWidth:alternate?1.08:1.15,palette:Math.floor(seed/2)%3,windowSeed:seed%3,exposedWest};
}

function townhouseGeometry(plot,recipe,level=0,storage=null,modular=false) {
  const {x,z,width,depth,height}=plot;
  if (![x,z,width,depth,height].every(Number.isFinite)||width<4.8||depth<5.5||height<recipe.ridge+.08-1e-6) throw new TypeError('Townhouse recipe does not fit plot');
  const w=width-.3,d=depth-.3,front=d/2,openings=[];
  const buckets=storage?storage.map(b=>{b.count=0;return b}):Array.from({length:3},()=>({position:[],normal:[],uv:[],surface:[],color:[]}));
  function quad(points,normal,surface,bucket=0,uv) {
    points=points.map(p=>new THREE.Vector3(...p));
    if(new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0])).dot(new THREE.Vector3(...normal))<0){points.reverse();if(uv)uv=uv.slice().reverse()}
    const b=buckets[bucket],axis=Math.abs(normal[1])>.7?'y':Math.abs(normal[0])>.7?'x':'z';
    for(const i of [0,1,2,0,2,3]) {
      const p=points[i],tint=palettes[recipe.palette][surface];
      if(storage){
        const v=b.count++;if(v>=4096)throw new RangeError('Townhouse scratch capacity exceeded');
        b.position[v*3]=p.x;b.position[v*3+1]=p.y;b.position[v*3+2]=p.z;
        for(let k=0;k<3;k++){b.normal[v*3+k]=normal[k];b.color[v*3+k]=tint?.[k]??1;}
        b.surface[v]=surface;b.uv[v*2]=uv?.[i]?.[0]??(axis==='x'?p.z:p.x);b.uv[v*2+1]=uv?.[i]?.[1]??(axis==='y'?p.z:p.y);
      }else{
        b.position.push(...p.toArray());b.normal.push(...normal);b.surface.push(surface);b.color.push(...(tint||[1,1,1]));
        b.uv.push(...(uv?.[i]||(axis==='x'?[p.z,p.y]:axis==='y'?[p.x,p.z]:[p.x,p.y])));
      }
    }
  }
  function box(x,y,z,w,h,d,surface,bucket=0) {
    const X=[x-w/2,x+w/2],Y=[y-h/2,y+h/2],Z=[z-d/2,z+d/2];
    quad([[X[0],Y[0],Z[1]],[X[1],Y[0],Z[1]],[X[1],Y[1],Z[1]],[X[0],Y[1],Z[1]]],[0,0,1],surface,bucket);
    quad([[X[0],Y[0],Z[0]],[X[1],Y[0],Z[0]],[X[1],Y[1],Z[0]],[X[0],Y[1],Z[0]]],[0,0,-1],surface,bucket);
    for(const [xx,n] of [[X[0],-1],[X[1],1]])quad([[xx,Y[0],Z[0]],[xx,Y[0],Z[1]],[xx,Y[1],Z[1]],[xx,Y[1],Z[0]]],[n,0,0],surface,bucket);
    for(const [yy,n] of [[Y[0],-1],[Y[1],1]])quad([[X[0],yy,Z[0]],[X[1],yy,Z[0]],[X[1],yy,Z[1]],[X[0],yy,Z[1]]],[0,n,0],surface,bucket);
  }
  function facade(face,span,holes) {
    const frontFace=face==='front',normal=frontFace?[0,0,1]:[-1,0,0];
    const pt=(u,y,v=0)=>frontFace?[u,y,front+v]:[-w/2-v,y,u];
    const piece=(u,y,v,wu,h,t,surface,bucket=1)=>{
      if(level===1&&bucket===1){quad([pt(u-wu/2,y-h/2,v),pt(u+wu/2,y-h/2,v),pt(u+wu/2,y+h/2,v),pt(u-wu/2,y+h/2,v)],normal,surface,bucket);return;}
      return frontFace?box(u,y,front+v,wu,h,t,surface,bucket):box(-w/2-v,y,u,t,h,wu,surface,bucket);
    };
    const xs=[...new Set([-span/2,span/2,...holes.flatMap(o=>[o.u-o.w/2,o.u+o.w/2])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,.35,recipe.ground,recipe.eaves,...holes.flatMap(o=>[o.y-o.h/2,o.y+o.h/2])])].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
      const u=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;
      if(holes.some(o=>Math.abs(u-o.u)<o.w/2&&Math.abs(y-o.y)<o.h/2))continue;
      quad([pt(xs[i-1],ys[j-1]),pt(xs[i],ys[j-1]),pt(xs[i],ys[j]),pt(xs[i-1],ys[j])],normal,y<.35?S.stone:y<recipe.ground?S.brick:S.plaster);
    }
    holes.forEach((o,index)=>{
      openings.push({...o,face});const a=o.u-o.w/2,b=o.u+o.w/2,lo=o.y-o.h/2,hi=o.y+o.h/2;
      const side=frontFace?[1,0,0]:[0,0,1];
      for(const [u,sign] of [[a,1],[b,-1]])quad([pt(u,lo),pt(u,hi),pt(u,hi,-recipe.reveal),pt(u,lo,-recipe.reveal)],side.map(n=>n*sign),S.stone);
      for(const [y,sign] of [[lo,1],[hi,-1]])quad([pt(a,y),pt(b,y),pt(b,y,-recipe.reveal),pt(a,y,-recipe.reveal)],[0,sign,0],S.stone);
      const f=recipe.frame;
      if(!modular){
      for(const u of [a-f/2,b+f/2])piece(u,o.y,.025,f,o.h+2*f,.09,S.trim);
      piece(o.u,hi+f/2,.025,o.w,f,.09,S.trim);
      }
      if(o.type==='door'&&!modular){
        piece(o.u,o.y,-.185,o.w,o.h,.03,S.door,0);
      }else if(o.type!=='door'){
        if(level===0&&!modular)piece(o.u,lo-f/2,.06,o.w+.22,.10,.15,S.stone);
        if(modular)return;
        piece(o.u,o.y,.005,.065,o.h,.075,S.trim);
        const lit=(index+(frontFace?1:0)+recipe.windowSeed)%3===0;
        const u0=index*.137+(frontFace?0:.19)+recipe.windowSeed*.07,v0=index*.271;
        quad([pt(a,lo,-recipe.reveal),pt(b,lo,-recipe.reveal),pt(b,hi,-recipe.reveal),pt(a,hi,-recipe.reveal)],normal,lit?S.litGlass:S.glass,2,[[u0,v0],[u0+.78,v0],[u0+.78,v0+1.65],[u0,v0+1.65]]);
      }
    });
  }
  const upper=Array.from({length:recipe.floors-1},(_,i)=>recipe.ground+recipe.upper*(i+.52));
  const bayPositions=recipe.bays===2?[-w*recipe.bayOffset,w*recipe.bayOffset]:Array.from({length:recipe.bays},(_,i)=>(i-(recipe.bays-1)/2)*w/recipe.bays);
  const frontHoles=upper.flatMap(y=>bayPositions.map(u=>({u,y,w:recipe.windowWidth,h:recipe.windowHeight,type:'window'})));
  if(recipe.bays===2)frontHoles.push({u:-recipe.entrySide*w*.24,y:1.65,w:1.2,h:1.5,type:'window'},{u:recipe.entrySide*w*.24,y:.12+2.2/2,w:.95,h:2.2,type:'door'});
  else bayPositions.forEach((u,i)=>{const door=i===(recipe.entrySide>0?recipe.bays-1:0);frontHoles.push({u,y:door?.12+2.2/2:1.65,w:door?.95:1.2,h:door?2.2:1.5,type:door?'door':'window'});});
  const sideHoles=upper.flatMap(y=>[-d*.29,d*.19].map(u=>({u,y,w:1.0,h:Math.min(1.45,recipe.windowHeight),type:'window'})));
  sideHoles.unshift({u:d*.19,y:1.65,w:1.0,h:1.35,type:'window'});
  facade('front',w,frontHoles);
  if(recipe.exposedWest)facade('west',d,sideHoles);
  else quad([[-w/2,0,-d/2],[-w/2,0,d/2],[-w/2,recipe.eaves,d/2],[-w/2,recipe.eaves,-d/2]],[-1,0,0],S.plaster);
  // Party/rear faces stay closed; the only recesses are shallow, visible openings.
  quad([[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,recipe.eaves,-d/2],[-w/2,recipe.eaves,-d/2]],[0,0,-1],S.plaster);
  quad([[w/2,0,-d/2],[w/2,0,d/2],[w/2,recipe.eaves,d/2],[w/2,recipe.eaves,-d/2]],[1,0,0],S.plaster);
  if(level===0&&recipe.bands!==false)for(const y of [recipe.ground,recipe.ground+recipe.upper])box(0,y,0,w+.14,.12,d+.14,S.stone,1);
  if(!modular)box(0,recipe.eaves-.09,0,width-.04,.18,depth-.04,S.trim);
  const half=width/2-.02,rz=depth/2-.02,dy=recipe.ridge-recipe.eaves,slope=Math.hypot(half,dy);
  if(recipe.roof==='side'||recipe.roof==='hip'){ // ridge parallel to the street (rollout variety); 'hip' also slopes the two ends
    const a=recipe.roof==='hip'?Math.max(0,half-rz):half,sz=Math.hypot(rz,dy);
    for(const side of [-1,1]){
      const n=new THREE.Vector3(0,rz,side*dy).normalize().toArray();
      quad([[-a,recipe.ridge,0],[-half,recipe.eaves,side*rz],[half,recipe.eaves,side*rz],[a,recipe.ridge,0]],n,S.roof,0,[[-half,0],[-half,sz],[half,sz],[half,0]]);
      if(recipe.roof==='hip'){const m=new THREE.Vector3(side*dy,half-a,0).normalize().toArray();quad([[side*half,recipe.eaves,-rz],[side*half,recipe.eaves,rz],[side*a,recipe.ridge,0],[side*a,recipe.ridge,0]],m,S.roof,0,[[-rz,0],[rz,0],[0,sz],[0,sz]]);}
      else{const xx=side*w/2,ge=recipe.ridge-dy*(d/2)/rz;quad([[xx,recipe.eaves,-d/2],[xx,recipe.eaves,d/2],[xx,ge,d/2],[xx,ge,-d/2]],[side,0,0],S.plaster);quad([[xx,ge,-d/2],[xx,ge,d/2],[xx,recipe.ridge,0],[xx,recipe.ridge,0]],[side,0,0],S.plaster);}
    }
    box(0,recipe.ridge+.02,0,Math.max(.14,2*a),.12,.14,S.roof);
  }else{
  for(const side of [-1,1]){
    const n=new THREE.Vector3(side*dy,half,0).normalize().toArray();
    quad([[0,recipe.ridge,-rz],[side*half,recipe.eaves,-rz],[side*half,recipe.eaves,rz],[0,recipe.ridge,rz]],n,S.roof,0,[[-rz,0],[-rz,slope],[rz,slope],[rz,0]]);
  }
  const gableEdge=recipe.ridge-dy*(w/2)/half;
  for(const [zz,n] of [[front,1],[-front,-1]]){
    quad([[-w/2,recipe.eaves,zz],[w/2,recipe.eaves,zz],[w/2,gableEdge,zz],[-w/2,gableEdge,zz]],[0,0,n],S.plaster);
    // The duplicate ridge point closes one triangle without a through-building tunnel.
    quad([[-w/2,gableEdge,zz],[w/2,gableEdge,zz],[0,recipe.ridge,zz],[0,recipe.ridge,zz]],[0,0,n],S.plaster);
  }
  box(0,recipe.ridge+.02,0,.14,.12,depth-.04,S.roof);
  }
  const geometries=buckets.map(data=>{
    const geometry=new THREE.BufferGeometry();
    for(const [key,size] of [['position',3],['normal',3],['uv',2],['surface',1],['color',3]])geometry.setAttribute(key==='surface'?'aSurface':key,new THREE.Float32BufferAttribute(storage?data[key].subarray(0,data.count*size):data[key],size));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return geometry;
  });
  return {geometries,metadata:{plotId:plot.id,openings,front,recipe}};
}

const KIT_URL=new URL('../../assets/processed/buildings/townhouse-kit.glb?v=2',import.meta.url).href; // bump ?v when the kit is rebuilt (static hosts cache GLBs)
let kitPromise;
export const loadTownhouseKit=()=>kitPromise??=loadGlb(KIT_URL).then(scene=>{
  const modules=new Map();
  scene.updateMatrixWorld(true);
  scene.traverse(node=>{
    const category=node.userData?.category;
    if(!category)return;
    const roles={mass:[],trim:[],glass:[]};
    node.children.forEach(role=>{
      const name=role.userData?.semantic_role;
      if(!roles[name])return;
      role.traverse(mesh=>{if(mesh.isMesh){const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);roles[name].push(geometry.toNonIndexed());}});
    });
    modules.set(node.name,{category,anchor:node.userData.anchor,roles});
  });
  return modules;
});
const moduleNames={
  window:['window_sash_6light_01','window_sash_4light_02','window_tall_8light_03','window_paired_sash_04','window_slim_sash_05','window_shop_upper_06','window_broad_sash_07'],
  door:['door_recessed_panel_01','door_glazed_top_02','door_sidelight_03','door_double_leaf_04','storefront_timber_05','storefront_pilaster_06'],
  cornice:['cornice_classical_01','cornice_bracketed_02','string_course_03','cornice_stepped_04','cornice_terrace_05'],
  roof:['roof_chimney_brick_01','roof_chimney_stone_02','roof_dormer_sash_03','roof_ridge_vent_04','roof_ridge_finial_05']
};
export function modularGeometry(plot,recipe,modules,variety=false) {
  const {geometries,metadata}=townhouseGeometry(plot,recipe,0,null,true),extra=[[],[],[]],w=plot.width-.3,d=plot.depth-.3,front=d/2;
  const moduleGeometry=(category,index,position,rotation,scale,surfaceByRole)=>{
    const name=moduleNames[category][index%moduleNames[category].length],module=modules.get(name);
    const anchor={window:'center of sill line on facade plane',door:'center of threshold on facade plane',cornice:'center of wall run at underside datum',roof:'center of roof contact footprint'}[category];
    if(!module||module.category!==category||module.anchor!==anchor)throw new Error(`Townhouse kit contract mismatch for ${name}`);
    const roleOrder={mass:0,trim:1,glass:2},palette=palettes[recipe.palette];
    for(const [role,items] of Object.entries(module.roles))for(const source of items){
      const geometry=source.clone(),matrix=new THREE.Matrix4().compose(position,rotation,scale);
      geometry.applyMatrix4(matrix);
      const surface=surfaceByRole[role];
      geometry.setAttribute('aSurface',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(surface),1));
      const tint=palette[surface]||[1,1,1],colors=new Float32Array(geometry.attributes.position.count*3);
      for(let i=0;i<colors.length;i+=3)colors.set(tint,i);
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      if(!geometry.attributes.normal)geometry.computeVertexNormals();
      extra[roleOrder[role]].push(geometry);
    }
  };
  const hash=(()=>{let seed=2166136261;for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;return seed;})();
  const faceIndices={front:0,west:0};
  for(const [index,o] of metadata.openings.entries()){
    const face=o.face==='front',angle=face?0:-Math.PI/2,rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
    const faceIndex=faceIndices[o.face]++;
    const x=face?o.u:-w/2,z=face?front:o.u,scale=new THREE.Vector3(o.w,o.h,1);
    if(o.type==='window'){
      // variety: per-house hash picks the window family; ground floor and side faces shift it so a facade never repeats one sash.
      const wi=variety?((hash>>>3)+(o.y<recipe.ground?2:0)+(face?0:3))%7:(recipe.windowSeed+index+(face?0:3))%7,name=moduleNames.window[wi],dims=[[.92,1.48],[1.05,1.48],[.88,1.72],[1.34,1.55],[.76,1.44],[1.28,1.12],[1.48,1.58]][moduleNames.window.indexOf(name)];
      scale.set(o.w/dims[0],o.h/dims[1],1);
      const lit=(faceIndex+(face?1:0)+recipe.windowSeed)%3===0;
      moduleGeometry('window',wi,new THREE.Vector3(x, o.y-o.h/2, face?z-.06:z),rotation,scale,{mass:S.stone,trim:S.trim,glass:lit?S.litGlass:S.glass});
    }else{
      const doorIndex=variety?(hash>>>5)%4:(recipe.windowSeed+(recipe.structural==='B'?3:0))%6,dims=[[1.02,2.24],[1.02,2.32],[1.34,2.35],[1.48,2.42],[2.05,2.62],[2.32,2.72]][doorIndex];
      scale.set(o.w/dims[0],o.h/dims[1],1);
      moduleGeometry('door',doorIndex,new THREE.Vector3(x,.09,z-.06),rotation,scale,{mass:S.door,trim:S.trim,glass:S.glass});
    }
  }
  const corniceY=recipe.eaves-.3;
  moduleGeometry('cornice',variety?(hash>>>7)%5:(recipe.palette+recipe.windowSeed)%5,new THREE.Vector3(0, corniceY, front-.12),new THREE.Quaternion(),new THREE.Vector3(w/5.08,1,1),{mass:S.stone,trim:S.trim,glass:S.glass});
  const gable=!recipe.roof||recipe.roof==='gable';
  let roofX,roofY,roofIndex=(hash>>>2)%5;
  if(gable){roofX=(hash%2?1:-1)*w*.28;roofY=recipe.ridge-(recipe.ridge-recipe.eaves)*Math.abs(roofX)/(w/2);}
  else{ // ridge runs along X: keep detail on the ridge line (no dormer, which only fits the gable pitch)
    const a=recipe.roof==='hip'?Math.max(0,w/2-d/2):w/2;roofX=a>1.2?(hash%2?1:-1)*a*.55:0;roofY=recipe.ridge-.04;if(roofIndex===2)roofIndex=0;
  }
  moduleGeometry('roof',roofIndex,new THREE.Vector3(roofX,roofY,0),new THREE.Quaternion(),new THREE.Vector3(1,1,1),{mass:S.roof,trim:S.roof,glass:S.glass});
  const result=geometries.map((base,i)=>{
    const merged=mergeGeometries([base,...extra[i]],false);
    base.dispose();extra[i].forEach(g=>g.dispose());
    if(!merged)throw new Error('Unable to merge townhouse modules');
    merged.computeBoundingBox();merged.computeBoundingSphere();return merged;
  });
  return result;
}

const names=['slice-mass','slice-details','slice-glass'];
function part(geometry,i,materials) {
  const mesh=new THREE.Mesh(geometry,i===2?materials.glass:materials.architecture);
  mesh.name=names[i];mesh.castShadow=i===0;mesh.receiveShadow=true;
  return mesh;
}

export function createTownhouseSlice(plot,recipe=townhouseRecipe(plot),level=0) {
  const {geometries,metadata}=townhouseGeometry(plot,recipe,level),materials=townhouseMaterials();
  const group=new THREE.Group();group.name='townhouse-visual-slice';group.position.set(plot.x,0,plot.z);
  geometries.forEach((geometry,i)=>group.add(part(geometry,i,materials)));
  group.userData=metadata;
  return group;
}

export function createTownhouseChunk(plots) {
  // Only the approved benchmark cell is assembled here; other city batches stay untouched.
  const group=new THREE.Group();group.name='townhouse-benchmark-chunk';group.position.set(820,0,-81);
  const buckets=[[],[],[]],houses=[],materials=townhouseMaterials();
  for(const plot of plots.slice().sort((a,b)=>a.id.localeCompare(b.id))) {
    if(!TOWNHOUSE_LOT_IDS.includes(plot.id))throw new TypeError('Lot is outside townhouse benchmark');
    if(plot.x-plot.width/2<820||plot.x+plot.width/2>852||plot.z-plot.depth/2< -81||plot.z+plot.depth/2> -49)throw new TypeError('Townhouse is outside benchmark cell');
    const {geometries,metadata}=townhouseGeometry(plot,townhouseRecipe(plot,plots));
    const transform=new THREE.Matrix4().makeTranslation(plot.x-820,0,plot.z+81);
    geometries.forEach((geometry,i)=>buckets[i].push(geometry.applyMatrix4(transform)));
    houses.push(metadata);
  }
  buckets.forEach((items,i)=>{
    const geometry=mergeGeometries(items,false);
    items.forEach(item=>item.dispose());
    if(!geometry)throw new Error('Unable to merge townhouse bucket');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    group.add(part(geometry,i,materials));
  });
  group.userData={plotIds:houses.map(h=>h.plotId),houses};
  return group;
}


export const EXPERIMENT_LOT_IDS=Object.freeze([...Array.from({length:5},(_,i)=>`block-679--80-${i}`),...Array.from({length:4},(_,i)=>`block-712--80-${i}`)]);
export function createTownhouseExperiment(plots,neighbors) {
  if(plots.length!==9||new Set(plots.map(p=>p.id)).size!==9||plots.some(p=>!EXPERIMENT_LOT_IDS.includes(p.id)||p.width!==6||p.depth!==9||p.height!==12))throw new TypeError('Townhouse experiment descriptors diverge');
  const experiment=new THREE.Group();experiment.name='townhouse-experiment';
  const materials=townhouseMaterials();
  // shortcut: 4096 vertices per bucket cover these two approved recipes; resize for any future recipe.
  const scratch=Array.from({length:3},()=>Object.fromEntries([['position',3],['normal',3],['uv',2],['surface',1],['color',3]].map(([key,size])=>[key,new Float32Array(4096*size)])));
  for(const [index,x]of [678,710].entries()){
    const group=new THREE.Group();group.name=`townhouse-chunk-${index?'B':'A'}`;group.position.set(x,0,-96);
    const selected=plots.filter(p=>p.x>=x&&p.x<x+32).sort((a,b)=>a.id.localeCompare(b.id));
    if(selected.length!==(index?4:5)||selected.some(p=>p.x-3<x||p.x+3>x+32||p.z-4.5< -96||p.z+4.5> -64))throw new TypeError('Townhouse experiment footprint diverges');
    const houses=selected.map(p=>({plotId:p.id,recipe:townhouseRecipe(p,neighbors)})),lods=[],buildMs=[];
    for(let level=0;level<2;level++){
      const start=performance.now(),buckets=[[],[],[]];
      selected.forEach((p,i)=>{
        const {geometries}=townhouseGeometry(p,houses[i].recipe,level,scratch),matrix=new THREE.Matrix4().makeTranslation(p.x-x,0,p.z+96);
        geometries.forEach((g,k)=>buckets[k].push(g.applyMatrix4(matrix)));
      });
      lods.push(buckets.map(items=>{
        const g=mergeGeometries(items,false);items.forEach(v=>v.dispose());
        if(!g)throw new Error('Unable to merge townhouse LOD');
        g.computeBoundingBox();g.computeBoundingSphere();return g;
      }));
      buildMs.push(performance.now()-start);
    }
    const bounds=new THREE.Box3();lods.flat().forEach(g=>bounds.union(g.boundingBox));bounds.translate(group.position);
    lods[0].forEach((g,k)=>group.add(part(g,k,materials)));
    group.userData={plotIds:houses.map(h=>h.plotId),houses,lods,bounds,level:null,buildMs};experiment.add(group);
  }
  experiment.userData.update=camera=>{
    for(const chunk of experiment.children){
      const d=chunk.userData,distance=d.bounds.distanceToPoint(camera.position);
      const next=d.level===null?(distance<120?0:1):d.level===0?(distance>129?1:0):(distance<111?0:1);
      if(next!==d.level){for(let k=0;k<3;k++)chunk.children[k].geometry=d.lods[next][k];d.level=next;}
    }
  };
  let disposed=false;
  experiment.userData.dispose=()=>{if(disposed)return;disposed=true;experiment.children.forEach(c=>c.userData.lods.flat().forEach(g=>g.dispose()));};
  loadTownhouseKit().then(modules=>{
    if(disposed)return;
    const replacements=[];
    try{
      for(const chunk of experiment.children){
        const d=chunk.userData,x=chunk.position.x,selected=plots.filter(p=>d.plotIds.includes(p.id)).sort((a,b)=>a.id.localeCompare(b.id));
        const buckets=[[],[],[]];
        selected.forEach(p=>{
          const geometry=modularGeometry(p,townhouseRecipe(p,neighbors),modules),matrix=new THREE.Matrix4().makeTranslation(p.x-x,0,p.z+96);
          geometry.forEach((g,k)=>buckets[k].push(g.applyMatrix4(matrix)));
        });
        replacements.push(buckets.map(items=>{
          const geometry=mergeGeometries(items,false);items.forEach(g=>g.dispose());
          if(!geometry)throw new Error('Unable to merge townhouse module chunk');
          geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
        }));
      }
      if(disposed){replacements.flat().forEach(g=>g.dispose());return;}
      experiment.children.forEach((chunk,i)=>{
        const d=chunk.userData,previous=d.lods[0];d.lods[0]=replacements[i];
        if(d.level===null||d.level===0)replacements[i].forEach((g,k)=>chunk.children[k].geometry=g);
        d.bounds.makeEmpty();[...replacements[i],...d.lods[1]].forEach(g=>d.bounds.union(g.boundingBox));d.bounds.translate(chunk.position);
        previous.forEach(g=>g.dispose());
      });
    }catch(error){replacements.flat().forEach(g=>g.dispose());}
  }).catch(()=>{});
  return experiment;
}
