import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneModules } from '../tools/preload-list.mjs';
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

test('index.html preloads exactly the static module graph (regenerate with node tools/preload-list.mjs)', () => {
  const listed = [...html.matchAll(/rel="modulepreload" href="(js\/[^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(listed, sceneModules());
  assert.ok(listed.filter(path => path.startsWith('js/world/')).every(path => ['js/world/layout.js', 'js/world/load-progress.js'].includes(path)), 'the 3D scene stays lazy until the visitor opts in');
});

test('loading status exists and the panel is not a fake interactive region', () => {
  assert.match(html, /id="loading" hidden/);
  assert.doesNotMatch(html, /id="loading" role="status"/);
  assert.match(html, /id="intro-status-announcement"[^>]*aria-live="polite"/);
  assert.match(html, /id="intro-status-text" aria-live="off"/);
  assert.match(html, /id="load-experience"[^>]*data-i18n="intro.loadExperience"/);
  assert.doesNotMatch(html, /<main[^>]*tabindex/);
});
