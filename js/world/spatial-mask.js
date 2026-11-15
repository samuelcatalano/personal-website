const overlaps = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

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
