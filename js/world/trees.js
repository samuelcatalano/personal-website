import * as THREE from 'three';
import { canopyGeometry, trunkGeometry, leafTexture, impostorGeometry, impostorTexture } from './tree-mesh.js';

// Three tree types (small street / medium urban / large park), one InstancedMesh per part per type per 160 m chunk (frustum-culled) + one understory batch.
// Positions and crown footprints come from placements; canopy diameter never exceeds placement.crown.
const TYPES = ['small', 'medium', 'large'];
const typeOf = (crown) => (crown < 2.1 ? 'small' : crown < 2.7 ? 'medium' : 'large'); // ponytail: crown is the only size signal; placements carry no type
const rnd = (x, z, k) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const TINTS = [0x73934e, 0x638652, 0x879f58, 0x9a9c57, 0x6e915b, 0x597c4b];
const hsl = {};

export async function createTrees(placements) {
  const group = new THREE.Group(); group.name = 'trees';
  const leaves = leafTexture(), canopyMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: leaves, alphaTest: 0.5, side: THREE.DoubleSide }); // leaf cards: alpha-tested, shadows cut out too
  const wind = { value: 0 }; // gentle crown sway: tops move most, phase from instance position; the clock is frozen under reduced motion
  canopyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 0.37 + ip.z * 0.23, top = clamp(position.y * 0.5 + 0.5, 0.0, 1.0);
      transformed.xz += vec2(sin(uWind * 1.3 + ph), cos(uWind * 1.1 + ph * 1.7)) * 0.035 * top * top;
      transformed += normal * 0.02 * sin(uWind * 3.1 + ph + position.x * 4.0) * top;`);
  };
  canopyMat.customProgramCacheKey = () => 'tree-wind-1';
  const trunkMat = new THREE.MeshLambertMaterial({ vertexColors: true }), impostors=impostorTexture(), impostorMat=new THREE.MeshLambertMaterial({vertexColors:true,map:impostors,alphaTest:.28,side:THREE.DoubleSide});
  const geoms = [], batches=[], o = new THREE.Object3D();
  // Spatial chunks along the route (CHUNK m in x) so standard frustum culling skips off-screen trees in every pass.
  const CHUNK = 160, chunkOf = (x) => Math.floor(x / CHUNK);
  for (const type of TYPES) {
    const all = placements.map((p, i) => ({ p, i })).filter(({ p }) => typeOf(p.crown) === type);
    if (!all.length) continue;
    const cg0 = canopyGeometry(type), tg0 = trunkGeometry(type),cg1=canopyGeometry(type,1),tg1=trunkGeometry(type,1),ig=impostorGeometry(type); geoms.push(cg0,tg0,cg1,tg1,ig);
    for (const ck of [...new Set(all.map(({ p }) => chunkOf(p.x)))]) {
    const list = all.filter(({ p }) => chunkOf(p.x) === ck);
    const lods=[
      {canopy:new THREE.InstancedMesh(cg0,canopyMat,list.length),trunk:new THREE.InstancedMesh(tg0,trunkMat,list.length)},
      {canopy:new THREE.InstancedMesh(cg1,canopyMat,list.length),trunk:new THREE.InstancedMesh(tg1,trunkMat,list.length)},
      {impostor:new THREE.InstancedMesh(ig,impostorMat,list.length)},
    ],bounds=new THREE.Box3(),trees=[];
    lods.forEach((lod,level)=>Object.values(lod).forEach((m,k)=>{m.name=`trees-${k?'trunk':level===2?'impostor':'canopy'}-${type}-lod${level}`;if(level>0)m.visible=false;m.castShadow=level<2;m.receiveShadow=level<2;m.userData.sourceIndices=list.map(e=>e.i);group.add(m);}));
    list.forEach(({ p: { x, z, h, crown, base = 0.1 } }, k) => {
      const r = (n) => rnd(x, z, n), wide = r(1) < 0.5; // shape variant: broad & low vs narrow & tall
      const H = Math.min(6.2, (h + 0.65) * 1.2) * (0.8 + r(2) * 0.25);
      const rw = crown / 2 * (0.96 + r(3) * 0.04) * (wide ? 1 : 0.94), ry = Math.min(H * 0.44, rw * (wide ? 1.0 : 1.14)), yc = ry + 0.95 + r(10) * 0.35, yaw = r(4) * Math.PI * 2; // round crown filling the footprint; trunk only ~1 m clear under it (was a 1.6 m bare lollipop stem)
      o.position.set(x, base + 0.02 + yc, z); o.rotation.set(0, yaw, 0); o.scale.set(rw, ry, rw); o.updateMatrix(); lods[0].canopy.setMatrixAt(k,o.matrix);lods[1].canopy.setMatrixAt(k,o.matrix);
      const t = 0.8 + r(5) * 0.45; // trunk thickness
      o.position.set(x, base + 0.02, z); o.scale.set(rw * t, yc, rw * t); o.updateMatrix(); lods[0].trunk.setMatrixAt(k,o.matrix);lods[1].trunk.setMatrixAt(k,o.matrix);
      o.position.set(x,base+.02+yc,z);o.rotation.set(0,yaw,0);o.scale.set(rw*2,yc*2,1);o.updateMatrix();lods[2].impostor.setMatrixAt(k,o.matrix);
      const c = new THREE.Color(TINTS[Math.floor(r(8) * TINTS.length)]); c.getHSL(hsl); c.setHSL(hsl.h + (r(6) - 0.5) * 0.04, hsl.s, hsl.l * (0.88 + r(9) * 0.24)); lods[0].canopy.setColorAt(k,c);lods[1].canopy.setColorAt(k,c);lods[2].impostor.setColorAt(k,c);
      const bark=new THREE.Color(0xffffff).multiplyScalar(0.8+r(7)*0.4);lods[0].trunk.setColorAt(k,bark);lods[1].trunk.setColorAt(k,bark);
      trees.push({x,z,base,rw,yc});bounds.expandByPoint(new THREE.Vector3(x-rw,base,z-rw));bounds.expandByPoint(new THREE.Vector3(x+rw,base+.02+yc*2,z+rw));
    });
    for(const lod of lods)for(const m of Object.values(lod)){m.computeBoundingBox();m.computeBoundingSphere();}
    batches.push({lods,bounds,trees,level:null,lastCameraX:NaN,lastCameraZ:NaN});
    }
  }
  // Understory stays inside existing canopy footprints; no new obstacle/path placement.
  const low = placements.flatMap((p, i) => (i % 3 === 0 && (p.base ?? 0.1) < 0.3 ? [{ p, i, side: -1 }, { p, i, side: 1 }] : []));
  let shrubs;
  if (low.length) {
    shrubs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), low.length);
    shrubs.name = 'tree-understory'; shrubs.receiveShadow = true;
    low.forEach(({ p, i, side }, k) => {
      const radius = p.crown * 0.16;
      o.position.set(p.x + side * p.crown * 0.17, (p.base ?? 0.1) + 0.24, p.z + Math.sin(i) * p.crown * 0.05); o.rotation.set(0, 0, 0); o.scale.set(radius, 0.22, radius * 0.83); o.updateMatrix();
      shrubs.setMatrixAt(k, o.matrix); shrubs.setColorAt(k, new THREE.Color([0x527047, 0x718446, 0x87985a][Math.floor(i / 3) % 3]));
    });
    shrubs.userData.sourceIndices = low.map((e) => e.i); shrubs.computeBoundingBox(); shrubs.computeBoundingSphere(); group.add(shrubs);
  }
  group.userData.batches=batches;
  group.userData.update = (camera, time = 0) => {
    wind.value=time;
    for(const batch of batches){
      const d=batch.bounds.distanceToPoint(camera.position),prev=batch.level;
      batch.level=prev===null?(d<70?0:d<150?1:2):prev===0?(d>80?(d>160?2:1):0):prev===1?(d<60?0:d>160?2:1):(d<60?0:d<140?1:2);
      if(prev!==batch.level)batch.lods.forEach((lod,i)=>Object.values(lod).forEach(m=>m.visible=i===batch.level));
      if(batch.level===2&&(Math.abs(camera.position.x-batch.lastCameraX)>.25||Math.abs(camera.position.z-batch.lastCameraZ)>.25)){
        batch.trees.forEach((tree,i)=>{o.position.set(tree.x,tree.base+.02+tree.yc,tree.z);o.rotation.set(0,Math.atan2(camera.position.x-tree.x,camera.position.z-tree.z),0);o.scale.set(tree.rw*2,tree.yc*2,1);o.updateMatrix();batch.lods[2].impostor.setMatrixAt(i,o.matrix);});
        batch.lods[2].impostor.instanceMatrix.needsUpdate=true;batch.lods[2].impostor.computeBoundingBox();batch.lods[2].impostor.computeBoundingSphere();batch.lastCameraX=camera.position.x;batch.lastCameraZ=camera.position.z;
      }
    }
  };
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return; disposed = true;
    geoms.forEach((g) => g.dispose()); leaves.dispose(); impostors.dispose(); canopyMat.dispose(); trunkMat.dispose(); impostorMat.dispose();
    if (shrubs) { shrubs.geometry.dispose(); shrubs.material.dispose(); }
  };
  return group;
}
