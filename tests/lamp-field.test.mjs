import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// lamp-field.js imports three; the node suite has no three, so load the pure data builder with the import stripped.
const source = readFileSync(new URL('../js/world/lamp-field.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const context = vm.createContext({ THREE: {} });
vm.runInContext(source, context);

test('lamp field peaks at a lamp, fades with distance and is zero beyond its reach', () => {
  const field = context.lampFieldData([[0, 0]]);
  const at = (x, z) => field.data[Math.floor((z - field.origin[1]) / field.size[1] * field.h) * field.w + Math.floor((x - field.origin[0]) / field.size[0] * field.w)];
  assert.ok(at(0, 0) > 100, 'lamp centre is lit');
  assert.ok(at(15, 0) > 0 && at(15, 0) < at(0, 0), 'light falls off with distance');
  assert.equal(at(20, 20), 0, 'beyond the 22 m reach stays dark');
});

test('no lamps means no field', () => {
  assert.equal(context.lampFieldData([]), null);
});
