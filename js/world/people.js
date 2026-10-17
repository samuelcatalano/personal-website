import * as THREE from 'three';
import { crowdPlan, PROPORTIONS as PR } from './crowd.js';
// Instanced Memoji-style pedestrians: smooth low-poly parts, one InstancedMesh per part, CPU walk cycle. Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, SWING = 0.5, FEET = 0.01, SEED = 1017;
const HAIR_BACK = { long: [0.15, 0.26, 0.075, -0.11, -0.045], bun: [0.07, 0.07, 0.07, 0.065, -0.06], ponytail: [0.045, 0.15, 0.045, -0.04, -0.085] }; // w,h,d, dy,dz from head centre (x u)
const PARTS = ['head', 'hair', 'hairBack', 'torso', 'armL', 'armR', 'legL', 'legR'];
const MULTI = ['shoes', 'hands', 'eyes']; // 2 instances per person
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
  // Unit geometries (full size 1, scaled per instance); limbs are shifted so the pivot is at the top.
  const sph = (w, h, phi = Math.PI) => new THREE.SphereGeometry(0.5, w, h, 0, Math.PI * 2, 0, phi), cap = () => new THREE.CapsuleGeometry(0.5, 0.5, 2, 6);
  const GEO = {
    head: sph(16, 12), hair: sph(16, 6, Math.PI * 0.46), hairBack: cap(), torso: cap().translate(0, 0.5, 0),
    armL: cap().translate(0, -0.5, 0), armR: cap().translate(0, -0.5, 0), legL: cap().translate(0, -0.5, 0), legR: cap().translate(0, -0.5, 0),
    shoes: sph(8, 6), hands: sph(6, 4), eyes: sph(6, 4),
  };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0 });
  const mk = (name, count) => {
    const m = new THREE.InstancedMesh(GEO[name], mat, count);
    Object.assign(m, { name, frustumCulled: false, castShadow: true });
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); return m;
  };
  const M_ = Object.fromEntries([...PARTS.map((n) => [n, mk(n, N)]), ...MULTI.map((n) => [n, mk(n, 2 * N)])]);
  const meshes = Object.values(M_), col = new THREE.Color(), EYE = '#1a1512';
  plan.forEach(({ look: k }, i) => {
    const c = { head: k.skin, hair: k.hair, hairBack: k.hair, torso: k.top, armL: k.top, armR: k.top, legL: k.bottom, legR: k.bottom };
    for (const n of PARTS) M_[n].setColorAt(i, col.set(c[n]));
    for (const [n, cc] of [['shoes', k.shoes], ['hands', k.skin], ['eyes', EYE]]) { M_[n].setColorAt(2 * i, col.set(cc)); M_[n].setColorAt(2 * i + 1, col); }
  });
  const st = plan.map((q) => ({ s: q.s0 * perim(q.path), vis: true, d: 0, u: q.look.height / (PR.head + PR.legs + PR.torso + 0.02) }));
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), w = new THREE.Vector3(), base = new THREE.Matrix4(), lf = new THREE.Matrix4(), t = new THREE.Matrix4(), tm = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const frame = (parent, x, y, z, rx) => lf.multiplyMatrices(parent, t.compose(v.set(x, y, z), q.setFromAxisAngle(AX, rx), ONE)); // scratch frame, no allocation
  const put = (mesh, idx, parent, x, y, z, sx, sy, sz) => mesh.setMatrixAt(idx, tm.multiplyMatrices(parent, t.compose(v.set(x, y, z), q.identity(), w.set(sx, sy, sz))));
  function pose(i, swing, bob) {
    const { look: k } = plan[i], { u } = st[i], hip = PR.legs * u, sh = hip + PR.torso * u, hd = PR.head * u, cy = sh + hd * 0.46, hs = k.shoulder;
    const yaw = Math.atan2(out.fx, out.fz); // fx/fz are already direction-aware
    base.compose(v.set(out.x, FEET + bob, out.z), q.setFromAxisAngle(AY, yaw), ONE);
    put(M_.torso, i, base, 0, hip, 0, hs, PR.torso * u, 0.16 * u);
    put(M_.head, i, base, 0, cy, 0, hd, hd, hd);
    put(M_.hair, i, base, 0, cy + 0.04 * hd, -0.03 * hd, ...(k.hairStyle === 'bald' ? [0, 0, 0] : [hd * 1.06, hd * 1.04, hd * 1.07]));
    const hb = HAIR_BACK[k.hairStyle];
    put(M_.hairBack, i, base, 0, cy + (hb ? hb[3] * u : 0), hb ? hb[4] * u : 0, ...(hb ? hb.slice(0, 3).map((x) => x * u) : [0, 0, 0]));
    for (const sd of [-1, 1]) {
      const j = sd < 0 ? 0 : 1;
      put(M_.eyes, 2 * i + j, base, sd * hd * 0.2, cy - 0.02 * hd, hd * 0.46, 0.13 * hd, 0.17 * hd, 0.08 * hd);
      const ax = sd * (hs / 2 + 0.03 * u), a = sd * swing; // left arm/leg swing opposite to right
      frame(base, ax, sh - 0.03 * u, 0, a);
      put(sd < 0 ? M_.armL : M_.armR, i, lf, 0, 0, 0, 0.065 * u, PR.arms * u, 0.075 * u);
      put(M_.hands, 2 * i + j, lf, 0, -PR.arms * u, 0, 0.075 * u, 0.075 * u, 0.075 * u);
      frame(base, sd * hs * 0.22, hip, 0, -a);
      put(sd < 0 ? M_.legL : M_.legR, i, lf, 0, 0, 0, 0.1 * u, hip, 0.11 * u);
      put(M_.shoes, 2 * i + j, lf, 0, -hip + 0.02 * u, 0.03 * u, 0.11 * u, 0.06 * u, 0.18 * u);
    }
  }
  const hide = (i) => { for (const m of meshes) { if (MULTI.includes(m.name)) { m.setMatrixAt(2 * i, ZERO); m.setMatrixAt(2 * i + 1, ZERO); } else m.setMatrixAt(i, ZERO); } };
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
        const ph = s.d * Math.PI / (0.4 * s.u); // one step per 0.4 u of travel
        pose(i, Math.sin(ph) * SWING, Math.abs(Math.cos(ph)) * 0.03 * s.u);
      });
      flag();
    },
  };
}
