import * as THREE from 'three';
import { SURFACE as S, townhouseMaterials } from './building-slice-materials.js';

export const TOWER_LOT_ID = 'block--295--49';

export function towerRecipe(plot) {
  let seed=2166136261;
  for(const c of plot.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  return {floors:Math.round(plot.height/3),reveal:.30,windowSeed:seed%13,setbacks:[.12,.76,.91],chamfer:.9};
}

export function createTowerSlice(plot,recipe=towerRecipe(plot)) {
  const {x,z,width,depth,height}=plot;
  if(!['tower','office','midrise'].includes(plot.kind)||![x,z,width,depth,height].every(Number.isFinite)||width<9.8||depth<9.8||height<40)throw new TypeError('Invalid high-rise slice plot');
  const w=width-.4,d=depth-.4;
  const buckets=Array.from({length:3},()=>({position:[],normal:[],uv:[],aSurface:[],color:[]}));
  const colors={[S.stone]:[.93,.97,1],[S.trim]:[.88,.95,1],[S.roof]:[.57,.67,.76],[S.plaster]:[.91,.96,1],[S.glass]:[.86,.97,1],[S.litGlass]:[1,.97,.90]};
  function quad(points,normal,surface,bucket=0){
    const p=points.map(v=>new THREE.Vector3(...v));
    if(new THREE.Vector3().subVectors(p[1],p[0]).cross(new THREE.Vector3().subVectors(p[2],p[0])).dot(new THREE.Vector3(...normal))<0)p.reverse();
    const b=buckets[bucket],axis=Math.abs(normal[1])>.7?'y':Math.abs(normal[0])>.7?'x':'z';
    for(const i of [0,1,2,0,2,3]){const v=p[i];b.position.push(v.x,v.y,v.z);b.normal.push(...normal);b.aSurface.push(surface);b.color.push(...(colors[surface]||[1,1,1]));b.uv.push(...(axis==='y'?[v.x,v.z]:[normal[2]*v.x-normal[0]*v.z,v.y]));}
  }
  function box(cx,cy,cz,bw,bh,bd,surface,bucket=0){
    const X=[cx-bw/2,cx+bw/2],Y=[cy-bh/2,cy+bh/2],Z=[cz-bd/2,cz+bd/2];
    for(const [zz,n]of [[Z[0],-1],[Z[1],1]])quad([[X[0],Y[0],zz],[X[1],Y[0],zz],[X[1],Y[1],zz],[X[0],Y[1],zz]],[0,0,n],surface,bucket);
    for(const [xx,n]of [[X[0],-1],[X[1],1]])quad([[xx,Y[0],Z[0]],[xx,Y[0],Z[1]],[xx,Y[1],Z[1]],[xx,Y[1],Z[0]]],[n,0,0],surface,bucket);
    for(const [yy,n]of [[Y[0],-1],[Y[1],1]])quad([[X[0],yy,Z[0]],[X[1],yy,Z[0]],[X[1],yy,Z[1]],[X[0],yy,Z[1]]],[0,n,0],surface,bucket);
  }
  function ring(y,bw,bd,c,surface,shift=0){
    const p=[[-bw/2+c,-bd/2],[bw/2-c,-bd/2],[bw/2,-bd/2+c],[bw/2,bd/2-c],[bw/2-c,bd/2],[-bw/2+c,bd/2],[-bw/2,bd/2-c],[-bw/2,-bd/2+c]];
    for(let i=0;i<8;i+=2)quad([[shift,y,0],...[0,1,2].map(j=>[p[(i+j)%8][0]+shift,y,p[(i+j)%8][1]])],[0,1,0],surface);
  }
  function tier(y0,y1,bw,bd,rows,lobby=false,shift=0){
    const c=recipe.chamfer,p=[[-bw/2+c,-bd/2],[bw/2-c,-bd/2],[bw/2,-bd/2+c],[bw/2,bd/2-c],[bw/2-c,bd/2],[-bw/2+c,bd/2],[-bw/2,bd/2-c],[-bw/2,-bd/2+c]];
    p.forEach(v=>v[0]+=shift);
    ring(y0,bw,bd,c,S.stone,shift);ring(y1,bw,bd,c,S.roof,shift);
    for(let edge=0;edge<8;edge++){
      const a=p[edge],b=p[(edge+1)%8],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),normal=[dz/len,0,-dx/len];
      const pt=(u,y,v=0)=>[a[0]+dx*u/len+normal[0]*v,y,a[1]+dz*u/len+normal[2]*v];
      const panel=(lo,hi,bottom,top,v,surface,bucket=0)=>quad([pt(lo,bottom,v),pt(hi,bottom,v),pt(hi,top,v),pt(lo,top,v)],normal,surface,bucket);
      if(edge%2){panel(0,len,y0,y1,0,S.stone);continue;}
      const bays=lobby?3:Math.max(2,Math.round(len/(recipe.bayWidth??3.4))),bay=len/bays,step=(y1-y0)/rows;
      for(let f=0;f<rows;f++){
        const lo=y0+f*step,hi=lo+step,lower=lo+.15,upper=hi-(recipe.spandrel??.18);
        panel(0,len,lo,lower,0,S.roof);panel(0,len,upper,hi,0,S.roof);
        for(let i=0;i<bays;i++){
          const left=i*bay+.13,right=(i+1)*bay-.13,r=lobby?.55:recipe.reveal;
          const lateral=[dx/len,0,dz/len];
          for(const [u,n]of [[left,1],[right,-1]])quad([pt(u,lower),pt(u,upper),pt(u,upper,-r),pt(u,lower,-r)],lateral.map(v=>v*n),S.trim);
          for(const [y,n]of [[lower,1],[upper,-1]])quad([pt(left,y),pt(right,y),pt(right,y,-r),pt(left,y,-r)],[0,n,0],S.trim);
          const lit=!lobby&&(f*3+i+edge+recipe.windowSeed)%19===0;
          panel(left,right,lower,upper,-r,lit?S.litGlass:S.glass,2);
          panel((left+right)/2-.022,(left+right)/2+.022,lower,upper,-r+.025,S.trim,1);
        }
        panel(0,len,hi-.045,hi,.015,S.trim,1);
      }
      // Continuous projecting ribs, unlike the office's horizontal structural grid.
      for(let i=0;i<=bays;i++){
        const lo=Math.max(0,i*bay-.13),hi=Math.min(len,i*bay+.13);
        panel(lo,hi,y0,y1,.10,S.trim);
        for(const [u,n]of [[lo,-1],[hi,1]])quad([pt(u,y0),pt(u,y1),pt(u,y1,.10),pt(u,y0,.10)],[dx/len*n,0,dz/len*n],S.stone);
        panel(lo,hi,y0,y0+.12,0,S.stone);
      }
    }
  }
  const [base,shoulder,crown]=recipe.setbacks.map(v=>height*v);
  tier(.30,base,w,d,1,true);
  const scales=recipe.scales||[.91,.78,.60],offsets=recipe.offsets||[0,0,0];
  tier(base,shoulder,w*scales[0],d*scales[0],Math.round(recipe.floors*.64),false,w*offsets[0]);
  tier(shoulder,crown,w*scales[1],d*scales[1],Math.max(2,Math.round(recipe.floors*.15)),false,w*offsets[1]);
  // A smaller, louvered mechanical lantern terminates the skyline without an antenna.
  const cw=w*scales[2],cd=d*scales[2],shift=w*offsets[2];
  const cap=recipe.crown??0,topY=height-[.22,1.3,2.9,1.3,2.9][cap]; // plant/mast variants sit between topY and height
  tier(crown,topY,cw,cd,1,false,shift);
  if(cap!==3)for(let i=0;i<4;i++){
    const y=crown+.35+i*(topY-.43-crown)/4;
    for(const zz of [-cd/2+.02,cd/2-.02])box(shift,y,zz,cw-2*recipe.chamfer,.10,.08,S.roof,1);
    for(const xx of [-cw/2+.02,cw/2-.02])box(xx+shift,y,0,.08,.10,cd-2*recipe.chamfer,S.roof,1);
  }
  // Crown variants: louvered lantern only (0), plant box on a flat cap (1), mast (2), solid cap with offset plant (3).
  if(cap===1)box(shift,topY+.5,0,cw*.5,1.0,cd*.45,S.roof);
  if(cap===2){box(shift,topY+1.45,0,.22,2.9,.22,S.trim,1);box(shift,topY+.25,0,cw*.4,.5,cd*.4,S.stone);}
  if(cap===3){box(shift+cw*.15,topY+.5,-cd*.1,cw*.42,1.0,cd*.36,S.roof);box(shift-cw*.22,topY+.35,cd*.15,1.5,.7,1.5,S.stone);}
  ring(topY+.12,cw+.10,cd+.10,recipe.chamfer,S.stone,shift);
  box(0,.15,0,w-2*recipe.chamfer,.30,d,S.stone);
  box(0,3.20,d/2-.35,3.4,.18,1,S.roof);
  for(const xx of [-.78,0,.78])box(xx,1.50,d/2-.50,.06,2.6,.06,S.trim,1);
  box(0,2.80,d/2-.50,1.62,.08,.06,S.trim,1);
  const materials=townhouseMaterials(),g=new THREE.Group();g.name=plot.id;g.position.set(x,0,z);
  buckets.forEach((data,k)=>{
    const geometry=new THREE.BufferGeometry();
    for(const [key,size]of [['position',3],['normal',3],['uv',2],['aSurface',1],['color',3]])geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],size));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,k===2?materials.glass:materials.architecture);mesh.name=['tower-mass','tower-trim','tower-glass'][k];mesh.castShadow=k===0;mesh.receiveShadow=true;g.add(mesh);
  });
  g.userData={archetype:'tower-slice',plotId:plot.id,recipe};return g;
}
