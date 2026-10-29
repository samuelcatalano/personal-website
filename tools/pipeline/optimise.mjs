// Raw GLB -> production GLB: weld -> dedup -> prune -> simplify (optional) -> reorder -> Meshopt (lossless byte compression, NO quantization).
// Usage: node optimise.mjs <in.glb> <out.glb> [ratio=1] [error=0.001] [smooth]
// `smooth`: for sources with flat-shaded, unwelded triangles (3 vertices per triangle) the simplifier cannot collapse anything, so drop NORMAL, weld by position, simplify, then recompute smooth normals.
// dedup skips MATERIAL: the runtime and the fleet catalog address materials by their source names.
// Why no quantization: the runtime shaders (underbody darkening in vehicle-assets.js) and wheel splitting read local-space positions in metres;
// KHR_mesh_quantization moves scale/offset onto the node and changes that space. Add quantization per asset class only after the runtime is made space-independent.
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, simplify, reorder, normals } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [, , input, output, ratio = '1', error = '0.001', mode = ''] = process.argv;
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
if (mode === 'smooth') for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('NORMAL', null);
await doc.transform(weld(), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }), prune());
if (+ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: +error }));
if (mode === 'smooth') await doc.transform(normals({ overwrite: true }), weld()); // normals() unwelds; re-index so the runtime wheel split (index-based) works
await doc.transform(reorder({ encoder: MeshoptEncoder }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, doc);
console.log(output, (statSync(output).size / 1048576).toFixed(2), 'MB');
