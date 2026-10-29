// Raw GLB -> production GLB: weld -> dedup -> prune -> simplify (optional) -> reorder -> Meshopt (lossless byte compression, NO quantization).
// Usage: node optimise.mjs <in.glb> <out.glb> [ratio=1] [error=0.001]
// Why no quantization: the runtime shaders (underbody darkening in vehicle-assets.js) and wheel splitting read local-space positions in metres;
// KHR_mesh_quantization moves scale/offset onto the node and changes that space. Add quantization per asset class only after the runtime is made space-independent.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, simplify, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [, , input, output, ratio = '1', error = '0.001'] = process.argv;
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(weld(), dedup(), prune());
if (+ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: +error }));
await doc.transform(reorder({ encoder: MeshoptEncoder }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, doc);
console.log(output, (statSync(output).size / 1048576).toFixed(2), 'MB');
