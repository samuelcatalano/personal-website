import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const output = join(root, 'dist');
const runtimeExtensions = new Set(['.glb', '.gltf', '.hdr', '.bin', '.ktx2', '.png', '.jpg', '.jpeg', '.webp', '.woff', '.woff2', '.mp3', '.pdf']);

async function copyRuntimeAssets(source, destination) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name), to = join(destination, entry.name);
    const path = relative(join(root, 'assets'), from).split(/[\\/]/).join('/');
    if (path === 'models/source' || path.startsWith('models/source/')) continue;
    if (entry.isDirectory()) await copyRuntimeAssets(from, to);
    else if (runtimeExtensions.has(extname(entry.name).toLowerCase())) {
      await mkdir(dirname(to), { recursive: true });
      await cp(from, to);
    }
  }
}

await copyRuntimeAssets(join(root, 'assets'), join(output, 'assets'));
for (const file of ['sw.js', 'site.webmanifest', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'social-preview.png']) {
  try { await cp(join(root, file), join(output, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const fleet = join(output, 'tools/vehicles/regional-fleet');
await mkdir(fleet, { recursive: true });
await cp(join(root, 'tools/vehicles/regional-fleet/models.json'), join(fleet, 'models.json'));
