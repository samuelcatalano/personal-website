// Pixel-art flags on a pole, facing +z. Local colours (flags are not palette tones).
const BLUE = { jack: '#1f3a8a', saltire: '#1f6fd6' }, RED = '#cf1f2e', WHITE = '#f4f4f0', POLE = '#8a8f96';
export const W = 11, H = 7;
// cell colour at column i, row j (0 = top)
export function pixel(kind, i, j) {
  const d1 = Math.abs(j - (i * (H - 1)) / (W - 1)), d2 = Math.abs(j - (H - 1) + (i * (H - 1)) / (W - 1));
  if (kind === 'saltire') return d1 <= 0.9 || d2 <= 0.9 ? WHITE : BLUE.saltire;
  const cx = Math.abs(i - 5) <= 1 || Math.abs(j - 3) <= 1, red = i === 5 || j === 3;
  if (cx) return red ? RED : WHITE;
  if (d1 <= 0.35 || d2 <= 0.35) return RED; // ponytail: no counterchange offset
  return d1 <= 0.9 || d2 <= 0.9 ? WHITE : BLUE.jack;
}
export const cloth = []; // flag cloth boxes (+ pole x px), kept out of the static world; see motion.js
// pole base at (x, y, z); flag ~2.4 x 1.4 m * scale, hoisted at the pole, flying +x
export function flag(add, x, y, z, kind, scale = 1) {
  const c = (2.4 * scale) / W, ph = H * c + 1.2 * scale;
  add(x, y, z, 0.1 * scale + 0.04, ph, 0.1 * scale + 0.04, POLE);
  const top = y + ph - 0.05;
  for (let j = 0; j < H; j++) for (let i = 0; i < W;) {
    const col = pixel(kind, i, j); let k = i;
    while (k < W && pixel(kind, k, j) === col) k++;
    cloth.push({ x: x + 0.05 * scale + ((i + k) / 2) * c, y: top - (j + 1) * c, z, w: (k - i) * c, h: c, d: 0.08 * scale, color: col, px: x + 0.05 * scale });
    i = k;
  }
}
