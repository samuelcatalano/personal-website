// Pure camera math (no three import) so node tests can load it.
export const SECTION_SHOT = {
  hero: 'hero', journey: 'follow', stack: 'high', articles: 'high', repos: 'high', recs: 'high', contact: 'closing',
};

// Shots are plain arrays: position and look-at target in world units.
export function shotFor(kind, bus, { mobile = false, lift = 0 }) {
  const k = mobile ? 0.95 : 1;
  const { x, y, z } = bus;
  switch (kind) {
    case 'hero': {
      // Three-quarter street view keeps the bus foreground and the terrace legible.
      return { position: [x + 28 * k, y + 32 * k, z + 45 * k], target: [x + 2, y + 4, z + 4] };
    }
    case 'follow': {
      const L = lift; // 0 keeps the approved street framing exactly
      return {
        position: [x + (20 + 10 * L) * k, y + (29 + 26 * L) * k, z + (50 + 40 * L) * k],
        target: [x + 2, y + 5 + 22 * L, z + 2 - 18 * L],
      };
    }
    case 'high': return { position: [x + 30 * k, y + 34 * k, z + 60 * k], target: [x - 6, y + 6, z - 20] };
    case 'closing': return { position: [x - 7 * k, y + 13 * k, z + 32 * k], target: [x + 1, y + 2.5, z] };
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
