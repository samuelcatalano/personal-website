import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackdrop } from '../js/world/backdrop.js';
import { stops } from '../js/content.js';
import { routePoints } from '../js/world/layout.js';

test('distant backdrop combines varied mass profiles with geometric facade depth', () => {
  const boxes = [];
  buildBackdrop((x, y, z, w, h, d, color) => boxes.push({ x, y, z, w, h, d, color }), stops, routePoints(stops.length));
  const panes = boxes.filter((b) => b.d === 0.03 || b.w === 0.03), reveals = boxes.filter((b) => b.d === 0.04 || b.w === 0.04);
  assert.ok(new Set(boxes.filter((b) => b.y === 0 && b.h > 4).map((b) => b.w.toFixed(2) + ':' + b.h.toFixed(2))).size > 30);
  const masses = boxes.filter((b) => b.y === 0 && b.h > 4 && b.w < 1000);
  assert.ok(masses.some((base) => boxes.some((top) => top.z === base.z && Math.abs(top.x - (base.x - base.w * .21)) < 1e-9 && Math.abs(top.y - base.h) < 1e-9 && Math.abs(top.w - base.w * .43) < 1e-9)), 'backdrop includes offset upper-storey crowns');
  assert.ok(panes.length > 1000 && reveals.length >= panes.length, 'facades use layered, recessed window geometry');
});
