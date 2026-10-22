// Street lamps. city.js / parks.js / glasgow.js call lampPost(x, z, yaw, style); scene.js builds the instanced posts once
// via buildLampPosts() (geometry in lamp-mesh.js, loaded lazily so node tests need no three). style: 'uk' heritage lantern, 'br' modern arm.
const spots = [];
export function lampPost(x, z, yaw = 0, style = 'uk') { spots.push([x, z, yaw, style]); }
export async function buildLampPosts() {
  if (!spots.length) return null;
  return (await import('./lamp-mesh.js')).buildLamps(spots.splice(0));
}
