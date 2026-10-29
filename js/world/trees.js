import * as THREE from 'three';
import { canopyGeometry, trunkGeometry, leafTexture, impostorGeometry, impostorTexture, FAMILIES } from './tree-mesh.js';

// Five crown families (round broadleaf, columnar, spreading, flowering, conifer), one InstancedMesh per part per family per 160 m chunk (frustum-culled) + one understory batch.
// Positions and crown footprints come from placements; canopy diameter never exceeds placement.crown. Family, tint and proportions are a pure function of
// (region, position): regionOf(x, z) -> 'sp' | 'london' | 'country' | 'glasgow'. Without regionOf every tree is a round broadleaf (legacy look).
const TRUNK = { round: 'medium', column: 'small', spread: 'large', bloom: 'small', conifer: 'small' }; // trunk mesh size class per family
const TRUNK_K = { round: 1, column: 1.5, spread: 1, bloom: 1.25, conifer: 1.15 }; // trunk girth vs crown width
const WEIGHTS = { // cumulative-free weights in FAMILIES order: round, column, spread, bloom, conifer
  sp: [0.34, 0.2, 0.14, 0.32, 0], london: [0.35, 0.1, 0.4, 0.15, 0], country: [0.3, 0.14, 0.2, 0, 0.36], glasgow: [0.3, 0.2, 0.12, 0, 0.38],
};
const PAL = { // sRGB tints (leaf atlas is neutral grey): [region][family]
  sp: { round: [0x66904a, 0x73934e, 0x597c4b], column: [0x4f7f3c, 0x5a8a40], spread: [0x6c8a48, 0x5f7d44], bloom: [0xe8c53a, 0xe58ab0, 0xd96f9a, 0xf0d24a], conifer: [0x2f5a3c] },
  london: { round: [0x638652, 0x879f58, 0x6e915b], column: [0x4a6c44, 0x597c4b], spread: [0x7a9150, 0x879f58, 0x6c8a48], bloom: [0xf0b6c8, 0xe9a0b8, 0xe8b4c6], conifer: [0x2f5a3c] },
  country: { round: [0x73934e, 0x638652, 0x9a9c57], column: [0x597c4b, 0x879f58], spread: [0x6c8a48, 0x7a9150], bloom: [0xe9a0b8], conifer: [0x2f5a3c, 0x3a6244, 0x2a4f38] },
  glasgow: { round: [0x597c4b, 0x6e915b, 0x73934e], column: [0x9bb35e, 0xa6b862, 0x8aa854], spread: [0x638652, 0x597c4b], bloom: [0xe9a0b8], conifer: [0x2a4f38, 0x335a40, 0x2f5a3c] }, // birch / sycamore / pine
};
const rnd = (x, z, k) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const pick = (list, v) => list[Math.floor(v * list.length) % list.length];
function familyOf(region, x, z) {
  if (!region) return 'round';
  const w = WEIGHTS[region] ?? WEIGHTS.london, v = rnd(x, z, 41); let acc = 0;
  for (let i = 0; i < w.length; i++) { acc += w[i]; if (v < acc) return FAMILIES[i]; }
  return 'round';
}
const TINTS = [0x73934e, 0x638652, 0x879f58, 0x9a9c57, 0x6e915b, 0x597c4b]; // legacy palette (no region)
const hsl = {};

export async function createTrees(placements, regionOf = null) {
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
  const trunkMat = new THREE.MeshLambertMaterial({ vertexColors: true }), impostors=impostorTexture(), impostorMat=new THREE.MeshLambertMaterial({map:impostors,alphaTest:.28,side:THREE.DoubleSide});
  const geoms = [], batches=[], o = new THREE.Object3D();
  // Spatial chunks along the route (CHUNK m in x) so standard frustum culling skips off-screen trees in every pass.
  const CHUNK = 160, chunkOf = (x) => Math.floor(x / CHUNK);
  const regionAt = placements.map((p) => regionOf?.(p.x, p.z) ?? null), famAt = placements.map((p, i) => familyOf(regionAt[i], p.x, p.z));
  for (const type of FAMILIES) {
    const all = placements.map((p, i) => ({ p, i })).filter(({ i }) => famAt[i] === type);
    if (!all.length) continue;
    const cg0 = canopyGeometry(type), tg0 = trunkGeometry(TRUNK[type]),cg1=canopyGeometry(type,1),tg1=trunkGeometry(TRUNK[type],1),ig=impostorGeometry(type); geoms.push(cg0,tg0,cg1,tg1,ig);
    for (const ck of [...new Set(all.map(({ p }) => chunkOf(p.x)))]) {
    const list = all.filter(({ p }) => chunkOf(p.x) === ck);
    const lods=[
      {canopy:new THREE.InstancedMesh(cg0,canopyMat,list.length),trunk:new THREE.InstancedMesh(tg0,trunkMat,list.length)},
      {canopy:new THREE.InstancedMesh(cg1,canopyMat,list.length),trunk:new THREE.InstancedMesh(tg1,trunkMat,list.length)},
      {impostor:new THREE.InstancedMesh(ig,impostorMat,list.length)},
    ],bounds=new THREE.Box3(),trees=[];
    lods.forEach((lod,level)=>Object.values(lod).forEach((m,k)=>{m.name=`trees-${k?'trunk':level===2?'impostor':'canopy'}-${type}-lod${level}`;if(level>0)m.visible=false;m.castShadow=level<2;m.receiveShadow=level<2;m.userData.sourceIndices=list.map(e=>e.i);group.add(m);}));
    list.forEach(({ p: { x, z, h, crown, base = 0.1 }, i }, k) => {
      const r = (n) => rnd(x, z, n), region = regionAt[i];
      const H = Math.min(6.2, (h + 0.65) * 1.2) * (0.8 + r(2) * 0.25), maxRy = (Math.min(6.55, (h + 0.65) * 1.45 + 0.35) - 0.02 - 0.5) / 2; // maxRy: landmark clearance cap (tests/trees)
      let rw = crown / 2, ry, gap = 0.95 + r(10) * 0.35, trunkK = TRUNK_K[type]; const wide = r(1) < 0.5;
      if (type === 'round') { rw *= (0.96 + r(3) * 0.04) * (wide ? 1 : 0.94); ry = Math.min(H * 0.44, rw * (wide ? 1.0 : 1.14)); }
      else if (type === 'column') { rw *= 0.5 + r(3) * 0.14; ry = Math.min(H * 0.5, rw * (2.4 + r(1) * 0.8)); }
      else if (type === 'spread') { rw *= 0.97 + r(3) * 0.03; ry = Math.min(H * 0.4, rw * (0.6 + r(1) * 0.14)); gap += 0.15; }
      else if (type === 'bloom') { rw *= 0.8 + r(3) * 0.12; ry = Math.min(H * 0.4, rw * (0.92 + r(1) * 0.14)); gap -= 0.1; }
      else { rw *= 0.68 + r(3) * 0.14; ry = Math.min(H * 0.52, rw * (1.9 + r(1) * 0.5)); gap = 0.58 + r(10) * 0.2; }
      ry = Math.min(ry, maxRy - gap / 2 + 0.25); const yc = ry + gap, yaw = r(4) * Math.PI * 2, hq = yc + ry; // trunk ~1 m clear under the crown (conifer: skirt near the ground)
      o.position.set(x, base + 0.02 + yc, z); o.rotation.set(0, yaw, 0); o.scale.set(rw, ry, rw); o.updateMatrix(); lods[0].canopy.setMatrixAt(k,o.matrix);lods[1].canopy.setMatrixAt(k,o.matrix);
      const t = (0.8 + r(5) * 0.45) * trunkK; // trunk thickness
      o.position.set(x, base + 0.02, z); o.scale.set(rw * t, yc, rw * t); o.updateMatrix(); lods[0].trunk.setMatrixAt(k,o.matrix);lods[1].trunk.setMatrixAt(k,o.matrix);
      o.position.set(x,base+.02,z);o.rotation.set(0,yaw,0);o.scale.set(rw*2,hq,1);o.updateMatrix();lods[2].impostor.setMatrixAt(k,o.matrix);
      const c = new THREE.Color(pick(region ? PAL[region][type] : TINTS, r(8))); c.getHSL(hsl); c.setHSL(hsl.h + (r(6) - 0.5) * 0.04, hsl.s, hsl.l * (0.88 + r(9) * 0.24)); lods[0].canopy.setColorAt(k,c);lods[1].canopy.setColorAt(k,c);lods[2].impostor.setColorAt(k,c);
      const bark=new THREE.Color(0xffffff).multiplyScalar(type==='column'&&region==='glasgow'?1.35:0.8+r(7)*0.4);lods[0].trunk.setColorAt(k,bark);lods[1].trunk.setColorAt(k,bark);
      trees.push({x,z,base,rw,hq});bounds.expandByPoint(new THREE.Vector3(x-rw,base,z-rw));bounds.expandByPoint(new THREE.Vector3(x+rw,base+.02+hq,z+rw));
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
        batch.trees.forEach((tree,i)=>{o.position.set(tree.x,tree.base+.02,tree.z);o.rotation.set(0,Math.atan2(camera.position.x-tree.x,camera.position.z-tree.z),0);o.scale.set(tree.rw*2,tree.hq,1);o.updateMatrix();batch.lods[2].impostor.setMatrixAt(i,o.matrix);});
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
