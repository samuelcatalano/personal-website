import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

// Dedicated landmarks share the city atlas; only silhouette/depth belongs in geometry.
function landmark(name,x,z){
  const group=new THREE.Group(),buckets=[[],[],[]];group.name=name+'-geometry';group.position.set(x,0,z);
  const stone=[1,1,.98],pale=[1.12,1.13,1.15],slate=[.87,.96,1.04];
  function add(g,x,y,z,surface=S.stone,tint=stone,bucket=0){
    if(g.index){const source=g;g=source.toNonIndexed();source.dispose();}
    g.translate(x,y,z);
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,colors=[],surfaces=[];
    for(let i=0;i<p.count;i++){
      colors.push(...tint);surfaces.push(surface);
      uv.setXY(i,Math.abs(n.getY(i))>.7?p.getX(i):n.getZ(i)*p.getX(i)-n.getX(i)*p.getZ(i),Math.abs(n.getY(i))>.7?p.getZ(i):p.getY(i));
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('aSurface',new THREE.Float32BufferAttribute(surfaces,1));buckets[bucket].push(g);
  }
  const box=(x,y,z,w,h,d,surface=S.stone,tint=stone,bucket=0)=>add(new THREE.BoxGeometry(w,h,d),x,y+h/2,z,surface,tint,bucket);
  function beam(a,b,r=.06,tint=pale,bucket=1){
    const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    const p=a.clone().add(b).multiplyScalar(.5);add(g,p.x,p.y,p.z,S.trim,tint,bucket);
  }
  // Closed cross-section swept around an ellipse: continuous bowl, roof and glazing bands.
  function ring(profile,surface,tint,bucket=0,start=0,end=Math.PI*2,segments=64){
    const p=[],uv=[],indices=[];
    for(let j=0;j<profile.length;j++)for(let i=0;i<=segments;i++){
      const a=start+(end-start)*i/segments,[rx,rz,y]=profile[j];p.push(Math.cos(a)*rx,y,Math.sin(a)*rz);uv.push(i/segments,j);
    }
    for(let j=0;j<profile.length;j++)for(let i=0;i<segments;i++){
      const a=j*(segments+1)+i,b=((j+1)%profile.length)*(segments+1)+i;indices.push(a,b,a+1,b,b+1,a+1);
    }
    if(end-start<Math.PI*2-.001)for(let j=1;j<profile.length-1;j++){
      indices.push(0,j*(segments+1),(j+1)*(segments+1));
      indices.push(segments,(j+1)*(segments+1)+segments,j*(segments+1)+segments);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();add(g,0,0,0,surface,tint,bucket);
  }
  function finish(){
    const mats=townhouseMaterials();
    buckets.forEach((parts,i)=>{if(!parts.length)return;const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,i===2?mats.glass:mats.architecture);mesh.name=name+'-'+['mass','trim','glass'][i];mesh.castShadow=i===0;mesh.receiveShadow=true;group.add(mesh);});
    group.userData.dispose=()=>group.children.forEach(m=>m.geometry.dispose());return group;
  }
  return {group,box,add,beam,ring,finish,stone,pale,slate};
}

export function createWembley(x,z){
  const {box,add,beam,ring,finish,pale,slate}=landmark('wembley',x,z);
  // Tapered continuous bowl and an open roof replace the old ring of overlapping cubes.
  ring([[18,12.8,6.2],[18.3,13.1,7.8],[17.8,12.6,8.5],[13.8,8.7,8.5],[13.5,8.4,6.2]],S.stone,pale);
  ring([[18.4,13.3,8.5],[18.2,13.1,9],[11.5,6.5,8.6],[11.5,6.5,8.35]],S.trim,pale);
  ring([[17.4,12.2,3.1],[17.55,12.35,3.65],[16.8,11.6,3.65],[16.7,11.5,3.1]],S.stone,pale);
  ring([[17.55,12.35,3.65],[18,12.8,6.2],[17.9,12.7,6.2],[17.45,12.25,3.65]],S.glass,[.86,.96,1.03],2);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;
    // Real gaps between the radial piers remain open at ground level.
    ring([[16.9,11.8,0],[17.5,12.4,3.2],[16.5,11.4,3.2],[16,11,0]],S.stone,pale,0,a-.07,a+.07,2);
    beam(new THREE.Vector3(Math.cos(a)*17.8,3.1,Math.sin(a)*12.7),new THREE.Vector3(Math.cos(a)*18.35,8.5,Math.sin(a)*13.2),.085,pale);
  }
  box(0,0,0,22,.35,12,S.plaster,[.35,.61,.24]);
  for(const dx of [-20,20])box(dx,0,0,1,.55,1,S.stone,pale);
  const points=[];for(let i=0;i<=64;i++){const a=i*Math.PI/64;points.push(new THREE.Vector3(-20*Math.cos(a),.4+34*Math.sin(a),0));}
  const curve=new THREE.CatmullRomCurve3(points);
  for(const dz of [-.38,.38])add(new THREE.TubeGeometry(curve,64,.22,6,false),0,0,dz,S.trim,pale);
  for(let i=0;i<32;i++){
    const a=curve.getPoint(i/32),b=curve.getPoint((i+1)/32);a.z=-.38;b.z=.38;beam(a,b,.065,pale);
  }
  for(const t of [.22,.35,.5,.65,.78])for(const side of [-1,1]){
    const a=curve.getPoint(t),b=new THREE.Vector3(a.x*.75,8.8,side*11.4);beam(a,b,.035,slate);
  }
  return finish();
}

export function createBigBen(x,z){
  const {box,add,finish,stone,pale,slate}=landmark('bigben',x,z);
  box(0,0,0,5,.8,5);box(0,.8,0,4.5,17.2,4.5);
  for(const dx of [-2.28,2.28])for(const dz of [-2.28,2.28])box(dx,.8,dz,.44,17,.44,S.stone,pale);
  for(const y of [3.2,8,12.8])for(const side of [-1,1]){
    box(0,y,side*2.27,.9,3.2,.07,S.door,[.66,.74,.80],2);
    box(side*2.27,y,0,.07,3.2,.9,S.door,[.66,.74,.80],2);
    for(const dx of [-.56,.56]){box(dx,y-.12,side*2.42,.18,3.45,.3,S.trim,pale,1);box(side*2.42,y-.12,dx,.3,3.45,.18,S.trim,pale,1);}
  }
  for(const y of [.75,7.6,12.4,17.5])box(0,y,0,5.1,.22,5.1,S.trim,pale,1);
  box(0,18,0,6,6,6);
  for(const dx of [-2.78,2.78])for(const dz of [-2.78,2.78])box(dx,18,dz,.42,6.5,.42,S.trim,pale,1);
  for(const y of [17.8,23.5,24.2])box(0,y,0,6.2,.3,6.2,S.trim,pale,1);
  // A tapered four-sided roof and corner pinnacles give the clock chamber a hierarchy.
  add(new THREE.CylinderGeometry(1.25,3.4,5.8,4,1,false,Math.PI/4),0,27.5,0,S.roof,slate);
  box(0,30.4,0,1.65,1,1.65,S.stone,stone);
  add(new THREE.ConeGeometry(1.18,2,4,1,false,Math.PI/4),0,32.4,0,S.roof,slate);
  box(0,33.4,0,.18,.6,.18,S.trim,pale,1);
  for(const dx of [-2.55,2.55])for(const dz of [-2.55,2.55]){
    box(dx,24.5,dz,.42,1.2,.42);add(new THREE.ConeGeometry(.38,1.8,4,1,false,Math.PI/4),dx,26.6,dz,S.roof,slate);
  }
  // Parliament uses a recessed arcade, buttress rhythm and a continuous pitched roof.
  box(20,0,0,34,.65,8);box(20,.65,0,33,6.75,5.8);
  for(const side of [-1,1]){
    for(let i=0;i<12;i++){
      const dx=4.3+i*2.7;box(dx,.65,side*3.65,.42,6.9,.7,S.stone,pale);
      for(const y of [1.4,4.3]){
        const shape=new THREE.Shape();shape.moveTo(-.6,0);shape.lineTo(.6,0);shape.lineTo(.6,1.7);shape.lineTo(0,2.35);shape.lineTo(-.6,1.7);shape.closePath();
        add(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false}),dx+1.35,y,side*2.94,S.glass,[.60,.69,.72],2);
      }
      box(dx,7.65,side*3.55,.35,.65,.4);
      add(new THREE.ConeGeometry(.29,.65,4,1,false,Math.PI/4),dx,8.625,side*3.55,S.stone,pale);
    }
    box(20,3.9,side*3.55,33.6,.25,.8,S.trim,pale,1);box(20,7.3,side*3.55,34,.35,.9,S.trim,pale,1);
  }
  const roof=new THREE.CylinderGeometry(0,1,1,4,1,false,Math.PI/4);roof.scale(23.3,2.1,4.2);add(roof,20,8.7,0,S.roof,slate);
  for(const dx of [4.3,35.7]){
    box(dx,.65,0,2.5,8.6,7.2);box(dx,9.25,0,2.6,.45,7.4,S.trim,pale,1);
    for(const side of [-1,1])box(dx,9.7,side*3.1,.7,.3,.7);
  }
  return finish();
}

export function createMasp(x,z){
  const {box,finish}=landmark('masp',x,z),red=[1.35,.12,.08],concrete=[1.05,1.08,1.10];
  box(0,0,0,36,.3,12,S.stone,concrete);
  // Two deep transverse portals support the suspended body; the central ground stays free.
  for(const dx of [-17,17]){
    for(const dz of [-5.5,5.5])box(dx,0,dz,1.8,14.1,1.6,S.trim,red);
    box(dx,14.1,0,2,1.5,13,S.trim,red);
  }
  for(const dz of [-5.55,5.55])box(0,13.65,dz,40,1.45,1.35,S.trim,red);
  box(0,8,0,33, .55,10,S.stone,concrete);box(0,13.1,0,33,.55,10,S.stone,concrete);
  box(0,8.55,0,32.2,4.55,8.8,S.glass,[.91,1,1.04],2);
  for(const side of [-1,1]){
    box(side*16.3,8.55,0,.4,4.55,10,S.stone,concrete);
    for(let i=-7;i<=7;i++)box(i*2.1,8.55,side*4.85,.075,4.55,.16,S.trim,[.55,.62,.66],1);
    box(0,10.75,side*4.85,32.2,.10,.16,S.trim,[.55,.62,.66],1);
  }
  return finish();
}
