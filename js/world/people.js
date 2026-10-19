import * as THREE from 'three';
import { crowdPlan, chooseVariants } from './crowd.js';
import * as SP from './sprites.js';
const { FRAMES, COLS, FB_COLS, ROWS, strideOf } = SP;
// Walking-emoji pedestrians: canvas-drawn sprites (side, front and back views) in two atlas textures, ONE InstancedMesh of cylindrical billboards (+ one for soft shadows). Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, FEET = 0.02, SEED = 1017, VARIANTS = 28, STAND = 2, LOCK = 0.6; // sprite looks; the standing frame (legs passing)
// The sharp atlas (about 80 MB of textures) only where the screen and GPU can afford it; phones get the 1x one (about 40 MB).
const sharp = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); return !matchMedia('(max-width: 767px)').matches && (navigator.deviceMemory ?? 8) >= 4 && !!gl && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096; } catch { return false; } };
export function createPeople(scene, { curve, pts, stops, reducedMotion = false, hd = sharp() }) {
  SP.setScale(hd ? 1.4 : 1);
  const { CELL_W, CELL_H, GROUND, S, FB_W, SIDE_W, FB_TEX_W, TEX_H } = SP;
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
    const { x0, x1, z0, z1 } = p.rect, i0 = p.inset ?? INSET, a = x0 + i0, b = x1 - i0, c = z0 + i0, d = z1 - i0, w = b - a, h = d - c;
    let t = ((s % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h)), fx = 1, fz = 0;
    if (t < w) { out.x = a + t; out.z = c; }
    else if ((t -= w) < h) { out.x = b; out.z = c + t; fx = 0; fz = 1; }
    else if ((t -= h) < w) { out.x = b - t; out.z = d; fx = -1; }
    else { t -= w; out.x = a; out.z = d - t; fx = 0; fz = -1; }
    out.fx = fx * p.dir; out.fz = fz * p.dir;
  };
  const place = (p, s) => (p.type === 'lane' ? lane : loop)(p, s);
  const perim = (p) => (p.type === 'lane' ? L : 2 * (p.rect.x1 - p.rect.x0 + p.rect.z1 - p.rect.z0 - 4 * (p.inset ?? INSET)));

  // Atlas: VARIANTS looks x FRAMES walk frames; every person maps to its nearest look.
  const { variants, of } = chooseVariants(plan.map((q) => q.look), VARIANTS);
  const blank = () => new THREE.DataTexture(new Uint8Array(4), 1, 1), pending = { map: blank(), map2: { value: blank() } }; // transparent until the atlas is built (in slices, off the first frame)
  for (const t of [pending.map, pending.map2.value]) t.needsUpdate = true;
  const texture = (img) => Object.assign(new THREE.DataTexture(new Uint8Array(img.data.buffer), img.width, img.height), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, needsUpdate: true }); // DataTexture keeps the bled RGB under alpha 0 (canvas uploads would not)
  let atlasMs = 0;
  const t0 = performance.now(), ready = SP.buildAtlas(variants).then(({ side, fb }) => { mat.map = texture(side); u.map2.value = texture(fb); atlasMs = performance.now() - t0; });
  const cycle = plan.map((q) => strideOf(q.look) * q.look.height); // metres per walk cycle: the sprite's own stance travel, so the planted foot does not slide
  const geo = new THREE.PlaneGeometry(CELL_W / S, CELL_H / S).translate(0, (GROUND - CELL_H / 2) / S, 0); // unit = body height; ground at y 0
  const info = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage); // cell index, walk dir x / z, view (0 side, 1 front, 2 back)
  geo.setAttribute('aInfo', info);
  const u = { map2: pending.map2 };
  const mat = new THREE.MeshLambertMaterial({ map: pending.map, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }) // soft blended edge; alphaToCoverage left fractional alpha in the composer target (no MSAA), which showed as a white rim;
  mat.onBeforeCompile = (sh) => { // cylindrical billboard + atlas cell + mirror so they face their walking direction as seen from the camera
    sh.uniforms.map2 = u.map2; sh.uniforms.uCells = { value: new THREE.Vector4(CELL_W, CELL_H, FB_W, TEX_H) }; sh.uniforms.uTex = { value: new THREE.Vector4(SIDE_W, FB_TEX_W, COLS, FB_COLS) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aInfo; uniform vec4 uCells, uTex; varying float vSd;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(viewMatrix[0][2] * 0.35, 1.0, viewMatrix[2][2] * 0.35));')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vec2 rr = vec2(viewMatrix[0][0], viewMatrix[2][0]); rr /= max(length(rr), 1e-4);
float sd = aInfo.w < 0.5 ? 1.0 : 0.0;
vec2 lu = vec2(sd > 0.5 && dot(aInfo.yz, rr) < 0.0 ? 1.0 - uv.x : uv.x, 1.0 - uv.y);
vSd = sd;
vec2 px = sd > 0.5 ? vec2(mod(aInfo.x, uTex.z) * uCells.x + lu.x * uCells.x, floor(aInfo.x / uTex.z) * uCells.y + lu.y * uCells.y)
  : vec2(mod(aInfo.x, uTex.w) * uCells.z + lu.x * uCells.z, floor(aInfo.x / uTex.w) * uCells.y + lu.y * uCells.y);
vMapUv = px / (sd > 0.5 ? vec2(uTex.x, uCells.w) : vec2(uTex.y, uCells.w));`)
      .replace('#include <project_vertex>', `float sc = instanceMatrix[0][0];
vec3 wp = instanceMatrix[3].xyz + vec3(rr.x, 0.0, rr.y) * position.x * (sd > 0.5 ? 1.0 : uCells.z / uCells.x) * sc + vec3(0.0, position.y * sc, 0.0);
vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D map2; varying float vSd;').replace('#include <map_fragment>', 'vec4 ta = texture2D(map, vMapUv, -0.6), tb = texture2D(map2, vMapUv, -0.6); diffuseColor *= vSd > 0.5 ? ta : tb;'); // sharper mips, so walk frames do not average into a blur; both reads are unconditional on the view
  };
  const crowd = new THREE.InstancedMesh(geo, mat, N);
  Object.assign(crowd, { name: 'crowd', frustumCulled: false, renderOrder: 1 }); // after the shadows
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), N);
  Object.assign(shadow, { name: 'crowd-shadow', frustumCulled: false, renderOrder: 0 });
  shadow.instanceMatrix = crowd.instanceMatrix; // same position + scale, no second buffer
  scene.add(crowd, shadow);
  const A = crowd.instanceMatrix.array, I = info.array;
  const st = plan.map((q, i) => ({ s: q.s0 * perim(q.path), d: q.s0 * 40, vis: true, h: q.look.height }));
  for (let i = 0; i < N; i++) { A.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16); }
  const show = (i, vis, sx = 0, sz = 0) => { const a = i * 16, h = vis ? st[i].h : 0; A[a] = A[a + 5] = A[a + 10] = h; A[a + 12] = out.x + sx; A[a + 13] = plan[i].path.y ?? FEET; A[a + 14] = out.z + sz; };
  const vw = new Uint8Array(N); // current view per person, with hysteresis so sector changes do not flicker
  const face = (i, frame, view = 0) => { I[4 * i] = (view ? of[i] * 2 + view - 1 : of[i]) * FRAMES + frame; I[4 * i + 1] = out.fx; I[4 * i + 2] = out.fz; I[4 * i + 3] = view; };
  const flag = () => { crowd.instanceMatrix.needsUpdate = true; info.needsUpdate = true; };
  plan.forEach((p, i) => { place(p.path, st[i].s); show(i, true); face(i, STAND); });
  flag();
  return {
    count: N, meshes: [crowd, shadow], ready, get atlasMs() { return atlasMs; },
    update(dt, cam) {
      if (reducedMotion || dt <= 0) return;
      plan.forEach(({ look: k, path }, i) => {
        const s = st[i]; s.s += path.dir * k.speed * dt; s.d += k.speed * dt;
        place(path, s.s);
        const near = Math.hypot(out.x - cam.x, out.z - cam.z) <= NEAR;
        if (!near) { show(i, false); return; }
        const ph = s.d / cycle[i] * FRAMES, fi = Math.floor(ph), lock = -(ph - fi - 0.5) * (cycle[i] / FRAMES) * LOCK; // pose is sampled at the frame centre; slide the sprite back so the planted foot stays put between frames
        show(i, true, out.fx * lock, out.fz * lock);
        // side view mostly perpendicular to the camera, front when walking toward it, back when walking away (45 degree sectors, hysteresis at the edges)
        const c = (out.fx * (out.x - cam.x) + out.fz * (out.z - cam.z)) / (Math.hypot(out.x - cam.x, out.z - cam.z) || 1), v = vw[i];
        vw[i] = v === 0 ? (c < -0.76 ? 1 : c > 0.76 ? 2 : 0) : v === 1 ? (c > -0.6 ? 0 : 1) : (c < 0.6 ? 0 : 2);
        face(i, ((fi % FRAMES) + FRAMES) % FRAMES, vw[i]);
      });
      flag();
    },
  };
}
