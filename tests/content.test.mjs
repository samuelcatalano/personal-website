import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
import { stops, SECTIONS, i18n, sectionStart } from '../js/content.js';
import { LANDMARKS, ukStart } from '../js/world/layout.js';

const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]).sort();

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

test('no private data in served files', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const files = [...['index.html', 'css/style.css', 'README.md'].map(f => join(root, f)), ...walk(join(root, 'js'))];
  const bad = [/\+?44[\s\d]{9,}/, /tel:/i, /\bFlat\s*\d/i, /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/];
  for (const f of files) for (const re of bad) assert.ok(!re.test(readFileSync(f, 'utf8')), `${f} matches ${re}`);
});

test('journey stops have a brand monogram, except the move stop', () => {
  for (const s of stops.filter(s => s.section === 'journey' && s.id !== 'move')) {
    assert.match(s.brand?.initials ?? '', /^[A-Z]{1,3}$/, s.id);
    assert.match(s.brand?.color ?? '', /^#[0-9a-f]{6}$/, s.id);
  }
});

test('move stop sits between reclame and millimetric, UK 2019, no brand', () => {
  const ids = stops.map(s => s.id), i = ids.indexOf('move');
  assert.ok(i > 0, 'move stop missing');
  assert.equal(ids[i - 1], 'reclame');
  assert.equal(ids[i + 1], 'millimetric');
  assert.equal(stops[i].year, '2019');
  assert.equal(stops[i].country, 'UK');
  assert.equal(stops[i].brand, undefined);
});

test('move stop has EN and PT journey copy', () => {
  assert.equal(i18n.en.stops.move.title, 'Moved to London');
  assert.equal(i18n.pt.stops.move.title, 'Mudança para Londres');
});

test('OLM is split between London and Glasgow with accurate dates and residence context', () => {
  const ids = stops.map(s => s.id);
  const olm = ids.indexOf('olm');
  const glasgow = ids.indexOf('glasgow');
  assert.equal(ids[olm + 1], 'glasgow');
  assert.equal(ids[glasgow + 1], 'tribal');
  assert.deepEqual(stops[olm], {
    id: 'olm', section: 'journey', year: '2021', country: 'UK',
    brand: { initials: 'OLM', color: '#0f766e' },
  });
  assert.deepEqual(stops[glasgow], {
    id: 'glasgow', section: 'journey', year: '2023', country: 'UK',
    brand: { initials: 'OLM', color: '#0f766e' },
  });
  assert.equal(i18n.en.stops.olm.dates, 'Jul 2021 – Dec 2022');
  assert.equal(i18n.en.stops.glasgow.dates, 'Jan 2023 – Feb 2024');
  assert.equal(i18n.en.stops.olm.title, 'OLM Systems — London');
  assert.equal(i18n.en.stops.glasgow.title, 'OLM Systems — Glasgow');
  assert.equal(i18n.pt.stops.olm.dates, 'jul 2021 – dez 2022');
  assert.equal(i18n.pt.stops.glasgow.dates, 'jan 2023 – fev 2024');
  assert.equal(i18n.pt.stops.olm.title, 'OLM Systems — Londres');
  assert.equal(i18n.pt.stops.glasgow.title, 'OLM Systems — Glasgow');
  assert.match(i18n.en.stops.glasgow.body, /lived in Glasgow through 2024/i);
  assert.match(i18n.en.stops.glasgow.body, /Tribal from June 2024/i);
  assert.match(i18n.pt.stops.glasgow.body, /morei em Glasgow até o fim de 2024/i);
  assert.match(i18n.pt.stops.glasgow.body, /na Tribal a partir de junho de 2024/i);
});

test('no airport landmark; the UK region starts at the move stop', () => {
  assert.equal(LANDMARKS.heathrow, undefined);
  assert.equal(stops[ukStart(stops)].id, 'move');
});
