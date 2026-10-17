import test from 'node:test';
import assert from 'node:assert/strict';
import { stopMarks, routeT, nearestStop, scrollYForStop } from '../js/scroll.js';

// stops 0..4; segment 2->3 is 10x longer than the others
const pts = [0, 30, 60, 360, 390].map((x) => ({ x, z: 0 })), n = pts.length, m = stopMarks(pts), total = 390;
const metres = (p) => routeT(p, n, m) * (n - 1); // fractional stop index -> metres via pts
const along = (p) => { const s = metres(p), i = Math.min(Math.floor(s), n - 2); return pts[i].x + (pts[i + 1].x - pts[i].x) * (s - i); };

test('stopMarks are cumulative distance shares', () => {
  assert.deepEqual(m, [0, 30 / total, 60 / total, 1 - 30 / total, 1].map((v, i) => (i === 3 ? 360 / total : v)));
  assert.equal(m[0], 0); assert.equal(m[n - 1], 1);
});
test('routeT with marks lands stops on i/(n-1), is monotonic', () => {
  for (let i = 0; i < n; i++) assert.ok(Math.abs(routeT(m[i], n, m) - i / (n - 1)) < 1e-12);
  let prev = -1;
  for (let p = 0; p <= 1; p += 0.001) { const t = routeT(p, n, m); assert.ok(t >= prev); prev = t; }
});
test('metres per progress is uniform across short and long segments', () => {
  const k = (a, b) => (along(b) - along(a)) / (b - a);
  assert.ok(Math.abs(k(0.01, 0.05) - total) < 1e-6);
  assert.ok(Math.abs(k(0.4, 0.6) - total) < 1e-6);
  assert.ok(Math.abs(k(0.93, 0.97) - total) < 1e-6);
});
test('nearestStop with marks picks the closest mark', () => {
  assert.equal(nearestStop(0, n, m), 0);
  assert.equal(nearestStop(1, n, m), 4);
  for (let i = 0; i < n; i++) assert.equal(nearestStop(m[i], n, m), i);
  assert.equal(nearestStop((m[2] + m[3]) / 2 + 0.01, n, m), 3);
  assert.equal(nearestStop((m[2] + m[3]) / 2 - 0.01, n, m), 2);
});
test('scrollYForStop with marks round-trips through nearestStop', () => {
  const H = 5000, V = 800;
  for (let i = 0; i < n; i++) {
    const y = scrollYForStop(i, n, H, V, m);
    assert.equal(nearestStop(y / (H - V), n, m), i);
  }
  assert.equal(scrollYForStop(n - 1, n, H, V, m), H - V);
});

test('fineMarks equalises speed inside a segment and keeps stop marks', async () => {
  // fake curve: first half of each segment is 3x faster than the second
  const q = (x) => ({ x, distanceTo: (o) => Math.abs(x - o.x) });
  const N = n - 1, pos = (t) => { const s = Math.floor(t * N - 1e-9), f = t * N - s; return q(s * 100 + (f < 0.5 ? f * 150 : 75 + (f - 0.5) * 50)); };
  const { fineMarks } = await import('../js/scroll.js');
  const f = fineMarks(m, { getPoint: (t) => pos(Math.max(t, 1e-9)) }, 8);
  assert.equal(f.length, N * 8 + 1);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(f[i * 8] - m[i]) < 1e-12);
  const d = f.slice(1).map((v, i) => v - f[i]);
  assert.ok(d.every((v) => v >= 0));
  const seg = d.slice(0, 8); assert.ok(Math.max(...seg) / Math.min(...seg) > 1); // knots follow the curve, so t-per-progress varies
  assert.ok(Math.abs(routeT(f[16], n, f) - 2 / N) < 1e-12);
});
