import { PALETTE as P } from './palette.js';
import { rng, stopIndex, LANDMARKS } from './layout.js';
import { house } from './houses.js';
import { draw } from './blocks.js';
import { flag } from './flags.js';
import { lampPost } from './street-lamp.js';

const CONE_ORANGE = '#f36b21', BRONZE_DK = '#4a3a22';

// z is the road centre; George Square sits on its far-side (-z) edge.
export function buildGlasgow(add, { x, z: roadZ }, onTree, createChambers, createStatue) {
  const squareZ = roadZ - 28, chambersZ = roadZ - 41;

  add(x, 0.01, squareZ, 40, 0.14, 22, P.gravel);
  add(x, 0.16, squareZ, 5, 0.04, 22, P.pave);
  add(x, 0.16, squareZ, 40, 0.04, 3, P.pave);
  for (const [dx, dz, w, d] of [[-14, -6, 8, 4], [14, -6, 8, 4], [-14, 6, 8, 4], [14, 6, 8, 4]]) {
    add(x + dx, 0.16, squareZ + dz, w, 0.2, d, P.grass);
  }
  for (const dx of [-17, -11, 11, 17]) {
    for (const dz of [-8, 8]) {
      if (onTree) onTree(x + dx, squareZ + dz, { h: 5.3, crown: 3.5, base: 0.2 });
      else {
        add(x + dx, 0.2, squareZ + dz, 0.7, 3, 0.7, P.trunk);
        add(x + dx, 3.1, squareZ + dz, 3.5, 3.5, 3.5, P.leaf);
      }
    }
  }

  if (createChambers) { // ponytail: voxel palace + statue kept as the fallback for headless tests that pass no geometry callbacks
    createChambers({ x, z: chambersZ });
    flag(add, x, 18.5, chambersZ, 'saltire');
  } else {
    // City Chambers: broad sandstone civic facade, glazed bays, and a central dome.
    add(x, 0, chambersZ, 30, 8, 3, P.sandstone);
    add(x, 8, chambersZ, 32, 1, 3.4, P.sandstone);
    add(x, 9, chambersZ, 26, 0.45, 3.7, P.gilt);
    add(x, 9.45, chambersZ, 12, 3, 4, P.sandstone);
    add(x, 12.45, chambersZ, 6, 0.5, 4.5, P.gilt);
    for (const dx of [-12, -8, -4, 4, 8, 12]) add(x + dx, 1.6, chambersZ + 1.56, 2.1, 4.3, 0.12, P.ink);
    for (const dx of [-5, -2.5, 2.5, 5]) add(x + dx, 1.2, chambersZ + 2.06, 0.7, 6.8, 0.35, P.cream);
    add(x, 0, chambersZ + 2.1, 4.6, 5.2, 0.45, P.ink);
    add(x, 13, chambersZ, 6, 1.2, 4.5, P.sandstone);
    add(x, 14.2, chambersZ, 4, 1, 3.5, P.gilt);
    add(x, 15.2, chambersZ, 1.3, 2.5, 1.3, P.sandstone);
    flag(add, x, 17.7, chambersZ, 'saltire');
  }

  // Duke of Wellington: stepped plinth, horse facing +x, rider; cone is the Glasgow in-joke.
  const sz = roadZ - 20;
  if (createStatue) createStatue({ x, z: sz });
  else {
    add(x, 0, sz, 5.8, 0.8, 3, P.concrete);
    add(x, 0.8, sz, 4.8, 1.2, 2.4, P.stone);
    add(x, 2, sz, 5.4, 0.6, 2.8, P.concrete);
    for (const [dx, dz] of [[1.5, -0.45], [1.5, 0.45], [-1.5, -0.45], [-1.5, 0.45]]) {
      add(x + dx, 2.6, sz + dz, 0.5, 0.3, 0.5, BRONZE_DK); // hoof
      add(x + dx, 2.9, sz + dz, 0.5, 1.5, 0.45, P.bronze); // leg
    }
    add(x, 4.4, sz, 4.2, 1.6, 1.3, P.bronze); // body
    add(x + 2.1, 5.5, sz, 1, 1.2, 0.8, P.bronze); // neck base
    add(x + 2.4, 6.4, sz, 0.8, 1, 0.7, P.bronze); // neck arch
    add(x + 1.9, 6, sz, 0.35, 1.38, 0.3, BRONZE_DK); // mane
    add(x + 2.9, 6.7, sz, 0.9, 0.8, 0.7, P.bronze); // head
    add(x + 3.45, 5.9, sz, 0.6, 1.3, 0.55, P.bronze); // muzzle
    add(x + 2.65, 7.5, sz, 0.25, 0.4, 0.5, BRONZE_DK); // ears
    add(x - 2.3, 5.2, sz, 0.5, 0.78, 0.45, BRONZE_DK); // tail root
    add(x - 2.45, 3.5, sz, 0.4, 1.7, 0.4, BRONZE_DK); // tail
    add(x - 0.2, 6, sz, 1.8, 0.2, 1.5, BRONZE_DK); // saddle
    for (const s of [-1, 1]) {
      add(x - 0.1, 5.1, sz + s * 0.85, 0.65, 1.4, 0.4, P.bronze); // rider leg
      add(x + 0.15, 4.85, sz + s * 0.85, 0.95, 0.35, 0.5, BRONZE_DK); // boot in stirrup
    }
    add(x - 0.2, 6.2, sz, 0.9, 1.4, 1.1, P.bronze); // torso
    add(x + 0.5, 6.7, sz + 0.65, 0.9, 0.4, 0.35, P.bronze); // reins arm
    add(x + 1.05, 6.6, sz + 0.65, 0.4, 0.4, 0.4, BRONZE_DK); // hand
    add(x - 0.2, 6.2, sz - 0.65, 0.35, 1, 0.35, P.bronze); // free arm
    add(x - 0.2, 7.6, sz, 0.8, 0.8, 0.8, P.bronze); // head
    add(x - 0.2, 8.4, sz, 0.9, 0.7, 0.9, CONE_ORANGE);
    add(x - 0.2, 9.1, sz, 0.7, 0.3, 0.7, P.white);
    add(x - 0.2, 9.4, sz, 0.5, 0.6, 0.5, CONE_ORANGE);
  }
}

// Green, residential Glasgow edges (own rng, nothing else shifts): the approach between the countryside and George Square (low houses and sandstone flats on the near bank, leaving the museum and university sightlines open) and the Scottish edge after the square.
// [dx from the square, kind (h house, t tenement), setback from the road centre]; the square itself spans dx +-20, so nothing sits there.
const EDGE = [[-104, 'h', 16], [-93, 't', 27], [-82, 'h', 19], [-71, 't', 25], [-60, 'h', 21], [-49, 't', 28], [-38, 'h', 17], [28, 'h', 17], [39, 't', 26], [49, 'h', 20]];
export function buildGlasgowEdges(add, stops, pts, curve, tree, onArchitecturePlot) {
  const r = rng(3319), q = rng(4421), g = pts[stopIndex(stops, LANDMARKS.glasgow)].x, path = Array.from({ length: 241 }, (_, i) => curve.getPointAt(i / 240));
  const zr = (x) => path.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a).z, taken = [], free = (x, z, d) => taken.every(([a, b, c]) => Math.hypot(a - x, b - z) > d + c);
  for (const [dx, kind, back] of EDGE) {
    const x = g + dx + (r() - 0.5) * 2, z = zr(x) - back, w = kind === 'h' ? 8 + r() * 2 : 10, d = kind === 'h' ? 7 + r() * 2 : 9;
    add(x, 0.02, z + 1, w + 6, 0.05, d + 6, P.patch); // lawn round the building
    if (kind === 'h') {
      if (onArchitecturePlot) onArchitecturePlot({ id: `glasgow-house-${dx}`, kind: 'terrace', x, z, width: w, depth: d, height: 2 * 3.1 + (back > 20 ? 0.6 : 2.7) });
      house(onArchitecturePlot ? () => {} : add, q, x, z, 1, w, d, 2, 3.1, back > 20);
    } else draw(add, x, z, [w, d, 2 + (r() < 0.4), 3.4, r() < 0.7 ? P.redSand : P.sandstone, P.white, 0, 1], r, q, false, false, onArchitecturePlot, `glasgow-tenement-${dx}`);
    taken.push([x, z, w / 2 + 2.5]);
  }
  for (let i = 0; i < 46; i++) { // trees: near-bank strip and a few on the camera side (low, <= 4.8 m)
    const x = g + (i % 2 ? 22 + r() * 32 : -108 + r() * 82), north = i % 3 < 2, z = zr(x) + (north ? -(11 + r() * 16) : 11 + r() * 2), h = north ? 2.8 + r() * 1.2 : 2.6 + r() * 0.7, crown = 1.8 + r() * 0.8;
    if (Math.abs(x - g) > 21 || !north ? free(x, z, 2) : false) { tree(add, x, z, { h, crown }); taken.push([x, z, 1.5]); }
  }
  for (const dx of [-100, -86, -72, -58, -44, -30, 26, 40, 52]) { // lamps on the near-bank path and benches facing the road
    const x = g + dx, z = zr(x) - 10.5;
    lampPost(x, z, 0, 'uk');
    if (dx % 4 === 0) { add(x + 3, 0.45, z, 1.6, 0.1, 0.45, P.oak); add(x + 3, 0.55, z - 0.2, 1.6, 0.38, 0.08, P.oak); }
  }
}
