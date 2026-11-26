import test from 'node:test';
import assert from 'node:assert/strict';
import { navLock } from '../js/scroll.js';

// a menu or keyboard jump is pending from the moment it is set until its stop is reached; main.js counts only the landing stop then
test('navLock reports a pending jump until its target is reached', () => {
  const l = navLock();
  assert.equal(l.pending(), false);
  l.set(7);
  assert.equal(l.pending(), true);
  assert.equal(l.filter(3), null); // a passed stop does not clear it
  assert.equal(l.pending(), true);
  assert.equal(l.filter(7), 7);
  assert.equal(l.pending(), false);
});
