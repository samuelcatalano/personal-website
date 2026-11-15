// World-space offsets are applied to emitted lot descriptors before scene collection.
// Raw legacy geometry calls without a descriptor callback intentionally keep source coordinates.
export const ARCHITECTURE_LAYOUT_OFFSETS = Object.freeze({
  'block-713--43-3': Object.freeze({ dx: 2, dz: -7 }),
  'block-713--43-4': Object.freeze({ dx: 2, dz: -7 }),
  'block-746--47': Object.freeze({ dx: 15, dz: 55 }),
  'frontage-gap-glasgow-585--1-0': Object.freeze({ dx: -9.5, dz: -8.5 }),
  'gap-47--98-0': Object.freeze({ dx: 12.5, dz: 0 }),
  'wembley-side--34--64': Object.freeze({ dx: -6.5, dz: 9.5 }),
  'wembley-side--48--68': Object.freeze({ dx: -31.5, dz: -23.5 }),
});

export function applyArchitectureLayoutOffset(plot) {
  const offset = ARCHITECTURE_LAYOUT_OFFSETS[plot.id];
  return offset ? { ...plot, x: plot.x + offset.dx, z: plot.z + offset.dz } : plot;
}
