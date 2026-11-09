import { test } from 'node:test';
import assert from 'node:assert/strict';
import { i18n, repos, stops } from '../js/content.js';

test('each public repository has concise descriptions in both languages', () => {
  for (const lang of ['en', 'pt']) {
    const descriptions = i18n[lang].sections.repos.descriptions;
    assert.deepEqual(Object.keys(descriptions).sort(), repos.map(repo => repo.name).sort());
    for (const description of Object.values(descriptions)) {
      assert.ok(description.trim());
      assert.ok(description.length <= 90, `${lang}: ${description}`);
    }
  }
});

test('journey labels its most recent existing stop in both languages', () => {
  const latest = stops.findLast(stop => stop.section === 'journey');
  for (const lang of ['en', 'pt']) {
    assert.ok(i18n[lang].sections.journey.latest.trim());
    assert.ok(i18n[lang].stops[latest.id].role.trim());
    assert.ok(i18n[lang].stops[latest.id].body.trim());
  }
});
