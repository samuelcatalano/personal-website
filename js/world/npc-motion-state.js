const PROFILES = [
  { name: 'relaxed', armSwing: .8, lean: -.005, shift: .014 },
  { name: 'purposeful', armSwing: 1.12, lean: .035, shift: .008 },
  { name: 'compact', armSwing: .6, lean: .015, shift: .010 },
].map(Object.freeze);

export const motionProfile = id => PROFILES[((id % 3) + 3) % 3];

// Keep a staggered 20 Hz deadline, carrying both fractional time and all mixer delta.
export function animationDue(state, dt, near, fresh, slot) {
  state.acc = (fresh ? 0 : state.acc || 0) + dt;
  if (fresh || near) { state.due = (slot % 5 + 1) * .01; return true; }
  state.due -= dt;
  if (state.due > 1e-8) return false;
  state.due += .05;
  if(state.due<=0)state.due=.05; // Skip missed poses after a stall; mixer delta still includes the whole interval.
  return true;
}
