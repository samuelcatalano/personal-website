// Ambient airliner: OFFSCREEN -> ENTER -> CRUISE -> EXIT -> COOLDOWN, independent of stops and the bus.
// No three import: the pure state function runs under node:test and the rest only uses plain object props.
const hash = (seed, k, j) => { let h = Math.imul(seed + k * 7919 + j * 104729 + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const ENTER = 4, EXIT = 4; // bank-in / bank-out segments (s)
const cycleTimes = (seed, k) => ({
  lead: k === 0 ? 1 + hash(seed, 0, 0) * 7 : 0, // first appearance within 8 s of load
  cruise: 27 + hash(seed, k, 1) * 6, // enter + cruise + exit = 35-45 s
  cooldown: 25 + hash(seed, k, 2) * 20,
});
export const flightPhase = (time, seed = 1) => {
  let t0 = 0;
  for (let k = 0; ; k++) {
    const { lead, cruise, cooldown } = cycleTimes(seed, k), fly = ENTER + cruise + EXIT, end = t0 + lead + fly + cooldown, s = time - t0 - lead;
    if (time < end) {
      if (s < 0) return { phase: 'offscreen', u: 0, p: 0, cycle: k };
      if (s < ENTER) return { phase: 'enter', u: s / fly, p: s / ENTER, cycle: k };
      if (s < ENTER + cruise) return { phase: 'cruise', u: s / fly, p: 0.5, cycle: k };
      if (s < fly) return { phase: 'exit', u: s / fly, p: (s - ENTER - cruise) / EXIT, cycle: k };
      return { phase: 'cooldown', u: 1, p: 1, cycle: k };
    }
    t0 = end;
  }
};
const BANK = 0.16; // half path length ; max roll (rad)
export function createAircraft(model, { reducedMotion = false, seed = 1, scale = 1 } = {}) {
  let path = null;
  model.visible = false;
  model.rotation.order = 'YXZ';
  const pick = (cycle, camera) => {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    let fx = -e[8], fz = -e[10]; const l = Math.hypot(fx, fz);
    if (l < 1e-3) { fx = 1; fz = 0; } else { fx /= l; fz /= l; }
    // The follow cameras look slightly down, so a 55-70 m plane only lands in the upper frame far ahead: aim at a ray ~NDC y 0.55-0.8 and solve the distance for the altitude.
    const th = (30 + hash(seed, cycle, 4) * 30) * Math.PI / 180, sg = hash(seed, cycle, 5) < 0.5 ? -1 : 1, camY = camera.position.y;
    const el = Math.asin(Math.max(-1, Math.min(1, -e[9]))) + Math.atan((0.55 + hash(seed, cycle, 7) * 0.25) * Math.tan(camera.fov * Math.PI / 360)), want = 55 + hash(seed, cycle, 6) * 15;
    const D = el > 0.01 ? Math.min(550, Math.max(150, (want - camY) / Math.tan(el))) : 550; // ponytail: nothing above the camera is framed when it looks fully downward, the plane then just stays off-screen
    const alt = Math.max(want * 0.8, Math.min(want, camY + D * Math.tan(Math.max(el, 0.01))));
    const half = 330 + D * 0.8; // both ends fall outside the frame at any distance
    const cx = camera.position.x + fx * D, cz = camera.position.z + fz * D;
    const dx = fx * Math.cos(th) - sg * fz * Math.sin(th), dz = fz * Math.cos(th) + sg * fx * Math.sin(th);
    path = { cycle, half, ax: cx - dx * half, az: cz - dz * half, dx, dz, y: alt, yaw: Math.atan2(-dz, dx) }; // nose is +x
  };
  return {
    object: model,
    shadow: model.userData.shadow,
    update(time, camera, night = 0) {
      const f = reducedMotion ? { phase: 'offscreen' } : flightPhase(time, seed);
      model.visible = f.phase === 'enter' || f.phase === 'cruise' || f.phase === 'exit';
      const sh = model.userData.shadow;
      if (sh) sh.visible = model.visible && night < 0.9;
      if (!model.visible) return;
      if (path?.cycle !== f.cycle) pick(f.cycle, camera);
      const d = f.u * 2 * path.half;
      model.position.set(path.ax + path.dx * d, path.y, path.az + path.dz * d);
      const bank = f.phase === 'enter' ? BANK * (1 - f.p) : f.phase === 'exit' ? -BANK * f.p : 0;
      model.rotation.set(bank, path.yaw, 0);
      const { nav, strobe } = model.userData;
      if (nav) { nav.visible = night > 0.35; strobe.visible = night > 0.35 && time % 1.3 < 0.12; } // red left / green right steady, white strobe blinks
      if (sh) { // soft blob on the ground under the plane: bigger and fainter the higher it flies
        sh.position.set(model.position.x, 0.14, model.position.z); sh.rotation.y = path.yaw;
        sh.scale.set(34 + path.y * 0.3, 1, 15 + path.y * 0.15); sh.material.opacity = 0.3 * (1 - night) * Math.min(1, 55 / path.y) ** 2;
      }
      model.scale.setScalar(scale * (f.phase === 'enter' ? 0.97 + 0.03 * f.p : f.phase === 'exit' ? 1 - 0.03 * f.p : 1));
    },
  };
}
