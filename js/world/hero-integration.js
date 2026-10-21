import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMidriseSlice } from './midrise-slice.js';
import { createOfficeSlice } from './office-slice.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

const lots=Object.freeze([
  ['infill--52-0','midrise',10,10,12],['west-30--50','midrise',10,10,12],
  ['block--277--93','office',11,11,35],['block--261--93','office',11,11,28],
]);
export const HERO_LOT_IDS=Object.freeze(lots.map(p=>p[0]));

export function createHeroIntegration(plots,allPlots=plots){
  const group=new THREE.Group();group.name='hero-zone-architecture';
  const cells=new Map();
  for(const p of plots){
    const expected=lots.find(q=>q[0]===p.id);
    if(!expected||[p.kind,p.width,p.depth,p.height].some((v,i)=>v!==expected[i+1]))throw new TypeError('Incompatible hero integration lot');
    // Only this four-lot district uses this 32m grid; geometry bounds may straddle a cell edge.
    const x=-280+Math.floor((p.x+280)/32)*32,z=-96+Math.floor((p.z+96)/32)*32,key=`${x}:${z}`;
    if(!cells.has(key))cells.set(key,{x,z,plots:[]});cells.get(key).plots.push(p);
  }
  for(const cell of cells.values()){
    const chunk=new THREE.Group();chunk.name=`hero-cell-${cell.x}-${cell.z}`;chunk.position.set(cell.x,0,cell.z);
    const houses=cell.plots.map(p=>p.kind==='office'?createOfficeSlice(p):createMidriseSlice(p));
    for(let k=0;k<3;k++){
      const inputs=houses.map(h=>h.children[k].geometry.translate(h.position.x-cell.x,0,h.position.z-cell.z));
      const geometry=mergeGeometries(inputs,false);inputs.forEach(g=>g.dispose());
      if(!geometry)throw new Error('Unable to merge hero architecture');
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,houses[0].children[k].material);mesh.name=['hero-mass','hero-trim','hero-glass'][k];mesh.castShadow=k===0;mesh.receiveShadow=true;chunk.add(mesh);
    }
    chunk.userData={archetype:'hero-zone-architecture',plotIds:cell.plots.map(p=>p.id)};group.add(chunk);
  }
  // A ground-only apron joins the approved garden to the existing sidewalk; cut around source footprints.
  const area={x0:-273,x1:-245,z0:-29,z1:-9},holes=allPlots.map(p=>({x0:p.x-p.width/2,x1:p.x+p.width/2,z0:p.z-p.depth/2,z1:p.z+p.depth/2})).filter(r=>r.x0<area.x1&&r.x1>area.x0&&r.z0<area.z1&&r.z1>area.z0);
  const xs=[...new Set([area.x0,area.x1,...holes.flatMap(r=>[Math.max(area.x0,r.x0),Math.min(area.x1,r.x1)])])].sort((a,b)=>a-b);
  const zs=[...new Set([area.z0,area.z1,-28.6,-9.4,...holes.flatMap(r=>[Math.max(area.z0,r.z0),Math.min(area.z1,r.z1)])])].sort((a,b)=>a-b);
  const position=[],normal=[],uv=[],color=[],surface=[];
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
    const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;if(holes.some(r=>x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1))continue;
    const tint=z<-28.6||z>-9.4?[.78,.83,.87]:[1,.99,.95];
    for(const [a,b]of [[xs[i-1],zs[j-1]],[xs[i-1],zs[j]],[xs[i],zs[j]],[xs[i-1],zs[j-1]],[xs[i],zs[j]],[xs[i],zs[j-1]]]){position.push(a,.085,b);normal.push(0,1,0);uv.push(a,b);color.push(...tint);surface.push(S.stone);}
  }
  const paving=new THREE.BufferGeometry();for(const [name,data,size]of [['position',position,3],['normal',normal,3],['uv',uv,2],['color',color,3],['aSurface',surface,1]])paving.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  paving.computeBoundingBox();paving.computeBoundingSphere();const apron=new THREE.Mesh(paving,townhouseMaterials().architecture);apron.name='hero-transition-paving';apron.receiveShadow=true;group.add(apron);
  let disposed=false;group.userData={archetype:'hero-zone-architecture',plotIds:plots.map(p=>p.id),dispose(){if(disposed)return;disposed=true;group.traverse(m=>{if(m.isMesh)m.geometry.dispose()});}};
  return group;
}
