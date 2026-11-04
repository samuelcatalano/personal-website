// Catalog axles must match the GLB tyre geometry (tools/vehicles/regional-fleet/measure_axles.py). The ambient wheel split sends each triangle of a
// wheel material to the axle centre within one tyre radius (+5 mm); a catalog axle off by centimetres leaves part of each tyre in the static body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const measured = JSON.parse(execFileSync('python3', ['-I', new URL('tools/vehicles/regional-fleet/measure_axles.py', root).pathname, '--json'], { encoding: 'utf8', maxBuffer: 1 << 24 }));
const { models } = JSON.parse(readFileSync(new URL('tools/vehicles/regional-fleet/models.json', root), 'utf8'));

for (const m of models) {
  test(`${m.id}: catalog axles match the tyre geometry (1 mm)`, () => {
    const a = m.axles, g = measured[m.id];
    for (const k of ['front', 'rear', 'height', 'wheelRadius', 'halfTrack']) {
      assert.ok(Math.abs(a[k] - g[k]) < 0.001, `${k}: catalog ${a[k]} vs geometry ${g[k].toFixed(3)}`);
    }
  });
}
