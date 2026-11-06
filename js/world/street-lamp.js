// Street lamps. city.js / parks.js / glasgow.js call lampPost(x, z, yaw, style); scene.js builds the instanced posts once
// via buildLampPosts() (geometry in lamp-mesh.js, loaded lazily so node tests need no three). style: 'uk' heritage lantern, 'br' modern arm.
const spots = [], every = []; // every: permanent copy (spots is spliced by buildLampPosts) so the night light pools can cover park/Glasgow lamps too
import { east } from './layout.js';
// ponytail: every caller runs inside city.js's legacy pass, so x is legacy; a caller on the real route would need its own entry point
export function lampPost(lx, z, yaw = 0, style = 'uk') { const x = east(lx); spots.push([x, z, yaw, style]); every.push([x, z]); }
// A light pool only, on the real route (x already real), `scale` x the usual size: the lantern on the fingerpost over the SP -> London tunnel (city.js)
export function lampPoolAt(x, z, scale = 1) { every.push([x, z, scale]); }
export const allLampSpots = () => every.map(([x, z, s = 1]) => [x, z, s]);
export const lampSpots = () => spots.map(([x, z]) => [x, z]); // read-only copy for street-props.js clearance
export async function buildLampPosts() {
  if (!spots.length) return null;
  return (await import('./lamp-mesh.js')).buildLamps(spots.splice(0));
}
