import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stops, SECTIONS, i18n, sectionStart } from '../js/content.js';

const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]).sort();

test('en and pt have identical keys', () => {
  assert.deepEqual(keys(i18n.pt), keys(i18n.en));
});

test('no empty strings', () => {
  for (const lang of ['en', 'pt']) {
    const walk = (o) => Object.values(o).forEach(v =>
      typeof v === 'string' ? assert.ok(v.trim(), `empty string in ${lang}`) : v && typeof v === 'object' && walk(v));
    walk(i18n[lang]);
  }
});

test('every stop has a known section and journey stops have copy', () => {
  for (const s of stops) {
    assert.ok(SECTIONS.includes(s.section), s.id);
    if (s.section === 'journey') assert.ok(i18n.en.stops[s.id]?.title, s.id);
  }
});

test('journey is chronological and stop ids unique', () => {
  const years = stops.filter(s => s.section === 'journey').map(s => +s.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  assert.equal(new Set(stops.map(s => s.id)).size, stops.length);
});

test('sections appear in SECTIONS order', () => {
  const starts = SECTIONS.map(sectionStart);
  assert.ok(starts.every(i => i >= 0));
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
});

test('no private data', () => {
  const all = JSON.stringify(i18n);
  for (const bad of ['7508', 'Station Grove', 'Flat 73', 'The Assembly']) assert.ok(!all.includes(bad), bad);
});
