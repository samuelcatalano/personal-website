import { PALETTE as P } from './palette.js';

const CONE_ORANGE = '#f36b21';

// z is the road centre; George Square sits on its far-side (-z) edge.
export function buildGlasgow(add, { x, z: roadZ }) {
  const squareZ = roadZ - 28, chambersZ = roadZ - 41;

  add(x, 0.01, squareZ, 40, 0.14, 22, P.gravel);
  add(x, 0.16, squareZ, 5, 0.04, 22, P.pave);
  add(x, 0.16, squareZ, 40, 0.04, 3, P.pave);
  for (const [dx, dz, w, d] of [[-14, -6, 8, 4], [14, -6, 8, 4], [-14, 6, 8, 4], [14, 6, 8, 4]]) {
    add(x + dx, 0.16, squareZ + dz, w, 0.2, d, P.grass);
  }
  for (const dx of [-17, -11, 11, 17]) {
    for (const dz of [-8, 8]) {
      add(x + dx, 0.2, squareZ + dz, 0.7, 3, 0.7, P.trunk);
      add(x + dx, 3.1, squareZ + dz, 3.5, 3.5, 3.5, P.leaf);
    }
  }

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

  // Duke of Wellington: pedestal, horse and rider; cone is the Glasgow in-joke.
  const statueZ = roadZ - 20;
  add(x, 0, statueZ, 4.8, 1.1, 4.8, P.concrete);
  add(x, 1.1, statueZ, 3.4, 1.5, 3.4, P.stone);
  add(x, 2.6, statueZ, 2.5, 0.5, 2.5, P.bronze);
  add(x, 3.1, statueZ, 4.8, 1.5, 1.8, P.bronze);
  add(x + 1.45, 4.3, statueZ, 1.2, 1.4, 1.3, P.bronze);
  add(x + 2.3, 4, statueZ, 1.1, 1.6, 1.4, P.bronze);
  add(x + 2.9, 5, statueZ, 1.2, 0.8, 1, P.bronze);
  add(x + 2.65, 5.8, statueZ - 0.35, 0.4, 0.6, 0.35, P.bronze);
  add(x + 2.95, 5.8, statueZ + 0.35, 0.4, 0.6, 0.35, P.bronze);
  add(x - 2.65, 4.2, statueZ, 0.7, 0.8, 0.7, P.bronze);
  add(x - 1.5, 2.7, statueZ - 0.6, 0.65, 1.3, 0.65, P.bronze);
  add(x - 1.5, 2.7, statueZ + 0.6, 0.65, 1.3, 0.65, P.bronze);
  add(x + 1.4, 2.7, statueZ - 0.6, 0.65, 1.3, 0.65, P.bronze);
  add(x + 1.4, 2.7, statueZ + 0.6, 0.65, 1.3, 0.65, P.bronze);
  add(x - 0.4, 4.6, statueZ, 1, 3, 1, P.bronze);
  add(x + 0.45, 6.3, statueZ, 1.5, 0.45, 0.45, P.bronze);
  add(x - 0.4, 7.6, statueZ, 1.3, 1.2, 1.3, P.bronze);
  add(x - 0.4, 8.8, statueZ, 1.1, 0.95, 1.1, CONE_ORANGE);
  add(x - 0.4, 9.75, statueZ, 0.9, 0.34, 0.9, P.white);
  add(x - 0.4, 10.09, statueZ, 0.6, 0.7, 0.6, CONE_ORANGE);
}
