import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, preservedSurfaceMaterials } from './building-slice-materials.js';
import { createPlantGeometry } from './plant-mesh.js';
import { createPlazaWater } from './plaza-water.js';

export const HERO_BOUNDS=Object.freeze({x0:-293,x1:-273,z0:-24,z1:24});

export function createHeroRealm(){
  const buckets=[[],[],[]],obstacles=[],group=new THREE.Group();group.name='hero-public-realm';group.position.set(-283,0,0);
  const stone=[.97,.99,1],edge=[.90,.91,.88],wood=[.40,.22,.095],iron=[.22,.27,.30];
  function add(geometry,x,y,z,surface,tint,bucket=1){
    if(geometry.index){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    geometry.translate(x,y,z);
    const p=geometry.attributes.position,n=geometry.attributes.normal,color=geometry.attributes.color,colors=[],surfaces=[];
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));
    const uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++){
      colors.push(...(color?[color.getX(i),color.getY(i),color.getZ(i)]:tint));surfaces.push(surface);
      if(Math.abs(n.getY(i))>.7)uv.setXY(i,p.getX(i),p.getZ(i));
      else uv.setXY(i,n.getZ(i)*p.getX(i)-n.getX(i)*p.getZ(i),p.getY(i));
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('aSurface',new THREE.Float32BufferAttribute(surfaces,1));buckets[bucket].push(geometry);
  }
  const box=(x,y,z,w,h,d,surface=S.stone,tint=stone,bucket=1)=>add(new THREE.BoxGeometry(w,h,d),x,y,z,surface,tint,bucket);
  const cylinder=(x,y,z,r,h,surface,tint,bucket=1)=>add(new THREE.CylinderGeometry(r,r,h,24),x,y,z,surface,tint,bucket);
  const plant=(kind,x,y,z,w,h,d)=>{const geometry=createPlantGeometry(kind);
    if(kind==='flower'){const c=geometry.attributes.color,tone=new THREE.Color('#e5d2b3');for(let i=0;i<c.count;i++)if(c.getX(i)>c.getY(i))c.setXYZ(i,tone.r,tone.g,tone.b);}
    geometry.scale(w,h,d);add(geometry,x,y,z,S.plaster,[1,1,1]);};
  function seatPad(x,z,yaw){
    const shape=new THREE.Shape(),w=1.43,d=.76,r=.22;
    shape.moveTo(-w+r,-d);shape.lineTo(w-r,-d);shape.quadraticCurveTo(w,-d,w,-d+r);
    shape.lineTo(w,d-r);shape.quadraticCurveTo(w,d,w-r,d);shape.lineTo(-w+r,d);
    shape.quadraticCurveTo(-w,d,-w,d-r);shape.lineTo(-w,-d+r);shape.quadraticCurveTo(-w,-d,-w+r,-d);
    add(new THREE.ShapeGeometry(shape,3).rotateX(-Math.PI/2).rotateY(yaw),x,.112,z,S.stone,[.91,.89,.83],0);
  }
  const obstacle=(kind,x,z,w,d)=>obstacles.push({kind,rect:{x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2}});
  box(0,.015,0,20,.09,48,S.stone,stone,0);
  // A broad central spine and cross-axis retain the original garden circulation.
  box(0,.067,0,3.4,.014,48,S.stone,[1,.98,.92],0);
  box(0,.077,0,20,.014,3,S.stone,[1,.98,.92],0);
  for(const x of [-1.80,1.80])box(x,.072,0,.055,.008,48,S.stone,edge,0);
  for(const z of [-23.7,23.7])box(0,.095,z,20,.06,.40,S.trim,stone,0);
  for(const x of [-9.8,9.8])for(const z of [-12.8,12.8])box(x,.095,z,.4,.06,22.4,S.trim,stone,0);
  // Fine expansion joints belong to the ground batch, not individual paving blocks.
  for(let z=-21;z<=21;z+=3)box(0,.064,z,19.4,.006,.018,S.stone,[.91,.91,.88],0);
  for(const x of [-5.6,5.6])for(const z of [-13,13]){
    box(x,.085,z,5.3,.045,13.6,S.plaster,[.44,.58,.30],0);
    for(const dz of [-6.9,6.9])box(x,.12,z+dz,5.6,.11,.20,S.stone,stone,0);
    for(const dx of [-2.75,2.75]){
      if(Math.sign(dx)!==Math.sign(x)&&Math.sign(x)===Math.sign(z)){
        const centre=Math.sign(z)*14,gap=1.65;
        for(const [a,b] of [[z-6.8,centre-gap],[centre+gap,z+6.8]])box(x+dx,.12,(a+b)/2,.20,.11,b-a,S.stone,stone,0);
      }else box(x+dx,.12,z,.20,.11,13.6,S.stone,stone,0);
    }
  }
  // Low planting at the lawn ends enriches the existing beds, away from both walking axes.
  for(const x of [-5.6,5.6])for(const z of [-18.5,18.5]){
    box(x,.16,z,2.5,.20,.95,S.stone,stone,0);
    box(x,.270,z,2.25,.020,.72,S.roof,[.42,.35,.25],0);
    for(let row=0;row<2;row++)for(let i=0;i<3;i++)plant('flower',x+(i-1)*.72,.28,z+(row-.5)*.38,.58,.48,.55);
    obstacle('planting',x,z,2.6,1);
  }
  // A quiet stone apron marks the meeting point without narrowing either walking axis.
  for(let i=0;i<16;i++)add(new THREE.RingGeometry(3.20,4.12,4,1,i*Math.PI/8+.002,Math.PI/8-.004).rotateX(-Math.PI/2),0,.092,0,S.stone,i%4===0?[.84,.84,.80]:[.94,.92,.86],0);
  add(new THREE.RingGeometry(4.12,4.20,64).rotateX(-Math.PI/2),0,.093,0,S.stone,[.82,.83,.79],0);
  cylinder(0,.135,0,3.18,.13,S.stone,edge,0);
  cylinder(0,.205,0,2.52,.075,S.stone,[.61,.70,.68],0);
  const profile=[[2.51,.20],[2.51,.40],[2.58,.50],[2.82,.50],[2.94,.41],[2.94,.20]].map(([r,y])=>new THREE.Vector2(r,y)).reverse();
  add(new THREE.LatheGeometry(profile,64),0,0,0,S.stone,stone);
  cylinder(0,.40,0,.52,.37,S.stone,edge);
  cylinder(0,.63,0,.76,.12,S.stone,stone);
  cylinder(0,.72,0,.07,.10,S.roof,iron);
  add(new THREE.RingGeometry(2.60,2.64,64).rotateX(-Math.PI/2),0,.504,0,S.litGlass,[1,.88,.68],2);
  obstacle('fountain',0,0,6.5,6.5);
  function bench(x,z,side,yaw=0){
    seatPad(x,z,yaw);
    const start=buckets[1].length;
    for(let i=0;i<5;i++)box(x,.50,z+(i-2)*.10,2.25,.075,.075,S.trim,wood);
    for(let i=0;i<3;i++)box(x,.77+i*.12,z+side*.28,2.25,.08,.07,S.trim,wood);
    for(const dx of [-.86,.86]){box(x+dx,.29,z,.10,.38,.48,S.roof,iron);box(x+dx,.74,z+side*.28,.08,.58,.08,S.roof,iron);}
    for(const dx of [-1,1])box(x+dx,.73,z,.07,.055,.52,S.roof,iron);
    for(const geometry of buckets[1].slice(start))geometry.translate(-x,0,-z).rotateY(yaw).translate(x,0,z);
    const c=Math.abs(Math.cos(yaw)),sn=Math.abs(Math.sin(yaw));
    obstacle('bench',x,z,2.5*c+.8*sn,.8*c+2.5*sn);
  }
  // Paired seats face the fountain, with a shaded pair along the existing central promenade.
  for(const side of [-1,1]){bench(side*5.9,-3.7,-1,side*-.28);bench(side*7.6,3.8,1,side*.52);}
  for(const side of [-1,1])bench(side*2.9,side*14,side,side*Math.PI/2);
  for(const x of [-5.6,5.6])for(const z of [-14.9,14.9]){
    for(let i=0;i<3;i++)plant('shrub',x+(i-1)*.60,.11,z+(i%2)*.3,.85,.32+(i%2)*.12,.74);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;plant('grass',x+Math.cos(a)*1.03,.11,z+.22+Math.sin(a)*.63,.42,.28+(i%3)*.04,.42);}
    obstacle('planting',x,z+.22,2.6,1.9);
  }
  for(const x of [-8.6,8.6])for(const z of [-19,19]){
    cylinder(x,.40,z,.72,.64,S.stone,stone);
    cylinder(x,.725,z,.62,.014,S.roof,[.42,.35,.25]);
    add(new THREE.RingGeometry(.63,.76,24).rotateX(-Math.PI/2),x,.738,z,S.stone,[.91,.91,.88]);
    for(let i=0;i<3;i++)plant('shrub',x+Math.cos(i*2.1)*.20,.5125+i*.08,z+Math.sin(i*2.1)*.20,.75,.75,.75);
    obstacle('planter',x,z,1.9,1.9);
  }
  for(const x of [-8.7,8.7])for(const z of [-14,14]){
    cylinder(x,.20,z,.19,.3,S.roof,iron);
    add(new THREE.CylinderGeometry(.055,.08,3.1,8),x,1.80,z,S.roof,iron);
    cylinder(x,3.42,z,.38,.10,S.roof,iron);
    cylinder(x,3.31,z,.22,.15,S.litGlass,[1,1,1],2);
    obstacle('lamp',x,z,.8,.8);
  }
  // Low planting softens the plaza-side portal corners, outside the transverse walkway.
  for(const z of [-5.8,5.8]){
    box(9.15,.22,z,1,.30,1.10,S.stone,stone);
    plant('shrub',9.15,.38,z,.78,.32,.88);
    obstacle('portal-planter',9.15,z,1.05,1.15);
  }
  const materials=preservedSurfaceMaterials();
  buckets.forEach((items,k)=>{
    const geometry=mergeGeometries(items,false);items.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Unable to merge hero realm bucket');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);mesh.name=['hero-ground','hero-furniture','hero-water-lamps'][k];mesh.castShadow=k===1;mesh.receiveShadow=true;group.add(mesh);
  });
  const water=createPlazaWater();group.add(water);
  let disposed=false;group.userData={obstacles,newLights:0,lampPools:[-8.7,8.7].flatMap(x=>[-14,14].map(z=>[-283+x,z,.6])),dispose(){if(disposed)return;disposed=true;group.children.filter(m=>m!==water).forEach(m=>m.geometry.dispose());water.userData.dispose();}};
  return group;
}
