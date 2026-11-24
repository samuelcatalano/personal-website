import * as THREE from 'three';
import { GROUND_MACRO, REALISM } from './textures.js';

const random = (i, k) => { const n=Math.sin(i*127.1+k*311.7)*43758.5453;return n-Math.floor(n); };
const UP=new THREE.Vector3(0,1,0);

// Shared by garden beds, the hero plaza and tree understory; dimensions stay normalized.
export function createPlantGeometry(kind) {
  const positions=[],normals=[],colors=[];
  const vertex=(p,n,c)=>{positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);colors.push(c.r,c.g,c.b);};
  const triangle=(a,b,c)=>{for(const v of [a,b,c])vertex(v.p,v.n,v.c);};
  const green=new THREE.Color('#527044'),young=new THREE.Color('#7d9659'),bark=new THREE.Color('#594b36');
  function stem(a,b,r,seed) {
    const axis=b.clone().sub(a),length=axis.length(),direction=axis.clone().normalize();
    const side=new THREE.Vector3().crossVectors(Math.abs(direction.y)>.95?new THREE.Vector3(1,0,0):UP,direction).normalize(),front=new THREE.Vector3().crossVectors(direction,side);
    const rows=[];
    for(let j=0;j<=3;j++){
      const t=j/3,center=a.clone().addScaledVector(axis,t).addScaledVector(side,Math.sin(t*Math.PI)*length*.07),ring=[];
      for(let i=0;i<6;i++){
        const angle=i/6*Math.PI*2,n=side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(front,Math.sin(angle));
        const p=center.clone().addScaledVector(n,r*(1-t*.78)),c=bark.clone().lerp(green,.25).multiplyScalar(.82+random(seed,i)*.24);
        ring.push({p,n,c});
      }
      rows.push(ring);
    }
    for(let j=0;j<3;j++)for(let i=0;i<6;i++){const k=(i+1)%6;triangle(rows[j][i],rows[j+1][i],rows[j+1][k]);triangle(rows[j][i],rows[j+1][k],rows[j][k]);}
  }
  function leaf(origin,direction,length,width,seed,base=green) {
    const along=direction.clone().normalize(),side=new THREE.Vector3().crossVectors(Math.abs(along.y)>.96?new THREE.Vector3(1,0,0):UP,along).normalize();
    side.applyAxisAngle(along,(random(seed,11)-.5)*1.6);
    const normal=new THREE.Vector3().crossVectors(along,side).normalize(),rows=[];
    for(let j=0;j<=4;j++){
      const t=j/4,shape=Math.max(.025,Math.sin(Math.PI*t)**.8),row=[];
      for(let k=0;k<3;k++){
        const u=k-1,p=origin.clone().addScaledVector(along,t*length).addScaledVector(side,u*width*shape*.5)
          .addScaledVector(normal,length*.22*t*t+width*.16*(1-Math.abs(u))*shape);
        const n=normal.clone().addScaledVector(along,-.44*t).addScaledVector(side,u*.3).normalize();
        const c=base.clone().lerp(base.g>=base.r?young:new THREE.Color('#efdfd0'),.12+random(seed,7)*.32).multiplyScalar(.60+random(seed,8)*.33+t*.22);
        row.push({p,n,c});
      }
      rows.push(row);
    }
    for(let j=0;j<4;j++)for(let k=0;k<2;k++){
      const a=rows[j][k],b=rows[j+1][k],c=rows[j+1][k+1],d=rows[j][k+1];triangle(a,b,c);triangle(a,c,d);

    }
  }
  if(kind==='grass'){
    for(let i=0;i<18;i++){
      const angle=random(i,1)*Math.PI*2,r=Math.sqrt(random(i,2))*.36,origin=new THREE.Vector3(Math.cos(angle)*r,0,Math.sin(angle)*r);
      const lean=.24+random(i,3)*.5,direction=new THREE.Vector3(Math.cos(angle)*lean,1,Math.sin(angle)*lean);
      leaf(origin,direction,.42+random(i,4)*.58,.012+random(i,5)*.018,i,green.clone().lerp(young,random(i,6)*.6));
    }
  } else if(kind==='shrub'||kind==='hedge'){
    const hedge=kind==='hedge',branches=hedge?19:15;
    for(let i=0;i<branches;i++){
      const angle=i*2.399963+random(i,1)*.5,r=.15+random(i,2)*.22;
      const base=new THREE.Vector3(hedge?(random(i,3)-.5)*.65:0,0,0);
      const end=new THREE.Vector3(hedge?(random(i,4)-.5)*.78:Math.cos(angle)*r,.43+random(i,5)*.40,Math.sin(angle)*r);
      stem(base,end,.008+random(i,6)*.009,i);
      for(let j=0;j<4;j++){
        const t=.24+j*.19,origin=base.clone().lerp(end,t),a=angle+j*2.4;
        const tip=origin.clone().add(new THREE.Vector3(Math.cos(a)*.15,.08+random(i,j+10)*.1,Math.sin(a)*.15));
        stem(origin,tip,.004,i*10+j);
        for(let k=0;k<3;k++){
          const o=origin.clone().lerp(tip,.35+k*.3),direction=new THREE.Vector3(Math.cos(a+k*1.9),.15+random(i+j,k)*.8,Math.sin(a+k*1.9));
          leaf(o,direction,.10+random(i*4+j,k+19)*.10,.045+random(i+j,k+22)*.033,i*31+j*5+k);
        }
      }
      leaf(end,new THREE.Vector3(Math.cos(angle)*.3,1,Math.sin(angle)*.3),.16,.07,i+400);
    }
  } else if(kind==='flower'){
    for(let i=0;i<5;i++){
      const angle=i*2.399963,base=new THREE.Vector3(Math.cos(angle)*.18,0,Math.sin(angle)*.18),head=base.clone().add(new THREE.Vector3((random(i,2)-.5)*.12,.55+random(i,3)*.32,(random(i,4)-.5)*.12));
      stem(base,head,.006,i);
      for(let j=0;j<3;j++){const a=angle+j*2.6;leaf(base.clone().lerp(head,.22+j*.18),new THREE.Vector3(Math.cos(a),.3,Math.sin(a)),.16,.055,i*10+j);}
      const petal=new THREE.Color(['#d8b7c6','#c9899d','#e6dab8'][i%3]);
      for(let j=0;j<7;j++){
        const a=j/7*Math.PI*2,tip=new THREE.Vector3(Math.cos(a),.12,Math.sin(a));
        leaf(head,tip,.10+random(i,j)*.025,.055,i*13+j,petal);
      }
      for(let j=0;j<6;j++){
        const a=j/6*Math.PI*2;leaf(head.clone().add(new THREE.Vector3(0,.008,0)),new THREE.Vector3(Math.cos(a),.8,Math.sin(a)),.025,.023,500+i*6+j,new THREE.Color('#b49b55'));
      }
    }
  } else throw new Error(`Unknown plant kind: ${kind}`);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeBoundingBox();const b=geometry.boundingBox;
  const sx=.49/Math.max(.49,Math.abs(b.min.x),Math.abs(b.max.x)),sz=.49/Math.max(.49,Math.abs(b.min.z),Math.abs(b.max.z));
  geometry.translate(0,-b.min.y,0);geometry.scale(sx,1/(b.max.y-b.min.y),sz);
  geometry.normalizeNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function createPlantMaterial() {
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0,side:THREE.DoubleSide});
  material.name='botanical-low-plants';
  material.onBeforeCompile=shader=>{
    // Same 50-100 m macro field as the lawns underneath, so grass blades follow the lush/dry stretches instead of one flat green.
    if(REALISM){shader.vertexShader='varying vec2 vPlantXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
vPlantXZ=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xz;
#else
vPlantXZ=(modelMatrix*vec4(transformed,1.0)).xz;
#endif`);
    shader.fragmentShader='varying vec2 vPlantXZ;\n'+GROUND_MACRO+'\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
{ float plantMacro=groundMacro(vPlantXZ)-.5; diffuseColor.rgb*=(1.0+.2*plantMacro)*mix(vec3(.9,1.0,.92),vec3(1.08,1.03,.84),smoothstep(-.25,.25,plantMacro)); }`);}
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
#if NUM_DIR_LIGHTS > 0
float plantBack=pow(max(0.0,dot(normalize(vViewPosition),-directionalLights[0].direction)),3.0);
outgoingLight += diffuseColor.rgb * directionalLights[0].color * (plantBack*.055);
#endif
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'botanical-low-plants-1'+(REALISM?'-macro-1':'');return material;
}
