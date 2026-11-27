import test from 'node:test';
import assert from 'node:assert/strict';
import { i18n, stops } from '../js/content.js';
import { journeyLine, routeStrip } from '../js/ui.js';

const firstJourneyStop = stops.findIndex((stop) => stop.section === 'journey');
const nextJourneyStop = stops.findIndex((stop, index) => stop.section === 'journey' && index !== firstJourneyStop);

test('journey progress and return ticket expose translated names and visit states', () => {
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  try {
    for (const lang of ['en', 'pt']) {
      const t = i18n[lang], seen = new Set([firstJourneyStop]);
      const progress = journeyLine(t, seen), strip = routeStrip(t, { seen });
      assert.match(progress, /<span id="journey-progress-label">/);
      assert.match(progress, /<progress[^>]*aria-labelledby="journey-progress-label"/);
      assert.equal((strip.match(/<li\b/g) ?? []).length, stops.filter((stop) => stop.section === 'journey').length);
      assert.ok(strip.includes(`aria-label="${t.ui.recap.route}"`));
      assert.ok(strip.includes(`${t.stops[stops[firstJourneyStop].id].title}: ${t.ui.recap.visited}`));
      assert.ok(strip.includes(`${t.stops[stops[nextJourneyStop].id].title}: ${t.ui.recap.notVisited}`));
    }
  } finally {
    if (originalMatchMedia) globalThis.matchMedia = originalMatchMedia;
    else delete globalThis.matchMedia;
  }
});

test('reset confirmation describes this visit rather than persistent device data', () => {
  assert.match(i18n.en.ui.resetConfirm, /this visit/i);
  assert.doesNotMatch(i18n.en.ui.resetConfirm, /device/i);
  assert.match(i18n.pt.ui.resetConfirm, /visita/i);
  assert.doesNotMatch(i18n.pt.ui.resetConfirm, /dispositivo/i);
});
