import test from 'node:test';
import assert from 'node:assert/strict';
import { tripState } from '../js/scroll.js';
import { stops } from '../js/content.js';

const at = (id) => stops.findIndex((s) => s.id === id);
const visitedFrom = (from, to) => new Set(Array.from({ length: to - from + 1 }, (_, k) => from + k));

test('counts the career stops reached and names the one after the current stop', () => {
  const seen = new Set([at('puc'), at('arizona'), at('insane'), at('taqtile')]); // 2003, 2011, 2012, 2014
  assert.deepEqual(tripState(stops, at('taqtile'), seen), { count: 4, total: 12, next: at('mira') }); // at 2014: next is 2017
});

test('from the hero nothing is visited yet and the first career stop is next', () => {
  assert.deepEqual(tripState(stops, 0, new Set()), { count: 0, total: 12, next: at('puc') });
});

test('next is always the stop after the current one, even when an earlier stop was never confirmed', () => {
  // regression: the panel showed "Next stop: 2003 PUC-SP" while the bus was at 2021
  const seen = visitedFrom(at('arizona'), at('olm'));
  assert.equal(tripState(stops, at('olm'), seen).next, at('glasgow'));
});

test('the last career stop has no next stop: the line ends there', () => {
  const last = at('tribal');
  assert.equal(tripState(stops, last, visitedFrom(at('puc'), last)).next, -1);
});
