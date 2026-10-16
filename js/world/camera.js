// Pure camera math (no three import) so node tests can load it.
export const SECTION_SHOT = {
  hero: 'hero', journey: 'follow', stack: 'high', articles: 'high', repos: 'high', recs: 'high', contact: 'closing',
};

// Shots are plain arrays: position and look-at target in world units.
export function shotFor(kind, bus, { mobile = false }) {
  const k = mobile ? 1.15 : 1;
  const { x, y, z } = bus;
  switch (kind) {
    case 'hero': {
      // Look down the route so the bus stays foreground and London forms the backdrop.
      return { position: [x - 45 * k, 26 * k, z + 24 * k], target: [x + 22, 4, z - 8] };
    }
    case 'follow': return { position: [x + 14 * k, y + 24 * k, z + 58 * k], target: [x, y + 5, z - 18] };
    case 'high': return { position: [x + 30 * k, y + 34 * k, z + 60 * k], target: [x - 6, y + 6, z - 20] };
    case 'closing': return { position: [x - 6 * k, y + 18 * k, z + 42 * k], target: [x + (mobile ? 6 : -2), y + 10, z - 60] };
    default: throw new Error(`unknown shot ${kind}`);
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
function aim({ position: p, target: q }) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const len = Math.hypot(...d) || 1;
  return { yaw: Math.atan2(d[2], d[0]), pitch: Math.asin(d[1] / len), len };
}

// Position moves in a straight line plus a sin arc; the view direction turns by yaw/pitch the short way.
export function blendShots(a, b, t, arc = 0) {
  const u = t * t * (3 - 2 * t);
  const A = aim(a), B = aim(b);
  const dyaw = ((B.yaw - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const yaw = A.yaw + dyaw * u, pitch = lerp(A.pitch, B.pitch, u), len = lerp(A.len, B.len, u);
  const position = a.position.map((v, i) => lerp(v, b.position[i], u));
  position[1] += Math.sin(Math.PI * u) * arc;
  const target = [
    position[0] + Math.cos(yaw) * Math.cos(pitch) * len,
    position[1] + Math.sin(pitch) * len,
    position[2] + Math.sin(yaw) * Math.cos(pitch) * len,
  ];
  return { position, target };
}

// Critically damped spring (SmoothDamp). dt <= 0 snaps, which gives the first frame its exact position.
export function spring(state, target, dt, smoothTime) {
  if (dt <= 0 || smoothTime <= 0) return { value: target, velocity: 0 };
  const omega = 2 / smoothTime, x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const temp = (state.velocity + omega * change) * dt;
  const value = target + (change + temp) * exp;
  if ((target - state.value > 0) === (value > target)) return { value: target, velocity: 0 }; // no overshoot
  return { value, velocity: (state.velocity - omega * temp) * exp };
}

// Linear approach capped at rate per second (day/night fade).
export const approach = (current, target, dt, rate) =>
  current + Math.max(-rate * dt, Math.min(rate * dt, target - current));
