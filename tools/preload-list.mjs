// Static-import closure of main.js and the 3D scene: the modules index.html preloads so the browser fetches them in parallel instead of one import level at a time.
// Usage: node tools/preload-list.mjs  (prints the <link> tags to paste into index.html; tests/preload.test.mjs fails when they drift)
import { readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function sceneModules() {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?from\s*'(\.\.?\/[^']+\.js)'|(?:^|\n)\s*import\s*'(\.\.?\/[^']+\.js)'/g)) {
      const spec = m[1] || m[2];
      visit(relative(root, join(root, dirname(file), spec)));
    }
  };
  visit('js/main.js');
  visit('js/world/scene.js');
  seen.delete('js/main.js'); // the entry script is already requested by its own <script> tag
  return [...seen].sort();
}
if (import.meta.url === `file://${process.argv[1]}`) for (const f of sceneModules()) console.log(`  <link rel="modulepreload" href="${f}">`);
