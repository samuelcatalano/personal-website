// River-facing side stays at the arch crest through the far bank; only the exit descends.
export const RIVER_WIDTH = 22; // channel width (scene.js createWater width)
export const BRIDGE_H = 7.5; // deck height above ground (road surface + 0.12)
export const DECK_T = 0.4; // slab thickness over the water: soffit at 7.1 m
// Mercury Clippers (ambient.js): GLB top 5.9 m x scale 0.4 = 2.36 m, floating at 0.1 + 0.25 bob, +0.07 roll -> 2.78 m. Soffit 7.1 m leaves 4.32 m of headroom.
export const BOAT_TOP = 2.78;
export const RIVER_EXIT = 28; // land ramp past the far bank
export const RIVER_RUN = RIVER_WIDTH + RIVER_EXIT; // from the near bank to ground level on the far side
export const RIVER_CUT_HW = 3.6; // half width of the bridge body (road half width 3 + 0.6 walkway/parapet)
// eased ramp: straight grade with parabolic ends over a quarter each, peak slope H / (0.75 L) (a smoothstep peaks at 1.5 H / L)
const E = 0.25, smooth = (u) => (u < E ? u * u / (2 * E * (1 - E)) : u > 1 - E ? 1 - (1 - u) ** 2 / (2 * E * (1 - E)) : (u - E / 2) / (1 - E));
export function riverProfile(az, bankAz) {
  const exit = az - bankAz - RIVER_WIDTH;
  if (exit <= 0) return BRIDGE_H;
  return BRIDGE_H * (1 - smooth(Math.min(1, exit / RIVER_EXIT)));
}
