// Pure wheel kinematics, no three.js (so tests/wheel-roll.test.mjs runs in Node). A wheel spins about its own axle (local z): travel of `distance`
// metres turns it by -distance / radius, so forward travel (+x) turns the tread backwards under the car. Ambient axles carry their measured tyre
// radius; authored wheel nodes sit with their centre one radius above the road, so the centre height is the radius.
export const wheelRadius = (w) => w.userData.radius ?? w.position.y;
export function rollWheels(wheels, distance) {
  for (const w of wheels) w.rotation.z -= distance / wheelRadius(w);
}
