import { draw } from './blocks.js';
import { rng } from './layout.js';
import { PALETTE as P } from './palette.js';

// Surveyed in real world coordinates; append after parks so existing lots, props and RNG stay fixed.
// [name, x, z, width, depth, floors, kind, region]
export const URBAN_INFILL = [
  ['west-house-0', -342, -9, 6, 7, 2, 'terrace', 'paulista'],
  ['west-house-1', -330, -9, 6, 7, 2, 'terrace', 'paulista'],
  ['west-house-2', -318, -9, 6, 7, 2, 'terrace', 'paulista'],
  ['west-house-3', -346, -21, 6, 7, 2, 'terrace', 'paulista'],
  ['west-house-4', -334, -21, 6, 7, 2, 'terrace', 'paulista'],
  ['west-house-5', -322, -21, 6, 7, 2, 'terrace', 'paulista'],
  ['west-shop-0', -330, -33, 6, 7, 2, 'shop', 'paulista'],
  ['west-shop-1', -318, -33, 6, 7, 2, 'shop', 'paulista'],
  ['west-flat-0', -338, -51, 8, 8, 4, 'midrise', 'paulista'],
  ['west-flat-1', -306, -51, 8, 8, 5, 'midrise', 'paulista'],
  ['paulista-rear-0', -182, -81, 8, 7, 6, 'midrise', 'paulista'],
  ['paulista-rear-1', -170, -81, 8, 7, 5, 'midrise', 'paulista'],
  ['london-rear-0', 242, -105, 8, 8, 4, 'midrise', 'london'],
  ['london-rear-1', 254, -104, 8, 8, 5, 'midrise', 'london'],
  ['london-edge-0', 254, -6, 6, 7, 2, 'terrace', 'london'],
  ['london-edge-1', 254, 30, 6, 7, 2, 'terrace', 'london'],
  ['clyde-edge', 358, -15, 6, 7, 2, 'terrace', 'countryside'],
  ['glasgow-edge-0', 366, 33, 6, 7, 2, 'terrace', 'glasgow'],
  ['glasgow-edge-1', 506, 30, 6, 7, 2, 'terrace', 'glasgow'],
  ['return-cottage-0', 555, 31, 6, 7, 2, 'terrace', 'countryside'],
  ['return-cottage-1', 598, 30, 6, 7, 2, 'terrace', 'countryside'],
  ['return-house-0', 618, -22, 6, 7, 2, 'terrace', 'countryside'],
  ['return-house-1', 630, -22, 6, 7, 2, 'terrace', 'london'],
  ['return-house-2', 642, -22, 6, 7, 2, 'terrace', 'london'],
  ['return-house-3', 634, -12, 6, 7, 2, 'terrace', 'london'],
  ['return-flat', 626, -84, 8, 8, 5, 'midrise', 'london'],
  ['west-office', -406, -115, 8, 8, 7, 'office', 'paulista'],
];

export function buildUrbanInfill(add, onArchitecturePlot) {
  const r = rng(11122026), kinds = { terrace: 3, shop: 2, midrise: 0, office: 1 };
  URBAN_INFILL.forEach(([name, x, z, width, depth, floors, kind, region], i) => {
    const emit = onArchitecturePlot && (plot => onArchitecturePlot({ ...plot, region }));
    const wall = [P.cream, P.ochre, P.mint, P.terracotta, P.sandstone][i % 5];
    draw(add, x, z, [width, depth, floors, 3.2, wall, P.white, kinds[kind], 1], r, r, floors === 2, false, emit, `urban-infill-${name}`);
  });
}
