import * as THREE from 'three';
import { crowdPlan, SKIN, PROPORTIONS as PR } from './crowd.js';
// Instanced walking-emoji pedestrians (natural proportions, T-shirt, trousers, sneakers): smooth low-poly parts, one InstancedMesh per part, CPU walk cycle. Paths come from crowd.js (pure data).
const NEAR = 140, INSET = 0.6, SWING = 0.45, FEET = 0.01, SEED = 1017, KID_HEAD = 1.4, LEAN = 0.07;
// Hair mass relative to the head centre, in head diameters: [w, h, d, dy, dz]. 'short' is the quiff on top.
const HAIR_BACK = { short: [0.62, 0.4, 0.62, 0.36, 0.1], long: [0.98, 1.05, 0.5, -0.3, -0.3], bun: [0.42, 0.42, 0.42, 0.5, -0.36], ponytail: [0.2, 0.65, 0.2, -0.1, -0.58] };
const PARTS = ['head', 'hair', 'hairBack', 'torso', 'neck', 'beard', 'pelvis'];
const MULTI = { upperArm: 2, sleeve: 2, forearm: 2, hands: 2, legs: 2, shoes: 2, soles: 2, bits: 11 }; // instances per person
// bits: 0,1 brows; 2 mouth; 3,4 ears; 5 nose; 6,7 eye whites; 8,9 pupils; 10 ponytail band
const MOUTH = '#8a3040', EYE = '#1a1512', BAND = '#c0392b';
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
  // Unit geometries (size 1, scaled per instance). Limbs hang from a top pivot; the torso is a tapered lathe standing on y=0.
  const sph = (w, h, phi = Math.PI) => new THREE.SphereGeometry(0.5, w, h, 0, Math.PI * 2, 0, phi);
  const cap = (r, len, seg) => new THREE.CapsuleGeometry(0.5, len, seg, r).scale(1, 1 / (len + 1), 1); // total height 1
  const limb = (r) => cap(r, 1.5, 1).translate(0, -0.5, 0);
  const TORSO = [[0, 0], [0.38, 0.02], [0.4, 0.15], [0.43, 0.5], [0.5, 0.85], [0.42, 0.97], [0.2, 1]].map(([x, y]) => new THREE.Vector2(x, y));
  const GEO = {
    head: sph(14, 9), hair: sph(14, 5, Math.PI * 0.6), hairBack: cap(8, 0.5, 1), torso: new THREE.LatheGeometry(TORSO, 12), neck: cap(6, 1, 1), beard: sph(8, 5), pelvis: sph(10, 6),
    upperArm: limb(6), sleeve: limb(6), forearm: limb(6), hands: sph(6, 5), legs: limb(7), shoes: sph(7, 4), soles: sph(7, 3), bits: sph(6, 3),
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
  const afro = (k) => k.hairStyle === 'short' && SKIN.indexOf(k.skin) >= 5;
  plan.forEach(({ look: k }, i) => {
    const c = { head: k.skin, hair: k.hair, hairBack: k.hair, torso: k.top, neck: k.skin, beard: k.hair, pelvis: k.bottom };
    for (const n of PARTS) M_[n].setColorAt(i, col.set(c[n]));
    const sole = k.shoes === '#f2f2ee' ? '#a8a8a2' : '#ecece6';
    const mc = { upperArm: [k.skin, k.skin], sleeve: [k.top, k.top], forearm: [k.skin, k.skin], hands: [k.skin, k.skin], legs: [k.bottom, k.bottom], shoes: [k.shoes, k.shoes], soles: [sole, sole],
      bits: [k.hair, k.hair, MOUTH, k.skin, k.skin, k.skin, '#ffffff', '#ffffff', EYE, EYE, BAND] };
    for (const [n, cs] of Object.entries(mc)) cs.forEach((cc, j) => M_[n].setColorAt(MULTI[n] * i + j, col.set(cc)));
  });
  const st = plan.map((q) => { const hf = q.look.height < 1.5 ? KID_HEAD : 1; return { s: q.s0 * perim(q.path), vis: true, d: 0, hf, u: q.look.height / (PR.head * hf + PR.legs + PR.torso + 0.02) }; });
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), w = new THREE.Vector3(), base = new THREE.Matrix4(), up = new THREE.Matrix4(), lf = new THREE.Matrix4(), lf2 = new THREE.Matrix4(), t = new THREE.Matrix4(), tm = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const frame = (o, parent, x, y, z, rx) => o.multiplyMatrices(parent, t.compose(v.set(x, y, z), q.setFromAxisAngle(AX, rx), ONE)); // scratch frame, no allocation
  const put = (mesh, idx, parent, x, y, z, sx, sy, sz, rx = 0) => mesh.setMatrixAt(idx, tm.multiplyMatrices(parent, t.compose(v.set(x, y, z), q.setFromAxisAngle(AX, rx), w.set(sx, sy, sz))));
  function pose(i, swing, bob) {
    const { look: k } = plan[i], { u, hf } = st[i], hip = PR.legs * u, T = PR.torso * u, hd = PR.head * hf * u, cy = T + 0.02 * u + hd * 0.5, hs = k.shoulder, bd = beard(k), af = afro(k);
    const yaw = Math.atan2(out.fx, out.fz); // fx/fz are already direction-aware
    base.compose(v.set(out.x, FEET + bob, out.z), q.setFromAxisAngle(AY, yaw), ONE);
    frame(up, base, 0, hip, 0, LEAN); // upper body, leaning slightly forward; y is relative to the hip
    put(M_.pelvis, i, base, 0, hip + 0.01 * u, 0, hs * 0.85, 0.16 * u, 0.15 * u);
    put(M_.torso, i, up, 0, 0.04 * u, 0, hs, T - 0.04 * u, 0.15 * u);
    put(M_.neck, i, up, 0, T + 0.005 * u, 0, 0.08 * u, 0.1 * u, 0.08 * u);
    put(M_.head, i, up, 0, cy, 0, hd * 0.9, hd, hd * 0.95);
    put(M_.beard, i, up, 0, cy - 0.26 * hd, 0.02 * hd, ...(bd ? [0.8 * hd, 0.5 * hd, 0.75 * hd] : [0, 0, 0]));
    put(M_.hair, i, up, 0, cy + (af ? 0.12 : 0.07) * hd, -0.06 * hd, ...(k.hairStyle === 'bald' ? [0, 0, 0] : af ? [hd * 1.3, hd * 1.28, hd * 1.3] : [hd * 1.05, hd * 1.12, hd * 1.1]), af ? -0.55 : -0.5);
    const hb = af ? null : HAIR_BACK[k.hairStyle];
    put(M_.hairBack, i, up, 0, cy + (hb ? hb[3] * hd : 0), hb ? hb[4] * hd : 0, ...(hb ? hb.slice(0, 3).map((x) => x * hd) : [0, 0, 0]));
    const B = (j, x, y, z, sx, sy, sz) => put(M_.bits, 11 * i + j, up, x * hd, cy + y * hd, z * hd, sx * hd, sy * hd, sz * hd);
    B(2, 0, -0.27, bd ? 0.43 : 0.405, 0.18, 0.035, 0.05); // smile
    B(5, 0, -0.14, 0.46, 0.12, 0.12, 0.13); // nose
    B(10, 0, 0.1, -0.52, ...(k.hairStyle === 'ponytail' ? [0.15, 0.1, 0.15] : [0, 0, 0])); // ponytail band
    for (const sd of [-1, 1]) {
      const j = sd < 0 ? 0 : 1, a = sd * swing, ar = a * 0.9;
      B(j, sd * 0.2, 0.13, 0.4, 0.17, 0.035, 0.05); // brows
      B(3 + j, sd * 0.45, -0.07, 0, 0.07, 0.15, 0.1); // ears
      B(6 + j, sd * 0.2, -0.04, 0.4, 0.15, 0.2, 0.08); // eye whites
      B(8 + j, sd * 0.2, -0.05, 0.44, 0.09, 0.13, 0.05); // pupils
      frame(lf, up, sd * (hs * 0.5 - 0.005 * u), T - 0.035 * u, 0, ar);
      const l1 = PR.arms * u * 0.52, l2 = PR.arms * u * 0.48;
      put(M_.upperArm, 2 * i + j, lf, 0, 0, 0, 0.08 * u, l1, 0.08 * u);
      put(M_.sleeve, 2 * i + j, lf, 0, 0.012 * u, 0, 0.105 * u, l1 * 0.55, 0.105 * u);
      frame(lf2, lf, 0, -l1, 0, -(0.15 + 0.9 * Math.max(0, -ar))); // elbow bends more on the forward swing
      put(M_.forearm, 2 * i + j, lf2, 0, 0, 0, 0.07 * u, l2, 0.07 * u);
      put(M_.hands, 2 * i + j, lf2, 0, -l2 + 0.005 * u, 0, 0.07 * u, 0.085 * u, 0.07 * u);
      frame(lf, base, sd * 0.058 * u, hip, 0, -a);
      put(M_.legs, 2 * i + j, lf, 0, 0, 0, 0.1 * u, hip, 0.11 * u);
      put(M_.shoes, 2 * i + j, lf, 0, -hip + 0.05 * u, 0.05 * u, 0.115 * u, 0.065 * u, 0.22 * u, a * 0.6);
      put(M_.soles, 2 * i + j, lf, 0, -hip + 0.015 * u, 0.05 * u, 0.13 * u, 0.035 * u, 0.25 * u, a * 0.6);
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
