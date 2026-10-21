import { PALETTE as P } from './palette.js';

const STONE = '#b49a74', STONE_LT = '#c8b088', SLATE = '#4a4d54', SPIRE = '#2a2d34', WIN = '#2b2620', LIT_WIN = '#2b2621'; // LIT_WIN glows warm at night

// University of Glasgow main building (Gilbert Scott): sandstone range, slate roofs, turrets, tall tower + spire.
export function buildUniversity(add, { x, z }, create) {
  const fz = z + 6; // range front face
  add(x, 0, fz + 0.1, 10, 0.5, 0.2, '#ffd86b'); // floodlight uplight band at the base
  for (const s of [-1, 1]) add(x + s * 19.5, 0, fz + 0.1, 29, 0.5, 0.2, '#ffd86b');
  if (create) return create({ x, z }); // ponytail: voxel body kept as the fallback for headless tests that pass no geometry callback
  // range: left/right wings and central link
  for (const s of [-1, 1]) {
    add(x + s * 19.5, 0, z, 29, 10, 12, STONE);
    add(x + s * 19.5, 10, z, 29.6, 0.5, 12.6, STONE_LT); // cornice
    for (const [w, d, y] of [[29.4, 12.4, 10.5], [29, 9.4, 12.5], [28.6, 6.4, 14.5], [28.2, 3.4, 16]]) add(x + s * 19.5, y, z, w, 2, d, SLATE);
  }
  add(x, 0, z, 10, 9, 12, STONE);
  add(x, 9, z, 10.6, 0.5, 12.6, STONE_LT);
  add(x, 9.5, z, 10.4, 2.5, 12.4, SLATE);
  // gothic windows: tall bay with pointed head, upper row smaller
  for (const s of [-1, 1]) for (const dx of [7.5, 10.5, 13.5, 16.5, 19.5, 22.5, 25.5, 28.5, 31.5]) {
    const wx = x + s * dx;
    add(wx, 1.2, fz + 0.05, 1.2, 4.6, 0.15, LIT_WIN);
    add(wx, 5.8, fz + 0.05, 0.6, 0.9, 0.15, LIT_WIN);
    add(wx, 7, fz + 0.05, 1, 1.8, 0.15, LIT_WIN);
    add(wx, 1, fz + 0.12, 0.25, 3.5, 0.1, STONE_LT); // mullion hint
  }
  // end pavilions with gables and corner turrets
  for (const s of [-1, 1]) {
    add(x + s * 33.2, 0, z + 2, 3.6, 13, 8, STONE);
    for (const [w, y] of [[3.8, 13], [2.6, 14.5], [1.4, 16]]) add(x + s * 33.2, y, z + 2, w, 1.5, w * 2, SLATE);
    for (const tx of [30.5, 34.8]) {
      add(x + s * tx, 0, fz + 0.2, 1.6, 11.5, 1.6, STONE);
      for (const [w, y] of [[1.9, 11.5], [1.3, 13], [0.8, 14.5], [0.4, 15.7]]) add(x + s * tx, y, fz + 0.2, w, 1.5, w, SPIRE);
    }
  }
  // central tower: base, belfry, corner pinnacles, stepped spire
  const tz = z + 3;
  add(x, 0, tz, 8, 17, 8, STONE);
  add(x, 17, tz, 7, 6, 7, STONE_LT);
  add(x, 23, tz, 8.2, 0.6, 8.2, STONE); // cornice
  add(x, 8, tz + 4.05, 1.6, 6, 0.15, LIT_WIN); // big front window
  add(x, 14, tz + 4.05, 1.6, 2, 0.15, P.lit);
  for (const dx of [-1.8, 1.8]) add(x + dx, 18.5, tz + 3.55, 1.1, 3.8, 0.15, LIT_WIN); // belfry lancets
  add(x, 12, tz + 4.05, 3, 0.4, 0.3, STONE_LT);
  for (const [px, pz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) {
    for (const [w, y, hh] of [[1.2, 23.6, 2.6], [0.8, 26.2, 1.4], [0.4, 27.6, 1.3]]) add(x + px, y, tz + pz, w, hh, w, SPIRE);
  }
  add(x, 23.6, tz, 5.6, 1.2, 5.6, SLATE); // spire base
  for (const [w, y, hh] of [[4.4, 24.8, 1.6], [3.6, 26.4, 1.6], [2.8, 28, 1.6], [2.0, 29.6, 1.5], [1.4, 31.1, 1.3], [0.9, 32.4, 1.0]]) add(x, y, tz, w, hh, w, SPIRE);
  add(x, 33.4, tz, 0.3, 1.3, 0.3, '#fff7c2'); // finial
}
