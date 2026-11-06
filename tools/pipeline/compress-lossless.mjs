// Lossless Meshopt only: no weld, reorder, simplification, quantization or texture recompression.
// node tools/pipeline/compress-lossless.mjs source.glb output.glb
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renameSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [, , input, output] = process.argv;
assert.ok(input && output, 'Provide input and output GLB paths');
const pending = output + '.tmp.glb';
assert.ok(resolve(input) !== resolve(output) && resolve(input) !== resolve(pending), 'Input must remain unchanged');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const digest = (array) => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const snapshot = (doc) => {
  const root = doc.getRoot();
  const triangleIndices = new Set(root.listMeshes().flatMap(m => m.listPrimitives().filter(p => p.getMode() === 4).map(p => p.getIndices())));
  const accessorDigest = (a) => {
    const array = a.getArray();
    if (!triangleIndices.has(a)) return digest(array);
    // Meshopt may cyclically rotate triangle indices; preserve triangle order, winding and every vertex attribute exactly.
    const canonical = array.slice();
    for (let i = 0; i < array.length; i += 3) {
      const t = [array[i], array[i + 1], array[i + 2]], first = t.indexOf(Math.min(...t));
      for (let j = 0; j < 3; j++) canonical[i + j] = t[(first + j) % 3];
    }
    return digest(canonical);
  };
  return {
    accessors: root.listAccessors().map(a => [a.getName(), a.getType(), a.getNormalized(), a.getArray().constructor.name, accessorDigest(a)]),
    textures: root.listTextures().map(t => [t.getName(), t.getMimeType(), digest(t.getImage())]),
    nodes: root.listNodes().map(n => [n.getName(), n.getMatrix(), n.getMesh()?.getName(), n.listChildren().map(c => c.getName())]),
    materials: root.listMaterials().map(m => [m.getName(), m.getBaseColorFactor(), m.getMetallicFactor(), m.getRoughnessFactor(), m.getAlphaMode(), m.getDoubleSided()]),
    animations: root.listAnimations().map(a => [a.getName(), a.listChannels().length, a.listSamplers().length]),
    skins: root.listSkins().map(s => [s.getName(), s.listJoints().map(j => j.getName())]),
  };
};
const doc = await io.read(input), before = snapshot(doc);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
try {
  await io.write(pending, doc);
  assert.deepEqual(snapshot(await io.read(pending)), before, 'Decoded asset must preserve vertex/image bytes, triangles, scene transforms and material/rig metadata');
  renameSync(pending, output);
} finally { rmSync(pending, { force: true }); }
console.log(JSON.stringify({ input, output, before: statSync(input).size, after: statSync(output).size, verified: true }));
