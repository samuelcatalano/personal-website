// NPC review renders without a server: Playwright serves the repo root and the GLB through request routing.
//   node tools/npc/review.mjs <out.png> <pack.glb> "mode=sheet&t=0.3" [w h]   rows = NPCs; cols = front, 3/4, side, back, face, face 3/4
//   node tools/npc/review.mjs <out.png> <pack.glb> "mode=crowd&n=80" 1600 900  crowd walking towards the camera (reference framing)
// three@0.169.0 is read from THREE_DIR (an unpacked npm tarball: `npm pack three@0.169.0`), so the CDN is not needed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(process.env.PW_REQUIRE || '/opt/node22/lib/node_modules/');
const pw = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const THREE_DIR = process.env.THREE_DIR || '/tmp/npcwork/package';
const [out, glb, q = 'mode=sheet', w = 1200, h = 1600] = process.argv.slice(2);
const b = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const TYPES = { '.js': 'application/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.json': 'application/json' };
await p.route('**/*', (r) => {
  const u = new URL(r.request().url());
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.169.0/')) return r.fulfill({ path: path.join(THREE_DIR, u.pathname.slice(19)), contentType: TYPES['.js'] });
  if (u.hostname !== 'npc.local') return r.abort();
  if (u.pathname === '/__glb') return r.fulfill({ path: path.resolve(glb), contentType: TYPES['.glb'] });
  const f = path.join(ROOT, u.pathname === '/__review.html' ? 'tools/npc/review.html' : u.pathname);
  return fs.existsSync(f) ? r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`http://npc.local/__review.html?${q}`);
await p.waitForFunction(() => document.title === 'done', null, { timeout: 180000 }).catch(() => errs.push('timeout'));
const cdp = await p.context().newCDPSession(p);
const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
console.log('errors:', errs.slice(0, 5));
await b.close();
