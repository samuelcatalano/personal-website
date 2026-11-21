import { findPedestrianPath } from './pedestrian-path.js';
import { crowdPlan } from './crowd.js';
import { estaiadaRoute } from './landmark-geometry.js';
import { LANDMARKS, ROAD, RIVER_Z, stopIndex, underpassFrames } from './layout.js';
import { HX as UNDERPASS_HALF_LENGTH, ARCH_HALF_WIDTH } from './underpass.js';
// Pedestrian simulation (no rendering): every person's route position, heading and walk pace; npc3d.js draws the 3D walkers from it. Paths come from crowd.js (pure data).
const SEP_NEAR = 140, SEP_FAR = 150, INSET = 0.6, SEED = 1017;
const TURN_DISTANCE = 1.2;
const GLANCE_RANGE = 9, GLANCE_TURN = 0.5; // m within which walkers glance at a moving bus; fraction of the full turn towards it
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
  let t = ((s % length) + length) % length, x, z, fx, fz, bending = true;
  if (t < straightX) { bending = false; x = a + r + t; z = c; fx = 1; fz = 0; }
  else if ((t -= straightX) < arc) {
    const angle = -Math.PI / 2 + t / r;
    x = b - r + r * Math.cos(angle); z = c + r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  } else if ((t -= arc) < straightZ) { bending = false; x = b; z = c + r + t; fx = 0; fz = 1; }
  else if ((t -= straightZ) < arc) {
    const angle = t / r;
    x = b - r + r * Math.cos(angle); z = d - r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  } else if ((t -= arc) < straightX) { bending = false; x = b - r - t; z = d; fx = -1; fz = 0; }
  else if ((t -= straightX) < arc) {
    const angle = Math.PI / 2 + t / r;
    x = a + r + r * Math.cos(angle); z = d - r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  } else if ((t -= arc) < straightZ) { bending = false; x = a; z = d - r - t; fx = 0; fz = -1; }
  else {
    const angle = Math.PI + (t - straightZ) / r;
    x = a + r + r * Math.cos(angle); z = c + r + r * Math.sin(angle); fx = -Math.sin(angle); fz = Math.cos(angle);
  }
  const dir = p.dir ?? 1;
  return { x, z, fx: fx * dir, fz: fz * dir, curvature: bending && r > 0 ? 1 / r : 0 };
}

export function createPeople({ curve, pts, stops, obstacles = [], space = null, reducedMotion = false }) {
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
  const MOUTH = 5.5, laneRuns = new Map();
  for (const person of plan) if (person.path.type === 'lane') {
    const left = Math.max(0, mj - MOUTH), right = Math.max(0, L - mj - MOUTH);
    const at = person.s0 * (left + right);
    laneRuns.set(person.path, person.path.offset >= 0 ? { start: 0, span: L, phase: person.s0 }
      : at < left ? { start: 0, span: left, phase: at / left }
      : { start: Math.min(L, mj + MOUTH), span: Math.max(.001, right), phase: right ? (at - left) / right : 0 });
  }
  const out = { x: 0, z: 0, fx: 0, fz: 1, speed: 1, nx: 0, nz: 0, offset: 0 };
  const lane = (p, s, look, flip = 0) => { // same side convention as furnitureSpots/city.js: normal = (-t.z, t.x), offset > 0 on that side
    const { start, span } = laneRuns.get(p);
    const u = ((s % (2 * span)) + 2 * span) % (2 * span), forward = u < span, d = forward ? u : 2 * span - u;
    const turn = forward ? 1 : -1, pace = d < TURN_DISTANCE ? turnSpeed(d) : d > span - TURN_DISTANCE ? turnSpeed(span - d) : 1;
    s = start + (d < TURN_DISTANCE ? turnDistance(d) : d > span - TURN_DISTANCE ? span - turnDistance(span - d) : d); // ease to a near-stop at route ends before turning back
    const w = Math.max(0, Math.min(L, s)), i = Math.min(Math.floor(w), M - 1), f = w - i;
    let tx = PX[i + 1] - PX[i], tz = PZ[i + 1] - PZ[i]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const x = PX[i] + (PX[i + 1] - PX[i]) * f, z = PZ[i] + (PZ[i + 1] - PZ[i]) * f;
    const edgeDistance = Math.min(d,span-d), t = Math.min(1,edgeDistance/TURN_DISTANCE), fade=t*t*(3-2*t);
    const baseBlend=.5+(forward?-.5:.5)*fade, blend=baseBlend+(1-2*baseBlend)*flip;
    const reflected=Math.sign(p.offset)*(2*(ROAD.padIn+.85)-Math.abs(p.offset)), delta=reflected-p.offset;
    const blendSlope=(d<span/2?-1:1)*3*t*(1-t)/TURN_DISTANCE;
    let offset=p.offset+delta*blend, offsetRate=delta*blendSlope*(1-2*flip), slope=0;
    const half = 0.16 * look.height, safe = Math.sign(offset) * (ARCH_HALF_WIDTH - half - PORTAL_MARGIN - 0.05), core = UNDERPASS_HALF_LENGTH + half + PORTAL_MARGIN + FRAME_MARGIN;
    for (const a of passages) {
      const along = (x - a.x) * a.tx + (z - a.z) * a.tz, t = Math.max(0, Math.min(1, (core + PORTAL_BLEND - Math.abs(along)) / PORTAL_BLEND)), blend = t * t * (3 - 2 * t), previous = offset;
      offset += (safe - previous) * blend;
      offsetRate *= 1-blend;
      slope = slope * (1 - blend) - (safe - previous) * Math.sign(along) * 6 * t * (1 - t) * (tx * a.tx + tz * a.tz) / PORTAL_BLEND;
    }
    out.nx = -tz; out.nz = tx; out.offset = offset;
    out.x = x + out.nx * offset; out.z = z + out.nz * offset;
    const lateral=offsetRate+slope*turn*pace, vx=tx*turn*pace-tz*lateral, vz=tz*turn*pace+tx*lateral, speed=Math.hypot(vx,vz);
    const across=Math.sign(delta*(d<span/2?-1:1)*(1-2*flip))||1;
    out.fx=(speed>1e-6?vx/speed:-tz*across)*p.dir;out.fz=(speed>1e-6?vz/speed:tx*across)*p.dir;out.speed=speed;
  };
  const loop = (p, s) => { Object.assign(out, loopAt(p, s)); out.speed = 1; out.nx = out.nz = out.offset = 0; };
  const place = (p, s, look, flip = 0) => p.type === 'idle' ? Object.assign(out, { x:p.x, z:p.z, fx:p.fx, fz:p.fz, speed:0, nx:0, nz:0, offset:0 }) : p.type === 'lane' ? lane(p, s, look, flip) : loop(p, s);
  const perim = (p) => (p.type === 'idle' ? 1 : p.type === 'lane' ? 2 * laneRuns.get(p).span : loopPerimeter(p));

  const walkPace = new Float32Array(N), visible = new Uint8Array(N);
  const st = plan.map((q) => ({ s: (laneRuns.get(q.path)?.phase ?? q.s0) * perim(q.path), pace: 1, direction: 1, partner: -1, passSide: 1, clearance: CROWD_PUSH, curvature: 0, trackFlip: 0, progressAge: 0, anchorX: 0, anchorZ: 0, mode: q.path.type === 'idle' ? 'idle' : 'walk', blocked: 0, recoveries: 0, recoveryTime: 0, busPhase: 'idle', busTime: 0, busInterest: false, group: -1, formation: 'solo', groupWaiting: false, detour: null, detourIndex: 0, retryAt: 0, reachedWaypoint: false, wantsPath: false }));
  const px = new Float32Array(N), pz = new Float32Array(N), fx = new Float32Array(N), fz = new Float32Array(N), sep = new Float32Array(N), pushX = new Float32Array(N), pushZ = new Float32Array(N), cells = new Map();
  const sidestep = new Float32Array(N), framePushX = new Float32Array(N), framePushZ = new Float32Array(N);
  const laneX = new Float32Array(N), laneZ = new Float32Array(N), laneNX = new Float32Array(N), laneNZ = new Float32Array(N);
  const rememberLane = (i) => { laneX[i] = out.x - out.nx * out.offset; laneZ[i] = out.z - out.nz * out.offset; laneNX[i] = out.nx; laneNZ[i] = out.nz; };
  const rememberNearestLane = i => {
    let at=0,best=Infinity;
    for(let m=0;m<M;m++){const dx=PX[m]-px[i],dz=PZ[m]-pz[i],d=dx*dx+dz*dz;if(d<best){best=d;at=m;}}
    const tx=PX[at+1]-PX[at],tz=PZ[at+1]-PZ[at],length=Math.hypot(tx,tz)||1;
    laneX[i]=PX[at];laneZ[i]=PZ[at];laneNX[i]=-tz/length;laneNZ[i]=tx/length;
  };
  const avoidKiosks = (i) => {
    const path = plan[i].path;
    if (space || !obstacles.length || path.type !== 'lane') return;
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
  const safe = (i, x, z) => !space || space.allows(x, z, .16 * plan[i].look.height + .02);
  const hasExit = (i,x,z) => {
    if(!space)return true;
    for(let a=0;a<8;a++){
      let clear=true;
      for(let d=.2;d<=.8001;d+=.2)if(!safe(i,x+Math.cos(a*Math.PI/4)*d,z+Math.sin(a*Math.PI/4)*d)){clear=false;break;}
      if(clear)return true;
    }
    return false;
  };
  const push = (i, dx, dz) => {
    if (plan[i].path.type === 'idle') return;
    const ox = pushX[i], oz = pushZ[i]; let x = ox + dx, z = oz + dz;
    const length = Math.hypot(x, z), limit = plan[i].path.type === 'lane' ? 0.2 : st[i].clearance;
    if (length > limit) { x *= limit / length; z *= limit / length; }
    if(elapsed>.5&&lastDt>0){
      const dx=x-framePushX[i],dz=z-framePushZ[i],distance=Math.hypot(dx,dz),budget=lastDt*.8;
      if(distance>budget){x=framePushX[i]+dx*budget/distance;z=framePushZ[i]+dz*budget/distance;}
    }
    if (!safe(i, px[i] + x - ox, pz[i] + z - oz)) return;
    px[i] += x - ox; pz[i] += z - oz; pushX[i] = x; pushZ[i] = z;
  };
  plan.forEach((p, i) => { place(p.path, st[i].s, p.look); st[i].pace = out.speed; px[i] = out.x; pz[i] = out.z; if (p.path.type === 'lane') { rememberLane(i); avoidKiosks(i); out.x = px[i]; out.z = pz[i]; } fx[i] = out.fx; fz[i] = out.fz; walkPace[i] = Math.min(1, out.speed); visible[i] = 1; });
  // Place each initial body on the nearest free point of its own authored corridor.
  if (space) for (let i=0;i<N;i++) if (plan[i].path.type !== 'idle' && (!safe(i,px[i],pz[i])||!hasExit(i,px[i],pz[i]))) {
    const {path,look}=plan[i], origin=st[i].s, limit=path.type==='lane'?.2:1.25;
    let found=false;
    for(let step=0;step<=Math.ceil(perim(path)*2)&&!found;step++) for(const direction of [1,-1]) {
      const phase=origin+direction*step*.25;place(path,phase,look);
      for(const side of [...new Set([0,CROWD_PUSH,-CROWD_PUSH,.75,-.75,1,-1,limit,-limit])].filter(v=>Math.abs(v)<=limit)) {
        if(path.type!=='lane'&&side*path.dir*out.curvature>.9)continue;
        const x=out.x-out.fz*side,z=out.z+out.fx*side;
        if(!safe(i,x,z)||!hasExit(i,x,z))continue;
        st[i].s=phase;px[i]=x;pz[i]=z;fx[i]=out.fx;fz[i]=out.fz;sidestep[i]=side;st[i].clearance=Math.max(CROWD_PUSH,Math.abs(side));
        if(path.type==='lane')rememberLane(i);
        found=true;break;
      }
      if(found)break;
    }
  }
  st.forEach((s,i)=>{s.anchorX=px[i];s.anchorZ=pz[i];});
  const groups = [], companionCells = new Map();
  const pathKey = p => p.type === 'lane' ? `lane:${Math.sign(p.offset)}:${p.dir}` : `${p.name ?? JSON.stringify(p.rect)}:${p.dir}`;
  for (let i = 0; i < N; i++) if (plan[i].path.type !== 'idle') {
    const key = `${Math.floor(px[i] / 2)},${Math.floor(pz[i] / 2)}`;
    let bucket = companionCells.get(key); if (!bucket) companionCells.set(key, bucket = []); bucket.push(i);
  }
  for (let i = 0; i < N; i++) if (st[i].group < 0 && plan[i].path.type !== 'idle') {
    const members = [i], a = plan[i], cx = Math.floor(px[i] / 2), cz = Math.floor(pz[i] / 2);
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const j of companionCells.get(`${x},${z}`) || []) {
      const b = plan[j], distance = Math.hypot(px[i] - px[j], pz[i] - pz[j]);
      if (j <= i || members.length === 3 || st[j].group >= 0 || pathKey(a.path) !== pathKey(b.path)) continue;
      if (fx[i]*fx[j]+fz[i]*fz[j]>.9 && distance >= CROWD_GAP && distance < 1.8 && Math.abs(a.look.speed - b.look.speed) < .18 && (a.look.height < 1.5) === (b.look.height < 1.5)) members.push(j);
    }
    if (members.length > 1) {
      const group = groups.length;
      const leader = members.reduce((a,b) => (px[b]-px[a])*fx[i]+(pz[b]-pz[a])*fz[i] > 0 ? b : a);
      groups.push({ members, leader, speed: Math.min(...members.map(j => plan[j].look.speed)) });
      for (const j of members) { st[j].group = group; st[j].formation = 'together'; }
    }
  }
  const react = new Float32Array(N); // 0..1 how much each walker is watching the hero vehicle
  const glance = new Float32Array(N); // 0..1 passing glance at a moving hero (heading only, pace untouched)
  const busProfiles = plan.map((_, i) => ({ kind: i % 4, delay: .25 + (i * 7 % 5) * .12, duration: 10 + i % 5, cooldown: 20 + i % 7 }));
  const busAttention = (i, dt, hero) => {
    const state = st[i], profile = busProfiles[i];
    const distance = hero ? Math.hypot(px[i] - hero.x, pz[i] - hero.z) : Infinity;
    const nearby = hero && distance < (state.busPhase === 'idle' ? 16 : 18) && hero.speed < (state.busPhase === 'idle' ? 1.2 : 1.8);
    if (dt > 0 && plan[i].path.type !== 'idle' && profile.kind < 3) {
      state.busTime = Math.max(0, state.busTime - dt);
      if (state.busPhase === 'cooldown' && state.busTime === 0) state.busPhase = 'idle';
      if (state.busPhase === 'idle' && nearby) { state.busPhase = 'delay'; state.busTime = profile.delay; }
      else if (state.busPhase === 'delay' && nearby && state.busTime === 0) { state.busPhase = 'attend'; state.busTime = profile.duration; }
      else if ((state.busPhase === 'delay' || state.busPhase === 'attend') && (!nearby || state.busTime === 0)) { state.busPhase = 'cooldown'; state.busTime = profile.cooldown; }
    }
    const strength = profile.kind === 0 ? 1 : profile.kind === 1 ? .45 : 0;
    return state.busPhase === 'attend' ? Math.max(0, Math.min(1, (16 - distance) / 10)) * strength : 0;
  };
  const yieldPace = new Float32Array(N).fill(1), travelX = fx.slice(), travelZ = fz.slice(), encounterCells = new Map();
  const beforeX = px.slice(), beforeZ = pz.slice(), actualSpeed = new Float32Array(N);
  const previousPhase = new Float64Array(N), previousSide = new Float32Array(N), previousFlip = new Float32Array(N), held = new Uint8Array(N);
  let elapsed = 0, lastDt = 0, navigationTarget = -1;
  const holdPosition = i => {
    if(held[i])return false;held[i]=1;
    px[i]=beforeX[i];pz[i]=beforeZ[i];st[i].s=previousPhase[i];sidestep[i]=previousSide[i];st[i].trackFlip=previousFlip[i];
    pushX[i]=pushZ[i]=0;walkPace[i]=0;
    place(plan[i].path,st[i].s,plan[i].look,st[i].trackFlip);
    travelX[i]=out.fx*st[i].direction;travelZ[i]=out.fz*st[i].direction;
    if(plan[i].path.type==='lane'){if(st[i].detour)rememberNearestLane(i);else rememberLane(i);}
    return true;
  };
  let navigationBudget=1;
  const planRecovery = (i,cam) => {
    const state=st[i],path=plan[i].path,radius=.16*plan[i].look.height+.02;
    if(!space||i!==navigationTarget||!navigationBudget||state.retryAt>elapsed||Math.hypot(px[i]-cam.x,pz[i]-cam.z)>SEP_FAR)return false;
    navigationBudget--;state.retryAt=elapsed+3+(i%7)*.1;
    let nearest=0;
    if(path.type==='lane')for(let m=1;m<=M;m++)if(Math.hypot(PX[m]-px[i],PZ[m]-pz[i])<Math.hypot(PX[nearest]-px[i],PZ[nearest]-pz[i]))nearest=m;
    const others=plan.flatMap((_,j)=>j!==i&&visible[j]&&Math.hypot(px[j]-px[i],pz[j]-pz[i])<10?[j]:[]);
    const query={allows(x,z,r){
      if(!space.allows(x,z,r)||others.some(j=>Math.hypot(x-px[j],z-pz[j])<.72))return false;
      if(path.type!=='lane')return true;
      let m=nearest;
      for(let k=Math.max(0,nearest-18);k<=Math.min(M-1,nearest+18);k++)if(Math.hypot(PX[k]-x,PZ[k]-z)<Math.hypot(PX[m]-x,PZ[m]-z))m=k;
      m=Math.min(m,M-1);
      const tx=PX[m+1]-PX[m],tz=PZ[m+1]-PZ[m],length=Math.hypot(tx,tz)||1,side=(-(x-PX[m])*tz+(z-PZ[m])*tx)/length*Math.sign(path.offset);
      const portal=passages.find(a=>Math.abs((x-a.x)*a.tx+(z-a.z)*a.tz)<UNDERPASS_HALF_LENGTH+PORTAL_BLEND+FRAME_MARGIN+2);
      if(portal&&Math.abs((x-portal.x)*portal.tx+(z-portal.z)*portal.tz)<UNDERPASS_HALF_LENGTH+r+PORTAL_MARGIN)return side>=r&&side+r+PORTAL_MARGIN<=ARCH_HALF_WIDTH;
      return side>=(portal?0:Math.min(ROAD.curb??ROAD.padIn-.225,ROAD.half??ROAD.padIn-.45)+r)&&side<=ROAD.padOut+1.25-r;
    }};
    const goals=[],flip=state.direction<0?1:0;
    for(const distance of [3,5,7]){
      const phase=state.s+path.dir*state.direction*distance;
      place(path,phase,plan[i].look,flip);const x=out.x,z=out.z,fx=out.fx*state.direction,fz=out.fz*state.direction,curvature=out.curvature||0;
      for(const side of path.type==='lane'?[0,.2,-.2]:[0,.55,-.55,.75,-.75,1,-1,1.25,-1.25]){
        if(path.type!=='lane'&&side*path.dir*state.direction*curvature>.9)continue;
        const gx=x-fz*side,gz=z+fx*side,d=Math.hypot(gx-px[i],gz-pz[i]);
        if(d>=.8&&d<9&&query.allows(gx,gz,radius))goals.push({x:gx,z:gz,phase,side,flip});
      }
    }
    const route=findPedestrianPath({x:px[i],z:pz[i]},goals,query,radius);
    if(!route)return false;
    state.detour=route;state.detourIndex=0;state.recoveryTime=0;state.mode='detour';return true;
  };
  const anticipate = (dt, cam) => {
    const blend = 1 - Math.exp(-4 * dt);
    encounterCells.clear();
    for (let i = 0; i < N; i++) if (Math.hypot(px[i] - cam.x, pz[i] - cam.z) < SEP_FAR) {
      const key = `${Math.floor(px[i] / 2.5)},${Math.floor(pz[i] / 2.5)}`;
      let bucket = encounterCells.get(key); if (!bucket) encounterCells.set(key, bucket = []); bucket.push(i);
    }
    for (let i = 0; i < N; i++) {
      const state = st[i], path = plan[i].path, speed = plan[i].look.speed * (1 - react[i]);
      if(state.detour){state.mode='detour';state.groupWaiting=false;continue;}
      let want = 1, side = 0;
      state.recoveryTime = Math.max(0, state.recoveryTime - dt);
      if (state.partner >= 0) {
        const j = state.partner, dx = px[j] - px[i], dz = pz[j] - pz[i];
        if (Math.hypot(dx, dz) > 3.2 || dx * travelX[i] + dz * travelZ[i] < -CROWD_GAP) state.partner = -1;
      }
      const cx = Math.floor(px[i] / 2.5), cz = Math.floor(pz[i] / 2.5);
      if (path.type !== 'idle' && Math.hypot(px[i] - cam.x, pz[i] - cam.z) < SEP_FAR) {
        for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const j of encounterCells.get(`${x},${z}`) || []) {
          if (j === i) continue;
          const dx = px[j] - px[i], dz = pz[j] - pz[i], distance = Math.hypot(dx, dz);
          if (distance > 2.5 || distance < .01) continue;
          const other = plan[j].path.type === 'idle' ? 0 : plan[j].look.speed * (1 - react[j]);
          const along = dx * travelX[i] + dz * travelZ[i], alignment = travelX[i] * travelX[j] + travelZ[i] * travelZ[j];
          const across = -dx * travelZ[i] + dz * travelX[i];
          if (alignment > .9 && Math.abs(along) < .6 && distance < 1.4 && Math.abs(speed - other) < .18) want = Math.min(want, other / Math.max(speed, .01));
          if (alignment > .7 && along > 0 && Math.abs(across) < CROWD_GAP) {
            const headway = Math.sqrt(CROWD_GAP * CROWD_GAP - across * across);
            want = Math.min(want, (other * yieldPace[j] + Math.max(0, along - headway) * 2) / Math.max(speed, .01));
          }
          const vx = travelX[i] * speed * yieldPace[i] - travelX[j] * other * yieldPace[j];
          const vz = travelZ[i] * speed * yieldPace[i] - travelZ[j] * other * yieldPace[j], v2 = vx * vx + vz * vz;
          const t = v2 > .01 ? (dx * vx + dz * vz) / v2 : Infinity;
          const gap = Math.hypot(dx - vx * Math.min(t, 2), dz - vz * Math.min(t, 2));
          const threat = along > 0 && ((t > .05 && t < 2 && gap < CROWD_GAP + .15) || distance < CROWD_GAP + .2);
          if (state.partner < 0 && threat) {
            state.partner = j;
            const nx = -travelZ[i], nz = travelX[i];
            state.passSide = safe(i, px[i] + nx * CROWD_PUSH, pz[i] + nz * CROWD_PUSH) ? 1 : -1;
          }
          if (state.partner === j && (alignment < .3 || other < .01) && speed > .01 && path.type !== 'lane') side = state.passSide * CROWD_PUSH;
          if (t > .05 && t < 2 && gap < CROWD_GAP + .15 && (i > j || alignment > .7 && along > 0)) want = Math.min(want, .35 + .65 * Math.min(1, t / 2));
        }
      }
      state.groupWaiting = false;
      if (state.group >= 0) {
        const group = groups[state.group], leader = group.leader;
        const singleFile = group.members.some(j => st[j].obstacle || st[j].partner >= 0 && st[st[j].partner].group !== state.group);
        state.formation = singleFile ? 'single-file' : 'together';
        want = Math.min(want, group.speed / Math.max(speed, .01));
        for (const j of group.members) if (j !== i) {
          const along = (px[j]-px[i])*travelX[i]+(pz[j]-pz[i])*travelZ[i];
          if (along < -1.6 && travelX[i]*travelX[j]+travelZ[i]*travelZ[j] > .7) { want = Math.min(want, .35); state.groupWaiting = true; }
        }
        if (singleFile && i !== leader && side === 0) {
          const limit = path.type === 'lane' ? .2 : state.clearance;
          side = Math.max(-limit, Math.min(limit, -(px[leader]-px[i])*travelZ[i]+(pz[leader]-pz[i])*travelX[i]+sidestep[i]));
        }
      }
      state.obstacle = false;
      if (space && path.type !== 'idle') {
        const nx = -travelZ[i], nz = travelX[i], bx = px[i] - nx * sidestep[i], bz = pz[i] - nz * sidestep[i];
        place(path, state.s + path.dir * state.direction * .8, plan[i].look,state.trackFlip);
        const aheadX = out.x, aheadZ = out.z, aheadNX = -out.fz * state.direction, aheadNZ = out.fx * state.direction;
        if (!safe(i, bx, bz) || !safe(i, aheadX, aheadZ)) {
          state.obstacle = true;
          let limit = path.type === 'lane' ? .2 : state.clearance;
          const canPass = sign => !(limit*sign*path.dir*state.direction*out.curvature > .9)
            && safe(i, aheadX + aheadNX * limit * sign, aheadZ + aheadNZ * limit * sign);
          if (path.type !== 'lane') for (const candidate of [.75,1,1.25]) {
            if(canPass(1)||canPass(-1))break;limit=candidate;state.clearance=limit;
          }
          if (!canPass(state.passSide) && canPass(-state.passSide)) state.passSide *= -1;
          if (canPass(state.passSide)) side = limit * state.passSide;
          else want = 0;
        }
      }
      if (state.recoveryTime > 0) want = 0;
      state.mode = path.type === 'idle' ? 'idle' : state.recoveryTime > 0 ? 'wait' : state.partner >= 0 ? 'yield' : 'walk';
      yieldPace[i] += (Math.max(0, Math.min(1, want)) - yieldPace[i]) * blend;
      sidestep[i] += Math.max(-dt, Math.min(dt, (side - sidestep[i]) * blend));
    }
  };
  return {
    count: N, behavior: st, route: { x: px, z: pz, fx, fz }, walkPace, visible,
    update(dt, cam, hero) { // hero: { x, z, speed } of the stopped-or-moving hero vehicle; walkers near it slow to a stop and turn to watch it halt
      if (reducedMotion || dt < 0) dt = 0;
      if(dt===0&&elapsed>0)return;
      lastDt=dt;
      beforeX.set(px); beforeZ.set(pz);held.fill(0);elapsed+=dt;navigationBudget=1;
      navigationTarget=-1;
      for(let i=0;i<N;i++)if(space&&visible[i]&&st[i].wantsPath&&st[i].retryAt<=elapsed&&Math.hypot(px[i]-cam.x,pz[i]-cam.z)<SEP_FAR&&(navigationTarget<0||st[i].retryAt<st[navigationTarget].retryAt))navigationTarget=i;
      st.forEach((s,i)=>{previousPhase[i]=s.s;previousSide[i]=sidestep[i];previousFlip[i]=s.trackFlip;});
      if(dt>0)anticipate(dt,cam);
      plan.forEach(({ look: k, path }, i) => {
        const s = st[i];
        const want = busAttention(i, dt, hero);
        react[i] += (want - react[i]) * Math.min(1, dt * 2.5); // eased both ways, so nobody freezes or restarts in a single frame
        s.reachedWaypoint=false;
        if(s.detour){
          s.busInterest=s.busPhase==='attend';
          const target=s.detour.points[s.detourIndex],dx=target.x-beforeX[i],dz=target.z-beforeZ[i],distance=Math.hypot(dx,dz),step=Math.min(distance,k.speed*dt*(1-react[i]));
          const tx=dx/(distance||1),tz=dz/(distance||1),x=beforeX[i]+tx*step,z=beforeZ[i]+tz*step;
          px[i]=safe(i,x,z)?x:beforeX[i];pz[i]=safe(i,x,z)?z:beforeZ[i];
          travelX[i]=fx[i]=tx;travelZ[i]=fz[i]=tz;pushX[i]=pushZ[i]=0;walkPace[i]=dt>0?step/Math.max(.001,k.speed*dt):0;
          if(path.type==='lane')rememberNearestLane(i);
          s.reachedWaypoint=Math.hypot(px[i]-target.x,pz[i]-target.z)<.005;
          const t=Math.min(1,Math.max(0,(SEP_FAR-Math.hypot(px[i]-cam.x,pz[i]-cam.z))/(SEP_FAR-SEP_NEAR)));sep[i]=t*t*(3-2*t);
          return;
        }
        const phaseBefore = s.s;
        if(path.type==='lane')s.trackFlip+=Math.max(-dt,Math.min(dt,(s.direction<0?1:0)-s.trackFlip));
        const routeStep = path.dir * s.direction * k.speed * dt * (1 - react[i]) * yieldPace[i];
        let stretch = path.type === 'lane' ? Math.max(1,s.pace) : 1;
        if (path.type !== 'idle' && path.type !== 'lane' && sidestep[i] !== 0) {
          place(path,s.s+routeStep,k);
          stretch=Math.max(1,Math.abs(1-sidestep[i]*path.dir*s.direction*out.curvature),Math.abs(1-sidestep[i]*path.dir*s.direction*s.curvature));
        }
        if (path.type !== 'idle') s.s += routeStep / stretch;
        place(path, s.s, k, s.trackFlip);
        out.fx *= s.direction; out.fz *= s.direction;
        if (path.type === 'lane') rememberLane(i);
        if (s.busPhase === 'attend' && busProfiles[i].kind === 0) s.mode = 'watch';
        s.pace = path.type === 'lane' ? out.speed : stretch; walkPace[i] = Math.min(1, out.speed) * (1 - react[i]) * yieldPace[i];
        pushX[i] = -out.fz * sidestep[i]; pushZ[i] = out.fx * sidestep[i];
        px[i] = out.x + pushX[i]; pz[i] = out.z + pushZ[i]; fx[i] = out.fx; fz[i] = out.fz;
        if (!safe(i, px[i], pz[i])) {
          s.s = phaseBefore; place(path, s.s, k, s.trackFlip); out.fx *= s.direction; out.fz *= s.direction;
          const slideX=out.x-out.fz*sidestep[i],slideZ=out.z+out.fx*sidestep[i];
          if(safe(i,slideX,slideZ)){px[i]=slideX;pz[i]=slideZ;}
          else{
            s.trackFlip=previousFlip[i];sidestep[i]=previousSide[i];
            place(path,s.s,k,s.trackFlip);out.fx*=s.direction;out.fz*=s.direction;
            px[i]=beforeX[i];pz[i]=beforeZ[i];
          }
          walkPace[i] = 0;pushX[i] = px[i] - out.x; pushZ[i] = pz[i] - out.z;
        }
        s.curvature = path.type === 'lane' || path.type === 'idle' ? 0 : out.curvature;
        travelX[i]=out.fx;travelZ[i]=out.fz;
        const near = hero && busProfiles[i].kind < 3 && path.type !== 'idle' && (hero.speed >= 1.5 || s.busPhase === 'attend')
          ? Math.max(0, Math.min(1, (GLANCE_RANGE - Math.hypot(px[i] - hero.x, pz[i] - hero.z)) / 5)) : 0;
        s.busInterest = near > .02 || react[i] > .25;
        glance[i] += (near - glance[i]) * Math.min(1, dt * 3); // passers-by keep walking but turn up to half-way to follow a moving bus
        if ((react[i] > 0.25 || glance[i] > 0.02) && hero) { // turn towards the vehicle
          const tx = hero.x - px[i], tz = hero.z - pz[i], tl = Math.hypot(tx, tz) || 1, m = Math.max((react[i] - 0.25) / 0.75, GLANCE_TURN * glance[i]);
          const bx = fx[i] + (tx / tl - fx[i]) * m, bz = fz[i] + (tz / tl - fz[i]) * m, bl = Math.hypot(bx, bz) || 1;
          fx[i] = bx / bl; fz[i] = bz / bl;
        }
        const t = Math.min(1, Math.max(0, (SEP_FAR - Math.hypot(out.x - cam.x, out.z - cam.z)) / (SEP_FAR - SEP_NEAR)));
        sep[i] = t * t * (3 - 2 * t); // smoothstep: separation eases out with zero slope at both edges, so no push jump at a distance edge
      });
      for(let i=0;i<N;i++)if(plan[i].path.type==='lane'&&Math.abs((px[i]-laneX[i])*laneNX[i]+(pz[i]-laneZ[i])*laneNZ[i])<ARCH_HALF_WIDTH)sep[i]=0;
      framePushX.set(pushX);framePushZ.set(pushZ);
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
      if(dt>0){
        // A constrained contact must wait rather than swap bodies or jump to the other track.
        if(elapsed>.5)for(let i=0;i<N;i++)if(Math.hypot(px[i]-beforeX[i],pz[i]-beforeZ[i])>2.4*dt+.001)holdPosition(i);
        for(let pass=0;pass<N;pass++){
          cells.clear();let changed=false;
          for(let i=0;i<N;i++)if(sep[i]>0){
            const key=`${Math.floor(px[i]/CROWD_CELL)},${Math.floor(pz[i]/CROWD_CELL)}`;
            let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(i);
          }
          for(let i=0;i<N;i++)if(sep[i]>0){
            const cx=Math.floor(px[i]/CROWD_CELL),cz=Math.floor(pz[i]/CROWD_CELL);
            for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const j of cells.get(`${x},${z}`)||[])if(j<i){
              const dx=px[i]-px[j],dz=pz[i]-pz[j],oldX=beforeX[i]-beforeX[j],oldZ=beforeZ[i]-beforeZ[j];
              if(dx*dx+dz*dz<Math.min(.62*.62,oldX*oldX+oldZ*oldZ)-1e-8){
                changed=holdPosition(i)||changed;changed=holdPosition(j)||changed;
                if(st[i].partner<0)st[i].partner=j;if(st[j].partner<0)st[j].partner=i;
              }
            }
          }
          if(!changed)break;
        }
      }
      for (let i = 0; i < N; i++) {
        // Feed contact corrections back into the route so its next step cannot walk through a neighbour.
        const path = plan[i].path;
        if (dt > 0 && path.type !== 'idle' && !held[i] && !st[i].detour) {
          st[i].s += (pushX[i] * travelX[i] + pushZ[i] * travelZ[i]) * path.dir * st[i].direction / Math.max(1, st[i].pace);
          sidestep[i] = -pushX[i] * travelZ[i] + pushZ[i] * travelX[i];
        }
        if (dt > 0 && path.type !== 'idle') {
          const state = st[i];
          if(state.detour&&state.reachedWaypoint&&!held[i]){
            state.detourIndex++;
            if(state.detourIndex===state.detour.points.length){
              const goal=state.detour.goal;state.s=goal.phase;sidestep[i]=goal.side;state.trackFlip=goal.flip;state.detour=null;state.recoveryTime=0;state.mode='walk';
            }
          }
          const progress = (px[i] - beforeX[i]) * travelX[i] + (pz[i] - beforeZ[i]) * travelZ[i];
          actualSpeed[i] = Math.max(0, progress / dt);
          state.progressAge += dt;
          if (Math.hypot(px[i]-state.anchorX,pz[i]-state.anchorZ)>.25 || react[i]>.2) {
            state.progressAge=0;state.anchorX=px[i];state.anchorZ=pz[i];state.wantsPath=false;
          }
          const j = state.partner, following = j >= 0 && travelX[i] * travelX[j] + travelZ[i] * travelZ[j] > .7
            && (actualSpeed[j] > .08 && st[j].progressAge < 2 || st[j].busPhase === 'attend' && busProfiles[j].kind === 0);
          state.blocked = react[i] < .2 && !following && !state.groupWaiting ? state.progressAge : 0;
          if (state.blocked > 2 && (j < 0 || i > j || state.blocked > 4)) {
            state.wantsPath=true;
            state.blocked = 0; state.progressAge=0;state.anchorX=px[i];state.anchorZ=pz[i];state.recoveries++; state.recoveryTime = .35; state.mode = 'recover';
            if(state.detour)continue;
            state.passSide *= -1;
            if (path.type === 'lane' || state.recoveries % 2 === 0) { state.direction *= -1; sidestep[i] *= -1; state.partner = -1; }
          }
        }
        if(dt>0&&st[i].wantsPath&&i===navigationTarget)planRecovery(i,cam);
        avoidKiosks(i);
        // A lane walker squeezed under an arch sits inside its clear opening (lateral < ARCH_HALF_WIDTH) and cannot keep road clearance there: hidden while inside it (the portal is its vanishing edge), never by distance.
        const lateral = Math.abs((px[i] - laneX[i]) * laneNX[i] + (pz[i] - laneZ[i]) * laneNZ[i]);
        visible[i] = plan[i].path.type === 'lane' && lateral < ARCH_HALF_WIDTH ? 0 : 1;
      }
    },
  };
}
