import test from 'node:test';
import assert from 'node:assert/strict';
import { wheelSnap } from '../js/scroll.js';

// feed a list of [deltaPx, timeMs] events in order and return the steps that fired (+1 / -1)
const run = (snap, events, busy = false) => events.map(([dy, t]) => snap.feed(dy, t, busy)).filter((d) => d !== 0);

test('one wheel notch is one step, in the direction it was turned', () => {
  const snap = wheelSnap();
  assert.deepEqual(run(snap, [[100, 0]]), [1]);
  assert.deepEqual(run(snap, [[-100, 1000]]), [-1]);
});

test('a fast spin of many notches is one gesture: one stop, not one per notch', () => {
  const events = Array.from({ length: 12 }, (_, k) => [100, k * 16]);
  assert.deepEqual(run(wheelSnap(), events), [1]);
});

test('trackpad inertia after a step does not fire a second step', () => {
  const flick = [[60, 0]];
  for (let k = 1; k <= 60; k++) flick.push([Math.max(0.5, 24 - k * 0.4), k * 16]); // a decaying tail, one event every 16 ms
  assert.deepEqual(run(wheelSnap(), flick), [1]);
});

test('a new gesture after a quiet pause steps again', () => {
  const snap = wheelSnap();
  const first = run(snap, [[100, 0], [100, 16]]);
  const second = run(snap, [[100, 600], [100, 616]]); // 600 ms of silence in between
  assert.deepEqual([...first, ...second], [1, 1]);
});

test('a gesture that runs into a glide is dropped: nothing fires once the glide ends', () => {
  const snap = wheelSnap();
  assert.deepEqual(run(snap, [[100, 0], [100, 16], [100, 32]], true), []);
  // the same gesture keeps going after the glide: still no step
  assert.deepEqual(run(snap, [[100, 48], [100, 64]]), []);
  // a pause ends it; the next gesture steps as usual
  assert.deepEqual(run(snap, [[100, 600]]), [1]);
});

test('small deltas accumulate until the threshold, so a slow trackpad drag still moves one stop', () => {
  const events = Array.from({ length: 20 }, (_, k) => [4, k * 30]); // 80 px over 600 ms, every event below the threshold
  assert.deepEqual(run(wheelSnap(), events), [1]);
});
