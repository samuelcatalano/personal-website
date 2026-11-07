// Flight of the A330 at the first UK stop, as a pure function of the scroll (no three.js, so node tests can check it against the city).
// `d` is the distance from the stop in stop-lengths of scroll; `u` counts from where the turn starts.
// The flight itself: it crosses close in front of the bus, eases into a gentle left turn away from the camera and recedes about 800 m toward the
// horizon, climbing into the strip of sky above the skyline (the frame's top edge is about 3.8 degrees above the camera, the skyline tops about 2).
// Flown for real, the recede would cross the buildings beyond the river. So past NEAR metres from the camera it is drawn on the same camera ray but
// no farther than NEAR, scaled down by the same ratio: the picture is identical (same direction, same angular size), and the plane never leaves
// the clear band over the river. Nothing here keeps state, so scrubbing the scroll back and forth cannot make it pop.
export const PLANE_IN = -1.15, TURN_AT = 0.1, PLANE_OUT = TURN_AT + 1.4;
export const NEAR = 80;   // metres from the camera (horizontal) the plane is ever drawn at: over the river in the follow shot
export const DRIFT = 0.5; // how far left (metres per metre receded) the turn carries it
export const SKY = 0.055; // tan of the elevation the recede tends to, seen from the camera: about 3 degrees, above the skyline, below the frame top (3.8)
export const smooth = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

export function flightPath(d, bus, cam) {
  const u = Math.max(d - TURN_AT, 0), back = u * u * 400;  // metres behind the bus line: slow at first, so the heading swings gradually
  const x = bus.x + 16 + d * 52 - DRIFT * back, z = bus.z - 2 - back;  // the turn keeps swinging left, so it recedes toward the middle of the frame
  const sky = cam.y - 9 + SKY * Math.hypot(x - cam.x, z - cam.z);  // 9 m under that line, so the tail stays in frame while the plane is still big
  const low = bus.y + 25 - 3 * Math.min(d, 0);              // the pass: about 25 m up, a slow descent toward the bus
  return [x, low + (sky - low) * smooth(0, 0.6, u), z];
}

// Pose to draw: position, uniform scale factor (1 = full size), heading, nose pitch and bank (radians).
export function planePose(d, bus, cam) {
  const [x, y, z] = flightPath(d, bus, cam), [x2, y2, z2] = flightPath(d + 0.02, bus, cam);
  const dh = Math.hypot(x - cam.x, z - cam.z), k = Math.min(1, NEAR / dh); // pull in along the camera ray
  return {
    x: cam.x + (x - cam.x) * k, y: cam.y + (y - cam.y) * k, z: cam.z + (z - cam.z) * k,
    scale: k * (1 - 0.85 * smooth(TURN_AT + 1.2, PLANE_OUT, d)), // and a speck at the very end, so nothing pops
    heading: Math.atan2(-(z2 - z), x2 - x),
    pitch: Math.min(0.08, Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z))),
    bank: -0.08 * Math.sin(Math.PI * smooth(TURN_AT, TURN_AT + 0.7, d)), // barely: a strong bank read as falling
  };
}
