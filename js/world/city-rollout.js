import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stops } from '../content.js';
import { inRegion, regions as routeRegions, routePoints, ukStart } from './layout.js';
import { townhouseRecipe, createTownhouseSlice, loadTownhouseKit, modularGeometry } from './building-slice.js';
import { midriseRecipe, createMidriseSlice } from './midrise-slice.js';
import { officeRecipe, createOfficeSlice } from './office-slice.js';
import { towerRecipe, createTowerSlice } from './tower-slice.js';
import { createShopSlice, heroShopRecipe } from './shop-slice.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

export function classifyPlot(p) {
  if (![p.x??0,p.z??0,p.width,p.depth,p.height].every(Number.isFinite)) return null;
  const {kind,width:w,depth:d,height:h}=p;
  if (kind==='terrace'&&w>=4.8&&w<=12&&d>=5.5&&d<=12&&h>=6&&h<=16) return 'townhouse';
  if (kind==='shop'&&w>=5&&d>=5&&h>=5.5&&h<=12) return 'shop';
  if (['office','tower','midrise'].includes(kind)&&w>=9.8&&d>=9.8&&h>=40) return 'tower';
  if (kind==='office'&&w>=8&&d>=8&&h>=12) return 'office';
  if (kind==='midrise'&&w>=8&&d>=6&&h>=6&&h<40) return 'midrise';
  return null;
}
export function classifyCompletion(p) {
  if(p.kind!=='midrise'||p.height>=12)return null;
  if(p.id?.startsWith('country-flat')||p.id?.startsWith('glasgow-tenement'))return 'B';
  if(p.width>=8&&p.depth>=8&&p.height>=6)return p.z<=-100?'C':'A';
  return 'B';
}
const hash=id=>{let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;};
const route=routePoints(stops.length),bands=routeRegions(stops,route),ukX=route[ukStart(stops)].x;
const REGION_SALT={paulista:0,london:1,countryside:2,glasgow:3};
const ARCHETYPES={townhouse:['brick-terrace','side-gable-terrace','hip-roof-terrace'],shop:['high-street-shop','wraparound-shop'],midrise:['stone-tenement','banded-apartment'],office:['horizontal-office','vertical-office'],tower:['straight-tower','stepped-tower','asymmetric-tower']};
const REGIONAL_ARCHETYPES={
  'paulista-arcade-shop':['shop',0], 'paulista-brise-apartment':['midrise',0], 'paulista-finned-tower':['tower',0],
  'london-bay-terrace':['townhouse',0], 'london-mansion-block':['midrise',1], 'london-corner-pub':['shop',1],
  'glasgow-blonde-bay-tenement':['midrise',0], 'glasgow-red-stepped-tenement':['midrise',1], 'glasgow-sandstone-gabled-row':['townhouse',0],
  'country-slate-cottage':['townhouse',2], 'country-garden-pair':['townhouse',1], 'country-garden-flat':['midrise',1],
};
function regionForPlot(p){
  if(p.region&&REGION_SALT[p.region]!==undefined)return p.region;
  if(p.id.startsWith('paulista-')||p.x<ukX)return 'paulista';
  if(p.id.startsWith('glasgow-')||inRegion(bands,'scot',p.x))return 'glasgow';
  if(p.id.startsWith('country-')||inRegion(bands,'ctry',p.x))return 'countryside';
  return 'london';
}
function facadeStyle(p,kind){
  const region=regionForPlot(p),styles=ARCHETYPES[kind],variant=(hash(p.id)+REGION_SALT[region])%styles.length;
  const explicit=styles.indexOf(p.archetype),regional=REGIONAL_ARCHETYPES[p.archetype];
  if(explicit>=0)return {archetype:p.archetype,region,variant:explicit,explicit:true};
  if(regional?.[0]===kind)return {archetype:p.archetype,region,variant:regional[1],explicit:true};
  return {archetype:styles[variant],region,variant,explicit:false};
}
function fittedTownhouse(p,neighbors,style) {
  const recipe=townhouseRecipe(p,neighbors),roof=Math.min(2.1,p.width*.32,p.height*(.15+(hash(p.id)%4)*.03));
  const floors=p.height<8.6?2:p.height>13.4?4:3,eaves=p.height-roof;
  const ground=Math.min(3.2,eaves/floors),upper=(eaves-ground)/(floors-1);
  const archetype=style.archetype;
  return {...recipe,archetype,region:style.region,roof:archetype==='country-garden-pair'?'side':archetype==='country-slate-cottage'?'hip':['gable','side','hip'][style.variant],bays:(style.variant===2||archetype==='country-garden-pair')&&p.width>=8?3:2,bands:style.variant!==1,palette:(hash(p.id)+REGION_SALT[style.region])%3,floors,ground,upper,eaves,ridge:p.height-.08,windowHeight:Math.min(1.6,upper*.56),bayWindows:archetype==='london-bay-terrace',entryGable:archetype==='glasgow-sandstone-gabled-row',chimney:archetype==='country-slate-cottage',gardenPair:archetype==='country-garden-pair'};
}
function towerFamily(p,neighbors){
  const selected=neighbors.filter(p=>['office','tower','midrise'].includes(p.kind)&&p.height>=40&&p.width>=9.8&&p.depth>=9.8).slice().sort((a,b)=>a.x-b.x||a.z-b.z||a.id.localeCompare(b.id)),assigned=[];
  for(const q of selected){
    const near=assigned.filter(o=>Math.hypot(q.x-o.p.x,q.z-o.p.z)<42),initial=(hash(q.id)+REGION_SALT[regionForPlot(q)])%3;
    let family=initial,best=Infinity;
    for(let k=0;k<3;k++){const f=(initial+k)%3,cost=near.filter(o=>o.family===f).length;if(cost<best){best=cost;family=f;}}
    assigned.push({p:q,family});if(q.id===p.id)return ['straight','stepped','asymmetric'][family];
  }
  return ['straight','stepped','asymmetric'][hash(p.id)%3];
}
export function rolloutRecipe(p,kind,neighbors=[p]){
  const style=facadeStyle(p,kind),seed=hash(p.id)+REGION_SALT[style.region];
  if(kind==='townhouse')return fittedTownhouse(p,neighbors,style);
  if(kind==='shop'){const r=heroShopRecipe(p,neighbors,style.variant===0?0:3);return {...r,archetype:style.archetype,region:style.region,ground:Math.min(3.4,p.height*(.40+(seed%3)*.04)),canopy:style.variant===0?false:true,baseSurface:style.variant===0?S.stone:S.brick,arcade:style.archetype==='paulista-arcade-shop',cornerPub:style.archetype==='london-corner-pub'};}
  if(kind==='midrise'){
    const r=midriseRecipe(p),compact=p.height<12,floors=compact?Math.max(2,Math.round(p.height/3.3)):r.floors,ground=compact?Math.min(3.2,p.height*.45):3.4+(seed%3)*.1;
    const archetype=style.archetype,mansion=archetype==='london-mansion-block',steppedRoof=archetype==='glasgow-red-stepped-tenement',gardenRoof=archetype==='country-garden-flat';
    return {...r,archetype,region:style.region,compact,floors,ground,bays:Math.max(3,r.bays+(seed%3)-1),windowHeight:compact?Math.min(1.8,(p.height-1.1-ground)/(floors-1)*.56):1.8,simplified:classifyCompletion(p)==='C',emphasis:style.variant?'vertical':'horizontal',rooftop:!compact&&style.variant===1&&!mansion&&!steppedRoof&&!gardenRoof,penthouse:compact||mansion||steppedRoof||gardenRoof?0:style.variant+1,palette:(seed)%3,brise:archetype==='paulista-brise-apartment',bayWindows:archetype==='glasgow-blonde-bay-tenement',mansion,steppedRoof,gardenRoof};
  }
  if(kind==='office'){const r=officeRecipe(p);return {...r,archetype:style.archetype,region:style.region,bays:Math.max(2,r.bays+(seed%3)-1),lobbyHeight:3.8+(seed%3)*.2,spandrel:style.variant ? .85 : .36,reveal:style.variant ? .22 : .4,emphasis:style.variant?'vertical':'horizontal',rooftop:style.variant===1,crown:style.variant ? 2 : 0};}
  const r=towerRecipe(p),silhouette=style.archetype==='paulista-finned-tower'?'finned':style.explicit?['straight','stepped','asymmetric'][style.variant]:towerFamily(p,neighbors),profiles={straight:{setbacks:[.12,.82,.96],scales:[.91,.91,.91],offsets:[0,0,0]},stepped:{setbacks:[.12,.70,.88],scales:[.91,.74,.52],offsets:[0,0,0]},asymmetric:{setbacks:[.12,.62,.86],scales:[.91,.62,.42],offsets:[0,.14,.20]},finned:{setbacks:[.12,.82,.96],scales:[.91,.91,.91],offsets:[0,0,0]}};
  const archetype=silhouette==='finned'?'paulista-finned-tower':style.explicit?style.archetype:{straight:'straight-tower',stepped:'stepped-tower',asymmetric:'asymmetric-tower'}[silhouette];
  // Per-lot jitter (footprint/height untouched) so neighbouring towers of one family are not clones.
  const j=(n,m)=>((Math.floor(seed/n)%m)/(m-1)-.5),pr=profiles[silhouette],setbacks=pr.setbacks.map((v,i)=>i?+(v+j(19+i,5)*.06).toFixed(3):v),scales=pr.scales.map((v,i)=>i?+(v+j(23+i,5)*.1).toFixed(3):v);
  return {...r,archetype,region:style.region,silhouette,...pr,setbacks,scales,chamfer:.65+(seed%3)*.12,bayWidth:[3.1,4.0,2.7,3.6,4.4][Math.floor(seed/3)%5],spandrel:[.18,.3,.5][Math.floor(seed/13)%3],reveal:[.30,.22,.38][Math.floor(seed/17)%3],crown:silhouette==='straight'?0:silhouette==='stepped'?1:2,...(silhouette==='finned'?{finDepth:.20,finWidth:.18}:{})};
}
export function building(p,kind,neighbors,level=0){
  const recipe=rolloutRecipe(p,kind,neighbors);
  if(kind==='townhouse')return createTownhouseSlice(p,recipe,level);
  if(kind==='shop')return createShopSlice(p,neighbors,recipe);
  if(kind==='midrise')return createMidriseSlice(p,recipe);
  if(kind==='office')return createOfficeSlice(p,recipe);
  return createTowerSlice(p,recipe);
}
// Vertex tints vary the shared metric atlas; materials and maps are never cloned.
const walls=[[1.12,1.14,1.16],[.55,.80,1.12],[.65,.92,.60],[1.18,.82,.45],[1.10,.65,.70],[.58,.64,.72],[1.10,1.04,.80],[.83,.75,.64],[1.15,.95,.62],[.72,.95,.88],[1.05,.55,.45],[.92,.88,1.08],[1.16,1.08,.92],[.62,.72,.58]];
// Glass tint families (multipliers on the shared teal pane): 0 cool blue, 1 green-teal, 2 bronze, 3 silver, 4 smoked.
const glassTints=[[.72,1.02,1.42],[.62,1.22,1.0],[1.85,1.0,.62],[1.45,1.2,1.02],[.58,.64,.7]];
const glassPick={london:[0,3,4,0,3,2],paulista:[1,2,3,1,0,4],countryside:[0,3,4,1,2,0],glasgow:[3,4,0,3,2,1],none:[0,1,3,2,4,0]};
// Roof targets in sRGB; vertex colour = target / atlas roof albedo, in linear space. Pitched = terrace/shop, flat = everything else.
const roofBase=[68,80,94],lin=(t,b)=>Math.pow(t/b,2.2);
const roofFor=t=>t.map((c,i)=>lin(c,roofBase[i]));
const roofs={
  pitched:{london:[[88,94,104],[168,92,66],[120,118,116],[110,82,66]],countryside:[[120,118,116],[110,112,116],[145,112,82],[88,94,104]],glasgow:[[88,94,104],[110,112,116],[88,94,104],[120,100,90]],paulista:[[168,92,66],[184,110,80],[130,128,124],[168,92,66]],none:[[88,94,104],[168,92,66],[120,118,116],[110,82,66]]},
  flat:[[176,178,176],[168,156,132],[128,136,142],[176,178,176],[168,156,132],[96,120,72],[128,136,142],[88,94,104]]
};
const bricks=[[1.05,.70,.50],[.58,.64,.74],[1.12,1.06,.86],[.72,.85,.74],[1.20,.66,.55],[.68,.54,.47],[.92,.48,.40],[1.0,.92,.70]];
export function tint(g,p) {
  const region=regionForPlot(p),seed=hash(p.id)+REGION_SALT[region],wall=walls[seed%walls.length],roof=[[1,1,1],[.72,.82,.93],[1.08,.76,.62],[.58,.58,.64],[1.2,.62,.45]][Math.floor(seed/5)%5];
  const regionalWall=region==='glasgow'?walls[[6,8,12][seed%3]]:region==='paulista'?walls[[0,6,12][seed%3]]:region==='london'?walls[[6,7,12][seed%3]]:region==='countryside'?walls[[1,5,9][seed%3]]:wall;
  const regionalBrick=region==='glasgow'?bricks[[2,5,7][Math.floor(seed/3)%3]]:region==='london'?bricks[[0,5,7][Math.floor(seed/3)%3]]:region==='countryside'?bricks[[2,3,7][Math.floor(seed/3)%3]]:bricks[Math.floor(seed/3)%bricks.length];
  const pitched=p.kind==='terrace'||p.kind==='shop',gt=glassTints[glassPick[region||'none'][Math.floor(seed/7)%6]];
  const roofTop=roofFor(pitched?roofs.pitched[region||'none'][Math.floor(seed/13)%4]:roofs.flat[Math.floor(seed/13)%8]);
  for(const m of g.children){const a=m.geometry.attributes;
    for(let i=0;i<a.position.count;i++){
      const s=a.aSurface.getX(i),t=s===S.plaster?regionalWall:s===S.stone?(region?regionalWall:p.kind==='office'?walls[(seed%3)*2]:[1,1,1]):s===S.brick?regionalBrick:s===S.roof?(pitched||a.normal.getY(i)>.7?roofTop:region==='glasgow'?walls[5]:roof):s===S.glass||s===S.litGlass?gt:[1,1,1];
      a.color.setXYZ(i,a.color.getX(i)*t[0],a.color.getY(i)*t[1],a.color.getZ(i)*t[2]);
    }
  }
}
// Kit rollout: every terraced townhouse (UK x>0 and Sao Paulo x<0, which gets its own variant pools in building-slice.js) swaps their LOD0 for authored kit modules once the GLB loads. `?kit=off` keeps the procedural facade.
const KIT_ON=!(typeof location!=='undefined'&&/[?&]kit=off\b/.test(location.search));
const kitLot=(p,kind)=>KIT_ON&&kind==='townhouse';
function houseGeometries(p,kind,neighbors,cell,level,modules) {
  let geometries,dispose=null;
  if(modules&&level===0&&kitLot(p,kind)){geometries=modularGeometry(p,rolloutRecipe(p,kind,neighbors),modules,true);tint({children:geometries.map(geometry=>({geometry}))},p);}
  else{const h=building(p,kind,neighbors,level);tint(h,p);geometries=h.children.map(m=>m.geometry);}
  geometries.forEach(g=>g.translate(p.x-cell.x,0,p.z-cell.z));
  return geometries;
}
function mergeCell(cell,neighbors,level,modules) {
  const houses=cell.plots.map(({p,kind})=>houseGeometries(p,kind,neighbors,cell,kind==='townhouse'?level:0,modules));
  const merged=[0,1,2].map(k=>{
    const geometry=mergeGeometries(houses.map(h=>h[k]),false);
    if(!geometry)throw new Error('Incompatible city architecture bucket');geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  });
  houses.flat().forEach(g=>g.dispose());
  return merged;
}
export function createCityRollout(plots,neighbors=plots) {
  const group=new THREE.Group();group.name='citywide-architecture';
  const cells=new Map(),counts={townhouse:0,shop:0,midrise:0,office:0,tower:0},ids=new Set();
  for(const p of [...plots].sort((a,b)=>a.id.localeCompare(b.id))){
    const kind=classifyPlot(p);if(!kind||ids.has(p.id))throw new TypeError('Invalid/duplicate rollout lot');ids.add(p.id);counts[kind]++;
    const x=Math.floor(p.x/32)*32,z=Math.floor(p.z/32)*32,key=`${x}:${z}`;
    if(!cells.has(key))cells.set(key,{x,z,plots:[]});cells.get(key).plots.push({p,kind});
  }
  let kitLots=0;const materials=townhouseMaterials(),start=performance.now(),chunkOf=new Map();
  for(const cell of cells.values()){
    const chunk=new THREE.Group();chunk.name=`architecture-cell-${cell.x}-${cell.z}`;chunk.position.set(cell.x,0,cell.z);
    const hasLod=cell.plots.some(({kind})=>kind==='townhouse'),lods=[];
    for(let level=0;level<(hasLod?2:1);level++)lods.push(mergeCell(cell,neighbors,level,null));
    lods[0].forEach((geometry,k)=>{const mesh=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);mesh.name=['city-mass','city-trim','city-glass'][k];mesh.castShadow=k===0;mesh.receiveShadow=true;chunk.add(mesh);});
    const bounds=new THREE.Box3();lods.flat().forEach(g=>bounds.union(g.boundingBox));bounds.translate(chunk.position);
    chunk.userData={plotIds:cell.plots.map(({p})=>p.id),lods,bounds,level:null};group.add(chunk);chunkOf.set(cell,chunk);
  }
  for(const [cell,chunk] of chunkOf){const n=cell.plots.filter(({p,kind})=>kitLot(p,kind)).length;if(n){chunk.userData.kitCell=cell;chunk.userData.kit=null;kitLots+=n;}}
  let disposed=false;let kit=null;group.userData={archetype:'citywide-architecture',get kitLots(){return kitLots},get kitReady(){return !!kit},plotIds:[...ids],counts,buildMs:performance.now()-start,
    update(camera){
      let built=0;
      for(const c of group.children){
        const d=c.userData,distance=d.bounds.distanceToPoint(camera.position);
        // Kit LOD0 is built lazily (max one cell per update, from 140 m, LOD0 starts at 120) and dropped beyond 180 m, so resident memory follows the camera, not the city.
        if(d.kitCell){
          if(kit&&!d.kit&&distance<140&&built<(distance<125?3:1)){d.kit=mergeCell(d.kitCell,neighbors,0,kit);built++;d.level=d.level===0?null:d.level;if(d.lods[0]){d.lods[0].forEach(g=>g.dispose());d.lods[0]=null;}}
          else if(d.kit&&distance>180){d.kit.forEach(g=>g.dispose());d.kit=null;d.level=d.level===0?null:d.level;}
        }
        const level=d.lods.length===1?0:d.level===null?(distance<120?0:1):d.level===0?(distance>129?1:0):(distance<111?0:1);
        if(level!==d.level){const set=level===0?d.kit||d.lods[0]:d.lods[level];if(!set)continue;c.children.forEach((m,k)=>m.geometry=set[k]);d.level=level;}
      }
    },
    dispose(){if(disposed)return;disposed=true;group.children.forEach(c=>{c.userData.lods.flat().forEach(g=>g?.dispose());c.userData.kit?.forEach(g=>g.dispose());});}};
  if(kitLots)loadTownhouseKit().then(m=>{kit=m;}).catch(()=>{});
  return group;
}
