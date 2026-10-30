// Raw GLB -> production GLB: weld -> dedup -> prune -> simplify (optional) -> reorder -> Meshopt (lossless byte compression, NO quantization).
// Usage: node optimise.mjs <in.glb> <out.glb> [ratio=1] [error=0.001] [smooth]
// `smooth`: for sources with flat-shaded, unwelded triangles (3 vertices per triangle) the simplifier cannot collapse anything, so drop NORMAL, weld by position, simplify, then recompute smooth normals.
// `crease=<deg>[:Mat+Mat]`: after simplify, rebuild NORMAL from the simplified triangles (area-weighted, smoothed across faces within <deg> of each other, seams matched by position),
// for the named materials only (all when none). Simplification leaves interpolated normals that shade car panels in grey patches; flat `smooth` output is faceted. Combine: `smooth,crease=40`.
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
const flags = mode.split(','), creaseArg = flags.find((f) => f.startsWith('crease=')), smooth = flags.includes('smooth');
if (smooth) for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('NORMAL', null);
await doc.transform(weld(), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }), prune());
if (+ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: +error }));
if (smooth && !creaseArg) await doc.transform(normals({ overwrite: true }), weld()); // normals() unwelds; re-index so the runtime wheel split (index-based) works
if (creaseArg) {
  const [deg, only] = creaseArg.slice(7).split(':'), cosT = Math.cos(+deg * Math.PI / 180), names = only ? only.split('+') : null;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    if (names && !names.includes(p.getMaterial()?.getName())) continue;
    const pos = p.getAttribute('POSITION'), idx = p.getIndices(); if (!pos || !idx) continue;
    const P = pos.getArray(), I = idx.getArray(), nv = pos.getCount(), nf = I.length / 3, fn = new Float32Array(nf * 3), groups = new Map(), own = Array.from({ length: nv }, () => []);
    const key = (v) => `${Math.round(P[3 * v] * 1e5)},${Math.round(P[3 * v + 1] * 1e5)},${Math.round(P[3 * v + 2] * 1e5)}`, gid = new Array(nv);
    for (let v = 0; v < nv; v++) { const k = key(v); gid[v] = groups.get(k) ?? groups.set(k, []).get(k); }
    for (let f = 0; f < nf; f++) {
      const a = I[3 * f], b = I[3 * f + 1], c = I[3 * f + 2], ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], wx = P[3 * c] - P[3 * a], wy = P[3 * c + 1] - P[3 * a + 1], wz = P[3 * c + 2] - P[3 * a + 2];
      fn[3 * f] = uy * wz - uz * wy; fn[3 * f + 1] = uz * wx - ux * wz; fn[3 * f + 2] = ux * wy - uy * wx; // length = 2 x area
      for (const v of [a, b, c]) { own[v].push(f); gid[v].push(f); }
    }
    const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }, out = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      if (!own[v].length) { out[3 * v + 1] = 1; continue; }
      let rx = 0, ry = 0, rz = 0; for (const f of own[v]) { rx += fn[3 * f]; ry += fn[3 * f + 1]; rz += fn[3 * f + 2]; }
      const r = unit(rx, ry, rz); let x = 0, y = 0, z = 0;
      for (const f of gid[v]) { const n = unit(fn[3 * f], fn[3 * f + 1], fn[3 * f + 2]); if (n[0] * r[0] + n[1] * r[1] + n[2] * r[2] >= cosT) { x += fn[3 * f]; y += fn[3 * f + 1]; z += fn[3 * f + 2]; } }
      out.set(unit(x, y, z), 3 * v);
    }
    p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out));
  }
}
await doc.transform(reorder({ encoder: MeshoptEncoder }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, doc);
console.log(output, (statSync(output).size / 1048576).toFixed(2), 'MB');
