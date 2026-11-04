// Shipped tree assets: foliage cutoff and normal-map format in the GLB, impostor atlas tile count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dir = new URL('../assets/processed/vegetation/', import.meta.url);
const glb = (() => {
  const buf = readFileSync(new URL('realistic-tree.glb', dir));
  assert.equal(buf.toString('latin1', 0, 4), 'glTF');
  assert.equal(buf.toString('latin1', 16, 20), 'JSON');
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
})();

test('foliage ships as an alpha-clipped MASK at the 0.42 cutoff', () => {
  const leaves = glb.materials.filter((m) => /leaf|leaves/i.test(m.name));
  assert.ok(leaves.length > 0, 'leaf material present');
  for (const m of leaves) {
    assert.equal(m.alphaMode, 'MASK', m.name);
    assert.ok(Math.abs(m.alphaCutoff - 0.42) < 1e-3, `${m.name} cutoff ${m.alphaCutoff}`);
  }
});

test('normal maps ship as KTX2 (UASTC), not PNG', () => {
  const normals = glb.materials.filter((m) => m.normalTexture);
  assert.ok(normals.length > 0, 'normal maps present');
  for (const m of normals) {
    const texture = glb.textures[m.normalTexture.index];
    const image = glb.images[texture.extensions?.KHR_texture_basisu?.source ?? texture.source];
    assert.equal(image.mimeType, 'image/ktx2', m.name);
  }
});

test('impostor atlas holds one 128 px tile per tree variant', () => {
  const tiles = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8')).variants.length;
  const png = readFileSync(new URL('tree-impostors.png', dir));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.equal(png.readUInt32BE(16), 128 * tiles, 'atlas width');
  assert.equal(png.readUInt32BE(20), 128, 'atlas height');
});
