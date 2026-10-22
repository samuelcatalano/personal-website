// Red K6-style kiosk. city.js calls phoneBox(add, x, z); positions are collected here and scene.js builds the instanced kiosks
// once via buildPhoneBoxes() (geometry in kiosk-mesh.js, loaded lazily so node tests need no three).
const spots = [];
export function phoneBox(_add, x, z, yaw = 0) { spots.push([x, z, yaw]); }
export async function buildPhoneBoxes() {
  if (!spots.length) return null;
  const group = (await import('./kiosk-mesh.js')).buildKiosks(spots.splice(0));
  return group;
}
