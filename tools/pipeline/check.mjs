// Asset budget report: node tools/pipeline/check.mjs [--strict]
// Reads every shipped GLB (assets/**/*.glb), reports bytes / triangles / meshes / materials / textures, flags GLBs no module references,
// and compares against budgets.json. Exit code 1 only with --strict and a hard-limit breach. Dev tool: never deployed.
import { NodeIO } from '@gltf-transform/core';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname, budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url)));
const walk = (d, ext, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f), s = statSync(p); if (s.isDirectory()) { if (!/node_modules|\/source\b/.test(p)) walk(p, ext, out); } else if (f.endsWith(ext)) out.push(p); } return out; };
const code = [...walk(join(ROOT, 'js'), '.js'), ...walk(join(ROOT, 'tests'), '.py'), join(ROOT, 'index.html')].map((f) => readFileSync(f, 'utf8')).join('\n');
const catalog = (() => { try { return readFileSync(join(ROOT, 'tools/vehicles/regional-fleet/models.json'), 'utf8'); } catch { return ''; } })();
const classOf = (rel) => /vehicles\/(a330)/.test(rel) ? 'airplane' : /vehicles\/.*bus/.test(rel) ? 'bus' : /vehicles\/mini/.test(rel) ? 'hero-car' : /vehicles\//.test(rel) ? 'car' : /landmarks\//.test(rel) ? 'landmark' : 'other';

const io = new NodeIO(), rows = [], breaches = [];
for (const file of walk(join(ROOT, 'assets'), '.glb')) {
  const rel = relative(ROOT, file), bytes = statSync(file).size, cls = classOf(rel), b = budgets[cls] ?? budgets.other;
  let tris = 0, meshes = 0, materials = 0, textures = 0, compressed = false, err = '';
  try {
    const doc = await io.read(file), root = doc.getRoot();
    for (const m of root.listMeshes()) { meshes++; for (const p of m.listPrimitives()) { const i = p.getIndices(), pos = p.getAttribute('POSITION'); tris += (i ? i.getCount() : pos?.getCount() ?? 0) / 3; } }
    materials = root.listMaterials().length; textures = root.listTextures().length;
    compressed = root.listExtensionsUsed().some((e) => /meshopt|draco|KHR_texture_basisu/i.test(e.extensionName));
  } catch (e) { err = String(e.message).slice(0, 60); }
  const name = basename(file), referenced = code.includes(name) || catalog.includes(name);
  const over = [];
  if (b.maxBytes && bytes > b.maxBytes) over.push('bytes');
  if (b.maxTris && tris > b.maxTris) over.push('tris');
  if (b.maxMaterials && materials > b.maxMaterials) over.push('materials');
  if (over.length) breaches.push(`${rel}: ${over.join(', ')}`);
  rows.push({ rel, cls, mb: +(bytes / 1048576).toFixed(2), tris: Math.round(tris), meshes, materials, textures, compressed, referenced, over: over.join('+') || '-', err });
}
rows.sort((a, c) => c.mb - a.mb);
console.table(rows.map(({ rel, cls, mb, tris, materials, textures, compressed, referenced, over }) => ({ file: rel.replace('assets/', ''), cls, MB: mb, tris, mats: materials, tex: textures, comp: compressed ? 'y' : 'n', used: referenced ? 'y' : 'NO', over })));
const total = rows.reduce((s, r) => s + r.mb, 0), shipped = rows.filter((r) => r.referenced).reduce((s, r) => s + r.mb, 0);
console.log(`total ${total.toFixed(1)} MB in ${rows.length} GLBs; referenced by runtime ${shipped.toFixed(1)} MB; unreferenced ${(total - shipped).toFixed(1)} MB (${rows.filter((r) => !r.referenced).length} files)`);
if (breaches.length) console.log('budget breaches:\n  ' + breaches.join('\n  '));
if (process.argv.includes('--strict') && breaches.length) process.exit(1);
