import { SWAP_TUNNEL } from './layout.js';
// Which side of the centre line the hero's lane is on. The lateral axis (tangent.z, -tangent.x) points to the LEFT of travel, so +1 = drive on the left
// (UK) and -1 = drive on the right (Brazil). It crosses over smoothly while the vehicle is under the SP -> London tunnel cover (+-SWAP_TUNNEL.half).
// s: metres along the route from the tunnel centre, positive towards London. ponytail: one smoothstep for hero and ambient traffic alike.
export function laneSide(s) {
  const k = (Math.max(-1, Math.min(1, s / SWAP_TUNNEL.half)) + 1) / 2;
  return -1 + 2 * k * k * (3 - 2 * k);
}
