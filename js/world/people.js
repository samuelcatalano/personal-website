import { crowdPlan } from './crowd.js';
import { estaiadaRoute } from './landmark-geometry.js';
import { LANDMARKS, ROAD, RIVER_Z, stopIndex, underpassFrames } from './layout.js';
import { HX as UNDERPASS_HALF_LENGTH, ARCH_HALF_WIDTH } from './underpass.js';
// Pedestrian simulation (no rendering): every person's route position, heading and walk pace; npc3d.js draws the 3D walkers from it. Paths come from crowd.js (pure data).
const SEP_NEAR = 140, SEP_FAR = 150, INSET = 0.6, SEED = 1017;
const TURN_DISTANCE = 1.2;
const CROWD_CELL = 0.9, CROWD_GAP = 0.82, CROWD_PUSH = 0.55; // shortcut: plaza sidesteps cap at 0.55 m, raise only if visual review still shows overlaps
const KIOSK_CLEARANCE = 1.3; // Kiosk half-diagonal, walker radius and one maximum lane crowd push
const PORTAL_MARGIN = 0.2, PORTAL_BLEND = 6, FRAME_MARGIN = 2; // keep the whole walker inside the masonry opening
const LOOP_TURN_RADIUS = 0.75; // soften rectangular plaza turns without changing their footprint
const turnDistance = (d) => { const t = Math.min(1, d / TURN_DISTANCE); return TURN_DISTANCE * t * t * (2 - t); };
const turnSpeed = (d) => { const t = Math.min(1, d / TURN_DISTANCE); return t * (4 - 3 * t); };

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

export function createPeople({ curve, pts, stops, obstacles = [], reducedMotion = false }) {
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
    const half = 0.16 * look.height, safe = Math.sign(offset) * (ARCH_HALF_WIDTH - half - PORTAL_MARGIN - 0.05), core = UNDERPASS_HALF_LENGTH + half + PORTAL_MARGIN + FRAME_MARGIN;
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
  const place = (p, s, look) => p.type === 'idle' ? Object.assign(out, { x:p.x, z:p.z, fx:p.fx, fz:p.fz, speed:0, nx:0, nz:0, offset:0 }) : p.type === 'lane' ? lane(p, s, look) : loop(p, s);
  const perim = (p) => (p.type === 'idle' ? 1 : p.type === 'lane' ? 2 * (p.offset < 0 ? SPAN : L) : loopPerimeter(p));

  const walkPace = new Float32Array(N), visible = new Uint8Array(N);
  const st = plan.map((q) => ({ s: q.s0 * perim(q.path), pace: 1 }));
  const px = new Float32Array(N), pz = new Float32Array(N), fx = new Float32Array(N), fz = new Float32Array(N), sep = new Float32Array(N), pushX = new Float32Array(N), pushZ = new Float32Array(N), cells = new Map();
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
  const push = (i, dx, dz) => {
    if (plan[i].path.type === 'idle') return;
    const ox = pushX[i], oz = pushZ[i]; let x = ox + dx, z = oz + dz;
    const length = Math.hypot(x, z), limit = plan[i].path.type === 'lane' ? 0.2 : CROWD_PUSH;
    if (length > limit) { x *= limit / length; z *= limit / length; }
    px[i] += x - ox; pz[i] += z - oz; pushX[i] = x; pushZ[i] = z;
  };
  plan.forEach((p, i) => { place(p.path, st[i].s, p.look); st[i].pace = out.speed; px[i] = out.x; pz[i] = out.z; if (p.path.type === 'lane') { rememberLane(i); avoidKiosks(i); out.x = px[i]; out.z = pz[i]; } fx[i] = out.fx; fz[i] = out.fz; walkPace[i] = Math.min(1, out.speed); visible[i] = 1; });
  return {
    count: N, route: { x: px, z: pz, fx, fz }, walkPace, visible,
    update(dt, cam) {
      if (reducedMotion || dt < 0) dt = 0;
      plan.forEach(({ look: k, path }, i) => {
        const s = st[i]; s.s += path.dir * k.speed * dt / Math.max(1, s.pace);
        place(path, s.s, k);
        if (path.type === 'lane') rememberLane(i);
        s.pace = out.speed; walkPace[i] = Math.min(1, out.speed);
        px[i] = out.x; pz[i] = out.z; fx[i] = out.fx; fz[i] = out.fz;
        const t = Math.min(1, Math.max(0, (SEP_FAR - Math.hypot(out.x - cam.x, out.z - cam.z)) / (SEP_FAR - SEP_NEAR)));
        sep[i] = t * t * (3 - 2 * t); // smoothstep: separation eases out with zero slope at both edges, so no push jump at a distance edge
      });
      pushX.fill(0); pushZ.fill(0);
      for (let pass = 0; pass < 6; pass++) {
        cells.clear();
        for (let i = 0; i < N; i++) if (sep[i] > 0) {
          const cx = Math.floor(px[i] / CROWD_CELL), cz = Math.floor(pz[i] / CROWD_CELL), key = `${cx},${cz}`;
          let bucket = cells.get(key); if (!bucket) cells.set(key, bucket = []); bucket.push(i);
        }
        for (let i = 0; i < N; i++) if (sep[i] > 0) {
          const cx = Math.floor(px[i] / CROWD_CELL), cz = Math.floor(pz[i] / CROWD_CELL);
          for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const j of cells.get(`${x},${z}`) || []) if (j < i) {
            let dx = px[i] - px[j], dz = pz[i] - pz[j], d2 = dx * dx + dz * dz;
            if (d2 >= CROWD_GAP * CROWD_GAP) continue;
            let d = Math.sqrt(d2);
            if (d < 1e-3) { const a = (i * 127 + j * 311) * 0.017; dx = Math.cos(a); dz = Math.sin(a); d = 0; }
            const amount = (CROWD_GAP - d) * 0.5 * Math.min(sep[i], sep[j]) / (d || 1);
            push(i, dx * amount, dz * amount); push(j, -dx * amount, -dz * amount);
          }
        }
      }
      for (let i = 0; i < N; i++) {
        avoidKiosks(i);
        // A lane walker squeezed under an arch sits inside its clear opening (lateral < ARCH_HALF_WIDTH) and cannot keep road clearance there: hidden while inside it (the portal is its vanishing edge), never by distance.
        const lateral = Math.abs((px[i] - laneX[i]) * laneNX[i] + (pz[i] - laneZ[i]) * laneNZ[i]);
        visible[i] = plan[i].path.type === 'lane' && lateral < ARCH_HALF_WIDTH ? 0 : 1;
      }
    },
  };
}
