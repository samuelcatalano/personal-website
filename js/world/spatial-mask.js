const overlaps = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

// Index low walkable slabs once. Query the actual rotated footprint, not its bounding rectangle.
export function createPavementHeight(slabs) {
  const cells = new Map(), size = 8;
  for (const { x, z, w, d, y, h, ry = 0 } of slabs) {
    const top = y + h;
    if (!(top > 0 && top <= .35 && w >= .45 && d >= .45)) continue;
    const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hd = d / 2;
    const dx = Math.abs(c) * hw + Math.abs(s) * hd, dz = Math.abs(s) * hw + Math.abs(c) * hd;
    const slab = { x, z, top, c, s, hw, hd };
    for (let i = Math.floor((x - dx) / size); i <= Math.floor((x + dx) / size); i++)
      for (let j = Math.floor((z - dz) / size); j <= Math.floor((z + dz) / size); j++) {
        const key = `${i}:${j}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(slab);
      }
  }
  return (x, z, ground) => {
    const nearby = cells.get(`${Math.floor(x / size)}:${Math.floor(z / size)}`);
    if (nearby) for (const slab of nearby) {
      if (slab.top <= ground) continue;
      const dx = x - slab.x, dz = z - slab.z;
      if (Math.abs(dx * slab.c - dz * slab.s) <= slab.hw && Math.abs(dx * slab.s + dz * slab.c) <= slab.hd) ground = slab.top;
    }
    return ground;
  };
}

export function createRectMask(rectangles, cellSize = 16) {
  const cells = new Map();
  const keys = r => {
    const out = [];
    for (let x = Math.floor(r.x0 / cellSize); x <= Math.floor(r.x1 / cellSize); x++)
      for (let z = Math.floor(r.z0 / cellSize); z <= Math.floor(r.z1 / cellSize); z++) out.push(`${x},${z}`);
    return out;
  };
  for (const r of rectangles) if (r.x1 - r.x0 > 1e-6 && r.z1 - r.z0 > 1e-6) for (const key of keys(r)) {
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(r);
  }
  return { intersects(r) {
    if (r.x1 - r.x0 <= 1e-6 || r.z1 - r.z0 <= 1e-6) return false;
    const candidates = new Set();
    for (const key of keys(r)) for (const q of cells.get(key) ?? []) candidates.add(q);
    for (const q of candidates) if (overlaps(r, q)) return true;
    return false;
  } };
}
