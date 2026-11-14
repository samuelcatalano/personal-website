import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stops, stackGroups, toolStops, toolSpan, i18n } from '../js/content.js';

test('toolSpan: first year and stop count come from the stops that mention the tool', () => {
  for (const g of stackGroups) for (const tool of g.items) {
    const ids = toolStops[tool], span = toolSpan(tool);
    if (!ids.length) { assert.equal(span, null, tool); continue; }
    const years = ids.map(id => +stops.find(s => s.id === id).year);
    assert.deepEqual(span, { since: Math.min(...years), count: ids.length }, tool);
  }
});
test('toolSpan: a tool the copy never names has no ticket', () => {
  assert.equal(toolSpan('JUnit · Mockito'), null);
  assert.equal(toolSpan('not a tool'), null);
});
test('ticket labels use their placeholders in both languages', () => {
  for (const lang of ['en', 'pt']) {
    const u = i18n[lang].ui;
    assert.match(u.ticketSince, /\{year\}/, lang);
    assert.match(u.ticketStops, /\{n\}/, lang);
  }
});
