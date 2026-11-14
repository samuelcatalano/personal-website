import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from './palette.js';
import { blockMaterial } from './textures.js';
import { SWAP_TUNNEL, swapTunnelFrame } from './layout.js';
import { V, soup, rest } from './route-tunnel.js';
import { cutHole } from './holes.js';
import { buildSwapPlaza } from './swap-plaza.js';
// Sao Paulo -> London: a cut-and-cover tunnel. The road runs down an open ramp, under a plaza at street level and up again; the hero swaps Mini <-> London
// bus out of sight inside (scene.js), so it drives in as one and out as the other, both ways. Nothing stands above the street: concrete retaining
// wings frame the ramps, the cover is a plaza level with the pavement (swap-plaza.js), and the portals remain open below the fascia.
// Local frame: x = metres along the road from the cover's centre (+ towards London), z across, y up.
const { half: HALF, ramp: RAMP, width: W, ahead: AHEAD } = SWAP_TUNNEL, REACH = HALF + RAMP;
const D = 4.8, LID = -0.3, LAWN = 0.07, KERB = 6.75, R = 2.5; // depth under the cover (a 4.3 m double-decker clears the soffit LID), plaza top (under the lamp pools' 0.08, lamps.js), its half width (kerb to kerb), vertical curves
const K = D / (RAMP - R); // grade between the vertical curves (~31%, 17 deg)
const ramp = (x) => x <= 0 ? 0 : x >= RAMP ? D : x < R ? K * x * x / (2 * R) : x > RAMP - R ? D - K * (RAMP - x) ** 2 / (2 * R) : K * (x - R / 2); // x: m from the ramp's top
const dip = (s) => ramp(REACH - Math.abs(s));
const EDGE = 3.85, RETAINING_CAP = 0.18, YELLOW = '#e9b93a', WHITE = '#ece8de'; // roadmarks.js: edge lines, SP double yellow centre, UK white dashes
// route: { dev(s): the route centre's offset across the straight local frame at s (the road bends ~0.6 m off it over the ramps), dash(s): is the
// London centre dash painted at s (roadmarks.js phase) } — so the tunnel's paint carries the street's on without a step at either end.
function parts({ dev, dash }) {
  const s = { road: soup(), dark: soup(), wall: soup(), white: soup(), yellow: soup() }, y = (x) => 0.06 - dip(x), step = 0.5;
  const n = Math.ceil(2 * REACH / step), xs = Array.from({ length: n + 1 }, (_, k) => -REACH + 2 * REACH * k / n); // ends exactly at +-REACH: the hole stops there
  const strip = (g, a, b, z0, z1, lift) => g.quad(V(a, y(a) + lift, z0), V(b, y(b) + lift, z0), V(b, y(b) + lift, z1), V(a, y(a) + lift, z1), V(0, 1, 0));
  const line = (g, a, b, o, w) => g.quad(V(a, y(a) + 0.014, dev(a) + o - w / 2), V(b, y(b) + 0.014, dev(b) + o - w / 2), V(b, y(b) + 0.014, dev(b) + o + w / 2), V(a, y(a) + 0.014, dev(a) + o + w / 2), V(0, 1, 0)); // along the real route
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2, covered = Math.abs(m) < HALF;
    strip(s.road, a, b, -W, W, 0);
    for (const [z, o] of [[-W, 1], [W, -1]]) { // concrete retaining wings on the ramps, dark tunnel walls inside
      const top = covered ? LID : 0.06;
      (covered ? s.dark : s.wall).quad(V(a, y(a) - 0.1, z), V(b, y(b) - 0.1, z), V(b, top, z), V(a, top, z), V(0, 0, o));
      if (!covered) {
        const side = Math.sign(z);
        s.wall.quad(V(a, 0.065, z - side * RETAINING_CAP), V(b, 0.065, z - side * RETAINING_CAP), V(b, 0.065, z), V(a, 0.065, z), V(0, 1, 0));
      }
    }
    for (const o of [-EDGE, EDGE]) line(s.white, a, b, o, 0.12);
    if (m < -AHEAD) for (const o of [-0.11, 0.11]) line(s.yellow, a, b, o, 0.1); // Sao Paulo side of the region swap
    else if (dash(m)) line(s.white, a, b, 0, 0.12); // London: roadmarks.js dashes
  }
  const kerb = KERB; // the plaza runs kerb to kerb over the covered stretch, hiding the street's road there
  s.dark.quad(V(-HALF, LID, -W), V(HALF, LID, -W), V(HALF, LID, W), V(-HALF, LID, W), V(0, -1, 0)); // soffit
  for (const e of [-1, 1]) { // portal: the cover's concrete edge, from the soffit up to the plaza, facing its ramp
    s.wall.quad(V(e * HALF, LID, -W), V(e * HALF, LID, W), V(e * HALF, LAWN, W), V(e * HALF, LAWN, -W), V(e, 0, 0));
    s.wall.quad(V(e * HALF, LAWN, -kerb), V(e * HALF, LAWN, kerb), V(e * (HALF - 0.3), LAWN + 0.01, kerb), V(e * (HALF - 0.3), LAWN + 0.01, -kerb), V(0, 1, 0)); // coping strip
  }
  // lips just under the street (0.06) round each ramp's hole, outside it only: the hole's discard and the floor's edges rasterise differently, so pixels on
  // the seam would otherwise show the void (route-tunnel.js has the same lip)
  const lip = (x0, x1, z0, z1) => s.road.quad(V(x0, 0.045, z0), V(x1, 0.045, z0), V(x1, 0.045, z1), V(x0, 0.045, z1), V(0, 1, 0));
  for (const e of [-1, 1]) {
    const [a, b] = e < 0 ? [-REACH, -HALF] : [HALF, REACH];
    lip(e < 0 ? a - 0.3 : b - 0.4, e < 0 ? a + 0.4 : b + 0.3, -W - 0.3, W + 0.3); lip(a, b, -W - 0.3, -W); lip(a, b, W, W + 0.3); // ends straddle the seam: the ramp is level there
  }
  return Object.fromEntries(Object.entries(s).map(([k, g]) => [k, [g.geo()]]));
}
export function createSwapTunnel(curve, stops) {
  const f = swapTunnelFrame(curve, stops), c = V(f.x, 0, f.z), tan = V(f.tx, 0, f.tz), across = V(-f.tz, 0, f.tx); // local x = tan, local z = across
  const group = new THREE.Group(); group.name = 'swap-tunnel';
  group.position.copy(c); group.rotation.y = Math.atan2(-f.tz, f.tx);
  const paint = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); // as roadmarks.js
  const mats = { road: blockMaterial(P.road), dark: blockMaterial(P.iron), wall: blockMaterial(P.concrete), white: paint(WHITE), yellow: paint(YELLOW), guardrail: new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.5, metalness: 0.6 }) }, geos = [];
  mats.wall.emissive.set('#8b5738'); mats.wall.emissiveIntensity = 0;
  // The real route in the local frame, sampled across the tunnel: centre offset and curve parameter by s (curve t is not arc length, so sample and lerp)
  const len = curve.getLength(), marks = Math.ceil(len / 1.2), samples = Array.from({ length: 401 }, (_, k) => {
    const t = f.t + (k / 200 - 1) * (REACH + 2) / f.speed * 1.3, p = curve.getPointAt(Math.min(1, Math.max(0, t))), dx = p.x - c.x, dz = p.z - c.z;
    return [dx * tan.x + dz * tan.z, dx * across.x + dz * across.z, t];
  });
  const at = (s, i) => { let k = 1; while (k < samples.length - 1 && samples[k][0] < s) k++; const [s0, a0] = [samples[k - 1][0], samples[k - 1][i]], [s1, a1] = [samples[k][0], samples[k][i]]; return a0 + (a1 - a0) * (s - s0) / (s1 - s0 || 1); };
  const pr = parts({ dev: (s) => at(s, 1), dash: (s) => Math.floor(at(s, 2) * marks) % 5 < 2 }); // roadmarks.js: k = segment of 1/marks in t, dash when k % 5 < 2
  for (const k in pr) {
    const geo = mergeGeometries(pr[k]);
    geos.push(geo);
    const m = new THREE.Mesh(geo, mats[k]); m.receiveShadow = true; group.add(m);
  }
  const plaza = buildSwapPlaza({ half: HALF, kerb: KERB, y: LAWN }); group.add(plaza.group);
  const railGeo = new THREE.BoxGeometry(1, 1, 1), barGaps = Math.ceil((RAMP + 0.14) / 0.135), postGaps = Math.ceil((RAMP + 0.14) / 2);
  const rails = new THREE.InstancedMesh(railGeo, mats.guardrail, 4 * (barGaps + postGaps + 2)), member = new THREE.Object3D();
  rails.name = 'swap-tunnel-pedestrian-rails'; rails.castShadow = rails.receiveShadow = true;
  let railIndex = 0;
  const addRail = (x, h, z, w, height, depth) => {
    member.position.set(x, 0.065 + h, z); member.scale.set(w, height, depth); member.updateMatrix();
    rails.setMatrixAt(railIndex++, member.matrix);
  };
  for (const side of [-1, 1]) for (const e of [-1, 1]) {
    const a = e < 0 ? -REACH : HALF - 0.14, b = e < 0 ? -HALF + 0.14 : REACH;
    const length = b - a, z = side * (W - RETAINING_CAP / 2), middle = (a + b) / 2;
    addRail(middle, 1.065, z, length, 0.07, 0.08);
    addRail(middle, 0.14, z, length, 0.05, 0.06);
    for (let i = 0; i <= postGaps; i++) addRail(a + i * length / postGaps, 0.55, z, 0.08, 1.1, 0.08);
    for (let i = 1; i < barGaps; i++) addRail(a + i * length / barGaps, 0.57, z, 0.035, 0.84, 0.035);
  }
  rails.instanceMatrix.needsUpdate = true; rails.computeBoundingBox(); rails.computeBoundingSphere(); group.add(rails); geos.push(railGeo);
  group.userData.setNight = (night) => { mats.wall.emissiveIntensity = 0.12 * night; };
  const local = (x, z) => { const dx = x - c.x, dz = z - c.z; return { s: dx * tan.x + dz * tan.z, z: dx * across.x + dz * across.z }; };
  return {
    group, t: f.t, half: HALF,
    // Hole in the street over the whole tunnel (holes.js): the ramps, and under the plaza too, where the street's paint (polygon-offset) would otherwise
    // show through it at grazing angles. ponytail: one straight box; the road bends a little off it, and W keeps the cut inside both kerbs.
    cut(scene) { return cutHole(scene, { cx: c.x, cz: c.z, ax: tan.x, az: tan.z, hl: REACH, hw: W }, group.children); },
    // Height and pitch from the ramps under the vehicle's axles; `src` carries the wheels (the hero group moves, its visible candidate has the wheels)
    place(mesh, src = mesh) {
      const { s, z } = local(mesh.position.x, mesh.position.z);
      if (Math.abs(z) > W || Math.abs(s) > REACH + 7) return;
      rest(mesh, s, Math.sign(Math.cos(mesh.rotation.y - group.rotation.y)) || 1, (x) => -dip(x), src);
    },
    // Whole body under the cover: centre at most HALF - halfLength from the cover's centre
    covered(x, z, halfLength) { return Math.abs(local(x, z).s) <= HALF - halfLength; },
    offset(x, z) { return local(x, z).s; },
    dispose() { rails.dispose(); plaza.dispose(); geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); },
  };
}
