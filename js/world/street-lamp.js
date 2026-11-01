// Street lamps. city.js / parks.js / glasgow.js call lampPost(x, z, yaw, style); scene.js builds the instanced posts once
// via buildLampPosts() (geometry in lamp-mesh.js, loaded lazily so node tests need no three). style: 'uk' heritage lantern, 'br' modern arm.
const spots = [], every = []; // every: permanent copy (spots is spliced by buildLampPosts) so the night light pools can cover park/Glasgow lamps too
export function lampPost(x, z, yaw = 0, style = 'uk') { spots.push([x, z, yaw, style]); every.push([x, z]); }
export const allLampSpots = () => every.map(([x, z]) => [x, z]);
export const lampSpots = () => spots.map(([x, z]) => [x, z]); // read-only copy for street-props.js clearance
export async function buildLampPosts() {
  if (!spots.length) return null;
  return (await import('./lamp-mesh.js')).buildLamps(spots.splice(0));
}
