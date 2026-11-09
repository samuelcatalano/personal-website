import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scene = readFileSync(join(root, 'js/world/scene.js'), 'utf8');
const water = readFileSync(join(root, 'js/world/water.js'), 'utf8');

test('Thames boat foam uses hull-shaped bounds and a narrow band separate from pier foam', () => {
  assert.ok(/const boatBounds = \(\) =>/.test(scene), 'boats have a separate bounds list');
  assert.ok(/bounds\.push\(\{ x:.*?hz: Math\.min\(.*?1\.08/s.test(scene), 'foam bounds cap each boat to its hull beam');
  assert.ok(/piers, boats, reflectRoots/.test(scene), 'scene passes both edge sets to water');

  assert.ok(/FOAM_WIDTH = 1\.4, BOAT_FOAM_WIDTH = 0\.35/.test(water), 'boat foam width is narrower while pier width is unchanged');
  assert.ok(/uniform vec4 uBoats\[\$\{MAX_BOATS\}\]/.test(water), 'shader receives boat hull bounds separately');
  assert.ok(/uBoatFoamW: \{ value: BOAT_FOAM_WIDTH \}/.test(water), 'shader gets the narrower boat width');
  assert.ok(/u\.uBoatN\.value = Math\.min\(boats\.length, MAX_BOATS\)/.test(water), 'shader gets the active hull bounds');
  assert.ok(/float capsuleDist\(/.test(water), 'boat bounds use a capsule distance field');
  assert.ok(/boats\.slice\(0, MAX_BOATS\)\.forEach/.test(water), 'hull bounds are initialized with the water shader');
  assert.ok(/smoothstep\(-0\.08, uBoatFoamW/.test(water), 'boat foam stays in a narrow band around the hull');
  assert.ok(/uFoamW \* \(0\.6 \+ 0\.8 \* fn\), pierEdge/.test(water), 'bank and pier foam retain the shared width formula');
});
