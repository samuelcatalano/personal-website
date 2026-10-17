import * as THREE from 'three';
import { crowdPlan, PROPORTIONS as PR } from './crowd.js';
// Instanced Memoji-style pedestrians: smooth low-poly parts, one InstancedMesh per part, CPU walk cycle. Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, SWING = 0.5, FEET = 0.01, SEED = 1017, KID_HEAD = 1.3;
// Hair mass behind the head, in head diameters: [w, h, d, dy, dz] from head centre.
const HAIR_BACK = { long: [0.98, 1.05, 0.5, -0.3, -0.3], bun: [0.42, 0.42, 0.42, 0.5, -0.36], ponytail: [0.22, 0.7, 0.22, -0.12, -0.6] };
const PARTS = ['head', 'hair', 'hairBack', 'torso', 'armL', 'armR', 'legL', 'legR', 'neck', 'nose', 'beard'];
const MULTI = { shoes: 2, hands: 2, eyes: 2, ears: 2, brows: 3 }; // instances per person (brows: left, right, mouth)
const MOUTH = '#7a2e2e', EYE = '#1a1512';
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
  // Unit geometries (size 1, scaled per instance). Limbs hang from a top pivot, torso stands on a bottom pivot.
  const sph = (w, h, phi = Math.PI) => new THREE.SphereGeometry(0.5, w, h, 0, Math.PI * 2, 0, phi);
  const cap = (r, len, seg) => new THREE.CapsuleGeometry(0.5, len, seg, r).scale(1, 1 / (len + 1), 1); // total height 1
  const GEO = {
    head: sph(14, 9), hair: sph(14, 5, Math.PI * 0.64), hairBack: cap(8, 0.5, 1), torso: cap(12, 0.6, 2).translate(0, 0.5, 0),
    armL: cap(8, 1.5, 1).translate(0, -0.5, 0), armR: cap(8, 1.5, 1).translate(0, -0.5, 0), legL: cap(8, 1.5, 1).translate(0, -0.5, 0), legR: cap(8, 1.5, 1).translate(0, -0.5, 0),
    neck: cap(8, 1, 1), nose: sph(8, 5), beard: sph(8, 5), shoes: sph(8, 5), hands: sph(12, 8), eyes: sph(8, 5), ears: sph(6, 4), brows: sph(6, 3),
  };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0 });
  const mk = (name, count) => {
    const m = new THREE.InstancedMesh(GEO[name], mat, count);
    Object.assign(m, { name, frustumCulled: false, castShadow: true });
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); return m;
  };
  const M_ = Object.fromEntries([...PARTS.map((n) => [n, mk(n, N)]), ...Object.entries(MULTI).map(([n, c]) => [n, mk(n, c * N)])]);
  const meshes = Object.values(M_), col = new THREE.Color();
  const beard = (k) => k.kind === 'man' && Math.floor(k.height * 1000) % 3 === 0; // ponytail: derived, not rolled, so crowd.js keeps its rng stream
  plan.forEach(({ look: k }, i) => {
    const c = { head: k.skin, hair: k.hair, hairBack: k.hair, torso: k.top, armL: k.top, armR: k.top, legL: k.bottom, legR: k.bottom, neck: k.skin, nose: k.skin, beard: k.hair };
    for (const n of PARTS) M_[n].setColorAt(i, col.set(c[n]));
    const mc = { shoes: [k.shoes, k.shoes], hands: [k.skin, k.skin], eyes: [EYE, EYE], ears: [k.skin, k.skin], brows: [k.hair, k.hair, MOUTH] };
    for (const [n, cs] of Object.entries(mc)) cs.forEach((cc, j) => M_[n].setColorAt(MULTI[n] * i + j, col.set(cc)));
  });
  const st = plan.map((q) => { const hf = q.look.height < 1.5 ? KID_HEAD : 1; return { s: q.s0 * perim(q.path), vis: true, d: 0, hf, u: q.look.height / (PR.head * hf + PR.legs + PR.torso + 0.02) }; });
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), w = new THREE.Vector3(), base = new THREE.Matrix4(), lf = new THREE.Matrix4(), t = new THREE.Matrix4(), tm = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const frame = (parent, x, y, z, rx) => lf.multiplyMatrices(parent, t.compose(v.set(x, y, z), q.setFromAxisAngle(AX, rx), ONE)); // scratch frame, no allocation
  const put = (mesh, idx, parent, x, y, z, sx, sy, sz, rx = 0) => mesh.setMatrixAt(idx, tm.multiplyMatrices(parent, t.compose(v.set(x, y, z), q.setFromAxisAngle(AX, rx), w.set(sx, sy, sz))));
  function pose(i, swing, bob) {
    const { look: k } = plan[i], { u, hf } = st[i], hip = PR.legs * u, sh = hip + PR.torso * u, hd = PR.head * hf * u, cy = sh + 0.02 * u + hd * 0.5, hs = k.shoulder;
    const yaw = Math.atan2(out.fx, out.fz); // fx/fz are already direction-aware
    base.compose(v.set(out.x, FEET + bob, out.z), q.setFromAxisAngle(AY, yaw), ONE);
    put(M_.torso, i, base, 0, hip - 0.04 * u, 0, hs, PR.torso * u + 0.04 * u, 0.2 * u);
    put(M_.neck, i, base, 0, sh + 0.005 * u, 0, 0.11 * u, 0.12 * u, 0.1 * u);
    put(M_.head, i, base, 0, cy, 0, hd * 0.94, hd, hd * 0.96);
    put(M_.nose, i, base, 0, cy - 0.15 * hd, 0.46 * hd, 0.12 * hd, 0.12 * hd, 0.12 * hd);
    const bd = beard(k);
    put(M_.beard, i, base, 0, cy - 0.24 * hd, 0.02 * hd, ...(bd ? [0.86 * hd, 0.66 * hd, 0.8 * hd] : [0, 0, 0]));
    put(M_.hair, i, base, 0, cy + 0.02 * hd, -0.02 * hd, ...(k.hairStyle === 'bald' ? [0, 0, 0] : [hd * 1.07, hd * 1.06, hd * 1.09]), -0.38); // cap tilted back: hairline above the brows
    const hb = HAIR_BACK[k.hairStyle];
    put(M_.hairBack, i, base, 0, cy + (hb ? hb[3] * hd : 0), hb ? hb[4] * hd : 0, ...(hb ? hb.slice(0, 3).map((x) => x * hd) : [0, 0, 0]));
    put(M_.brows, 3 * i + 2, base, 0, cy - 0.27 * hd, (bd ? 0.43 : 0.41) * hd, 0.2 * hd, 0.04 * hd, 0.05 * hd); // mouth
    for (const sd of [-1, 1]) {
      const j = sd < 0 ? 0 : 1;
      put(M_.eyes, 2 * i + j, base, sd * hd * 0.2, cy - 0.05 * hd, hd * 0.42, 0.14 * hd, 0.19 * hd, 0.07 * hd);
      put(M_.brows, 3 * i + j, base, sd * hd * 0.2, cy + 0.12 * hd, hd * 0.41, 0.18 * hd, 0.035 * hd, 0.05 * hd);
      put(M_.ears, 2 * i + j, base, sd * hd * 0.47, cy - 0.08 * hd, 0, 0.08 * hd, 0.15 * hd, 0.1 * hd);
      const a = sd * swing; // left arm/leg swing opposite to right
      frame(base, sd * (hs * 0.46 + 0.015 * u), sh - 0.06 * u, 0, a);
      put(sd < 0 ? M_.armL : M_.armR, i, lf, 0, 0, 0, 0.095 * u, PR.arms * u, 0.095 * u);
      put(M_.hands, 2 * i + j, lf, 0, -PR.arms * u + 0.01 * u, 0, 0.11 * u, 0.11 * u, 0.11 * u);
      frame(base, sd * hs * 0.27, hip, 0, -a);
      put(sd < 0 ? M_.legL : M_.legR, i, lf, 0, 0, 0, 0.125 * u, hip, 0.14 * u);
      put(M_.shoes, 2 * i + j, lf, 0, -hip + 0.0375 * u, 0.04 * u, 0.13 * u, 0.075 * u, 0.22 * u);
    }
  }
  const hide = (i) => { for (const m of meshes) for (let j = 0, c = MULTI[m.name] || 1; j < c; j++) m.setMatrixAt(c * i + j, ZERO); };
  const flag = () => meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  plan.forEach((p, i) => { place(p.path, st[i].s); pose(i, 0, 0); });
  flag();
  return {
    count: N, meshes,
    update(dt, cam) {
      if (reducedMotion || dt <= 0) return;
      plan.forEach(({ look: k, path }, i) => {
        const s = st[i]; s.s += path.dir * k.speed * dt; s.d += k.speed * dt;
        place(path, s.s);
        if (Math.hypot(out.x - cam.x, out.z - cam.z) > NEAR) { if (s.vis) { hide(i); s.vis = false; } return; }
        s.vis = true;
        const ph = s.d * Math.PI / (0.35 * s.u); // one step per 0.35 u of travel
        pose(i, Math.sin(ph) * SWING, Math.abs(Math.cos(ph)) * 0.025 * s.u);
      });
      flag();
    },
  };
}
