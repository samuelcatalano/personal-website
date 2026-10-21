import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

export const HERO_BOUNDS=Object.freeze({x0:-293,x1:-273,z0:-24,z1:24});

export function createHeroRealm(){
  const buckets=[[],[],[]],obstacles=[],group=new THREE.Group();group.name='hero-public-realm';group.position.set(-283,0,0);
  const stone=[.97,.99,1],edge=[.76,.81,.85],wood=[.52,.30,.12],iron=[.22,.27,.30],leaf=[.23,.48,.12];
  function add(geometry,x,y,z,surface,tint,bucket=1){
    if(geometry.index){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    geometry.translate(x,y,z);
    const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,colors=[],surfaces=[];
    for(let i=0;i<p.count;i++){
      colors.push(...tint);surfaces.push(surface);
      if(Math.abs(n.getY(i))>.7)uv.setXY(i,p.getX(i),p.getZ(i));
      else uv.setXY(i,n.getZ(i)*p.getX(i)-n.getX(i)*p.getZ(i),p.getY(i));
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('aSurface',new THREE.Float32BufferAttribute(surfaces,1));buckets[bucket].push(geometry);
  }
  const box=(x,y,z,w,h,d,surface=S.stone,tint=stone,bucket=1)=>add(new THREE.BoxGeometry(w,h,d),x,y,z,surface,tint,bucket);
  const cylinder=(x,y,z,r,h,surface,tint,bucket=1)=>add(new THREE.CylinderGeometry(r,r,h,24),x,y,z,surface,tint,bucket);
  const obstacle=(kind,x,z,w,d)=>obstacles.push({kind,rect:{x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2}});
  box(0,.015,0,20,.09,48,S.stone,stone,0);
  // A broad central spine and cross-axis retain the original garden circulation.
  box(0,.067,0,3.4,.014,48,S.stone,[1,.98,.92],0);
  box(0,.077,0,20,.014,3,S.stone,[1,.98,.92],0);
  for(const x of [-1.80,1.80])box(x,.078,0,.12,.018,48,S.roof,edge,0);
  for(const z of [-23.7,23.7])box(0,.095,z,20,.06,.40,S.trim,stone,0);
  for(const x of [-9.8,9.8])for(const z of [-12.8,12.8])box(x,.095,z,.4,.06,22.4,S.trim,stone,0);
  // Fine expansion joints belong to the ground batch, not individual paving blocks.
  for(let z=-21;z<=21;z+=3)box(0,.065,z,19.4,.008,.025,S.roof,[.63,.66,.66],0);
  for(const x of [-5.6,5.6])for(const z of [-13,13]){
    box(x,.085,z,5.3,.045,13.6,S.plaster,[.44,.58,.30],0);
    for(const dz of [-6.9,6.9])box(x,.12,z+dz,5.6,.11,.20,S.stone,stone,0);
    for(const dx of [-2.75,2.75])box(x+dx,.12,z,.20,.11,13.6,S.stone,stone,0);
  }
  // Low planting at the lawn ends enriches the existing beds, away from both walking axes.
  for(const x of [-5.6,5.6])for(const z of [-18.5,18.5]){
    box(x,.16,z,2.5,.20,.95,S.stone,stone,0);
    for(let i=0;i<3;i++){
      const geometry=new THREE.SphereGeometry(1,7,4);geometry.scale(.48,.25,.34);
      add(geometry,x+(i-1)*.62,.43,z,S.plaster,i%2?[.42,.58,.24]:leaf);
    }
    obstacle('planting',x,z,2.6,1);
  }
  // A circular stone basin replaces the stacked voxel fountain at the same centre.
  cylinder(0,.14,0,3.25,.16,S.stone,edge,0);
  cylinder(0,.30,0,2.85,.35,S.stone,stone);
  cylinder(0,.48,0,2.55,.025,S.glass,[.85,1,1],2);
  cylinder(0,.56,0,.60,.40,S.stone,stone);
  cylinder(0,.82,0,1.10,.14,S.stone,stone);
  cylinder(0,.94,0,.12,.32,S.glass,[.85,1,1],2);
  obstacle('fountain',0,0,6.5,6.5);
  function bench(x,z,side){
    for(let i=0;i<5;i++)box(x,.50,z+(i-2)*.10,2.25,.075,.075,S.trim,wood);
    for(let i=0;i<3;i++)box(x,.77+i*.12,z+side*.28,2.25,.08,.07,S.trim,wood);
    for(const dx of [-.86,.86]){box(x+dx,.29,z,.10,.38,.48,S.roof,iron);box(x+dx,.74,z+side*.28,.08,.58,.08,S.roof,iron);}
    obstacle('bench',x,z,2.5,.8);
  }
  for(const x of [-5.7,5.7])for(const z of [-4.8,4.8])bench(x,z,z<0?-1:1);
  for(const x of [-8.6,8.6])for(const z of [-19,19]){
    cylinder(x,.40,z,.72,.64,S.stone,stone);
    for(let i=0;i<3;i++){
      const geometry=new THREE.SphereGeometry(1,8,5);geometry.scale(.6,.42,.6);
      add(geometry,x+Math.cos(i*2.1)*.20,.88+i*.08,z+Math.sin(i*2.1)*.20,S.plaster,leaf);
    }
    obstacle('planter',x,z,1.9,1.9);
  }
  for(const x of [-8.8,8.8])for(const z of [-8.2,8.2]){
    cylinder(x,.20,z,.19,.3,S.roof,iron);
    add(new THREE.CylinderGeometry(.055,.08,3.1,8),x,1.80,z,S.roof,iron);
    cylinder(x,3.42,z,.38,.10,S.roof,iron);
    cylinder(x,3.31,z,.22,.15,S.litGlass,[1,1,1],2);
    obstacle('lamp',x,z,.8,.8);
  }
  const materials=townhouseMaterials();
  buckets.forEach((items,k)=>{
    const geometry=mergeGeometries(items,false);items.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Unable to merge hero realm bucket');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);mesh.name=['hero-ground','hero-furniture','hero-water-lamps'][k];mesh.castShadow=k===1;mesh.receiveShadow=true;group.add(mesh);
  });
  let disposed=false;group.userData={obstacles,newLights:0,dispose(){if(disposed)return;disposed=true;group.children.forEach(m=>m.geometry.dispose());}};
  return group;
}
