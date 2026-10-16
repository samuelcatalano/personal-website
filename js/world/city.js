import { RIVER_Z, LANDMARKS, rng, riverEnd, riverStart } from './layout.js';
import { PALETTE as P } from './palette.js';
const PATCH = P.patch, ROAD = P.road, LINE = P.cream;
const BANK = P.taupe, PATH = P.stone, CREAM = P.cream;
const UK_WALLS = [CREAM, '#d8d0c2', P.stone];
const BR_WALLS = [P.stone, '#d8d0c2', '#bdb3a4'];
const ROOF = P.roof, ROOFS = [P.brick, P.roof, P.oak, P.steel], // ponytail: tint by position keeps r() sequence
   GLASS = P.glass, WINDOW_LIT = P.lit;
const TRUNK = P.trunk, LEAF = P.leaf, LEAF_SHADE = P.grass, PHONE = P.red;
function townhouse(add, x, z, side, br, r, roofStacks) {
  const w = 9, d = 7, floors = side === 1 ? 2 : br ? 2 + (r() < 0.25) : 2 + (r() < 0.6 ? 1 : 0);
  const h = floors * 2.8, wall = (br ? BR_WALLS : UK_WALLS)[Math.floor(r() * (br ? BR_WALLS.length : UK_WALLS.length))];
  const face = z - side * (d / 2 + 0.08);
  add(x, 0, z, w, h, d, wall);
  add(x, 0, z, w + 0.2, 0.38, d + 0.2, ROOF);
  add(x, h - 0.25, z, w + 0.45, 0.3, d + 0.45, CREAM);
  const rc = ROOFS[Math.abs(Math.round(x * 0.37 + z * 0.11)) % ROOFS.length];
  add(x, h, z, w + 0.7, 0.42, d + 0.7, rc);
  add(x, h + 0.42, z, w * 0.74, 0.32, d * 0.72, rc);
  const stacks = roofStacks && side === 1;
  if (!br && r() < 0.5) { const sx = r() < 0.5 ? -2.4 : 2.4; if (!stacks) add(x + sx, h + 0.7, z, 0.65, 1.1, 0.7, ROOF); }
  if (stacks) {
    for (const dx of [-(w * 0.37 - 0.5), w * 0.37 - 0.5]) {
      add(x + dx, h + 0.74, z, 0.9, 1.1, 0.7, BANK);
      add(x + dx, h + 1.84, z, 0.3, 0.35, 0.3, ROOF);
    }
    add(x, h + 0.74, z - side * (d * 0.36 - 0.12), w * 0.74, 0.28, 0.16, CREAM);
  }
  for (const dx of [-w / 2 + 0.18, w / 2 - 0.18]) add(x + dx, 0.42, face, 0.22, h - 0.72, 0.18, BANK);
  for (let floor = 0; floor < floors; floor++) {
    add(x, 0.42 + floor * 2.8, face, w, 0.12, 0.22, BANK);
    for (const dx of [-2.15, 2.15]) {
      const y = 0.65 + floor * 2.8, lit = r() < 0.08;
      add(x + dx, y, face, 1.5, 1.9, 0.16, CREAM);
      add(x + dx, y + 0.18, face - side * 0.1, 1.12, 1.48, 0.08, lit ? WINDOW_LIT : GLASS);
      add(x + dx, y + 0.18, face - side * 0.15, 0.12, 1.52, 0.12, BANK);
      add(x + dx, y + 0.86, face - side * 0.15, 1.16, 0.12, 0.12, BANK);
      add(x + dx, y + 0.08, face - side * 0.2, 1.7, 0.18, 0.42, BANK);
      if (br && floor > 0) add(x + dx, y - 0.18, face - side * 0.24, 1.65, 0.16, 0.5, PATH);
    }
  }
  add(x, 0.12, face, 1.55, 2.38, 0.2, CREAM);
  add(x, 0.25, face - side * 0.14, 1.12, 2.02, 0.1, ROOF);
  add(x, 1.7, face - side * 0.21, 0.18, 0.18, 0.08, WINDOW_LIT);
  add(x, 2.48, face - side * 0.12, 1.7, 0.2, 0.34, BANK);
  add(x, 0.2, face - side * 0.12, 1.72, 0.18, 0.34, BANK);
}
function broadleaf(add, x, z, r) {
  const h = 2.6 + r() * 0.6, crown = 1.8 + r() * 0.5;
  add(x, 0, z, 0.32, h, 0.32, TRUNK);
  add(x, h - 0.4, z, crown, 1.1, crown, LEAF);
  add(x - crown * 0.22, h + 0.2, z + crown * 0.16, crown * 0.52, 1, crown * 0.52, LEAF_SHADE);
  add(x + crown * 0.2, h + 0.15, z - crown * 0.2, crown * 0.48, 0.9, crown * 0.48, LEAF);
}
function palm(add, x, z) {
  add(x, 0, z, 0.45, 4.2, 0.45, TRUNK);
  for (const [dx, dz, w, d] of [[2, 0, 3.8, 0.65], [-2, 0, 3.8, 0.65], [0, 2, 0.65, 3.8], [0, -2, 0.65, 3.8]]) {
    add(x + dx * 0.35, 4.1, z + dz * 0.35, w, 0.35, d, LEAF);
  }
}
export function buildCity(add, stops, pts, curve) {
  const r = rng(2026), LM = new Set(Object.values(LANDMARKS));
  const span = pts.length * 30 + 120, N = pts.length * 20;
  add(0, -1, 0, span, 1, 200, P.pave);
  const x0 = riverStart(stops, pts), rEnd = riverEnd(stops, pts), mid = (x0 + rEnd) / 2, len = rEnd - x0;
  for (const side of [-1, 1]) {
    const edge = RIVER_Z + side * 12;
    add(mid, -0.08, edge, len, 0.18, 2.2, BANK);
    add(mid, 0.02, edge + side * 2.1, len, 0.12, 3.2, PATH);
    for (let x = x0 + 7; x < rEnd; x += 18) {
      add(x, 0.02, edge + side * 3.1, 1.2, 0.42, 0.7, PATCH);
      add(x + 1.3, 0.02, edge + side * 3.1, 0.55, 0.7, 0.55, LEAF);
    }
  }
  for (let i = 0; i <= N; i += 2) {
    const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N);
    const nx = -t.z, nz = t.x;
    add(p.x, -0.18, p.z, 8.5, 0.25, 8.5, ROAD);
    if (i % 6 === 0) add(p.x, 0.05, p.z, 1.2, 0.03, 0.3, LINE);
    if (i % 16 === 8) {
      for (const side of [-1, 1]) {
        const x = p.x + nx * side * 9.4, z = p.z + nz * side * 9.4;
        add(x, 0, z, 0.16, 3, 0.16, ROOF);
        add(x, 3, z, 0.7, 0.2, 0.7, WINDOW_LIT);
      }
    }
  }
  for (let i = 0; i <= N * 2; i++) {
    const p = curve.getPointAt(i / (N * 2)), t = curve.getTangentAt(i / (N * 2));
    const nx = -t.z, nz = t.x;
    for (const side of [-1, 1]) {
      add(p.x + nx * side * 4.55, -0.01, p.z + nz * side * 4.55, 1.5, 0.18, 1.5, BANK);
      add(p.x + nx * side * 7.1, -0.02, p.z + nz * side * 7.1, 3.3, 0.12, 3.3, PATH);
    }
  }
  pts.forEach((p, i) => {
    const br = stops[i].country === 'BR' && i >= 2;
    for (const side of [-1, 1]) {
      add(p.x, 0, p.z + side * 10.5, 25, 0.035, 3.2, PATCH);
      if (side === -1 && LM.has(stops[i].id)) continue;
      for (const dx of [-9, 0, 9]) {
        if (side === 1 && stops[i].id === 'contact' && dx === 0) continue;
        townhouse(add, p.x + dx, p.z + side * (side === 1 ? 21 : 17), side, br, r, i >= 2);
      }
      for (const dx of [-8, 8]) {
        const x = p.x + dx + (r() - 0.5) * 2, z = p.z + side * 10.2;
        br ? palm(add, x, z) : broadleaf(add, x, z, r);
      }
      if (!br && i % 2 === 0) {
        add(p.x + 4, 0, p.z + side * 11.2, 1.2, 2.5, 1.2, PHONE);
        add(p.x + 4, 2.5, p.z + side * 11.2, 1.4, 0.3, 1.4, ROOF);
      }
    }
  });
}
