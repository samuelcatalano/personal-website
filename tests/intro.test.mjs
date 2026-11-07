import { test } from 'node:test';
import assert from 'node:assert/strict';
import { practice } from '../js/intro.js';

const run = (...dys) => dys.reduce(practice, { p: 0, down: false, up: false });

test('scrolling down to the flag completes the first step only', () => {
  const s = run(300, 300);
  assert.deepEqual([s.p, s.down, s.up], [1, true, false]);
});
test('going back up only counts after the flag was reached', () => {
  assert.equal(run(-400).up, false);
  assert.equal(run(600, -600).up, true);
});
test('position never leaves 0..1', () => {
  assert.equal(run(-9999).p, 0);
  assert.equal(run(9999).p, 1);
});

import { journeyIndex, careerLabel } from '../js/intro.js';
import { stops, i18n } from '../js/content.js';
test('the toy bus walks the 12 journey stops and the blind labels them', () => {
  const journey = stops.filter(x => x.section === 'journey');
  assert.deepEqual([0, 0.5, 1].map(p => journeyIndex(p)), [0, 6, 11]);
  assert.equal(careerLabel(journey[0], i18n.en), '2003 PUC');
  assert.equal(careerLabel(journey.find(x => x.id === 'move'), i18n.en), '2019 LONDON');
  assert.equal(careerLabel(journey.find(x => x.id === 'move'), i18n.pt), '2019 LONDRES');
  assert.equal(careerLabel(journey.find(x => x.id === 'glasgow'), i18n.en), '2023 GLASGOW');
});
import { trackLoad, loadState, labelOf } from '../js/world/load-progress.js';
test('load progress counts finished requests and names the latest pending stage', async () => {
  assert.equal(labelOf('assets/processed/vehicles/x.glb'), 'vehicles');
  assert.equal(labelOf('assets/other.glb'), 'city');
  let release; const slow = trackLoad('assets/npc/p.glb', new Promise(r => { release = r; }));
  assert.equal(loadState().stage, 'npc');
  const before = loadState().done; release(1); await slow;
  assert.equal(loadState().done, before + 1);
  assert.equal(loadState().stage, null);
});
import { nextStop, travelMs } from '../js/autoride.js';
test('auto-ride resumes at the next stop ahead and restarts after the last', () => {
  const ys = [0, 900, 1800, 2700];
  assert.equal(nextStop(ys, 0), 1);
  assert.equal(nextStop(ys, 950), 2);
  assert.equal(nextStop(ys, 2700), 0);
});
test('auto-ride travel time is bounded', () => {
  assert.equal(travelMs(10), 1400);
  assert.equal(travelMs(100000), 5500);
});
