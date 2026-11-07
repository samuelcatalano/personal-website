// Flight of the A330 at the first UK stop, as a pure function of the scroll (no three.js, so node tests can check it against the city).
// `d` is the distance from the stop in stop-lengths of scroll; `u` counts from where the turn starts.
// The flight itself: it crosses close in front of the bus, eases into a gentle left turn away from the camera and recedes over a kilometre toward the
// horizon, climbing into the strip of sky above the skyline (the frame's top edge is about 3.8 degrees above the camera, the skyline tops about 2).
// Flown for real, the recede would cross the buildings beyond the river. So past NEAR metres from the camera it is drawn on the same camera ray but
// no farther than NEAR, scaled down by the same ratio: the picture is identical (same direction, same angular size), and the plane never leaves
// the clear band over the river. Nothing here keeps state, so scrubbing the scroll back and forth cannot make it pop.
export const PLANE_IN = -1.15, TURN_AT = -0.55, PLANE_OUT = TURN_AT + 2.1;
export const NEAR = 80;   // metres from the camera (horizontal) the plane is ever drawn at: over the river in the follow shot
export const SKY = 0.055; // tan of the elevation the recede tends to, seen from the camera: about 3 degrees, above the skyline, below the frame top (3.8)
export const TURN = 2.0, TURN_LEN = 0.9; // the heading swings about 115 degrees left (past straight away, so it recedes toward the middle of the frame), eased over TURN_LEN of scroll
export const HAZE = [350, 900]; // true distance from the camera (metres, before the pull-in) where the horizon tint starts and where it is complete
export const smooth = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

// Motion since the turn began, integrated along a heading that eases in, so the turn starts gently. The straight-pass speed (52 m per stop length)
// is kept until the heading is well past 60 degrees, so the plane does not run off the right edge, then it pulls away. Fixed steps, no state.
function turnOffset(u) {
  const N = 40, du = u / N;
  let X = 0, Z = 0;
  for (let i = 0; i < N; i++) {
    const m = (i + 0.5) * du, h = TURN * smooth(0, TURN_LEN, m), speed = 52 + 900 * Math.max(m - 0.4, 0) ** 2;
    X += Math.cos(h) * speed * du; Z += Math.sin(h) * speed * du;
  }
  return [X, Z];
}

export function flightPath(d, bus, cam) {
  const u = Math.max(d - TURN_AT, 0), [ox, back] = turnOffset(u);
  const x = bus.x + 16 + Math.min(d, TURN_AT) * 52 + ox, z = bus.z - 2 - back; // `back`: metres behind the bus line
  const sky = cam.y - 9 + SKY * Math.hypot(x - cam.x, z - cam.z);  // 9 m under that line, so the tail stays in frame while the plane is still big
  const low = bus.y + 27;                                          // the pass: level, about 27 m up
  return [x, low + (sky - low) * smooth(0.2, 0.8, u), z];
}

// Pose to draw: position, uniform scale factor (1 = full size), heading, nose pitch and bank (radians).
export function planePose(d, bus, cam) {
  const [x, y, z] = flightPath(d, bus, cam), [x2, y2, z2] = flightPath(d + 0.02, bus, cam);
  const dh = Math.hypot(x - cam.x, z - cam.z), k = Math.min(1, NEAR / dh); // pull in along the camera ray
  return {
    x: cam.x + (x - cam.x) * k, y: cam.y + (y - cam.y) * k, z: cam.z + (z - cam.z) * k,
    scale: k * (1 - 0.85 * smooth(TURN_AT + 1.6, PLANE_OUT, d)), // and a speck at the very end, so nothing pops
    dist: dh, // true distance, drives the haze
    heading: Math.atan2(-(z2 - z), x2 - x),
    pitch: Math.min(0.03, Math.max(0, Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z)))), // a hint of climb, never nose-down
    bank: -0.03 * Math.sin(Math.PI * smooth(TURN_AT, TURN_AT + TURN_LEN, d)), // near level: from the high camera any roll reads as tilted or falling
  };
}
