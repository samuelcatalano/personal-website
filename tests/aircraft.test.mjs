import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flightPhase } from '../js/world/aircraft.js';

// Sample 0.25 s steps and collapse into [phase, cycle, startTime, endTime] runs
const runs = (seed, end = 600) => {
  const out = [];
  for (let t = 0; t < end; t += 0.25) {
    const f = flightPhase(t, seed), last = out[out.length - 1];
    if (last && last.phase === f.phase && last.cycle === f.cycle) last.end = t; else out.push({ phase: f.phase, cycle: f.cycle, start: t, end: t });
  }
  return out;
};

test('phases run offscreen > enter > cruise > exit > cooldown, then repeat', () => {
  const seq = runs(1).map((r) => r.phase), order = ['enter', 'cruise', 'exit', 'cooldown']; // offscreen lead only before the first flight
  assert.equal(seq[0], 'offscreen');
  seq.slice(1).forEach((p, i) => assert.equal(p, order[i % 4]));
  assert.ok(seq.length >= 10);
});

test('deterministic for a seed, different across seeds', () => {
  assert.deepEqual(runs(7), runs(7));
  assert.notDeepEqual(runs(7), runs(8));
});

test('timings: first appearance <= 8 s, traversal 35-45 s, cooldown 25-45 s between cycles', () => {
  const r = runs(3, 900), first = r.find((x) => x.phase === 'enter');
  assert.ok(first.start <= 8.25, `first appears at ${first.start}`);
  for (const c of [0, 1, 2]) {
    const a = r.filter((x) => x.cycle === c && ['enter', 'cruise', 'exit'].includes(x.phase)), cd = r.find((x) => x.cycle === c && x.phase === 'cooldown');
    const fly = a[a.length - 1].end + 0.25 - a[0].start, cool = cd.end + 0.25 - cd.start;
    assert.ok(fly >= 34.75 && fly <= 45.5, `fly ${fly}`);
    assert.ok(cool >= 24.75 && cool <= 45.5, `cooldown ${cool}`);
  }
});

test('u advances 0..1 across the flight and cycles never overlap', () => {
  let prev = 0;
  for (let t = 0; t < 120; t += 0.1) { const f = flightPhase(t, 5); if (f.cycle === 0 && f.phase !== 'offscreen') { assert.ok(f.u >= prev); prev = f.u; } }
  assert.ok(prev > 0.99);
  const r = runs(5, 400);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].start >= r[i - 1].end);
});
