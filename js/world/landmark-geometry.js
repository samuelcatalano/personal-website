import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';
import { PALETTE as P } from './palette.js';
import { blockMaterial } from './textures.js';
import { RIVERSIDE_KNOTS, riversideRoofAt } from './riverside.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z),lathe=(pts,seg=16,a=0,l=Math.PI*2)=>new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),seg,a,l);
// Night lighting: two shared emissive strip materials (warm/cool) + one shared additive wash. Intensity per strip = vertex-colour brightness.
// Dark-neutral fixtures by day (diffuse ignores vertex colour); sky.js drives emissive via userData.glow (wash too, as a black Lambert).
const WARMW=[1,.54,.2],COOLW=[.74,.81,1];
let lightMats;
function getLightMats(){
  if(lightMats)return lightMats;
  const strip=(hex,k)=>{
    const m=new THREE.MeshStandardMaterial({color:0x8a8e95,roughness:.6,metalness:0,vertexColors:true});
    m.userData.glow=true;m.userData.glowColor=new THREE.Color(hex);m.userData.glowK=k;
    m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','').replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = emissive * vColor;');};
    m.customProgramCacheKey=()=>'landmark-light-strip';return m;
  };
  // Additive wash: Lambert with black diffuse so sky.js's glow loop (emissive = glowColor * night * glowK) drives it; zero by day.
  const wash=new THREE.MeshLambertMaterial({color:0x000000,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  wash.userData.glow=true;wash.userData.glowColor=new THREE.Color(1,1,1);wash.userData.glowK=.85;
  wash.onBeforeCompile=strip(0,0).onBeforeCompile;wash.customProgramCacheKey=()=>'landmark-light-wash';
  return lightMats={warm:strip('#ffc27a',2.4),cool:strip('#dfe9ff',3.2),wash};
}
function archShape(w,h){const r=w/2,sh=h-w*.85,s=new THREE.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,sh);s.lineTo(0,h);s.lineTo(-r,sh);s.closePath();return s;}
// Dedicated landmarks share the city atlas; only silhouette/depth belongs in geometry.
function landmark(name,x,z){
  const group=new THREE.Group(),buckets=[[],[],[]],L=[[],[],[]];group.name=name+'-geometry';group.position.set(x,0,z);
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
  function beam(a,b,r=.06,tint=pale,bucket=1,seg=6){
    const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),seg);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
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
  // Pointed-arch window on a wall through (cx,cz) whose outward normal is (sin face,cos face); u slides along the wall.
  function gothic(cx,cz,face,u,y,w,h,glass=[.8,.9,1],surface=S.glass,frame=true){
    const px=cx+Math.cos(face)*u-Math.sin(face)*.02,pz=cz-Math.sin(face)*u-Math.cos(face)*.02;
    if(frame){const f=new THREE.ExtrudeGeometry(archShape(w+.32,h+.22),{depth:.05,bevelEnabled:false});f.rotateY(face);add(f,px,y-.1,pz,S.trim,pale,1);}
    const g=new THREE.ExtrudeGeometry(archShape(w,h),{depth:.08,bevelEnabled:false});g.rotateY(face);add(g,px,y,pz,surface,glass,surface===S.glass||surface===S.litGlass?2:0);
  }
  // Loft a [offset,y] cross-section along a plan path(t)->[x,z]; flat quads, closed profiles must be counter-clockwise (offset right, y up) and are capped.
  function sweep(profile,path,n,surface,tint,bucket=0,closed=true){
    const st=[],pos=[];
    for(let i=0;i<=n;i++){const t=i/n,[cx,cz]=path(t),[ax,az]=path(Math.min(1,t+.002)),[bx,bz]=path(Math.max(0,t-.002)),l=Math.hypot(ax-bx,az-bz);st.push([cx,cz,-(az-bz)/l,(ax-bx)/l]);}
    const P=(i,j)=>{const [cx,cz,nx,nz]=st[i],[d,y]=profile[j%profile.length];return [cx+nx*d,y,cz+nz*d];};
    const tri=(a,b,c)=>pos.push(...a,...b,...c),m=closed?profile.length:profile.length-1;
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const A=P(i,j),B=P(i,j+1),C=P(i+1,j+1),D=P(i+1,j);tri(A,C,B);tri(A,D,C);}
    if(closed)for(let j=1;j<profile.length-1;j++){tri(P(0,0),P(0,j),P(0,j+1));tri(P(n,0),P(n,j+1),P(n,j));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.computeVertexNormals();add(g,0,0,0,surface,tint,bucket);
  }
  // b: 0 lightsWarm strips, 1 lightsCool strips, 2 additive wash (tone = its colour). k..k1 = brightness bottom->top.
  function lit(b,g,x,y,z,k=1,k1=k,tone=WARMW){
    if(g.index){const src=g;g=src.toNonIndexed();src.dispose();}
    g.translate(x,y,z);const p=g.attributes.position;let lo=1e9,hi=-1e9;
    for(let i=0;i<p.count;i++){lo=Math.min(lo,p.getY(i));hi=Math.max(hi,p.getY(i));}
    const c=[];for(let i=0;i<p.count;i++){const q=k+(k1-k)*(hi>lo?(p.getY(i)-lo)/(hi-lo):0),t=b===2?tone:[1,1,1];c.push(t[0]*q,t[1]*q,t[2]*q);}
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));L[b].push(g);
  }
  const lbox=(b,x,y,z,w,h,d,k=1,k1=k)=>lit(b,new THREE.BoxGeometry(w,h,d),x,y+h/2,z,k,k1);
  function lbeam(b,a,c,r=.04,k=1,seg=4){
    const delta=c.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),seg);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    const m=a.clone().add(c).multiplyScalar(.5);lit(b,g,m.x,m.y,m.z,k);
  }
  function finish(){
    const mats=townhouseMaterials();
    buckets.forEach((parts,i)=>{if(!parts.length)return;const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,i===2?mats.glass:mats.architecture);mesh.name=name+'-'+['mass','trim','glass'][i];mesh.castShadow=i===0;mesh.receiveShadow=true;group.add(mesh);});
    const lm=getLightMats();
    L.forEach((parts,i)=>{if(!parts.length)return;const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,[lm.warm,lm.cool,lm.wash][i]);mesh.name=name+'-'+['lightsWarm','lightsCool','wash'][i];mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);});
    group.userData.dispose=()=>group.children.forEach(m=>m.geometry.dispose());return group;
  }
  return {group,box,add,beam,ring,gothic,sweep,finish,lit,lbox,lbeam,stone,pale,slate};
}

export function createWembley(x,z){
  const {box,add,beam,ring,finish,lit,lbeam,pale}=landmark('wembley',x,z);
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
    const a=curve.getPoint(t),b=new THREE.Vector3(a.x*.75,8.8,side*11.4);lbeam(1,a,b,.035,.12); // faint support cables
  }
  // Beacon: cool-white tubes just proud of both arch tubes; low warm glazing band round the bowl.
  const c48=new THREE.CatmullRomCurve3(points.filter((_,i)=>i%2===0));
  for(const dz of [-.5,.5])lit(1,new THREE.TubeGeometry(c48,40,.13,5,false),0,0,dz,1);
  const ell=[];for(let i=0;i<48;i++){const a=i*Math.PI/24;ell.push(new THREE.Vector3(Math.cos(a)*17.85,4.9,Math.sin(a)*12.65));}
  lit(0,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ell,true),48,.07,4,true),0,0,0,.4);
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

// ---- Tower Bridge: local x across the crossing, z along it (group origin = river centreline) ----
export function createTowerBridge(x,z){
  const {box,add,beam,gothic,finish,lit,lbox,lbeam,pale,slate}=landmark('towerbridge',x,z);
  const grey=[.94,.96,1],blue=[.46,.68,.95],gilt=[.86,.76,.52],dark=[.22,.25,.29],TZ=9.5;
  for(const tz of [-TZ,TZ]){
    box(0,-1,tz,5.2,24,4.8,S.stone,grey);
    for(const [y,h] of [[3.2,2.6],[7.6,2.6],[11.6,2.6],[16.2,2.6],[20.3,2.2]])
      for(const [face,cx,cz] of [[0,0,tz+2.4],[Math.PI,0,tz-2.4],[Math.PI/2,2.6,tz],[-Math.PI/2,-2.6,tz]]){
        if(y>20&&(face===0&&tz<0||face===Math.PI&&tz>0))continue; // walkway docks on the inner faces
        for(const u of [-.9,.9])gothic(cx,cz,face,u,y,1,h);
      }
    for(const y of [6.6,14.8])box(0,y,tz,5.9,.3,5.5,S.trim,pale,1);
    box(0,22.6,tz,6,.8,5.6,S.trim,pale,1);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const cx=sx*2.55,cz=tz+sz*2.45;
      box(cx,-1,cz,1.2,25.2,1.1,S.stone,pale);box(cx,24.2,cz,1.34,.3,1.24,S.trim,pale,1);
      add(new THREE.CylinderGeometry(.05,.8,4.6,8),cx,26.8,cz,S.roof,slate);
      box(cx,29.1,cz,.07,.9,.07,S.trim,gilt,1);
    }
    // steep pyramidal slate roof, dormers, finial
    add(new THREE.CylinderGeometry(.12,3.7,10,4,1,false,Math.PI/4),0,28.4,tz,S.roof,slate);
    for(const [face,dx,dz] of [[0,0,1],[Math.PI,0,-1],[Math.PI/2,1,0],[-Math.PI/2,-1,0]]){
      const cx=dx*1.88,cz=tz+dz*1.88;
      box(cx,25.3,cz,dx?.7:.95,1.3,dz?.7:.95,S.stone,grey);
      gothic(dx*2.23,tz+dz*2.23,face,0,25.55,.5,.95,[.8,.9,1],S.glass,false);
      add(new THREE.CylinderGeometry(.04,.75,.9,4,1,false,Math.PI/4),cx,26.85,cz,S.roof,slate);
    }
    beam(v(0,33.2,tz),v(0,35.2,tz),.07,gilt,1,6);
  }
  // abutments with chain posts, road deck on the bascule line
  for(const az of [-16,16]){
    box(0,0,az,6.2,4,3,S.stone,grey);
    for(const sx of [-1,1]){box(sx*3.55,0,az+Math.sign(az)*.6,.9,10,.9,S.stone,pale);add(new THREE.ConeGeometry(.7,1.6,4,1,false,Math.PI/4),sx*3.55,10.8,az+Math.sign(az)*.6,S.roof,slate);}
  }
  box(0,4,0,6,1.2,34,S.trim,blue,1);
  box(0,5.2,0,5.2,.08,34,S.plaster,dark);
  for(const sx of [-1,1]){
    box(sx*2.86,6.2,0,.22,.22,33.8,S.trim,pale,1);
    for(let a=-16;a<=16;a+=2)box(sx*2.86,5.28,a,.14,.95,.14,S.trim,pale,1);
  }
  // blue high-level walkways with glazed sides
  for(const wx of [-1.5,1.5]){
    box(wx,19,0,1.2,1.5,14.5,S.trim,blue,1);box(wx,19.35,0,1.26,.8,12.4,S.glass,[.8,.92,1],2);box(wx,20.5,0,1.4,.14,14.5,S.trim,pale,1);
    for(let a=-6;a<=6;a+=2)for(const sx of [-1,1])box(wx+sx*.63,19.1,a,.1,1.3,.14,S.trim,blue,1);
  }
  // suspension chains: tower flank down to the abutment posts, with hangers
  for(const sx of [-1,1])for(const dir of [-1,1]){
    const pts=[],y0=18.4,y1=10,z0=dir*(TZ+3.1),z1=dir*16.6;
    for(let i=0;i<=12;i++){const u=i/12;pts.push(v(sx*3.1,y1+(y0-y1)*(1-u)**2,z0+(z1-z0)*u));}
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.11,5,false),0,0,0,S.trim,gilt.map(c=>c*.85),1);
    for(const u of [.3,.5,.7,.88]){const p=pts[Math.round(u*12)];beam(v(sx*3.1,6.3,p.z),v(sx*3.1,p.y,p.z),.04,pale,1,4);}
  }
  // Night: gold uplight + lit windows (additive wash), warm corner/spire outlines, cool walkway/chain/deck lines.
  const arch=(w,h)=>new THREE.ShapeGeometry(archShape(w,h));
  for(const tz of [-TZ,TZ]){
    for(const [face,cx,cz,rows] of [[0,0,tz+2.4,5],[Math.PI,0,tz-2.4,5],[Math.PI/2,2.6,tz,5],[-Math.PI/2,-2.6,tz,5]]){
      const sn=Math.sin(face),cs=Math.cos(face),pg=new THREE.PlaneGeometry(3.8,14);pg.rotateY(face);
      lit(2,pg,cx+sn*.04,7,cz+cs*.04,.5,0);
      [[3.2,2.6],[7.6,2.6],[11.6,2.6],[16.2,2.6],[20.3,2.2]].forEach(([y,h])=>{
        if(y>20&&(face===0&&tz<0||face===Math.PI&&tz>0))return;
        for(const u of [-.9,.9]){const g=arch(.62,h*.8);g.rotateY(face);lit(2,g,cx+cs*u+sn*.075,y+h*.1,cz-sn*u+cs*.075,.7,.4);}
      });
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const cx=sx*2.55,cz=tz+sz*2.45;
      lbox(0,cx+sx*.42,3,cz+sz*.565,.07,21,.03,.55,.9);lbox(0,cx+sx*.615,3,cz+sz*.4,.03,21,.07,.55,.9);
      lbeam(0,v(cx+sx*.57,24.5,cz+sz*.57),v(cx+sx*.04,29.1,cz+sz*.04),.03,.9,3);
      lbeam(0,v(sx*2.64,23.4,tz+sz*2.64),v(sx*.1,33.4,tz+sz*.1),.035,.8,3);
    }
  }
  for(const wx of [-1.5,1.5]){
    lbox(1,wx,18.97,0,.5,.03,14.2,.9);
    for(const sx of [-1,1])lbox(1,wx+sx*.615,19.12,0,.03,.07,14.2,.6);
  }
  for(const sx of [-1,1]){
    lbox(1,sx*3.015,4.5,0,.03,.1,34,.65);
    for(const dir of [-1,1]){
      const pts=[],y0=18.4,y1=10,z0=dir*(TZ+3.1),z1=dir*16.6;
      for(let i=0;i<=12;i++){const u=i/12;pts.push(v(sx*3.19,y1+(y0-y1)*(1-u)**2+.04,z0+(z1-z0)*u));}
      lit(1,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.05,4,false),0,0,0,.85);
    }
  }
  const g=finish();
  g.userData.layout={towerZ:[-TZ,TZ],towerHeight:35,deckY:4,deckTop:5.2,walkwayZ:0,walkways:2,pinnacles:8};
  return g;
}

// ---- Heathrow: curved wave roof over a glazed terminal, tapered tower with a flared glazed cab ----
export function createHeathrow(x,z){
  const {box,add,beam,finish,pale}=landmark('heathrow',x,z),W=14,wave=u=>4.7+.42*Math.cos(u*Math.PI*4);
  box(-4,0,-.2,W,.3,4.2,S.stone,[.8,.82,.86]);
  box(-4,.3,-.2,W-.4,3.5,3.3,S.plaster,[1.05,1.1,1.2]);              // terminal body (back of the glass)
  box(-4,.9,1.45,W-1,2.7,.08,S.glass,[.8,.92,1],2);                   // glazed concourse front
  for(let i=0;i<=14;i++)box(-4-6.5+i*13/14,.9,1.52,.12,2.8,.1,S.trim,pale,1);
  const top=[],bot=[];for(let i=0;i<=48;i++){const u=i/48;top.push([-W/2-.3+u*(W+.6),wave(u)]);}
  for(let i=48;i>=0;i--)bot.push([top[i][0],top[i][1]-.38]);
  const shape=new THREE.Shape([...top,...bot].map(([px,py])=>new THREE.Vector2(px,py)));
  add(new THREE.ExtrudeGeometry(shape,{depth:4.6,bevelEnabled:false}),-4,0,-2.3,S.trim,[1.08,1.1,1.16],1);
  for(let i=0;i<=6;i++){const u=(i/6*W+.3)/(W+.6),cx=-4-W/2+i/6*W,h=wave(u)-.38;box(cx,.3,1.95,.18,h-.3,.18,S.trim,pale,1);}
  // control tower
  add(new THREE.CylinderGeometry(.62,1.05,10,12),9,5,0,S.stone,[1.05,1.07,1.1]);
  add(new THREE.CylinderGeometry(1.3,1.3,.3,12),9,10.1,0,S.trim,pale,1);
  add(new THREE.CylinderGeometry(2.0,1.35,2.4,12),9,11.45,0,S.glass,[.78,.92,1],2);
  add(new THREE.CylinderGeometry(2.15,2.15,.4,12),9,12.85,0,S.trim,pale,1);
  add(new THREE.CylinderGeometry(.9,1.1,.3,12),9,13.2,0,S.trim,pale,1);
  beam(v(9,13.3,0),v(9,15.4,0),.07,pale,1,5);
  const g=finish();return g;
}

// ---- Airplane (x forward): lathe fuselage, swept wings, nacelles, tail ----
export function createPlane(){
  const {box,add,finish}=landmark('plane',0,0),AX=1.6;
  const tab=[[.12,-8],[.34,-7.4],[.62,-6.2],[.9,-4.6],[1.08,-3],[1.12,-1.5],[1.12,4],[1.02,5.2],[.82,6.2],[.55,7.1],[.28,7.7],[0,8]];
  const R=y=>{for(let i=1;i<tab.length;i++)if(y<=tab[i][1]){const[a,b]=[tab[i-1],tab[i]];return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);}return 0;};
  const white=[1.2,1.3,1.5],pearl=[1.15,1.26,1.46],navy=[.07,.15,.44],red=[1.03,.17,.24],ys=(a,b,n)=>Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
  const body=(pts,a,l,surface,tint,bucket=0,dr=.03)=>{const g=lathe(pts.map(([r,y])=>[r+dr,y]),16,a,l);g.rotateZ(-Math.PI/2);add(g,0,AX,0,surface,tint,bucket);};
  body(tab,0,Math.PI*2,S.plaster,white,0,0);
  body(ys(-6.2,5,8).map(y=>[R(y),y]),Math.PI/2-1.15,2.3,S.plaster,navy);                    // navy belly
  for(const [a,l] of [[-.22,.1],[Math.PI+.12,.1]])body(ys(-5.5,4.6,8).map(y=>[R(y),y]),a,l,S.plaster,red,0,.04); // livery cheatline
  for(const [a,l] of [[-.5,.2],[Math.PI+.3,.2]])body(ys(-5,4.4,9).map(y=>[R(y),y]),a,l,S.glass,[.5,.75,.95],2); // window band
  body(ys(5.35,6.45,3).map(y=>[R(y),y]),-Math.PI/2-.85,1.7,S.glass,[.4,.65,.9],2);          // cockpit
  const wing=(pts,t,y,s)=>{const sh=new THREE.Shape(pts.map(([px,pz])=>new THREE.Vector2(px,pz*s)));const g=new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false});g.rotateX(Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+Math.abs(p.getZ(i))*.05);add(g,0,y,0,S.plaster,pearl);};
  for(const s of [-1,1]){
    wing([[3.2,.9],[-1.6,8.6],[-2.9,8.6],[-1.4,.9]],.22,AX-.35,s);
    wing([[-5.6,.5],[-7.0,3.4],[-7.9,3.4],[-7.4,.5]],.14,AX+.2,s);
    const n=lathe([[0,-1.3],[.3,-1.25],[.5,-1],[.52,0],[.46,.9],[.32,1.25],[0,1.3]],12);n.rotateZ(-Math.PI/2);add(n,1.6,AX-.8,s*3.5,S.plaster,pearl);
    const ring=lathe([[.36,.88],[.52,1.02],[.47,1.2],[.34,1.3]],12);ring.rotateZ(-Math.PI/2);add(ring,1.64,AX-.8,s*3.5,S.plaster,navy);
  }
  const fin=(pts,d,tint)=>{const sh=new THREE.Shape(pts.map(([a,b])=>new THREE.Vector2(a,b)));add(new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false}),0,AX+.4,-d/2,S.plaster,tint);};
  fin([[-4.6,.2],[-6.9,3.5],[-8.1,3.5],[-7.8,.2]],.16,navy);
  fin([[-4.6,.2],[-5.37,1.3],[-7.9,1.3],[-7.8,.2]],.2,red);
  return finish();
}

// ---- Catedral da Se: neo-gothic nave, buttresses, green dome on a drum, two spired towers ----
export function createSe(x,z){
  const {box,add,beam,gothic,finish,pale,slate}=landmark('se',x,z);
  const stoneT=[.98,.99,1.03],verd=[2.1,2.55,2.1],gilt=[.86,.76,.52],dark=[.5,.55,.62];
  box(0,0,0,30,12,14,S.stone,stoneT);box(0,11.8,0,30.6,.35,14.6,S.trim,pale,1);
  for(const sx of [-1,1])box(sx*11.4,12.15,-1,7.0,.12,12.8,S.roof,slate);
  box(0,12,0,15.6,3.5,14,S.stone,stoneT);
  const gable=new THREE.Shape([new THREE.Vector2(-8,0),new THREE.Vector2(8,0),new THREE.Vector2(0,4.1)]);
  add(new THREE.ExtrudeGeometry(gable,{depth:13.7,bevelEnabled:false}),0,15.4,-6.85,S.roof,slate);
  add(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-7.8,0),new THREE.Vector2(7.8,0),new THREE.Vector2(0,3.9)]),{depth:.22,bevelEnabled:false}),0,15.5,6.85,S.stone,stoneT);
  // facade: portal, steps, rose window, lancets
  gothic(0,7,0,0,1.5,3.2,6.4,dark,S.door,true);
  for(let i=0;i<5;i++)box(0,0,7.55+i*.75-.05,10-i*.4,1.5-i*.3,.75,S.stone,pale);
  add(new THREE.CylinderGeometry(1.5,1.5,.1,24).rotateX(Math.PI/2),0,11.4,7,S.glass,[.7,.85,1],2);
  add(new THREE.TorusGeometry(1.6,.1,5,24),0,11.4,7.05,S.trim,pale,1);
  for(let i=0;i<6;i++){const a=i*Math.PI/6;beam(v(Math.cos(a)*1.55,11.4+Math.sin(a)*1.55,7.05),v(-Math.cos(a)*1.55,11.4-Math.sin(a)*1.55,7.05),.045,pale,1,4);}
  for(const u of [-5,5])gothic(0,7,0,u,3,1.3,4.8);
  // side walls: buttress rhythm with recessed lancets, clerestory
  for(const sx of [-1,1]){
    for(let k=-2;k<=2;k++){const bz=k*3;box(sx*15.35,0,bz,.9,11.4,.7,S.stone,pale);add(new THREE.ConeGeometry(.5,1.7,4,1,false,Math.PI/4),sx*15.35,12.25,bz,S.stone,pale);}
    for(const wz of [-4.5,-1.5,1.5,4.5]){gothic(sx*15,0,sx*Math.PI/2,-sx*wz,4,1.1,5);gothic(sx*7.8,0,sx*Math.PI/2,-sx*wz,12.7,1,2.4);}
  }
  gothic(0,-7,Math.PI,-4,3,1.3,5);gothic(0,-7,Math.PI,4,3,1.3,5);
  // drum, windows, ribbed dome, lantern
  const DT=Math.PI/16;
  add(new THREE.CylinderGeometry(5.5,5.6,5.5,32),0,18.05,0,S.stone,stoneT);
  add(new THREE.CylinderGeometry(5.9,5.9,.4,32),0,15.5,0,S.trim,pale,1);add(new THREE.CylinderGeometry(5.85,5.85,.35,32),0,20.95,0,S.trim,pale,1);
  for(let k=0;k<8;k++){const a=(4*k+.5)*DT,r=5.5*Math.cos(DT/2);gothic(r*Math.sin(a),r*Math.cos(a),a,0,16.4,1.0,3.6);}
  const dome=new THREE.SphereGeometry(5.5,32,10,0,Math.PI*2,0,Math.PI/2);dome.scale(1,1.15,1);add(dome,0,21.1,0,S.roof,verd);
  for(let k=0;k<8;k++){
    const pts=[];for(let i=0;i<=10;i++){const t=i/10*Math.PI/2;pts.push(new THREE.Vector3(5.6*Math.cos(t),21.1+6.4*Math.sin(t)*1.0,0));}
    const t=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.1,4,false);t.rotateY(k*Math.PI/4);add(t,0,0,0,S.trim,pale,1);
  }
  add(new THREE.CylinderGeometry(1.0,1.15,2.6,12),0,28.2,0,S.stone,stoneT);
  add(new THREE.CylinderGeometry(1.45,1.45,.3,12),0,27.45,0,S.trim,pale,1);
  add(new THREE.ConeGeometry(1.3,2.0,12),0,30.5,0,S.roof,verd);
  box(0,31.4,0,.14,2.2,.14,S.trim,gilt,1);box(0,32.6,0,.9,.14,.14,S.trim,gilt,1);
  // twin towers with pinnacles and octagonal verdigris spires
  for(const sx of [-1,1]){
    const tx=sx*11,tz=4;
    box(tx,0,tz,6,26,6,S.stone,stoneT);
    for(const px of [-1,1])for(const pz of [-1,1]){
      const cx=tx+px*3,cz=tz+pz*3;box(cx,0,cz,1.0,24,1.0,S.stone,pale);
      add(new THREE.ConeGeometry(.7,3.2,8),cx,25.6,cz,S.stone,pale);
    }
    for(const y of [8,13.5,19,26])box(tx,y,tz,7.2,.3,7.2,S.trim,pale,1);
    for(const [face,cx,cz] of [[0,tx,tz+3],[sx*Math.PI/2,tx+sx*3,tz]]){
      for(const [y,h,w] of [[4,3.4,1.1],[9.5,3.4,1.1],[14.8,3.4,1.1]])gothic(cx,cz,face,0,y,w,h);
      for(const u of [-.9,.9])gothic(cx,cz,face,u,20.4,1.0,5);
    }
    add(new THREE.CylinderGeometry(.12,3.0,10.5,8),tx,31.8,tz,S.roof,verd);
    beam(v(tx,36.9,tz),v(tx,39.3,tz),.08,gilt,1,6);box(tx,38.2,tz,1,.12,.12,S.trim,gilt,1);
  }
  return finish();
}

// ---- Ponte Estaiada: tapered X pylon, deck through it, fans of straight stays ----
export function createEstaiada(x,z){
  const {box,add,finish,lit,lbox,lbeam,pale}=landmark('estaiada',x,z),concrete=[1.04,1.07,1.14],steel=[.9,.95,1.05];
  const loft=(a,b,wa,da,wb,db)=>{
    const g=new THREE.BoxGeometry(1,1,1).toNonIndexed(),p=g.attributes.position,d=b.clone().sub(a).normalize();
    for(let i=0;i<p.count;i++){
      const t=p.getY(i)+.5,w=wa+(wb-wa)*t,dep=da+(db-da)*t,cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t;
      p.setXYZ(i,cx+d.y*p.getX(i)*w,cy-d.x*p.getX(i)*w,p.getZ(i)*dep);
    }
    g.computeVertexNormals();return g;
  };
  const slope=8/28,H=46,lx=y=>-8+y*slope;
  for(const s of [-1,1]){
    add(loft(v(s*lx(.5),.5,0),v(s*lx(H),H,0),3.0,2.8,1.4,1.4),0,0,0,S.plaster,concrete);
    box(s*8,0,0,4.4,1.1,3.6,S.stone,[.9,.92,.96]);
  }
  box(0,3.6,0,8,1.2,56,S.plaster,concrete);box(0,4.8,0,7.2,.06,56,S.plaster,[.2,.22,.25]);
  for(const pz of [-27.2,27.2])box(0,0,pz,6.4,3.6,2.4,S.stone,[.9,.92,.96]);
  for(const s of [-1,1])box(s*3.9,4.8,0,.2,.7,56,S.trim,pale,1);
  // stays: leg A (upper right) feeds the right deck edge, leg B the left
  const ay=[45,42.4,39.8,37.2,34.6,32,29.4],run=[7,10.5,14,17.5,21,24.5,27.4];
  for(const s of [1,-1])ay.forEach((y,k)=>{for(const d of [-1,1])lbeam(1,v(s*lx(y)*1,y,0),v(s*3.9,5.5,d*run[k]),.045,.11,4);});
  // Night: cool edge strips down both pylon legs (inner edge brighter), deck-edge strips, warm base wash.
  for(const s of [-1,1]){
    const a=v(s*lx(.5),.5,0),b=v(s*lx(H),H,0),d=b.clone().sub(a).normalize(),n=v(d.y,-d.x,0);
    const at=(t,e,zs)=>{const c=a.clone().lerp(b,t),w=3+(1.4-3)*t,dep=2.8-1.4*t;return v(c.x+n.x*e*w/2,c.y+n.y*e*w/2,zs*(dep/2+.03));};
    for(const e of [-1,1])for(const zs of [-1,1])lbeam(1,at(.08,e,zs),at(1,e,zs),.1,e===s?1:.75,4);
    const th=-s*Math.asin(d.x);
    for(const zs of [-1,1]){const pg=new THREE.PlaneGeometry(2.5,14);pg.rotateZ(th);lit(2,pg,s*lx(7),7.3,zs*1.34,.6,0);}
    lbox(1,s*4.015,4.95,0,.03,.4,56,.6);
  }
  return finish();
}

// ---- London Eye: rotating wheel (glowing rim + pods) and a static A-frame on the riverbank ----
export function createLondonEye(x,z){
  const R=16,wheel=new THREE.Group(),flat=g=>{const n=g.index?g.toNonIndexed():g;for(const k of Object.keys(n.attributes))if(!['position','normal','uv'].includes(k))n.deleteAttribute(k);return n;};
  const cyl=(a,b,r,seg=4)=>{const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),seg,1,true);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0,1,0),d.normalize()));const m=a.clone().add(b).multiplyScalar(.5);return flat(g.translate(m.x,m.y,m.z));};
  const rim=[],frame=[];
  for(const s of [-1,1])rim.push(flat(new THREE.TorusGeometry(R,.26,5,64).translate(0,0,s*.7)));
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,c=Math.cos(a)*R,s=Math.sin(a)*R;rim.push(cyl(v(c,s,-.7),v(c,s,.7),.07));}
  for(let i=0;i<16;i++)for(const sz of [-1,1]){const a=i/16*Math.PI*2+(sz>0?Math.PI/16:0);frame.push(cyl(v(Math.cos(a)*1.1,Math.sin(a)*1.1,sz*1.1),v(Math.cos(a)*R,Math.sin(a)*R,sz*.7),.05));}
  frame.push(flat(new THREE.CylinderGeometry(1.1,1.1,2.4,12).rotateX(Math.PI/2)),flat(new THREE.CylinderGeometry(.5,1.1,.6,12).rotateX(Math.PI/2).translate(0,0,1.5)),cyl(v(0,0,-3.2),v(0,0,1.4),.4,8));
  const mk=(parts,mat,name,cast=true)=>{const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=cast;m.receiveShadow=true;wheel.add(m);return m;};
  mk(rim,blockMaterial(P.eyeRim,{glow:true,k:1}),'eye-rim');
  mk(frame,new THREE.MeshStandardMaterial({color:P.white,roughness:.6}),'eye-spokes',false);
  const podGeo=flat(new THREE.SphereGeometry(1,10,4)),pods=new THREE.InstancedMesh(podGeo,blockMaterial(P.eyePod,{glow:true,k:1.2}),32),m4=new THREE.Matrix4(),q=new THREE.Quaternion();
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2;pods.setMatrixAt(i,m4.compose(v(Math.cos(a)*(R+.5),Math.sin(a)*(R+.5),0),q.setFromAxisAngle(v(0,0,1),a+Math.PI/2),v(1.05,.62,.8)));}
  pods.name='eye-pods';pods.castShadow=true;wheel.add(pods);
  wheel.name='eye-wheel';wheel.position.set(x,18,z);
  wheel.userData.dispose=()=>wheel.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  const {beam,box,finish,pale}=landmark('eyeframe',x,z);
  for(const sx of [-1,1]){beam(v(0,18,-3.1),v(sx*3.6,.4,-7.4),.5,pale,1,8);}
  beam(v(-2.1,9.6,-5.2),v(2.1,9.6,-5.2),.22,pale,1,6);box(0,17.2,-3.1,1.2,1.6,1.2,S.trim,pale,1);box(0,0,-7.4,10.4,.8,3,S.stone);
  return {wheel,frame:finish()};
}

// ---- Edificio Copan: S-curved slab, continuous white brise-soleil floor bands over dark glazing ----
export function createCopan({x,z,len,amp,depth,h}){
  const {box,add,sweep,finish,pale}=landmark('copan',x,z),D=depth/2,path=t=>[-len/2+t*len,amp*Math.sin(2*Math.PI*t)],N=32,F=3.2;
  const rect=(d0,d1,y0,y1)=>[[d0,y0],[d1,y0],[d1,y1],[d0,y1]],white=[1.2,1.2,1.22],dark=[.5,.55,.65],glass=[.7,.82,.95];
  sweep(rect(-D,D,0,F),path,N,S.stone,dark);                                   // commercial base
  sweep(rect(-D+.75,D-.75,F,h-.5),path,N,S.stone,dark);                        // core behind the glazing
  for(const k of [1,-1]){
    sweep(k>0?[[D+.03,.5],[D+.03,F-.6]]:[[-D-.03,F-.6],[-D-.03,.5]],path,N,S.litGlass,glass,2,false); // lit shopfronts
    sweep(k>0?[[D-.72,F],[D-.72,h-.5]]:[[-D+.72,h-.5],[-D+.72,F]],path,N,S.glass,glass,2,false);
  }
  for(let y=F;y<h-.5;y+=3)sweep(rect(-D,D,y,y+.65),path,N,S.plaster,white);   // one continuous projecting ribbon per floor
  sweep(rect(-D-.3,D+.3,h-.5,h),path,N,S.plaster,white);                       // flat roof slab
  const [ax,az]=path(.27),[bx,bz]=path(.66);
  box(ax,h,az,3,2.2,3,S.stone,[.8,.84,.9]);box(ax,h+2.2,az,3.3,.2,3.3,S.trim,pale,1);
  add(new THREE.CylinderGeometry(1,1,1.8,10),bx,h+.9,bz,S.trim,[.7,.74,.8],1);add(new THREE.ConeGeometry(1.1,.6,10),bx,h+2.1,bz,S.roof,[.87,.96,1.04]);
  return finish();
}

// ---- Riverside Museum: sawtooth zinc roof, glazed front and gable ends ----
export function createRiverside(x,z){
  const {box,add,finish,lit,lbox,lbeam}=landmark('riverside',x,z),zinc=[.6,.64,.7],silver=[.95,.98,1.04],glass=[.7,.82,.95],T=.7,W=7.5;
  const top=RIVERSIDE_KNOTS.map(([u,y])=>[u-16,y]),low=top.map(([px,py])=>[px,py-T]).reverse();
  const poly=pts=>new THREE.Shape(pts.map(([px,py])=>new THREE.Vector2(px,py)));
  add(new THREE.ExtrudeGeometry(poly([...top,...low]),{depth:2*W,bevelEnabled:false}),0,0,-W,S.trim,zinc);   // pleated roof sheet
  const under=[[-15.7,.3],[15.7,.3],...[...RIVERSIDE_KNOTS].reverse().map(([u,y])=>[u-16,y-T+.05])];
  add(new THREE.ExtrudeGeometry(poly(under),{depth:.25,bevelEnabled:false}),0,0,6.6,S.glass,glass,2);             // glazed front under the roof
  add(new THREE.ExtrudeGeometry(poly(under),{depth:.2,bevelEnabled:false}),0,0,-W+.3,S.plaster,[.5,.55,.6]);
  for(let u=-14;u<=14;u+=2)box(u,.3,6.95,.14,riversideRoofAt(u+16)-T-.35,.16,S.trim,silver,1);
  for(const s of [-1,1]){
    const he=riversideRoofAt(s<0?0:32)-T;
    box(s*15.7,.3,0,.3,he-.3,13.8,S.litGlass,glass,2);
    for(const dz of [-6.9,-3.45,0,3.45,6.9])box(s*15.85,.3,dz,.22,he-.2,.24,S.trim,silver,1);
    box(s*15.85,he*.5,0,.22,.2,14,S.trim,silver,1);
    const pg=new THREE.PlaneGeometry(13.4,he-.6);pg.rotateY(s*Math.PI/2);lit(2,pg,s*15.99,.4+(he-.6)/2,0,.3,.12);
  }
  // Night: cool zig-zag roofline strips (front/back top edge, front lower edge), warm entrance band + faint glazed-front wash, warm gable glow above.
  for(let i=0;i<top.length-1;i++){
    const [x0,y0]=top[i],[x1,y1]=top[i+1];
    for(const zz of [-7.515,7.515])lbeam(1,v(x0,y0-.08,zz),v(x1,y1-.08,zz),.05,1,4);
    lbeam(1,v(x0,y0-T+.1,7.515),v(x1,y1-T+.1,7.515),.04,.45,4);
  }
  lbox(0,0,.45,7.07,28,.12,.04,.6);
  lit(2,new THREE.ShapeGeometry(poly(under)),0,0,7.08,.16,.04);
  return finish();
}

// ---- University of Glasgow: Gothic Revival range, steep slate roofs, turrets, tower with open-lattice spire ----
export function createUniversity(x,z,lift=0){
  const {group,box,add,beam,gothic,finish,pale,slate}=landmark('university',x,z),sand=[1,.9,.78],light=[1.1,1.03,.91],dark=[.6,.55,.5],gilt=[.86,.76,.52];
  group.position.y=lift;
  const hip=(cx,y,cz,w,h,d)=>{const g=new THREE.CylinderGeometry(0,1,1,4,1,false,Math.PI/4);g.scale(w/1.4142,h,d/1.4142);add(g,cx,y+h/2,cz,S.roof,slate);};
  const gable=(cx,y,cz,w,h,len,alongX)=>{ // triangular prism roof: ridge along x or z
    const g=new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(0,h)]),{depth:len,bevelEnabled:false});
    g.translate(0,0,-len/2);if(alongX)g.rotateY(Math.PI/2);add(g,cx,y,cz,S.roof,slate);
  };
  const turret=(tx,tz,hh)=>{add(new THREE.CylinderGeometry(.95,1.05,hh,8),tx,hh/2,tz,S.stone,sand);add(new THREE.CylinderGeometry(1.2,1.2,.3,8),tx,hh,tz,S.trim,pale,1);add(new THREE.ConeGeometry(1.25,3.6,8),tx,hh+2.1,tz,S.roof,slate);beam(v(tx,hh+3.8,tz),v(tx,hh+4.8,tz),.05,gilt,1,4);};
  for(const s of [-1,1]){
    // wing: sandstone range, string course, cornice, steep gable roof with dormers
    box(s*17.8,0,0,25.6,10,12,S.stone,sand);box(s*17.8,5.7,0,25.9,.25,12.3,S.trim,light,1);box(s*17.8,10,0,26.2,.5,12.6,S.trim,light,1);
    gable(s*17.8,10.5,0,12.8,6.5,26,true);
    for(const dx of [8.5,14,19.5,25]){
      const cx=s*dx;box(cx,10.2,4.1,2,2.9,2.2,S.stone,sand);gable(cx,13.1,4.1,2.4,1.4,2.2,false);gothic(cx,5.2,0,0,11.2,.8,1.6,dark,S.litGlass,false);
    }
    for(let i=0;i<9;i++){const bx=s*(5.2+i*3.1);box(bx,0,6.2,.5,10.2,.5,S.stone,light);add(new THREE.ConeGeometry(.4,1.2,4,1,false,Math.PI/4),bx,10.8,6.2,S.stone,light);}
    for(let i=0;i<8;i++){const wx=s*(6.75+i*3.1);gothic(0,6,0,wx,1.1,1.3,4.5,dark,S.litGlass);gothic(0,6,0,wx,6.4,1.1,2.9,dark,S.litGlass);}
    // end pavilion with cross gable and corner turrets
    box(s*33,0,.6,4.8,13,13.2,S.stone,sand);box(s*33,13,.6,5.2,.45,13.6,S.trim,light,1);gable(s*33,13.4,.6,5.2,5.2,13.6,false);
    gothic(s*33,7.2,0,0,2.5,1.4,5.6,dark,S.litGlass);gothic(s*33,7.2,0,0,9.2,1.2,2.6,dark,S.litGlass);
    for(const [tx,tz,hh] of [[s*30.8,6.9,12],[s*35.2,6.9,12],[s*35.2,-5.9,12]])turret(tx,tz,hh);
    // tower flank buttresses
    for(const bz of [-.8,6.4])box(s*4.35,0,bz,.9,17,.9,S.stone,light);
  }
  // centre block beneath the tower
  box(0,0,0,10,9,12,S.stone,sand);box(0,9,0,10.6,.5,12.6,S.trim,light,1);gable(0,9.5,0,12.8,4.5,10.6,true);
  // tower: base, big window, belfry with lancets, cornice, pinnacles
  const tz=3;
  box(0,0,tz,8,17,8,S.stone,sand);box(0,17,tz,7,6,7,S.stone,light);box(0,23,tz,8.4,.6,8.4,S.trim,light,1);
  for(const y of [7,12.5])box(0,y,tz,8.3,.3,8.3,S.trim,light,1);
  gothic(0,7,0,0,1.2,2.4,5.2,dark,S.door);gothic(0,7,0,0,8,1.8,6,dark,S.litGlass);
  for(const [face,cx,cz] of [[0,0,tz+3.5],[Math.PI,0,tz-3.5],[Math.PI/2,3.5,tz],[-Math.PI/2,-3.5,tz]])
    for(const u of [-1.6,1.6])gothic(cx,cz,face,u,18.2,1.1,3.8,dark,S.litGlass);
  for(const px of [-3.7,3.7])for(const pz of [-3.7,3.7]){box(px,23.6,tz+pz,1,2.4,1,S.stone,light);add(new THREE.ConeGeometry(.75,2.8,4,1,false,Math.PI/4),px,27.2,tz+pz,S.roof,slate);}
  // open-lattice tapering spire: leaning posts, square rings and diagonal bracing, gilded finial
  const levels=[[23.6,2.5],[26,2],[28.2,1.5],[30.2,1],[32,.55]],corner=(l,i)=>v([-1,1,1,-1][i]*l[1],l[0],tz+[-1,-1,1,1][i]*l[1]);
  for(let k=0;k<levels.length;k++){
    for(let i=0;i<4;i++){
      beam(corner(levels[k],i),corner(levels[k],(i+1)%4),.07,slate,0,4);
      if(k<levels.length-1){beam(corner(levels[k],i),corner(levels[k+1],i),.13,slate,0,4);beam(corner(levels[k],i),corner(levels[k+1],(i+1)%4),.06,slate,0,4);}
    }
  }
  for(let i=0;i<4;i++)beam(corner(levels.at(-1),i),v(0,33.2,tz),.1,slate,0,4);
  beam(v(0,33.2,tz),v(0,34.7,tz),.06,gilt,1,4);
  return finish();
}

// ---- Boat: rounded hull with tapered bow, deck, windowed cabin; cached per colour pair ----
const boatCache=new Map(),tintOf=hex=>{const c=new THREE.Color(hex),b=new THREE.Color().setRGB(.788,.745,.655,THREE.SRGBColorSpace);return [c.r/b.r,c.g/b.g,c.b/b.b].map(q=>Math.min(q,3));};
export function createBoat(hullColor,cabinColor){
  const key=hullColor+cabinColor,hit=boatCache.get(key);if(hit)return hit.clone();
  const {box,add,finish,pale}=landmark('boat',0,0),hull=tintOf(hullColor),cab=tintOf(cabinColor),glass=[.7,.82,.95];
  const plan=(k=1)=>{
    const s=new THREE.Shape();s.moveTo(-3*k,-.7*k);s.quadraticCurveTo(-3*k,-1*k,-2.6*k,-1*k);s.lineTo(.3*k,-1*k);s.bezierCurveTo(1.7*k,-1*k,2.5*k,-.5*k,3*k,0);
    s.bezierCurveTo(2.5*k,.5*k,1.7*k,1*k,.3*k,1*k);s.lineTo(-2.6*k,1*k);s.quadraticCurveTo(-3*k,1*k,-3*k,.7*k);return s;
  };
  const flat=(g,y)=>{g.rotateX(-Math.PI/2);return [g,y];};
  let [g,y]=flat(new THREE.ExtrudeGeometry(plan(.93),{depth:.26,bevelEnabled:false,curveSegments:3}),0);add(g,0,y,0,S.plaster,hull.map(q=>q*.45));        // dark waterline
  [g,y]=flat(new THREE.ExtrudeGeometry(plan(),{depth:.5,bevelEnabled:true,bevelThickness:.1,bevelSize:.08,bevelSegments:1,curveSegments:3}),.26);add(g,0,y+.1,0,S.plaster,hull); // rounded topsides
  [g,y]=flat(new THREE.ExtrudeGeometry(plan(.9),{depth:.05,bevelEnabled:false}),0);add(g,0,.97,0,S.plaster,[1.1,.95,.8],1);                    // deck
  const cabin=new THREE.Shape();cabin.moveTo(-1.7,-.8);cabin.lineTo(.5,-.8);cabin.quadraticCurveTo(.95,-.8,.95,-.35);cabin.lineTo(.95,.35);cabin.quadraticCurveTo(.95,.8,.5,.8);cabin.lineTo(-1.7,.8);cabin.closePath();
  [g,y]=flat(new THREE.ExtrudeGeometry(cabin,{depth:.95,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:1,curveSegments:2}),0);add(g,0,y+1,0,S.plaster,cab);
  for(const sz of [-1,1])box(-.5,1.4,sz*.88,2.3,.42,.06,S.glass,glass,2);
  box(.93,1.4,0,.06,.42,1.1,S.glass,glass,2);
  box(-.4,2.0,0,3,.12,1.9,S.trim,pale,1);
  const out=finish();boatCache.set(key,out);return out.clone();
}

// ---- Glasgow City Chambers: Italian-Renaissance palace, sandstone, rusticated base, pedimented portico, domed tower + corner cupolas ----
// Local frame: x along the facade, +z toward George Square, y up. Window/arch openings are rings (recessed glass) so no faces are coplanar.
export function createChambers(x,z){
  const {box,add,finish,pale,slate}=landmark('chambers',x,z),sand=[1.08,.97,.76],light=[1.22,1.12,.9],rust=[.98,.86,.62],joint=[.7,.6,.42],glass=[.75,.85,.95],lead=[.95,1,1.04],gilt=[1.1,.9,.45],dark=[.45,.4,.34];
  const cyl=(rt,rb,y,h,cx,cz,seg=14,surface=S.stone,tint=sand,bucket=0)=>add(new THREE.CylinderGeometry(rt,rb,h,seg),cx,y+h/2,cz,surface,tint,bucket);
  const dome=(r,y,h,cx,cz,seg=16)=>add(lathe([[r,0],[r*.99,h*.06],[r*.9,h*.35],[r*.7,h*.62],[r*.42,h*.84],[r*.16,h*.97],[0,h]].map(([a,b])=>[a,b]),seg),cx,y,cz,S.roof,lead);
  const outline=(w,yb,yt,round)=>{const s=new THREE.Shape(),r=w/2;s.moveTo(-r,yb);s.lineTo(r,yb);if(round){s.lineTo(r,yt-r);s.absarc(0,yt-r,r,0,Math.PI,false);}else{s.lineTo(r,yt);s.lineTo(-r,yt);}s.closePath();return s;};
  // Recessed opening: glass pane against the wall plane z0, framed by an extruded surround ring (+ optional pediment / lintel slab).
  const win=(cx,y,w,h,z0,{round=false,surface=S.litGlass,tint=glass,ped=0}={})=>{
    const outer=outline(w+.5,-.12,h+.25,round);outer.holes.push(new THREE.Path(outline(w,0,h,round).getPoints(5)));
    add(new THREE.ExtrudeGeometry(outer,{depth:.16,bevelEnabled:false,curveSegments:5}),cx,y,z0,S.stone,light,1);
    add(new THREE.ExtrudeGeometry(outline(w,0,h,round),{depth:.05,bevelEnabled:false,curveSegments:5}),cx,y,z0,surface,tint,surface===S.door?0:2);
    box(cx,y-.27,z0,w+.8,.15,.3,S.stone,light,1);
    const top=y+h+.25+(round?0:0);
    if(ped===1){const t=new THREE.Shape([new THREE.Vector2(-w/2-.45,0),new THREE.Vector2(w/2+.45,0),new THREE.Vector2(0,.5)]);add(new THREE.ExtrudeGeometry(t,{depth:.24,bevelEnabled:false}),cx,top,z0,S.stone,light,1);}
    else if(ped===2)box(cx,top,z0,w+.9,.18,.3,S.stone,light,1);
  };
  const F=2.2;
  // main body, rusticated base with joint courses, string courses and cornice
  box(0,0,0,30,10.2,4.4,S.stone,sand);
  box(0,0,0,30.4,4,4.8,S.stone,rust);
  for(let y=.7;y<4;y+=.7)box(0,y,F+.2+.03,30.4,.08,.06,S.stone,joint);
  box(0,3.95,0,31,.3,5.2,S.stone,light,1);box(0,7.85,0,30.5,.2,4.9,S.stone,light,1);
  box(0,10.2,0,31.4,.6,5.2,S.stone,light,1);
  for(let cx=-15;cx<=15.01;cx+=1)box(cx,9.8,F+.15,.3,.4,.3,S.stone,light,1);
  box(0,10.8,0,28,.5,3.2,S.roof,slate);
  for(const s of [-1,1]){
    // wing windows: arched ground floor, pedimented piano nobile, small attic row
    for(const wx of [4.6,6.8,9]){
      win(s*wx,1,1.1,2.4,F+.2,{round:true,surface:S.glass});
      win(s*wx,4.7,1.1,2.3,F,{ped:wx===6.8?1:2});
      win(s*wx,8.35,1.0,1.3,F,{ped:2});
    }
    for(let px=3.8;px<10.7;px+=.6){box(s*px,10.8,2.1,.2,.7,.2,S.stone,light,1);}
    box(s*7.25,10.8,2.1,6.9,.14,.5,S.stone,light,1);box(s*7.25,11.55,2.1,6.9,.14,.5,S.stone,light,1);
    // corner pavilion with its own cupola
    const px=s*12.8;
    box(px,0,.3,4.4,12,5,S.stone,sand);box(px,0,.3,4.8,4,5.4,S.stone,rust);
    for(let y=.7;y<4;y+=.7)box(px,y,3.03,4.8,.08,.06,S.stone,joint);
    box(px,3.95,.3,5,.3,5.6,S.stone,light,1);box(px,7.85,.3,4.6,.2,5.1,S.stone,light,1);box(px,12,.3,5.2,.5,5.6,S.stone,light,1);
    win(px,1,1.4,2.4,3,{round:true,surface:S.glass});win(px,4.7,1.2,2.3,2.8,{ped:1});win(px,8.35,1.1,1.3,2.8,{ped:2});win(px,10.3,.9,1,2.8,{round:true});
    for(const q of [-1,1])box(px+q*1.9,0,3.0,.4,12,.3,S.stone,light,1); // quoin strips
    cyl(1.1,1.2,12.5,.9,px,.3);cyl(1.3,1.3,13.4,.2,px,.3,14,S.trim,light,1);dome(1.25,13.6,1.6,px,.3,14);cyl(.2,.2,15.2,.55,px,.3,8,S.trim,light,1);cyl(0,.3,15.75,.5,px,.3,8,S.trim,gilt,1);
  }
  // central pedimented portico: arched loggia below, columned piano nobile above
  box(0,0,1.85,6.2,10.2,3.7,S.stone,sand);box(0,0,1.9,6.6,4,4.2,S.stone,rust);
  for(let y=.7;y<4;y+=.7)box(0,y,3.93,6.6,.08,.06,S.stone,joint);
  win(0,0,1.5,3.2,3.9,{round:true,surface:S.door,tint:dark});
  for(const s of [-1,1])win(s*2.15,0,1.1,2.6,3.9,{round:true,surface:S.door,tint:dark});
  box(0,0,4.7,5.4,.2,1.8,S.stone,pale);box(0,.2,4.5,4.4,.2,1.2,S.stone,pale);
  box(0,3.95,1.9,7,.3,4.4,S.stone,light,1);
  for(const wx of [-1.7,0,1.7])win(wx,4.7,.8,2.6,3.7,{round:true});
  for(const wx of [-2.55,-.85,.85,2.55]){cyl(.22,.22,4.25,3.8,wx,3.95,12,S.stone,light);box(wx,4.25,3.95,.6,.15,.6,S.stone,light,1);box(wx,8.0,3.95,.6,.2,.6,S.stone,light,1);}
  box(0,8.05,1.9,7.4,.9,4.5,S.stone,light,1);
  for(const wx of [-1.4,1.4])win(wx,9.3,.7,.8,3.7,{ped:2});
  box(0,9.35,3.74,.9,.9,.12,S.stone,gilt,1);
  box(0,10.2,1.9,7.4,.6,4.6,S.stone,light,1);
  const ped=new THREE.Shape([new THREE.Vector2(-3.9,0),new THREE.Vector2(3.9,0),new THREE.Vector2(0,1.5)]);
  add(new THREE.ExtrudeGeometry(ped,{depth:.8,bevelEnabled:false}),0,10.8,3.4,S.stone,light,1);
  // tower, colonnaded drum, ribbed dome and lantern; pole base lands at y=18.5
  box(0,10.2,0,5.8,3,4,S.stone,sand);box(0,13.2,0,6.6,.3,4.8,S.stone,light,1);
  for(const s of [-1,1])for(const q of [-1,1])box(s*2.8,10.8,q*1.9,.4,2.4,.4,S.stone,light,1);
  cyl(1.55,1.6,13.5,1.2,0,0);
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;cyl(.14,.14,13.5,1.2,Math.cos(a)*1.78,Math.sin(a)*1.78,8,S.stone,light);}
  cyl(2.1,2.1,14.7,.3,0,0,16,S.trim,light,1);
  dome(2.0,15,2,0,0,20);
  cyl(.45,.5,17,.9,0,0,10,S.stone,light);cyl(.58,.58,17.85,.15,0,0,10,S.trim,light,1);cyl(0,.5,18,.5,0,0,10,S.roof,lead);
  return finish();
}

// ---- Duke of Wellington statue: stepped plinth, bronze horse and rider, traffic cone (the Glasgow in-joke) ----
export function createWellington(x,z){
  const {box,add,finish,pale}=landmark('wellington',x,z),stone=[1,.96,.9],bz=tintOf(P.bronze).map((q,i)=>q*[.62,.66,.6][i]),dk=tintOf('#4a3a22').map(q=>q*.8),orange=tintOf('#f36b21'),white=[1.2,1.2,1.2];
  const br=(g,px,py,pz,tint=bz)=>add(g,px,py,pz,S.trim,tint,0);
  const limb=(a,b,r1,r2,tint=bz,seg=6)=>{const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r2,r1,d.length(),seg);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));const m=a.clone().add(b).multiplyScalar(.5);br(g,m.x,m.y,m.z,tint);};
  const ell=(rx,ry,rz,px,py,pz,tint=bz)=>{const g=new THREE.SphereGeometry(1,9,6);g.scale(rx,ry,rz);br(g,px,py,pz,tint);};
  // plinth: base steps, dado with moulding, cornice and cap slab
  box(0,0,0,5.8,.5,3,S.stone,stone);box(0,.5,0,5.3,.5,2.6,S.stone,pale);box(0,1,0,4.7,1.1,2.1,S.stone,stone);box(0,1,0,4.95,.15,2.35,S.stone,pale);
  box(0,1.5,1.08,2.2,.8,.06,S.trim,stone,1);
  box(0,2.1,0,5.1,.25,2.6,S.stone,pale);box(0,2.35,0,5.4,.25,2.8,S.stone,stone);
  const y0=2.6;
  for(const [hx,hz] of [[1.4,-.45],[1.4,.45],[-1.45,-.45],[-1.45,.45]]){
    br(new THREE.CylinderGeometry(.19,.22,.22,8),hx,y0+.11,hz,dk);
    limb(v(hx,y0+.22,hz),v(hx+(hx<0?-.05:.05),y0+1.7,hz*.9),.12,.22);
  }
  ell(1.55,.78,.68,0,y0+2.05,0);ell(.85,.85,.68,1.1,y0+2.2,0);ell(.95,.82,.68,-1.2,y0+2.05,0); // barrel, chest, haunch
  limb(v(1.55,y0+2.35,0),v(2.35,y0+3.5,0),.45,.3);                                           // neck
  limb(v(2.2,y0+3.55,0),v(3.05,y0+3.05,0),.3,.18);ell(.33,.3,.28,2.45,y0+3.65,0);              // head, jaw
  for(const s of [-1,1])br(new THREE.ConeGeometry(.07,.3,5),2.3,y0+3.95,s*.16,dk);            // ears
  limb(v(1.5,y0+2.9,0),v(2.15,y0+3.8,0),.09,.09,dk,6);                                       // mane
  limb(v(-2,y0+2.5,0),v(-2.45,y0+1.2,0),.17,.05,dk);                                         // tail
  ell(.85,.12,.75,-.15,y0+2.78,0,dk);                                                        // saddle cloth
  const hip=v(-.15,y0+3.05,0);
  for(const s of [-1,1]){const k=v(.3,y0+2.55,s*.72);limb(hip.clone().setZ(s*.25),k,.2,.14);limb(k,v(.2,y0+1.95,s*.76),.13,.1);br(new THREE.BoxGeometry(.45,.12,.2),.38,y0+1.88,s*.78,dk);}
  limb(v(-.15,y0+3.1,0),v(-.1,y0+3.85,0),.34,.3);ell(.36,.5,.34,-.12,y0+3.6,0);               // torso
  limb(v(.0,y0+3.8,.28),v(.75,y0+3.35,.3),.1,.08);limb(v(0,y0+3.8,-.28),v(-.05,y0+3.2,-.4),.1,.08); // arms
  ell(.24,.26,.24,-.1,y0+4.2,0);                                                              // head
  br(new THREE.ConeGeometry(.3,.75,10),-.1,y0+4.8,0,orange);br(new THREE.CylinderGeometry(.19,.24,.14,10),-.1,y0+4.85,0,white);br(new THREE.CylinderGeometry(.34,.34,.05,10),-.1,y0+4.45,0,orange);
  return finish();
}
