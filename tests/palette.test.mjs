import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../js/world/palette.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('palette values are lowercase #rrggbb', () => {
  for (const [k, v] of Object.entries(PALETTE)) assert.match(v, /^#[0-9a-f]{6}$/, k);
});

// Cores fora da paleta só são permitidas onde já foram aprovadas: London Eye (cápsulas),
// mostrador do relógio (canvas) e duas variações de parede da cidade.
const APPROVED = new Set(['#bfe3ff', '#f4f0e2', '#4d4030', '#6d604b', '#493d30', '#392d24', '#d8d0c2', '#bdb3a4']);

test('landmarks and city only use palette or approved colours', () => {
  const allowed = new Set([...Object.values(PALETTE), ...APPROVED]);
  for (const f of ['js/world/landmarks.js', 'js/world/city.js', 'js/world/parks.js']) {
    const used = readFileSync(join(root, f), 'utf8').match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    for (const c of used) assert.ok(allowed.has(c.toLowerCase()), `${f} uses off-palette ${c}`);
  }
});

test('palette preserves the approved city art-pass tones', () => {
  const want = { grass: '#658545', pave: '#c2b9a8', patch: '#829467', road: '#353b40', dirt: '#86603e', stone: '#9b9b99', oak: '#a27b4c', brick: '#a8442f', sandstone: '#e0c880', concrete: '#c4c4c2', glass: '#6fb4e0', leaf: '#3c8a22', maroon: '#6b1f2a' };
  for (const [k, v] of Object.entries(want)) assert.equal(PALETTE[k], v, k);
});
