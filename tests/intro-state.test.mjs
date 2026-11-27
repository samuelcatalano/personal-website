import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntroState, hasVisited } from '../js/intro-state.js';
import { i18n } from '../js/content.js';

test('loading state publishes monotonic progress and becomes ready and started once', () => {
  const state = createIntroState();
  const seen = [];
  state.subscribe((value) => seen.push(value));
  state.loading('vehicles', 64);
  state.loading('city', 20);
  state.ready();
  state.started();
  assert.deepEqual(seen.map(({ phase }) => phase), ['idle', 'loading', 'loading', 'ready', 'started']);
  assert.equal(seen[2].progress, 64);
  assert.equal(seen[2].stage, 'city');
  assert.equal(state.current.phase, 'started');
});

test('first visit is distinct and storage failures do not prevent the intro', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(hasVisited(storage), false);
  assert.equal(hasVisited(storage), true);
  assert.equal(hasVisited({ getItem() { throw new Error('blocked'); }, setItem() {} }), false);
});

test('loading and summary fallback copy exists in English and Portuguese', () => {
  for (const lang of ['en', 'pt']) {
    assert.match(i18n[lang].ui.intro.loadingProgress, /\{stage\}.*\{percent\}/);
    assert.ok(i18n[lang].ui.intro.firstVisit);
    assert.ok(i18n[lang].ui.intro.loadExperience);
  }
});
