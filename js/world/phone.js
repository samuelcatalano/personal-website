// Red K6-style kiosk. city.js calls phoneBox(add, x, z); positions are collected here and scene.js builds the instanced kiosks
// once via buildPhoneBoxes() (geometry in kiosk-mesh.js, loaded lazily so node tests need no three).
const spots = [];
import { east } from './layout.js';
export function phoneBox(_add, x, z, yaw = 0) { spots.push([east(x), z, yaw]); } // x is legacy: only city.js's legacy pass calls it
export const kioskSpots = () => spots.map(([x, z]) => [x, z]);
export async function buildPhoneBoxes() {
  if (!spots.length) return null;
  const group = (await import('./kiosk-mesh.js')).buildKiosks(spots.splice(0));
  return group;
}
