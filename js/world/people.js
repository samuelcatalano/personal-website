import * as THREE from 'three';
import { crowdPlan, chooseVariants } from './crowd.js';
import { buildAtlas, CELL_W, CELL_H, GROUND, S, COLS, ROWS, FRAMES } from './sprites.js';
// Walking-emoji pedestrians: canvas-drawn sprites in one atlas, ONE InstancedMesh of cylindrical billboards (+ one for soft shadows). Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, FEET = 0.02, SEED = 1017, VARIANTS = 32, STAND = 3, CYCLE = 0.8; // CYCLE: metres of travel per walk cycle, in body heights
export function createPeople(scene, { curve, pts, stops, reducedMotion = false }) {
  const plan = crowdPlan(stops, pts, SEED), N = plan.length;
  // Arc-length table of the route (curve parameter is per stop, so speed would vary): positions + normals every ~1 m.
  const fine = Array.from({ length: 4001 }, (_, k) => curve.getPoint(k / 4000)), cum = [0];
  for (let k = 1; k < fine.length; k++) cum.push(cum[k - 1] + fine[k].distanceTo(fine[k - 1]));
  const L = cum[cum.length - 1], M = Math.floor(L), PX = [], PZ = [];
  for (let m = 0, k = 0; m <= M + 1; m++) {
    while (k < fine.length - 2 && cum[k + 1] < m) k++;
    const f = (m - cum[k]) / (cum[k + 1] - cum[k] || 1);
    PX.push(fine[k].x + (fine[k + 1].x - fine[k].x) * f); PZ.push(fine[k].z + (fine[k + 1].z - fine[k].z) * f);
  }
  const out = { x: 0, z: 0, fx: 0, fz: 1 };
  const lane = (p, s) => { // same side convention as furnitureSpots/city.js: normal = (-t.z, t.x), offset > 0 on that side
    const w = ((s % L) + L) % L, i = Math.min(Math.floor(w), M - 1), f = w - i;
    let tx = PX[i + 1] - PX[i], tz = PZ[i + 1] - PZ[i]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out.x = PX[i] + (PX[i + 1] - PX[i]) * f - tz * p.offset; out.z = PZ[i] + (PZ[i + 1] - PZ[i]) * f + tx * p.offset;
    out.fx = tx * p.dir; out.fz = tz * p.dir;
  };
  const loop = (p, s) => {
    const { x0, x1, z0, z1 } = p.rect, a = x0 + INSET, b = x1 - INSET, c = z0 + INSET, d = z1 - INSET, w = b - a, h = d - c;
    let t = ((s % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h)), fx = 1, fz = 0;
    if (t < w) { out.x = a + t; out.z = c; }
    else if ((t -= w) < h) { out.x = b; out.z = c + t; fx = 0; fz = 1; }
    else if ((t -= h) < w) { out.x = b - t; out.z = d; fx = -1; }
    else { t -= w; out.x = a; out.z = d - t; fx = 0; fz = -1; }
    out.fx = fx * p.dir; out.fz = fz * p.dir;
  };
  const place = (p, s) => (p.type === 'lane' ? lane : loop)(p, s);
  const perim = (p) => (p.type === 'lane' ? L : 2 * (p.rect.x1 - p.rect.x0 + p.rect.z1 - p.rect.z0 - 4 * INSET));

  // Atlas: VARIANTS looks x FRAMES walk frames; every person maps to its nearest look.
  const { variants, of } = chooseVariants(plan.map((q) => q.look), VARIANTS);
  const img = buildAtlas(variants), map = new THREE.DataTexture(new Uint8Array(img.data.buffer), img.width, img.height); // DataTexture keeps the bled RGB under alpha 0 (canvas uploads would not)
  Object.assign(map, { colorSpace: THREE.SRGBColorSpace, anisotropy: 8, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, needsUpdate: true });
  const geo = new THREE.PlaneGeometry(CELL_W / S, CELL_H / S).translate(0, (GROUND - CELL_H / 2) / S, 0); // unit = body height; ground at y 0
  const info = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage); // cell index, walk dir x / z
  geo.setAttribute('aInfo', info);
  const mat = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { // cylindrical billboard + atlas cell + mirror so they face their walking direction as seen from the camera
    sh.uniforms.uGrid = { value: new THREE.Vector2(COLS, ROWS) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aInfo; uniform vec2 uGrid;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(viewMatrix[0][2] * 0.35, 1.0, viewMatrix[2][2] * 0.35));')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vec2 rr = vec2(viewMatrix[0][0], viewMatrix[2][0]); rr /= max(length(rr), 1e-4);
vec2 lu = vec2(dot(aInfo.yz, rr) >= 0.0 ? uv.x : 1.0 - uv.x, uv.y);
float cl = mod(aInfo.x, uGrid.x), rw = floor(aInfo.x / uGrid.x);
vMapUv = vec2((cl + lu.x) / uGrid.x, (rw + 1.0 - lu.y) / uGrid.y);`)
      .replace('#include <project_vertex>', `float sc = instanceMatrix[0][0];
vec3 wp = instanceMatrix[3].xyz + vec3(rr.x, 0.0, rr.y) * position.x * sc + vec3(0.0, position.y * sc, 0.0);
vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
gl_Position = projectionMatrix * mvPosition;`);
  };
  const crowd = new THREE.InstancedMesh(geo, mat, N);
  Object.assign(crowd, { name: 'crowd', frustumCulled: false });
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), N);
  Object.assign(shadow, { name: 'crowd-shadow', frustumCulled: false });
  shadow.instanceMatrix = crowd.instanceMatrix; // same position + scale, no second buffer
  scene.add(crowd, shadow);
  const A = crowd.instanceMatrix.array, I = info.array;
  const st = plan.map((q, i) => ({ s: q.s0 * perim(q.path), d: q.s0 * 40, vis: true, h: q.look.height }));
  for (let i = 0; i < N; i++) { A.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16); }
  const show = (i, vis) => { const a = i * 16, h = vis ? st[i].h : 0; A[a] = A[a + 5] = A[a + 10] = h; A[a + 12] = out.x; A[a + 13] = FEET; A[a + 14] = out.z; };
  const face = (i, frame) => { I[3 * i] = of[i] * FRAMES + frame; I[3 * i + 1] = out.fx; I[3 * i + 2] = out.fz; };
  const flag = () => { crowd.instanceMatrix.needsUpdate = true; info.needsUpdate = true; };
  plan.forEach((p, i) => { place(p.path, st[i].s); show(i, true); face(i, STAND); });
  flag();
  return {
    count: N, meshes: [crowd, shadow],
    update(dt, cam) {
      if (reducedMotion || dt <= 0) return;
      plan.forEach(({ look: k, path }, i) => {
        const s = st[i]; s.s += path.dir * k.speed * dt; s.d += k.speed * dt;
        place(path, s.s);
        const near = Math.hypot(out.x - cam.x, out.z - cam.z) <= NEAR;
        show(i, near);
        if (near) face(i, Math.floor(s.d / (CYCLE * s.h) * FRAMES) % FRAMES);
      });
      flag();
    },
  };
}
