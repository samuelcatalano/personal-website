const fract = n => n - Math.floor(n);

function lattice(x, y, octave) {
  let n = Math.imul(x + octave * 1013, 374761393) + Math.imul(y - octave * 1999, 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, cells, octave) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (dx, dy) => lattice((ix + dx) % cells, (iy + dy) % cells, octave);
  const a = at(0, 0) + (at(1, 0) - at(0, 0)) * sx;
  const b = at(0, 1) + (at(1, 1) - at(0, 1)) * sx;
  return a + (b - a) * sy;
}

// Periodic multi-scale cloud luminance. Stored as a single-channel texture and sampled in world space.
export function buildCloudNoise(size = 128) {
  const data = new Uint8Array(size * size), octaves = [3, 6, 12, 24, 48], weights = [0.38, 0.27, 0.18, 0.11, 0.06];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let value = 0;
    for (let i = 0; i < octaves.length; i++) value += valueNoise(x / size * octaves[i], y / size * octaves[i], octaves[i], i) * weights[i];
    data[y * size + x] = Math.round(value * 255);
  }
  return data;
}
