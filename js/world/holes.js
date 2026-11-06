import * as THREE from 'three';
// Holes in the flat street (ground, asphalt, paint) over the tunnel ramps (route-tunnel.js, swap-tunnel.js). Those materials are shared city-wide and
// three.js clipping planes allow one convex region per material, so instead every patched material discards fragments inside any registered hole:
// an oriented rectangle in plan, below `top` (under the vehicles' 0.11 m headlight pools). One shared uniform list: a material patched once sees all holes.
const MAX = 4, A = Array.from({ length: MAX }, () => new THREE.Vector4()), B = Array.from({ length: MAX }, () => new THREE.Vector4()), count = { value: 0 };
const FRAG = `
for (int i = 0; i < ${MAX}; i++) {
  if (i >= holeCount) break;
  vec2 d = vHoleWP.xz - holeA[i].xy;
  if (abs(dot(d, holeA[i].zw)) <= holeB[i].x && abs(dot(d, vec2(-holeA[i].w, holeA[i].z))) <= holeB[i].y && vHoleWP.y < holeB[i].z) discard;
}`;
function patch(m) {
  if (m.userData.holes) return;
  m.userData.holes = true;
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, renderer) {
    prev?.call(this, sh, renderer); // blockMaterial's hook first: it also rewrites <common>, keeping the include
    Object.assign(sh.uniforms, { holeA: { value: A }, holeB: { value: B }, holeCount: count });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHoleWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 hp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n  hp = instanceMatrix * hp;\n#endif\n  vHoleWP = (modelMatrix * hp).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vHoleWP; uniform vec4 holeA[${MAX}]; uniform vec4 holeB[${MAX}]; uniform int holeCount;`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FRAG);
  };
  m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|holes'; };
  m.needsUpdate = true;
}
// Register a hole (centre cx/cz, unit axis ax/az along it, half length hl, half width hw) and patch every material found at street level inside it
// (raycast probe; `skip` = the tunnel's own meshes). ponytail: probes once at build time, so only surfaces that exist by then are cut.
export function cutHole(scene, { cx, cz, ax, az, hl, hw, top = 0.1 }, skip = []) {
  if (count.value >= MAX) { console.warn('holes: no slot left'); return 0; }
  A[count.value].set(cx, cz, ax, az); B[count.value].set(hl, hw, top, 0); count.value++;
  scene.updateMatrixWorld(true);
  const own = (o) => { for (; o; o = o.parent) if (skip.includes(o)) return true; return false; }; // the tunnel's own meshes, nested groups included
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3(), hit = new Set();
  ray.far = 60;
  // Cull once per hole, not once per probe: city-wide instance batches made these rays scan the entire city hundreds of times.
  const dx = Math.abs(ax) * hl + Math.abs(az) * hw, dz = Math.abs(az) * hl + Math.abs(ax) * hw;
  const region = new THREE.Box3(new THREE.Vector3(cx - dx, -1.5, cz - dz), new THREE.Vector3(cx + dx, top, cz + dz));
  const bounds = new THREE.Box3(), matrix = new THREE.Matrix4(), candidates = [];
  scene.traverse((o) => {
    if (!o.isMesh || own(o) || !ray.layers.test(o.layers)) return;
    const geometry = o.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix); matrix.premultiply(o.matrixWorld);
        if (!bounds.copy(geometry.boundingBox).applyMatrix4(matrix).intersectsBox(region)) continue;
        const probe = new THREE.Mesh(geometry, o.material);
        probe.matrixWorld.copy(matrix); candidates.push(probe);
      }
    } else if (bounds.copy(geometry.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(region)) candidates.push(o);
  });
  const across = [...new Set([-hw + 0.15, hw - 0.15, ...Array.from({ length: Math.floor(2 * hw / 1.2) }, (_, k) => -hw + 0.6 + k * 1.2), -3.85, 3.85, -0.11, 0.11].filter((c) => Math.abs(c) < hw))]; // + the paint lines
  for (let s = -hl + 0.3; s < hl; s += 1.5) for (const c of across) {
    ray.set(from.set(cx + ax * s - az * c, 50, cz + az * s + ax * c), down);
    for (const h of ray.intersectObjects(candidates, false)) if (h.point.y > -1.5 && h.point.y < top) for (const m of [h.object.material].flat()) hit.add(m);
  }
  hit.forEach(patch);
  return hit.size;
}
