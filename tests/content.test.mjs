import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
import { stops, SECTIONS, i18n, sectionStart } from '../js/content.js';

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

test('journey stops have a brand monogram', () => {
  for (const s of stops.filter(s => s.section === 'journey')) {
    assert.match(s.brand?.initials ?? '', /^[A-Z]{1,3}$/, s.id);
    assert.match(s.brand?.color ?? '', /^#[0-9a-f]{6}$/, s.id);
  }
});
