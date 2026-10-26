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
  assert.ok(panes.length > 1000 && reveals.length >= panes.length, 'facades use layered, recessed window geometry');
});
