import * as THREE from 'three';
import { crowdPlan, chooseVariants } from './crowd.js';
import * as SP from './sprites.js';
import { estaiadaRoute } from './landmark-geometry.js';
import { LANDMARKS, ROAD, RIVER_Z, stopIndex, underpassFrames } from './layout.js';
import { HX as UNDERPASS_HALF_LENGTH, ARCH_HALF_WIDTH } from './underpass.js';
const { FRAMES, COLS, FB_COLS, ROWS, strideOf } = SP;
// Walking-emoji pedestrians: canvas-drawn sprites (side, front and back views) in two atlas textures, ONE InstancedMesh of cylindrical billboards (+ one for soft shadows). Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, FEET = 0.02, PAVE_TOP = 0.1, SEED = 1017, VARIANTS = 28, STAND = 2, LOCK = 0.6; // sprite looks; the standing frame (legs passing)
const TURN_DISTANCE = 1.2;
const CROWD_CELL = 0.9, CROWD_GAP = 0.82, CROWD_PUSH = 0.55; // shortcut: plaza sidesteps cap at 0.55 m, raise only if visual review still shows overlaps
const KIOSK_CLEARANCE = 1.3; // Kiosk half-diagonal, sprite radius and one maximum lane crowd push
const PORTAL_MARGIN = 0.2, PORTAL_BLEND = 6, FRAME_MARGIN = 2; // keep the whole walker inside the masonry opening
const LOOP_TURN_RADIUS = 0.75; // soften rectangular plaza turns without changing their footprint
const turnDistance = (d) => { const t = Math.min(1, d / TURN_DISTANCE); return TURN_DISTANCE * t * t * (2 - t); };
const turnSpeed = (d) => { const t = Math.min(1, d / TURN_DISTANCE); return t * (4 - 3 * t); };
// The sharp atlas (about 80 MB of textures) only where the screen and GPU can afford it; phones get the 1x one (about 40 MB).
const sharp = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); return !matchMedia('(max-width: 767px)').matches && (navigator.deviceMemory ?? 8) >= 4 && !!gl && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096; } catch { return false; } };

function loopPerimeter(p) {
  const i = p.inset ?? INSET, w = p.rect.x1 - p.rect.x0 - 2 * i, h = p.rect.z1 - p.rect.z0 - 2 * i;
  const r = Math.max(0, Math.min(LOOP_TURN_RADIUS, w / 2, h / 2));
  return 2 * (w + h) - 8 * r + 2 * Math.PI * r;
}

function loopAt(p, s) {
  const { x0, x1, z0, z1 } = p.rect, i = p.inset ?? INSET, a = x0 + i, b = x1 - i, c = z0 + i, d = z1 - i;
  const w = b - a, h = d - c, r = Math.max(0, Math.min(LOOP_TURN_RADIUS, w / 2, h / 2));
  const straightX = Math.max(0, w - 2 * r), straightZ = Math.max(0, h - 2 * r), arc = r * Math.PI / 2;
  const length = 2 * (straightX + straightZ) + 4 * arc;
  if (!(length > 0)) return { x: a, z: c, fx: p.dir ?? 1, fz: 0 };
  let t = ((s % length) + length) % length, x, z, fx, fz;
  if (t < straightX) { x = a + r + t; z = c; fx = 1; fz = 0; }
  else if ((t -= straightX) < arc) {
    const angle = -Math.PI / 2 + t / r;
    x = b - r + r * Math.cos(angle); z = c + r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  } else if ((t -= arc) < straightZ) { x = b; z = c + r + t; fx = 0; fz = 1; }
  else if ((t -= straightZ) < arc) {
    const angle = t / r;
    x = b - r + r * Math.cos(angle); z = d - r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  } else if ((t -= arc) < straightX) { x = b - r - t; z = d; fx = -1; fz = 0; }
  else if ((t -= straightX) < arc) {
    const angle = Math.PI / 2 + t / r;
    x = a + r + r * Math.cos(angle); z = d - r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  } else if ((t -= arc) < straightZ) { x = a; z = d - r - t; fx = 0; fz = -1; }
  else {
    const angle = Math.PI + (t - straightZ) / r;
    x = a + r + r * Math.cos(angle); z = c + r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  }
  const dir = p.dir ?? 1;
  return { x, z, fx: fx * dir, fz: fz * dir };
}

export function createPeople(scene, { curve, pts, stops, obstacles = [], reducedMotion = false, hd = sharp() }) {
  SP.setScale(hd ? 1.4 : 1);
  const { CELL_W, CELL_H, GROUND, S, FB_W, SIDE_W, FB_TEX_W, TEX_H } = SP;
  const plan = crowdPlan(stops, pts, SEED), N = plan.length;
  // Arc-length table of the route (curve parameter is per stop, so speed would vary): positions + normals every ~1 m.
  const fine = Array.from({ length: 4001 }, (_, k) => curve.getPoint(k / 4000)), cum = [0];
  for (let k = 1; k < fine.length; k++) cum.push(cum[k - 1] + fine[k].distanceTo(fine[k - 1]));
  const L = cum[cum.length - 1], M = Math.floor(L), PX = [], PZ = [];
  const passages = underpassFrames(curve, stops);
  for (let m = 0, k = 0; m <= M + 1; m++) {
    while (k < fine.length - 2 && cum[k + 1] < m) k++;
    const f = (m - cum[k]) / (cum[k + 1] - cum[k] || 1);
    PX.push(fine[k].x + (fine[k + 1].x - fine[k].x) * f); PZ.push(fine[k].z + (fine[k + 1].z - fine[k].z) * f);
  }
  // Estaiada ramp mouth: the bridge-side pavement lanes (offset < 0) stop at it and walkers turn back there instead of crossing the carriageway
  const J = estaiadaRoute(pts[stopIndex(stops, LANDMARKS.estaiada)].x, curve, RIVER_Z).stations.at(-1), dj = (m) => Math.hypot(PX[m] - J.x, PZ[m] - J.z);
  let mj = 0; for (let m = 1; m <= M; m++) if (dj(m) < dj(mj)) mj = m;
  const MOUTH = 5.5, G0 = mj + MOUTH, SPAN = L - 2 * MOUTH; // walkable run: from the mouth's far edge all the way round to its near edge
  const out = { x: 0, z: 0, fx: 0, fz: 1, speed: 1, nx: 0, nz: 0, offset: 0 };
  const lane = (p, s, look) => { // same side convention as furnitureSpots/city.js: normal = (-t.z, t.x), offset > 0 on that side
    const start = p.offset < 0 ? G0 : 0, span = p.offset < 0 ? SPAN : L;
    const u = ((s % (2 * span)) + 2 * span) % (2 * span), forward = u < span, d = forward ? u : 2 * span - u;
    const turn = forward ? 1 : -1, pace = d < TURN_DISTANCE ? turnSpeed(d) : d > span - TURN_DISTANCE ? turnSpeed(span - d) : 1;
    s = start + (d < TURN_DISTANCE ? turnDistance(d) : d > span - TURN_DISTANCE ? span - turnDistance(span - d) : d); // ease to a near-stop at route ends before turning back
    const w = ((s % L) + L) % L, i = Math.min(Math.floor(w), M - 1), f = w - i;
    let tx = PX[i + 1] - PX[i], tz = PZ[i + 1] - PZ[i]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const x = PX[i] + (PX[i + 1] - PX[i]) * f, z = PZ[i] + (PZ[i + 1] - PZ[i]) * f;
    let offset = p.offset;
    let slope = 0;
    const half = CELL_W / S * look.height / 2, safe = Math.sign(offset) * (ARCH_HALF_WIDTH - half - PORTAL_MARGIN - 0.05), core = UNDERPASS_HALF_LENGTH + half + PORTAL_MARGIN + FRAME_MARGIN;
    for (const a of passages) {
      const along = (x - a.x) * a.tx + (z - a.z) * a.tz, t = Math.max(0, Math.min(1, (core + PORTAL_BLEND - Math.abs(along)) / PORTAL_BLEND)), blend = t * t * (3 - 2 * t), previous = offset;
      offset += (safe - previous) * blend;
      slope = slope * (1 - blend) - (safe - previous) * Math.sign(along) * 6 * t * (1 - t) * (tx * a.tx + tz * a.tz) / PORTAL_BLEND;
    }
    out.nx = -tz; out.nz = tx; out.offset = offset;
    out.x = x + out.nx * offset; out.z = z + out.nz * offset;
    const fx = tx - tz * slope, fz = tz + tx * slope, fl = Math.hypot(fx, fz) || 1;
    out.fx = fx / fl * p.dir * turn; out.fz = fz / fl * p.dir * turn; out.speed = pace;
  };
  const loop = (p, s) => { Object.assign(out, loopAt(p, s)); out.speed = 1; out.nx = out.nz = out.offset = 0; };
  const place = (p, s, look) => p.type === 'lane' ? lane(p, s, look) : loop(p, s);
  const perim = (p) => (p.type === 'lane' ? 2 * (p.offset < 0 ? SPAN : L) : loopPerimeter(p));

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
  const walkPace = crowd.userData.walkPace = new Float32Array(N);
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), N);
  Object.assign(shadow, { name: 'crowd-shadow', frustumCulled: false, renderOrder: 0 });
  shadow.instanceMatrix = crowd.instanceMatrix; // same position + scale, no second buffer
  scene.add(crowd, shadow);
  const A = crowd.instanceMatrix.array, I = info.array;
  const st = plan.map((q, i) => ({ s: q.s0 * perim(q.path), d: q.s0 * 40, pace: 1, vis: true, h: q.look.height, frame: STAND, lock: 0 }));
  const px = new Float32Array(N), pz = new Float32Array(N), fx = new Float32Array(N), fz = new Float32Array(N), near = new Uint8Array(N), pushX = new Float32Array(N), pushZ = new Float32Array(N), cells = new Map();
  const laneX = new Float32Array(N), laneZ = new Float32Array(N), laneNX = new Float32Array(N), laneNZ = new Float32Array(N);
  const rememberLane = (i) => { laneX[i] = out.x - out.nx * out.offset; laneZ[i] = out.z - out.nz * out.offset; laneNX[i] = out.nx; laneNZ[i] = out.nz; };
  const avoidKiosks = (i) => {
    const path = plan[i].path;
    if (!obstacles.length || path.type !== 'lane') return;
    const side = Math.sign(path.offset), nx = laneNX[i], nz = laneNZ[i], x = px[i], z = pz[i];
    let shift = 0;
    for (const [kx, kz] of obstacles) {
      const dx = x - kx, dz = z - kz, lateral = dx * nx + dz * nz, towardRoad = -side * lateral;
      if (towardRoad <= 0) continue;
      const distance2 = dx * dx + dz * dz;
      if (distance2 >= KIOSK_CLEARANCE * KIOSK_CLEARANCE) continue;
      const along2 = Math.max(0, distance2 - lateral * lateral);
      shift = Math.max(shift, Math.sqrt(KIOSK_CLEARANCE * KIOSK_CLEARANCE - along2) - towardRoad);
    }
    const offset = side * ((x - laneX[i]) * nx + (z - laneZ[i]) * nz);
    shift = Math.max(0, Math.min(shift, offset - ROAD.padIn - 0.35));
    px[i] -= nx * side * shift; pz[i] -= nz * side * shift;
  };
  crowd.userData.route = { x: px, z: pz, fx, fz };
  for (let i = 0; i < N; i++) { A.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16); }
  const show = (i, vis, sx = 0, sz = 0) => { const a = i * 16, h = vis ? st[i].h : 0; A[a] = A[a + 5] = A[a + 10] = h; A[a + 12] = out.x + sx; A[a + 13] = plan[i].path.y ?? (plan[i].path.type === 'lane' ? PAVE_TOP : FEET); A[a + 14] = out.z + sz; };
  const push = (i, dx, dz) => {
    const ox = pushX[i], oz = pushZ[i]; let x = ox + dx, z = oz + dz;
    const length = Math.hypot(x, z), limit = plan[i].path.type === 'lane' ? 0.2 : CROWD_PUSH;
    if (length > limit) { x *= limit / length; z *= limit / length; }
    px[i] += x - ox; pz[i] += z - oz; pushX[i] = x; pushZ[i] = z;
  };
  const vw = new Uint8Array(N); // current view per person, with hysteresis so sector changes do not flicker
  const face = (i, frame, view = 0) => { I[4 * i] = (view ? of[i] * 2 + view - 1 : of[i]) * FRAMES + frame; I[4 * i + 1] = out.fx; I[4 * i + 2] = out.fz; I[4 * i + 3] = view; };
  const flag = () => { crowd.instanceMatrix.needsUpdate = true; info.needsUpdate = true; };
  plan.forEach((p, i) => { place(p.path, st[i].s, p.look); st[i].pace = out.speed; px[i] = out.x; pz[i] = out.z; if (p.path.type === 'lane') { rememberLane(i); avoidKiosks(i); out.x = px[i]; out.z = pz[i]; } fx[i] = out.fx; fz[i] = out.fz; walkPace[i] = Math.min(1, out.speed); show(i, true); face(i, STAND); });
  flag();
  return {
    count: N, meshes: [crowd, shadow], ready, get atlasMs() { return atlasMs; },
    update(dt, cam) {
      if (reducedMotion || dt < 0) dt = 0;
      plan.forEach(({ look: k, path }, i) => {
        const s = st[i]; s.s += path.dir * k.speed * dt / Math.max(1, s.pace);
        place(path, s.s, k);
        if (path.type === 'lane') rememberLane(i);
        s.pace = out.speed; walkPace[i] = Math.min(1, out.speed); s.d += k.speed * walkPace[i] * dt;
        px[i] = out.x; pz[i] = out.z; fx[i] = out.fx; fz[i] = out.fz;
        near[i] = Math.hypot(out.x - cam.x, out.z - cam.z) <= NEAR + CROWD_GAP ? 1 : 0;
        if (!near[i]) return;
        if (dt > 0) {
          if (out.speed < 0.08) { s.frame = STAND; s.lock = 0; }
          else { const ph = s.d / cycle[i] * FRAMES, fi = Math.floor(ph); s.frame = ((fi % FRAMES) + FRAMES) % FRAMES; s.lock = -(ph - fi - 0.5) * (cycle[i] / FRAMES) * LOCK; }
        }
      });
      pushX.fill(0); pushZ.fill(0);
      for (let pass = 0; pass < 6; pass++) {
        cells.clear();
        for (let i = 0; i < N; i++) if (near[i]) {
          const cx = Math.floor(px[i] / CROWD_CELL), cz = Math.floor(pz[i] / CROWD_CELL), key = `${cx},${cz}`;
          let bucket = cells.get(key); if (!bucket) cells.set(key, bucket = []); bucket.push(i);
        }
        for (let i = 0; i < N; i++) if (near[i]) {
          const cx = Math.floor(px[i] / CROWD_CELL), cz = Math.floor(pz[i] / CROWD_CELL);
          for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const j of cells.get(`${x},${z}`) || []) if (j < i) {
            let dx = px[i] - px[j], dz = pz[i] - pz[j], d2 = dx * dx + dz * dz;
            if (d2 >= CROWD_GAP * CROWD_GAP) continue;
            let d = Math.sqrt(d2);
            if (d < 1e-3) { const a = (i * 127 + j * 311) * 0.017; dx = Math.cos(a); dz = Math.sin(a); d = 0; }
            const amount = (CROWD_GAP - d) * 0.5 / (d || 1);
            push(i, dx * amount, dz * amount); push(j, -dx * amount, -dz * amount);
          }
        }
      }
      for (let i = 0; i < N; i++) {
        avoidKiosks(i);
        out.x = px[i]; out.z = pz[i]; out.fx = fx[i]; out.fz = fz[i];
        const visible = near[i] && Math.hypot(px[i] - cam.x, pz[i] - cam.z) <= NEAR;
        if (!visible) { show(i, false); continue; }
        const s = st[i]; show(i, true, out.fx * s.lock, out.fz * s.lock);
        // side view mostly perpendicular to the camera, front when walking toward it, back when walking away (45 degree sectors, hysteresis at the edges)
        const c = (out.fx * (out.x - cam.x) + out.fz * (out.z - cam.z)) / (Math.hypot(out.x - cam.x, out.z - cam.z) || 1), v = vw[i];
        vw[i] = v === 0 ? (c < -0.76 ? 1 : c > 0.76 ? 2 : 0) : v === 1 ? (c > -0.6 ? 0 : 1) : (c < 0.6 ? 0 : 2);
        face(i, s.frame, vw[i]);
      }
      flag();
    },
  };
}
