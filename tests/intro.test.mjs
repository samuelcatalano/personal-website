import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { practice } from '../js/intro.js';

test('the preview advances and reverses without leaving the route', () => {
  assert.equal(practice(0, 300), 0.6);
  assert.equal(practice(0.6, -150), 0.3);
  assert.equal(practice(0, -9999), 0);
  assert.equal(practice(0, 9999), 1);
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
import { progressValue } from '../js/intro.js';
test('ticket progress follows loading progress monotonically and reserves 100 for ready', () => {
  assert.equal(progressValue({ ratio: 0 }), 0);
  assert.equal(progressValue({ ratio: 1 }), 99);
  assert.equal(progressValue({ ratio: 0.5 }), 50);
  assert.ok(progressValue({ ratio: 0.7 }) < progressValue({ ratio: 0.8 }));
});

test('the loading intro keeps its scroll cue without repeating it over the journey scene', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="intro-hint"/);
  assert.doesNotMatch(html, /id="journey-hint"/);
  assert.doesNotMatch(ui, /t\.ui\.scroll(?:Touch)?/);
  assert.equal(i18n.en.ui.scroll, undefined);
  assert.equal(i18n.pt.ui.scroll, undefined);
  assert.match(i18n.en.ui.intro.hint, /Scroll down/);
  assert.match(i18n.pt.ui.intro.hint, /Role para baixo/);
});
test('every language has the finishing-step texts and the same tips', () => {
  const { en, pt } = { en: i18n.en.ui.intro, pt: i18n.pt.ui.intro };
  for (const k of ['photo', 'touches']) assert.ok(en[k] && pt[k], `intro.${k} in en and pt`);
  assert.ok(en.photo.includes('{city}') && pt.photo.includes('{city}'));
  assert.ok(en.tips.length >= 3 && en.tips.length === pt.tips.length, 'same number of tips in en and pt');
  assert.ok([...en.tips, ...pt.tips].every((s) => typeof s === 'string' && s.length > 10));
});
