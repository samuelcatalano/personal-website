import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE as S, townhouseMaterials, roomGlassMaterial, addRoomCoordinates } from './building-slice-materials.js';
import { buildingCharacter, exposedFaces, windowOccupation } from './building-character.js';
import { regionForPlot } from './lot-tint.js';

function identifyBuilding(geometries,plot,kind,recipe) {
  const c=buildingCharacter(plot,kind,recipe.region??regionForPlot(plot));
  const neutral=[1,1,1],seed=Math.round(c.seed*65535),wear=Math.round(c.wear*65535),usage=Math.round(c.usage*65535);
  geometries.forEach((g,bucket)=>{
    if(g.userData.propertyIdentity)return;
    const p=g.attributes.position,s=g.attributes.aSurface,color=g.attributes.color,data=new Uint16Array(p.count*4);
    for(let q=0;q<p.count;q+=6){
      const end=Math.min(p.count,q+6);let x=0,y=0,z=0;
      if(bucket===2)for(let i=q;i<end;i++){x+=p.getX(i)/(end-q);y+=p.getY(i)/(end-q);z+=p.getZ(i)/(end-q);}
      const exterior=bucket===2&&g.userData.nonRoomRanges?.some(([start,count])=>q>=start&&q<start+count);
      const nx=g.attributes.normal.getX(q),nz=g.attributes.normal.getZ(q),side=Math.abs(nx)>.5;
      const occupancy=bucket===2&&!exterior?windowOccupation(c,side?z:x,y,side?(nx>0?0:1):(nz>0?2:3)):0;
      for(let i=q;i<end;i++){
        data[i*4]=seed;data[i*4+1]=wear;data[i*4+2]=Math.round(occupancy*65535);data[i*4+3]=exterior?0:usage;
        const surface=s.getX(i),tint=surface===S.door?c.door:surface===S.trim?c.frame:neutral;
        const value=surface===S.plaster||surface===S.brick||surface===S.stone?1+(c.seed-.5)*.10:1;
        color.setXYZ(i,color.getX(i)*tint[0]*value,color.getY(i)*tint[1]*value,color.getZ(i)*tint[2]*value);
      }
    }
    g.setAttribute('aBuilding',new THREE.BufferAttribute(data,4,true));g.userData.propertyIdentity=true;
  });
  return geometries;
}

// Construction is attached before chunking, so it follows both procedural and loaded-kit rebuilds.
export function finishArchitecture(geometries, plot, kind, recipe = {}, level = 0, neighbors = []) {
  const base=geometries[1];
  if(level || base.userData.constructionFinish) return identifyBuilding(geometries,plot,kind,recipe);
  const out={position:[],normal:[],uv:[],aSurface:[],color:[]};
  const commercial=kind==='office'||kind==='tower', templates=new Map();
  const character=buildingCharacter(plot,kind,recipe.region??regionForPlot(plot));
  const exposure=exposedFaces(plot,neighbors),details={curtains:0,wallPatches:0,roofServices:0,entries:0};
  if(recipe.exposedWest===false)exposure.west=false;if(recipe.exposedEast===false)exposure.east=false;
  if(recipe.exposedBack===false)exposure.back=false;
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
    return true;
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
    // Two front rooms carry visible fabric; the remaining glazing keeps its existing interior layers.
    if(kind==='townhouse'&&normal.z>.9&&h<2.1&&bottom>1.5&&details.curtains<2){
      const cloth=character.curtain===1?[.68,.74,.77]:character.curtain===2?[.85,.73,.57]:[.90,.86,.76];
      let placed=false;
      if(character.curtain===1)placed=part((lo+hi)/2,top-h*.18,.018,w*.94,h*.32,.016,S.trim,cloth);
      else for(const u of [lo+w*.09,hi-w*.09])placed=part(u,(bottom+top)/2,.018,w*.16,h*.93,.016,S.trim,cloth)||placed;
      if(placed)details.curtains++;
    }
  }
  // Repairs belong only to sizeable blank wall panels on verified exposed faces.
  const mass=geometries[0].attributes,mp=mass.position,mn=mass.normal,ms=mass.aSurface;
  const patched=new Set();let roof=null,chimney=null;
  for(let q=0;!geometries[0].index&&q+5<mp.count;q+=6){
    normal.fromBufferAttribute(mn,q);
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;
    for(let j=q;j<q+6;j++){x0=Math.min(x0,mp.getX(j));x1=Math.max(x1,mp.getX(j));y0=Math.min(y0,mp.getY(j));y1=Math.max(y1,mp.getY(j));z0=Math.min(z0,mp.getZ(j));z1=Math.max(z1,mp.getZ(j));}
    // Dress the existing opaque front leaf, never a glazed opening or a shared wall.
    if(kind==='townhouse'&&ms.getX(q)===S.door&&normal.z>.99&&exposure.front&&details.entries===0&&y0>=.02&&y0<.4&&y1-y0>1.5&&y1-y0<2.8&&x1-x0>.65&&x1-x0<1.8){
      const w=x1-x0,h=y1-y0,cx=(x0+x1)/2;
      const columns=character.curtain===2?2:1;
      for(const row of [.28,.72])for(let col=0;col<columns;col++)profile(cx+(col-(columns-1)/2)*w*.38,y0+h*row,z1+.018,w*(columns===1?.70:.30),h*.32,.025,S.door,[1.10,1.08,1.04]);
      profile(cx,y0+h*.59,z1+.043,w*.30,.038,.028,S.trim,[.54,.43,.25]);
      profile(x1-w*.14,y0+h*.47,z1+.055,.025,.17,.055,S.trim,[.48,.40,.26]);
      profile(cx,y0-.045,z1+.055,w+.09,.065,.22,S.stone,[.86,.84,.78]);
      details.entries++;
    }
    const area=(x1-x0)*(z1-z0);
    if(normal.y>.99&&ms.getX(q)===S.roof&&x1-x0>2&&z1-z0>2&&y0>plot.height*.6&&y1-y0<.002&&(!roof||area>roof.area||area===roof.area&&y0>roof.y))roof={x0,x1,z0,z1,y:y0,area};
    if(kind==='townhouse'&&normal.y>.99&&y0>(recipe.eaves??plot.height)&&y1<plot.height-.06&&x1-x0>.2&&x1-x0<1&&z1-z0>.2&&z1-z0<1)chimney={x0,x1,z0,z1,y:y0};
    if(Math.abs(normal.y)>.01||details.wallPatches>=2||character.wear<.42)continue;
    const face=normal.x>.9?'east':normal.x<-.9?'west':normal.z>.9?'front':normal.z<-.9?'back':null;
    const width=Math.abs(normal.x)>.9?z1-z0:x1-x0;
    if(!face||!exposure[face]||patched.has(face)||width<2.8||y1-y0<2.6||![S.plaster,S.brick,S.stone].includes(ms.getX(q)))continue;
    const cx=(x0+x1)/2,cz=(z0+z1)/2;
    across.set(normal.z,0,-normal.x);
    const basis=new THREE.Matrix3().set(across.x,0,normal.x,0,1,0,across.z,0,normal.z);
    if(profile(cx+normal.x*.012,y0+Math.min(1,(y1-y0)*.28),cz+normal.z*.012,Math.min(1.4,width*.3),.7,.014,ms.getX(q),[.91,.92,.90],basis)){
      patched.add(face);details.wallPatches++;
    }
  }
  if(chimney){
    if(profile((chimney.x0+chimney.x1)/2,chimney.y+.025,(chimney.z0+chimney.z1)/2,chimney.x1-chimney.x0,.035,chimney.z1-chimney.z0,character.roofVariant===1?S.trim:S.stone,[.62,.61,.57]))details.roofServices++;
  }
  // Low roof-service finishes use clear existing flat support; pitched roofs keep their silhouette.
  if(roof&&plot.height-roof.y>.24){
    const w=.65+character.roofVariant*.18,d=.62,h=character.roofVariant===1?.12:.20;
    for(const side of [-1,1]){
      if(details.roofServices>=2)break;
      const x=(roof.x0+roof.x1)/2+side*(roof.x1-roof.x0)*.26,z=(roof.z0+roof.z1)/2+(character.roofVariant-1)*(roof.z1-roof.z0)*.22;
      let clear=true;
      for(let q=0;q+2<mp.count&&clear;q+=3){
        let loX=Infinity,hiX=-Infinity,loZ=Infinity,hiZ=-Infinity,hiY=-Infinity;
        for(let j=q;j<q+3;j++){loX=Math.min(loX,mp.getX(j));hiX=Math.max(hiX,mp.getX(j));loZ=Math.min(loZ,mp.getZ(j));hiZ=Math.max(hiZ,mp.getZ(j));hiY=Math.max(hiY,mp.getY(j));}
        if(hiY>roof.y+.03&&loX<x+w/2+.08&&hiX>x-w/2-.08&&loZ<z+d/2+.08&&hiZ>z-d/2-.08)clear=false;
      }
      if(!clear||x-w/2<roof.x0+.12||x+w/2>roof.x1-.12||z-d/2<roof.z0+.12||z+d/2>roof.z1-.12)continue;
      if(!profile(x,roof.y+h/2+.012,z,w,h,d,S.roof,[.56,.59,.61]))continue;
      if(character.roofVariant!==1)for(const dx of [-.16,0,.16])profile(x+dx,roof.y+h+.028,z,.055,.025,d*.75,S.trim,[.47,.49,.51]);
      details.roofServices++;
    }
  }
  if(kind==='townhouse'&&recipe.eaves&&recipe.ridge){
    const half=plot.width/2-.02,rz=(recipe.bayWindows?plot.depth-.5:plot.depth)/2-.02,rise=recipe.ridge-recipe.eaves;
    const gable=recipe.roof!=='side'&&recipe.roof!=='hip';
    const run=gable?half:rz,length=gable?2*rz:plot.width-.10,slant=Math.hypot(run,rise),rows=Math.floor(slant/[.30,.33,.36][character.roofVariant]);
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
    merged.userData={...base.userData,constructionFinish:true,constructionStart:base.attributes.position.count,propertyDetails:details};merged.computeBoundingBox();merged.computeBoundingSphere();
    geometries[1]=merged;base.dispose();
  }else {base.userData.constructionFinish=true;base.userData.propertyDetails=details;}
  extra.dispose();templates.forEach(g=>g.dispose());
  return identifyBuilding(geometries,plot,kind,recipe);
}

export function finishBuilding(group,plot,kind,level=0) {
  const geometries=finishArchitecture(group.children.map(m=>m.geometry),plot,kind,group.userData.recipe,level);
  group.children.forEach((m,k)=>m.geometry=geometries[k]);
  if(group.children[2].material.name==='slice-glass'){addRoomCoordinates(geometries[2],plot.x,plot.z);group.children[2].material=roomGlassMaterial();}
  return group;
}

// Keep legacy silhouettes/openings, but bring their instanced parts into the ordinary shared finish.
export function finishLegacyBuilding(source,plot,neighbors=[]) {
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
  finishArchitecture(geometries,plot,plot.kind==='terrace'?'townhouse':plot.kind,{},0,neighbors);
  addRoomCoordinates(geometries[2],plot.x,plot.z);
  const group=new THREE.Group(),materials=townhouseMaterials();group.name=source.name;group.position.copy(source.position);
  geometries.forEach((geometry,k)=>{geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,k===2?roomGlassMaterial():materials.architecture);mesh.castShadow=k===0;mesh.receiveShadow=true;group.add(mesh);});
  group.userData={...source.userData,archetype:'ordinary-legacy-finish'};return group;
}
