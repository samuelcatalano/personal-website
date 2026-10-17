import * as THREE from 'three';
import { crowdPlan, PROPORTIONS as PR } from './crowd.js';
import { blockMaterial } from './textures.js';
// Instanced pedestrians: one InstancedMesh per body part, CPU walk cycle. Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, SWING = 0.5, FEET = 0.01, SEED = 1017;
const HAIR_BACK = { long: [0.14, 0.2, 0.035, -0.08], bun: [0.06, 0.06, 0.06, 0.05], ponytail: [0.04, 0.14, 0.04, -0.05] }; // w,h,d, y rel. head base
const PARTS = ['head', 'hair', 'hairBack', 'torso', 'armL', 'armR', 'legL', 'legR'];
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
  const box = new THREE.BoxGeometry(1, 1, 1), mat = blockMaterial('#ffffff');
  const mk = (name, count, pivotTop) => {
    const m = new THREE.InstancedMesh(box.clone().translate(0, pivotTop ? -0.5 : 0.5, 0), mat, count);
    Object.assign(m, { name, frustumCulled: false, castShadow: true });
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); return m;
  };
  const M_ = Object.fromEntries(PARTS.map((n) => [n, mk(n, N, n.startsWith('arm') || n.startsWith('leg'))]));
  M_.shoes = mk('shoes', 2 * N, false);
  const meshes = Object.values(M_), col = new THREE.Color();
  plan.forEach(({ look: k }, i) => {
    const c = { head: k.skin, hair: k.hair, hairBack: k.hair, torso: k.top, armL: k.top, armR: k.top, legL: k.bottom, legR: k.bottom };
    for (const n of PARTS) M_[n].setColorAt(i, col.set(c[n]));
    M_.shoes.setColorAt(2 * i, col.set(k.shoes)); M_.shoes.setColorAt(2 * i + 1, col);
  });
  const st = plan.map((q) => ({ s: q.s0 * perim(q.path), vis: true, d: 0, u: q.look.height / (PR.head + PR.legs + PR.torso + 0.02) }));
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), base = new THREE.Matrix4(), pm = new THREE.Matrix4(), t = new THREE.Matrix4(), S = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const at = (parent, x, y, z, rx = 0) => pm.copy(parent).multiply(t.compose(v.set(x, y, z), q.setFromAxisAngle(AX, rx), ONE));
  const put = (mesh, idx, parent, x, y, z, sx, sy, sz, rx) => mesh.setMatrixAt(idx, t.copy(at(parent, x, y, z, rx)).multiply(S.makeScale(sx, sy, sz)));
  function pose(i, swing, bob) {
    const { look: k } = plan[i], { u } = st[i], hip = PR.legs * u, sh = hip + PR.torso * u, hd = PR.head * u, hy = sh + 0.01 * u, hs = k.shoulder;
    const yaw = Math.atan2(out.fx, out.fz); // fx/fz are already direction-aware
    base.compose(v.set(out.x, FEET + bob, out.z), q.setFromAxisAngle(AY, yaw), ONE);
    put(M_.torso, i, base, 0, hip, 0, hs, PR.torso * u, 0.14 * u);
    put(M_.head, i, base, 0, hy, 0, hd, hd, hd);
    put(M_.hair, i, base, 0, hy + hd - 0.035 * u, 0, ...(k.hairStyle === 'bald' ? [0, 0, 0] : [hd + 0.02 * u, 0.05 * u, hd + 0.02 * u]));
    const hb = HAIR_BACK[k.hairStyle];
    put(M_.hairBack, i, base, 0, hy + (hb ? hb[3] * u : 0), -(hd / 2 + (hb ? hb[2] * u / 2 : 0)), ...(hb ? hb.slice(0, 3).map((x) => x * u) : [0, 0, 0]));
    put(M_.armL, i, base, -(hs / 2 + 0.04 * u), sh, 0, 0.07 * u, PR.arms * u, 0.08 * u, -swing);
    put(M_.armR, i, base, hs / 2 + 0.04 * u, sh, 0, 0.07 * u, PR.arms * u, 0.08 * u, swing);
    [[M_.legL, -1, swing, 0], [M_.legR, 1, -swing, 1]].forEach(([mesh, sd, a, j]) => {
      put(mesh, i, base, sd * hs * 0.22, hip, 0, 0.09 * u, hip, 0.11 * u, a);
      put(M_.shoes, 2 * i + j, at(base, sd * hs * 0.22, hip, 0, a).clone(), 0, -hip, 0.03 * u, 0.1 * u, 0.05 * u, 0.17 * u);
    });
  }
  const hide = (i) => { for (const m of meshes) { if (m === M_.shoes) { m.setMatrixAt(2 * i, ZERO); m.setMatrixAt(2 * i + 1, ZERO); } else m.setMatrixAt(i, ZERO); } };
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
