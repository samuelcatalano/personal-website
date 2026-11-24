import assert from 'node:assert/strict';
import test from 'node:test';
import { hazeTone, capRise } from '../js/world/backdrop.js';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const chroma = (hex) => { const c = rgb(hex); return Math.max(...c) - Math.min(...c); };
const luma = (hex) => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };

test('hazeTone keeps the colour at k = 1 and lowers chroma in proportion to k', () => {
  assert.equal(hazeTone('#a8442f', 1), '#a8442f');
  for (const hex of ['#a8442f', '#8e3b2e', '#6f8fa3', '#c9a96b']) {
    const half = hazeTone(hex, 0.5), none = hazeTone(hex, 0);
    assert.ok(chroma(half) < chroma(hex) * 0.62, `${hex} -> ${half}`);
    assert.ok(chroma(none) <= 8, `${hex} -> ${none} is near-neutral stone`);
    assert.ok(Math.abs(luma(half) - luma(hex)) <= 3, 'value is kept, only chroma drops');
  }
});

test('hazeTone is deterministic and returns lowercase #rrggbb', () => {
  assert.equal(hazeTone('#717B88', 0.4), hazeTone('#717b88', 0.4));
  assert.match(hazeTone('#717b88', 0.4), /^#[0-9a-f]{6}$/);
});

test('capRise gives roof caps a stable 0-1.4 m extra height per position', () => {
  const a = capRise(120.5, -280), b = capRise(120.5, -280);
  assert.equal(a, b);
  const all = Array.from({ length: 200 }, (_, i) => capRise(i * 13.7, -220 - i));
  assert.ok(all.every((v) => v >= 0 && v <= 1.4));
  assert.ok(Math.max(...all) - Math.min(...all) > 1, 'heights actually vary');
});
