import * as THREE from 'three';
import { canopyGeometry, trunkGeometry, leafTexture } from './tree-mesh.js';

// Three tree types (small street / medium urban / large park), one InstancedMesh per part per type per 160 m chunk (frustum-culled) + one understory batch.
// Positions and crown footprints come from placements; canopy diameter never exceeds placement.crown.
const TYPES = ['small', 'medium', 'large'];
const typeOf = (crown) => (crown < 2.1 ? 'small' : crown < 2.7 ? 'medium' : 'large'); // ponytail: crown is the only size signal; placements carry no type
const rnd = (x, z, k) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const TINTS = [0x63a03c, 0x52903a, 0x74ad46, 0x8fa84a, 0x5f9a40, 0x4d8634]; // vivid leaf greens + one olive (leaf texture and inner shade darken them)
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
  const trunkMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const geoms = [], o = new THREE.Object3D();
  // Spatial chunks along the route (CHUNK m in x) so standard frustum culling skips off-screen trees in every pass.
  const CHUNK = 160, chunkOf = (x) => Math.floor(x / CHUNK);
  for (const type of TYPES) {
    const all = placements.map((p, i) => ({ p, i })).filter(({ p }) => typeOf(p.crown) === type);
    if (!all.length) continue;
    const cg = canopyGeometry(type), tg = trunkGeometry(type); geoms.push(cg, tg);
    for (const ck of [...new Set(all.map(({ p }) => chunkOf(p.x)))]) {
    const list = all.filter(({ p }) => chunkOf(p.x) === ck);
    const canopy = new THREE.InstancedMesh(cg, canopyMat, list.length), trunk = new THREE.InstancedMesh(tg, trunkMat, list.length);
    canopy.name = 'trees-canopy-' + type; trunk.name = 'trees-trunk-' + type;
    list.forEach(({ p: { x, z, h, crown, base = 0.1 } }, k) => {
      const r = (n) => rnd(x, z, n), wide = r(1) < 0.5; // shape variant: broad & low vs narrow & tall
      const H = Math.min(6.2, (h + 0.65) * 1.2) * (0.8 + r(2) * 0.25);
      const rw = crown / 2 * (0.94 + r(3) * 0.06) * (wide ? 1 : 0.93), ry = Math.min(H * (wide ? 0.36 : 0.4), rw * (wide ? 1.1 : 1.25)), yc = Math.min(H - ry, ry + 1.6 + r(10) * 0.5), yaw = r(4) * Math.PI * 2; // full rounded crowns: fill the placement footprint
      o.position.set(x, base + 0.02 + yc, z); o.rotation.set(0, yaw, 0); o.scale.set(rw, ry, rw); o.updateMatrix(); canopy.setMatrixAt(k, o.matrix);
      const t = 0.8 + r(5) * 0.45; // trunk thickness
      o.position.set(x, base + 0.02, z); o.scale.set(rw * t, yc, rw * t); o.updateMatrix(); trunk.setMatrixAt(k, o.matrix);
      const c = new THREE.Color(TINTS[Math.floor(r(8) * TINTS.length)]); c.getHSL(hsl); c.setHSL(hsl.h + (r(6) - 0.5) * 0.04, hsl.s, hsl.l * (0.88 + r(9) * 0.24)); canopy.setColorAt(k, c);
      trunk.setColorAt(k, new THREE.Color(0xffffff).multiplyScalar(0.8 + r(7) * 0.4));
    });
    for (const m of [canopy, trunk]) { m.castShadow = m.receiveShadow = true; m.computeBoundingBox(); m.computeBoundingSphere(); m.userData.sourceIndices = list.map((e) => e.i); group.add(m); }
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
  group.userData.update = (_camera, time = 0) => { wind.value = time; };
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return; disposed = true;
    geoms.forEach((g) => g.dispose()); leaves.dispose(); canopyMat.dispose(); trunkMat.dispose();
    if (shrubs) { shrubs.geometry.dispose(); shrubs.material.dispose(); }
  };
  return group;
}
