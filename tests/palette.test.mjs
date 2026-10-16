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
  for (const f of ['js/world/landmarks.js', 'js/world/city.js']) {
    const used = readFileSync(join(root, f), 'utf8').match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    for (const c of used) assert.ok(allowed.has(c.toLowerCase()), `${f} uses off-palette ${c}`);
  }
});

test('palette has the Minecraft block tones', () => {
  const want = { grass: '#5d8c3a', dirt: '#86603e', stone: '#8f8f8f', oak: '#a27b4c', brick: '#9a4b3a', sandstone: '#d9c995', concrete: '#bdbdbd', glass: '#a8c8d8', leaf: '#4f7a2e' };
  for (const [k, v] of Object.entries(want)) assert.equal(PALETTE[k], v, k);
});
