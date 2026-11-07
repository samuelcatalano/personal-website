import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planePose, PLANE_IN, PLANE_OUT } from '../js/world/plane-path.js';

// Fixture captured from the live scene (?qa): the bus position along the route around the first UK stop, the A330's bounding box at scale 1,
// and a 3 m heightmap of everything rendered in the plane's corridor (downward raycasts against every visible mesh, buildings, trees and landmarks included).
// ponytail: a snapshot; recapture it if the London stretch of the city, the route or the camera's follow shot changes.
const F = JSON.parse(readFileSync(new URL('./plane-flight.fixture.json', import.meta.url)));
const bus = (d) => {
  const i = Math.max(1, F.bus.findIndex((b) => b[0] >= d - 1e-9)), a = F.bus[i - 1], b = F.bus[i], f = (d - a[0]) / (b[0] - a[0]);
  return { x: a[1] + (b[1] - a[1]) * f, y: 0, z: a[2] + (b[2] - a[2]) * f };
};
const cams = { desktop: 1, mobile: 0.95 }; // camera.js 'follow' shot: bus + (20, 29, 50), times 0.95 on mobile
const [lo, hi] = F.box, reach = Math.SQRT2 * Math.max(-lo[0], hi[0], -lo[2], hi[2]);
const height = (x, z) => {
  const j = Math.round((x - F.x0) / F.step), i = Math.round((F.z0 - z) / F.step);
  assert.ok(i >= 0 && i < F.rows.length && j >= 0 && j < F.rows[0].length, `footprint (${x.toFixed(0)}, ${z.toFixed(0)}) is outside the captured heightmap`);
  return F.rows[i][j];
};
const each = (fn) => { for (const [name, s] of Object.entries(cams)) for (let d = PLANE_IN; d < PLANE_OUT; d += 0.005) { const b = bus(d); fn(d, b, { x: b.x + 20 * s, y: b.y + 29 * s, z: b.z + 50 * s }, name); } };

test('the A330 never touches anything the scene renders under its footprint', () => {
  let min = Infinity;
  each((d, b, cam, name) => {
    const p = planePose(d, b, cam), r = reach * p.scale, belly = p.y + (lo[1] - Math.abs(Math.sin(p.bank)) * reach) * p.scale;
    for (let x = p.x - r; x <= p.x + r; x += F.step / 2) for (let z = p.z - r; z <= p.z + r; z += F.step / 2) {
      if (Math.hypot(x - p.x, z - p.z) > r) continue;
      const gap = belly - height(x, z);
      min = Math.min(min, gap);
      assert.ok(gap > 2, `${name} d=${d.toFixed(3)}: belly ${belly.toFixed(1)} m over ${height(x, z)} m at (${x.toFixed(0)}, ${z.toFixed(0)})`);
    }
  });
  assert.ok(min < 30, 'sanity: the check really looked under the plane');
  console.log(`minimum clearance ${min.toFixed(1)} m`);
});

test('the A330 flies smoothly, level and stays below the frame top while receding', () => {
  const top = Math.tan(3.5 * Math.PI / 180); // frame top measured at ~3.8 degrees above the camera (1728x907, follow shot)
  each((d, b, cam, name) => {
    const p = planePose(d, b, cam), q = planePose(d + 0.005, b, cam);
    assert.ok(Math.abs(p.bank) <= 0.03 && p.pitch >= 0 && p.pitch <= 0.03, `${name} d=${d.toFixed(3)}: wings level, never nose-down`);
    assert.ok(Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 3 && Math.abs(q.scale - p.scale) < 0.03, `${name} d=${d.toFixed(3)}: no jump`);
    if (d >= 0 && name === 'desktop') assert.ok((p.y + hi[1] * p.scale - cam.y) / Math.hypot(p.x - cam.x, p.z - cam.z) < top, `d=${d.toFixed(3)}: tail above the frame`);
  });
});
