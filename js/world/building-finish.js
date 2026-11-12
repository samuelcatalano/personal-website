import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials, roomGlassMaterial, addRoomCoordinates } from './building-slice-materials.js';

// Construction is attached before chunking, so it follows both procedural and loaded-kit rebuilds.
export function finishArchitecture(geometries, plot, kind, recipe = {}, level = 0) {
  const base=geometries[1];
  if(level || base.userData.constructionFinish) return geometries;
  const out={position:[],normal:[],uv:[],aSurface:[],color:[]};
  const commercial=kind==='office'||kind==='tower', templates=new Map();
  const up=new THREE.Vector3(0,1,0),across=new THREE.Vector3(),normal=new THREE.Vector3(),center=new THREE.Vector3(),matrix=new THREE.Matrix4();
  const frameColor=commercial?[.28,.32,.34]:recipe.region==='glasgow'?[.76,.70,.60]:[.80,.79,.74];
  const v=new THREE.Vector3(),n=new THREE.Vector3();
  function profile(cx,cy,cz,w,h,d,surface,color,basis=null) {
    if(Math.min(w,h,d)<=.002) return;
    const r=Math.min(.014,w*.22,h*.22,d*.22),key=[w,h,d,r].map(x=>x.toFixed(5)).join(':');
    let g=templates.get(key);
    if(!g){
      const shape=new THREE.Shape();shape.moveTo(-w/2+r,-h/2+r);shape.lineTo(w/2-r,-h/2+r);shape.lineTo(w/2-r,h/2-r);shape.lineTo(-w/2+r,h/2-r);shape.closePath();
      g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,steps:1,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:1,curveSegments:1});
      g.translate(0,0,-d/2+r);templates.set(key,g);
    }
    const p=g.attributes.position,nor=g.attributes.normal;
    const positions=[],normals=[];
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);n.fromBufferAttribute(nor,i);
      if(basis){v.applyMatrix3(basis);n.applyMatrix3(basis);}
      v.add(center.set(cx,cy,cz));
      // Added construction fits the original descriptor; inherited outliers are not expanded.
      if(Math.abs(v.x)>plot.width/2-.003||Math.abs(v.z)>plot.depth/2-.003||v.y<.005||v.y>plot.height-.003)return;
      positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);
    }
    for(let i=0;i<p.count;i++){
      const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2],nx=normals[i*3],ny=normals[i*3+1],nz=normals[i*3+2];
      out.position.push(x,y,z);out.normal.push(nx,ny,nz);out.aSurface.push(surface);out.color.push(...color);
      out.uv.push(...(Math.abs(ny)>.7?[x,z]:Math.abs(nx)>.7?[z,y]:[x,y]));
    }
  }
  const glass=geometries[2],p=glass.attributes.position,nor=glass.attributes.normal,seen=new Set();
  for(let q=0;!glass.index&&q+5<p.count;q+=6){
    normal.fromBufferAttribute(nor,q);
    if(Math.abs(normal.y)>.025)continue;
    across.set(normal.z,0,-normal.x).normalize();
    let lo=Infinity,hi=-Infinity,bottom=Infinity,top=-Infinity,plane=0,planar=true,corners=0;
    for(let j=q;j<q+6;j++){
      v.fromBufferAttribute(p,j);const u=v.dot(across),dist=v.dot(normal);if(j===q)plane=dist;
      planar&&=Math.abs(dist-plane)<.002;
      lo=Math.min(lo,u);hi=Math.max(hi,u);bottom=Math.min(bottom,v.y);top=Math.max(top,v.y);
    }
    const w=hi-lo,h=top-bottom;
    if(!planar||w<.24||h<.35)continue;
    // Only rectangular panes; chamfer triangles and thin glazing returns retain their current finish.
    for(let j=q;j<q+6;j++){
      v.fromBufferAttribute(p,j);const u=v.dot(across);
      if(Math.min(Math.abs(u-lo),Math.abs(u-hi))>.003||Math.min(Math.abs(v.y-bottom),Math.abs(v.y-top))>.003)planar=false;
      corners|=1<<(Math.round((u-lo)/w)+2*Math.round((v.y-bottom)/h));
    }
    if(!planar||corners!==15)continue;
    const key=[normal.x,normal.z,plane,lo,hi,bottom,top].map(x=>x.toFixed(3)).join(':');if(seen.has(key))continue;seen.add(key);
    const basis=new THREE.Matrix3().set(across.x,0,normal.x,0,1,0,across.z,0,normal.z);
    const part=(u,y,offset,pw,ph,pd,surface,color)=>profile(across.x*u+normal.x*(plane+offset),y,across.z*u+normal.z*(plane+offset),pw,ph,pd,surface,color,basis);
    const bead=commercial?.036:.044;
    for(const u of [lo+bead/2,hi-bead/2])part(u,(bottom+top)/2,.048,bead,h,.072,S.trim,frameColor);
    for(const y of [bottom+bead/2,top-bead/2])part((lo+hi)/2,y,.048,w-2*bead,bead,.072,S.trim,frameColor);
    if(commercial&&w>1.5)part((lo+hi)/2,(bottom+top)/2,.063,.052,h,.082,S.trim,frameColor);
    if(!commercial&&h<2.15){
      // Sloping sill nose, thin drip and a header cap create real contact/shadow junctions.
      part((lo+hi)/2,bottom-.045,.10,w+.12,.075,.22,S.stone,[.94,.92,.86]);
      part((lo+hi)/2,bottom-.087,.16,w+.10,.018,.048,S.roof,[.52,.55,.57]);
      part((lo+hi)/2,top+.042,.075,w+.10,.055,.13,S.stone,[.94,.92,.86]);
    }
  }
  if(kind==='townhouse'&&recipe.eaves&&recipe.ridge){
    const half=plot.width/2-.02,rz=(recipe.bayWindows?plot.depth-.5:plot.depth)/2-.02,rise=recipe.ridge-recipe.eaves;
    const gable=recipe.roof!=='side'&&recipe.roof!=='hip';
    const run=gable?half:rz,length=gable?2*rz:plot.width-.10,slant=Math.hypot(run,rise),rows=Math.floor(slant/.33);
    for(const side of [-1,1]){
      const slopeNormal=gable?new THREE.Vector3(side*rise,run,0).normalize():new THREE.Vector3(0,run,side*rise).normalize();
      const along=gable?new THREE.Vector3(0,0,side):new THREE.Vector3(-side,0,0);
      const down=new THREE.Vector3().crossVectors(slopeNormal,along).normalize();
      const basis=new THREE.Matrix3().set(along.x,down.x,slopeNormal.x,along.y,down.y,slopeNormal.y,along.z,down.z,slopeNormal.z);
      for(let row=1;row<rows;row++){
        const f=row/rows,y=recipe.ridge-rise*f+.025,dist=run*f;
        // Hip courses stop at the actual sloping end, leaving existing ridges unobstructed.
        const span=recipe.roof==='hip'?2*(Math.max(0,half-rz)+Math.min(half,rz)*f):length;
        profile(gable?side*dist:0,y,gable?0:side*dist,span,.045,.035,S.roof,[.97,.98,1],basis);
      }
    }
  }
  const extra=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(base.attributes)){
    const values=out[name]??new Float32Array(out.position.length/3*a.itemSize);
    extra.setAttribute(name,new THREE.BufferAttribute(new a.array.constructor(values),a.itemSize,a.normalized));
  }
  if(out.position.length){
    const merged=mergeGeometries([base,extra],false);
    if(!merged)throw new Error('Construction finish attribute mismatch');
    merged.userData={...base.userData,constructionFinish:true,constructionStart:base.attributes.position.count};merged.computeBoundingBox();merged.computeBoundingSphere();
    geometries[1]=merged;base.dispose();
  }else base.userData.constructionFinish=true;
  extra.dispose();templates.forEach(g=>g.dispose());
  return geometries;
}

export function finishBuilding(group,plot,kind,level=0) {
  const geometries=finishArchitecture(group.children.map(m=>m.geometry),plot,kind,group.userData.recipe,level);
  group.children.forEach((m,k)=>m.geometry=geometries[k]);
  if(group.children[2].material.name==='slice-glass'){addRoomCoordinates(geometries[2],plot.x,plot.z);group.children[2].material=roomGlassMaterial();}
  return group;
}

// Keep legacy silhouettes/openings, but bring their instanced parts into the ordinary shared finish.
export function finishLegacyBuilding(source,plot) {
  const buckets=[[],[],[]],instance=new THREE.Matrix4(),transform=new THREE.Matrix4();
  const atlasColors=['#dcd3bf','#a06049','#44505e','#e6ddc9','#c4baa4','#415e70','#415e70','#344345'].map(c=>new THREE.Color(c));
  source.children.forEach(mesh=>{
    mesh.updateMatrix();
    const name=mesh.material.name,defaultRole=name==='window-glass'?2:/window-frame|architectural-trim|architectural-details/.test(name)?1:0;
    const defaultSurface=defaultRole===2?S.glass:defaultRole===1?S.trim:/brick/.test(name)?S.brick:/roof|crown/.test(name)?S.roof:/recess/.test(name)?S.door:/stone|concrete|facade-family/.test(name)?S.stone:S.plaster;
    const tint=new THREE.Color(mesh.userData.benchmarkTint??(name==='benchmark-architectural-details'?mesh.material.color:source.userData.benchmarkTint??mesh.material.color));
    for(let item=0;item<(mesh.isInstancedMesh?mesh.count:1);item++){
      const explicit=mesh.userData.instanceSurface?.[item],surface=explicit??defaultSurface;
      const role=explicit===undefined?defaultRole:surface===S.glass||surface===S.litGlass?2:surface===S.trim?1:0;
      const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      transform.copy(mesh.matrix);if(mesh.isInstancedMesh){mesh.getMatrixAt(item,instance);transform.multiply(instance);}
      g.applyMatrix4(transform);
      const p=g.attributes.position,n=g.attributes.normal,oldColor=g.attributes.color,colors=[],uv=[];
      const instanceTint=new THREE.Color(1,1,1);if(mesh.instanceColor)mesh.getColorAt(item,instanceTint);
      for(let i=0;i<p.count;i++){
        const color=tint.clone().multiply(instanceTint);
        if(mesh.material.vertexColors&&oldColor)color.multiply(new THREE.Color().fromBufferAttribute(oldColor,i));
        const albedo=atlasColors[surface];colors.push(color.r/albedo.r,color.g/albedo.g,color.b/albedo.b);
        uv.push(...(Math.abs(n.getY(i))>.7?[p.getX(i),p.getZ(i)]:Math.abs(n.getX(i))>.7?[p.getZ(i),p.getY(i)]:[p.getX(i),p.getY(i)]));
      }
      for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name);
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      g.setAttribute('aSurface',new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(surface),1));buckets[role].push(g);
    }
  });
  const geometries=buckets.map(items=>{
    if(items.length){const g=mergeGeometries(items,false);items.forEach(g=>g.dispose());return g;}
    const g=new THREE.BufferGeometry();for(const [key,size] of [['position',3],['normal',3],['uv',2],['color',3],['aSurface',1]])g.setAttribute(key,new THREE.Float32BufferAttribute([],size));return g;
  });
  finishArchitecture(geometries,plot,plot.kind==='terrace'?'townhouse':plot.kind);
  addRoomCoordinates(geometries[2],plot.x,plot.z);
  const group=new THREE.Group(),materials=townhouseMaterials();group.name=source.name;group.position.copy(source.position);
  geometries.forEach((geometry,k)=>{geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,k===2?roomGlassMaterial():materials.architecture);mesh.castShadow=k===0;mesh.receiveShadow=true;group.add(mesh);});
  group.userData={...source.userData,archetype:'ordinary-legacy-finish'};return group;
}
