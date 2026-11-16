import assert from 'node:assert/strict';
import test from 'node:test';
import { yearLabels } from '../js/intro.js';
import { i18n } from '../js/content.js';

test('yearLabels drops a year that repeats the previous node', () => {
  assert.deepEqual(yearLabels([{ year: 2019 }, { year: 2019 }, { year: 2020 }, { year: 2019 }]), [2019, '', 2020, 2019]);
});

test('nav overflow label exists in both languages', () => {
  assert.equal(i18n.en.ui.more, 'More');
  assert.equal(i18n.pt.ui.more, 'Mais');
});

test('hide/show strings carry no hardcoded key hint', () => {
  for (const l of ['en', 'pt']) for (const k of ['hideShort', 'show']) assert.ok(!/\(H\)/.test(i18n[l].ui[k]), `${l}.${k}`);
});
