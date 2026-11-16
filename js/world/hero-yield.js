// Pure helper for ambient cars that cross the hero's lane (Ponte Estaiada junction): where along a path does it first enter the lane band?
// `offsets` are lateral distances (m, + = hero side) of evenly spaced samples along the path; returns the path fraction 0..1, or -1 when it never enters.
export function firstInBand(offsets, lo, hi) {
  const i = offsets.findIndex((o) => o >= lo && o <= hi);
  return i < 0 ? -1 : i / (offsets.length - 1);
}
