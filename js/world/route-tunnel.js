import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from './palette.js';
import { blockMaterial } from './textures.js';
import { cutHole } from './holes.js';
// Cut-and-cover tunnel behind the route start (Sao Paulo): the whole road dips down one open ramp into a concrete portal under the hero plaza, so ambient
// cars drive out of the scene instead of vanishing on the paving. Nothing but the ramp and the portal: the ramp's edges are flush asphalt, no walls,
// no median. The ramp starts just behind where the Mini starts (it stays put on the level road).
// Local frame: x = metres past the route start, away from the route (into the tunnel); z across (Sao Paulo drives on the right: oncoming lane at +1.75, hero lane at -1.75, see lanes.js); y up.
const U0 = 3, L = 21.5, IN = 10; // ramp start (clear of the Mini's tail, u ~ 2), portal face (cuts the hero plaza's south-east corner, reworked in hero-realm.js; the first tree stands at u 23.5), interior depth
const W0 = -4.1, W1 = 4.1, TOP = 1.4, LID = -0.05; // ramp edges across, portal top above the road, soffit (just under the plaza paving)
// The mouth opens MOUTH m above the street: the lintel rides higher than the plaza and a dark plate MOUTH_D m behind it drops back to the soffit, so the
// portal reads tall while the tunnel itself stays under the paving.
const MOUTH = 0.8, STEP = L + 0.55, PLAZA_U = 17.5; // PLAZA_U: the hero plaza's paving starts here along the ramp
const FRONT = L - 0.2, PARAPET_BASE = -0.4;
const SINK = 0.3; // m a middle axle may dip into the crest of the ramp (place())
// An 8 m crest curve (was 3) into a 26% grade (was ~33%) over a ramp 4.7 m longer: the 16.8 m articulated Caio pitches in gradually instead of
// kinking over the crest, and its roof still clears the soffit behind the mouth by 0.2 m (tests/caio-ramp.browser.py).
const R = 8, K = 0.26, D = K * (L - U0 - R / 2); // ramp depth at the portal
export const TUNNEL_HEADROOM = D + MOUTH; // open mouth above the ramp floor at the portal face
export const PORTAL = L; // metres past the route start of the portal face: a vehicle hides once its tail is past it
export const soffit = (u) => u < STEP ? MOUTH : LID; // ceiling height over the road at u, from the lintel face inwards
// Ramp depth (m below the road) at u metres past the route start: a vertical curve, R m of parabola (grade 0 -> K) easing into a constant grade K
// that reaches D at the portal. Levels off at the back of the interior.
export const depth = (u) => { const x = Math.min(u, L + IN) - U0; return x <= 0 ? 0 : x < R ? K * x * x / (2 * R) : K * (x - R / 2); };
export const bare = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
export const box = (x0, x1, y0, y1, z0, z1) => bare(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function soup() { // as underpass.js: wound so the face normal agrees with `out`
  const p = [];
  const tri = (a, b, c, out) => { const n = b.clone().sub(a).cross(c.clone().sub(a)); (n.dot(out) < 0 ? [a, c, b] : [a, b, c]).forEach((v) => p.push(v.x, v.y, v.z)); };
  return { quad(a, b, c, d, out) { tri(a, b, c, out); tri(a, c, d, out); }, geo() { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; } };
}
function parts() {
  const road = soup(), dark = soup(), e = L + IN, y = (u) => 0.06 - depth(u);
  const us = [...Array.from({ length: Math.ceil((L - U0) / 0.5) }, (_, k) => U0 + k * 0.5), FRONT, ...Array.from({ length: IN + 1 }, (_, k) => L + k)];
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1], g = a >= L ? dark : road; // asphalt in the open, dark inside
    road.quad(V(a, y(a), W0), V(b, y(b), W0), V(b, y(b), W1), V(a, y(a), W1), V(0, 1, 0));
    // The stone parapets continue the inner face of the cut from their base up.
    const edgeTop = a >= L ? LID : a >= PLAZA_U && b <= FRONT ? PARAPET_BASE : 0.06;
    for (const [z, o] of [[W0, 1], [W1, -1]]) g.quad(V(a, y(a) - 0.1, z), V(b, y(b) - 0.1, z), V(b, edgeTop, z), V(a, edgeTop, z), V(0, 0, o));
  }
  // lip under the seam, straddling U0 just below both the cut road (0.06) and the ramp's first metres: the clip test and the floor's edge rasterise
  // differently, so pixels on the line would otherwise show the void
  road.quad(V(U0 - 0.3, 0.045, W0), V(U0 + 0.4, 0.045, W0), V(U0 + 0.4, 0.045, W1), V(U0 - 0.3, 0.045, W1), V(0, 1, 0));
  dark.quad(V(STEP, LID, W0), V(e, LID, W0), V(e, LID, W1), V(STEP, LID, W1), V(0, -1, 0)); // ceiling
  dark.quad(V(e, y(e), W0), V(e, y(e), W1), V(e, LID, W1), V(e, LID, W0), V(-1, 0, 0)); // back wall
  const paint = soup(); // double yellow centre line (roadmarks.js: +-0.11 m, 0.1 m wide) carried on from the route start down the ramp and inside
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1];
    for (const o of [-0.11, 0.11]) paint.quad(V(a, y(a) + 0.014, o - 0.05), V(b, y(b) + 0.014, o - 0.05), V(b, y(b) + 0.014, o + 0.05), V(a, y(a) + 0.014, o + 0.05), V(0, 1, 0));
  }
  for (const o of [-0.11, 0.11]) paint.quad(V(0, 0.074, o - 0.05), V(U0, 0.074, o - 0.05), V(U0, 0.074, o + 0.05), V(0, 0.074, o + 0.05), V(0, 1, 0)); // level stretch behind the Mini
  dark.quad(V(STEP, LID, W0), V(STEP, LID, W1), V(STEP, MOUTH, W1), V(STEP, MOUTH, W0), V(-1, 0, 0)); // mouth back: drop to the soffit
  const portal = [ // lintel over the opening, its back plate (the plaza side stays a solid headwall) and the two jambs down the sides of the cut
    box(FRONT, L + 0.6, MOUTH, TOP, W0 - 0.5, W1 + 0.5), box(STEP + 0.005, L + 0.6, LID, MOUTH, W0 + 0.15, W1 - 0.15),
    box(FRONT, L + 0.6, -D - 0.2, MOUTH, W0 - 0.5, W0 + 0.15), box(FRONT, L + 0.6, -D - 0.2, MOUTH, W1 - 0.15, W1 + 0.5),
    // Coping and a narrow plinth articulate the existing lintel; all detail stays outside the opening.
    box(L-.24,L+.64,TOP,TOP+.10,W0-.54,W1+.54),
    box(L-.24,L-.201,MOUTH,MOUTH+.12,W0-.5,W1+.5), // soffit band along the raised lintel
    // Where the ramp crosses the hero plaza it gets parapets (the street stretch before it stays flush): down below the paving so no seam shows.
    box(PLAZA_U, FRONT, PARAPET_BASE, 0.95, W1, W1 + 0.25), box(PLAZA_U, FRONT, PARAPET_BASE, 0.95, W0 - 0.25, W0),
  ];
  return { road: [road.geo()], dark: [dark.geo()], wall: portal, paint: [paint.geo()] };
}
// Axle offsets along a vehicle's own x (forward +) from its wheel nodes, cached on `src` per wheel list (the GLB upgrade swaps the procedural wheels).
// `src` is the model carrying the wheels; `mesh` the object that is moved (the hero group moves, its visible candidate carries the wheels).
function axles(mesh, src) {
  const ud = src.userData, wheels = ud.wheels ?? [];
  if (ud.axlesOf !== wheels) {
    mesh.updateMatrixWorld(true);
    const xs = wheels.map((w) => +mesh.worldToLocal(w.getWorldPosition(new THREE.Vector3())).x.toFixed(1));
    ud.axles = [...new Set(xs)].sort((a, b) => a - b); ud.axlesOf = wheels;
    if (ud.axles.length < 2) ud.axles = [-1.3, 1.3]; // ponytail: no wheel nodes -> a car-sized wheelbase
  }
  return ud.axles;
}
// Rest a vehicle on a road surface y = surface(u) (u along the road, metres; the vehicle's centre at u, facing dir = +-1 along u): the body rides on its
// end axles, not on its centre, so a long bus noses down as soon as its front wheels reach a ramp and levels out as its rear wheels follow.
// An articulated Caio (userData.joint, caio-joint.js) splits it: the front body rides its front and middle axles, the trailing section pivots at the
// joint onto its rear axles. Rigid vehicles with a middle axle: over a crest it dips below the road, held to SINK m by lifting the line.
// Needs rotation.order 'YZX' (yaw, then pitch about the car's own z).
export function rest(mesh, u, dir, surface, src = mesh) {
  const joint = mesh.userData.joint ?? src.userData.joint, all = axles(mesh, src);
  if (joint) joint.bone.rotation.z = 0;
  const front = joint ? all.filter((x) => x > joint.x) : all, back = joint ? all.filter((x) => x < joint.x) : [];
  const ax = (front.length >= 2 ? front : all).map((x) => { const at = u + dir * x; return [at, surface(at)]; });
  const [xa, ya] = ax[0], [xb, yb] = ax[ax.length - 1], m = (yb - ya) / (xb - xa), line = (x) => ya + m * (x - xa);
  const lift = Math.max(0, ...ax.map(([x, y]) => y - line(x) - SINK));
  mesh.position.y = 0.07 + line(u) + lift;
  mesh.rotation.z = Math.atan(m) * dir;
  if (!joint || front.length < 2 || !back.length) return;
  // Trailing section: from the joint on the front body's line to the road under its rear axles (their mean, a tandem pair shares the load).
  const xr = back.reduce((s, x) => s + x, 0) / back.length, yj = line(u + dir * joint.x) + lift, yr = surface(u + dir * xr);
  joint.bone.rotation.z = Math.atan((yj - yr) / (joint.x - xr)) - Math.atan(m * dir);
  // Suspension: joint + tandem over-constrain the trailing section (and the middle axle is extrapolated over a crest), so each wheel travels up to
  // TRAVEL m along its own vertical to meet the road, as a real bus's axles do. Wheel parents (body, rear bone) are within a few degrees of level.
  mesh.updateMatrixWorld(true);
  const base = mesh.getWorldPosition(_v), hx = Math.cos(mesh.rotation.y), hz = -Math.sin(mesh.rotation.y); // heading on the ground (scene-level vehicle)
  const bend = joint.bone.rotation.z, c = Math.cos(bend), s = Math.sin(bend);
  for (const w of src.userData.wheels ?? []) {
    const ud = w.userData; ud.restX ??= w.position.x; ud.restY ??= w.position.y;
    const dx = ud.restX - joint.x, behind = dx < 0; // trailing wheels swing with the rear section about the joint (on the ground line, y 0)
    w.position.set(behind ? joint.x + dx * c - ud.restY * s : ud.restX, behind ? dx * s + ud.restY * c : ud.restY, w.position.z);
    w.updateMatrixWorld(true); w.getWorldPosition(_w).sub(base);
    const along = _w.x * hx + _w.z * hz, bottom = mesh.position.y + _w.y - (ud.radius ?? 0.52); // pitched: the wheel sits `along` m ahead on the ground, not x
    w.position.y += Math.max(-TRAVEL, Math.min(TRAVEL, surface(u + dir * along) + 0.07 - bottom));
  }
}
const TRAVEL = 0.18, _v = new THREE.Vector3(), _w = new THREE.Vector3();
// Back to level road: no pitch, no bend.
export function straighten(mesh) {
  mesh.rotation.z = 0; if (!mesh.userData.joint) return;
  mesh.userData.joint.bone.rotation.z = 0;
  for (const w of mesh.userData.wheels ?? []) if (w.userData.restY !== undefined) { w.position.x = w.userData.restX; w.position.y = w.userData.restY; }
}
export function createRouteTunnel(curve) {
  const p0 = curve.getPointAt(0), tan = curve.getTangentAt(0), back = tan.clone().negate(), across = V(tan.z, 0, -tan.x); // local x = back, local z = across
  const group = new THREE.Group(); group.name = 'route-tunnel';
  group.position.copy(p0); group.rotation.y = Math.atan2(tan.z, -tan.x);
  const mats = { road: blockMaterial(P.road), wall: blockMaterial(P.paverWarm), dark: blockMaterial(P.iron),
    paint: new THREE.MeshStandardMaterial({ color: '#e9b93a', roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) }, geos = []; // paint as roadmarks.js
  const pr = parts();
  for (const k in pr) {
    const geo = mergeGeometries(pr[k].map((x) => { if (!x.attributes.normal) x.computeVertexNormals(); return x; }));
    geos.push(geo);
    const m = new THREE.Mesh(geo, mats[k]); m.castShadow = k === 'wall'; m.receiveShadow = true; group.add(m);
  }
  const local = (pos) => { const dx = pos.x - p0.x, dz = pos.z - p0.z; return { u: dx * back.x + dz * back.z, z: dx * across.x + dz * across.z }; };
  return {
    group,
    cut(scene) { // hole in the street over the ramp (holes.js); the lip and the ramp floor fill it
      const uc = (U0 + STEP) / 2; // through the paving under the raised lintel too
      return cutHole(scene, { cx: p0.x + back.x * uc, cz: p0.z + back.z * uc, ax: back.x, az: back.z, hl: (STEP - U0) / 2, hw: W1 }, group.children);
    },
    // Drop a vehicle on the ramp: `tun` metres past the route start (null = still on the road, already placed on its lane), then height and pitch from the
    // ramp if it is over it. Needs rotation.order 'YZX' (yaw, then pitch about the car's own z).
    place(mesh, tun) { // height and pitch from the ramp under the vehicle's axles (rest())
      if (tun) mesh.position.addScaledVector(back, tun);
      const { u, z } = local(mesh.position), dir = Math.sign(Math.cos(mesh.rotation.y - group.rotation.y)) || 1;
      if (!(z > W0 && z < W1) || u < U0 - 12) { mesh.position.y = 0.07; straighten(mesh); return; }
      rest(mesh, u, dir, (x) => -depth(x));
    },
    dispose() { geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); },
  };
}
