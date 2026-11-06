import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from './palette.js';
import { blockMaterial } from './textures.js';
import { cutHole } from './holes.js';
// Cut-and-cover tunnel behind the route start (Sao Paulo): the whole road dips down one open ramp into a concrete portal under the hero plaza, so ambient
// cars drive out of the scene instead of vanishing on the paving. Nothing but the ramp and the portal: the ramp's edges are flush asphalt, no walls,
// no median. The ramp starts just behind where the Mini starts (it stays put on the level road).
// Local frame: x = metres past the route start, away from the route (into the tunnel); z across (oncoming lane at -1.75, hero lane at +1.75); y up.
const U0 = 3, L = 16.8, IN = 10; // ramp start (clear of the Mini's tail, u ~ 2), portal face (clear of the hero plaza), interior depth
const W0 = -4.1, W1 = 4.1, TOP = 1.4, LID = -0.05; // ramp edges across, portal top above the road, soffit (just under the plaza paving)
const SINK = 0.3; // m a middle axle may dip into the crest of the ramp (place())
const D = 3.4; // ramp depth at the portal: a Caio bus (3.1 m) clears the soffit
export const PORTAL = L; // metres past the route start of the portal face: a vehicle hides once its tail is past it
// Ramp depth (m below the road) at u metres past the route start: a vertical curve, R m of parabola (grade 0 -> K) easing into a constant grade K
// that reaches D at the portal (~28%, 15 deg). Levels off at the back of the interior.
const R = 3, K = D / (L - U0 - R / 2);
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
  const us = [...Array.from({ length: Math.ceil((L - U0) / 0.5) }, (_, k) => U0 + k * 0.5), ...Array.from({ length: IN + 1 }, (_, k) => L + k)];
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1], g = a >= L ? dark : road; // asphalt in the open, dark inside
    road.quad(V(a, y(a), W0), V(b, y(b), W0), V(b, y(b), W1), V(a, y(a), W1), V(0, 1, 0));
    // edges: the sides of the cut, from the ramp up to the road (open) or the soffit (inside); asphalt-coloured, flush, so they read as the ramp, not as walls
    for (const [z, o] of [[W0, 1], [W1, -1]]) g.quad(V(a, y(a) - 0.1, z), V(b, y(b) - 0.1, z), V(b, a >= L ? LID : 0.06, z), V(a, a >= L ? LID : 0.06, z), V(0, 0, o));
  }
  // lip under the seam, straddling U0 just below both the cut road (0.06) and the ramp's first metres: the clip test and the floor's edge rasterise
  // differently, so pixels on the line would otherwise show the void
  road.quad(V(U0 - 0.3, 0.045, W0), V(U0 + 0.4, 0.045, W0), V(U0 + 0.4, 0.045, W1), V(U0 - 0.3, 0.045, W1), V(0, 1, 0));
  dark.quad(V(L, LID, W0), V(e, LID, W0), V(e, LID, W1), V(L, LID, W1), V(0, -1, 0)); // ceiling
  dark.quad(V(e, y(e), W0), V(e, y(e), W1), V(e, LID, W1), V(e, LID, W0), V(-1, 0, 0)); // back wall
  const paint = soup(); // double yellow centre line (roadmarks.js: +-0.11 m, 0.1 m wide) carried on from the route start down the ramp and inside
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1];
    for (const o of [-0.11, 0.11]) paint.quad(V(a, y(a) + 0.014, o - 0.05), V(b, y(b) + 0.014, o - 0.05), V(b, y(b) + 0.014, o + 0.05), V(a, y(a) + 0.014, o + 0.05), V(0, 1, 0));
  }
  for (const o of [-0.11, 0.11]) paint.quad(V(0, 0.074, o - 0.05), V(U0, 0.074, o - 0.05), V(U0, 0.074, o + 0.05), V(0, 0.074, o + 0.05), V(0, 1, 0)); // level stretch behind the Mini
  const portal = [ // lintel over the opening and the two jambs down the sides of the cut
    box(L - 0.2, L + 0.6, LID, TOP, W0 - 0.5, W1 + 0.5),
    box(L - 0.2, L + 0.6, -D - 0.2, TOP, W0 - 0.5, W0 + 0.15), box(L - 0.2, L + 0.6, -D - 0.2, TOP, W1 - 0.15, W1 + 0.5),
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
// ponytail: rigid body (the Caio's articulated body is one mesh, it cannot bend at the joint): over a crest a middle axle dips below the road, held to
// SINK m (under the body's ground clearance) by lifting the line. Needs rotation.order 'YZX' (yaw, then pitch about the car's own z).
export function rest(mesh, u, dir, surface, src = mesh) {
  const ax = axles(mesh, src).map((x) => { const at = u + dir * x; return [at, surface(at)]; });
  const [xa, ya] = ax[0], [xb, yb] = ax[ax.length - 1], m = (yb - ya) / (xb - xa), line = (x) => ya + m * (x - xa);
  const lift = Math.max(0, ...ax.map(([x, y]) => y - line(x) - SINK));
  mesh.position.y = 0.07 + line(u) + lift;
  mesh.rotation.z = Math.atan(m) * dir;
}
export function createRouteTunnel(curve) {
  const p0 = curve.getPointAt(0), tan = curve.getTangentAt(0), back = tan.clone().negate(), across = V(tan.z, 0, -tan.x); // local x = back, local z = across
  const group = new THREE.Group(); group.name = 'route-tunnel';
  group.position.copy(p0); group.rotation.y = Math.atan2(tan.z, -tan.x);
  const mats = { road: blockMaterial(P.road), wall: blockMaterial(P.concrete), dark: blockMaterial(P.iron),
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
      const uc = (U0 + L) / 2;
      return cutHole(scene, { cx: p0.x + back.x * uc, cz: p0.z + back.z * uc, ax: back.x, az: back.z, hl: (L - U0) / 2, hw: W1 }, group.children);
    },
    // Drop a vehicle on the ramp: `tun` metres past the route start (null = still on the road, already placed on its lane), then height and pitch from the
    // ramp if it is over it. Needs rotation.order 'YZX' (yaw, then pitch about the car's own z).
    place(mesh, tun) { // height and pitch from the ramp under the vehicle's axles (rest())
      if (tun) mesh.position.addScaledVector(back, tun);
      const { u, z } = local(mesh.position), dir = Math.sign(Math.cos(mesh.rotation.y - group.rotation.y)) || 1;
      if (!(z > W0 && z < W1) || u < U0 - 12) { mesh.position.y = 0.07; mesh.rotation.z = 0; return; }
      rest(mesh, u, dir, (x) => -depth(x));
    },
    dispose() { geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); },
  };
}
