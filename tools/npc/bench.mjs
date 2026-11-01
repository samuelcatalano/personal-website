// NPC POC benchmark table: runs npc-poc/index.html with ?bench=1 for several NPC counts and shadow settings,
// then prints one row per run from window.__bench (set by the page when its sampling window ends).
//   node tools/npc/bench.mjs <pack.glb> [--mobile] [--counts 1,10,40] [--frames 60]
// Default: 1280x720 @1x, counts 1,5,10,20,40,80, shadows 0 and 1.
// --mobile: 375x812 @2x DPR, CDP Emulation.setCPUThrottlingRate rate 4, counts from --counts (default as above).
// The page's GLB request (/assets/npc/npc_pack.glb) and three@0.169.0 (CDN) are served locally; no server is started.
// three@0.169.0 is read from THREE_DIR (an unpacked npm tarball: `npm pack three@0.169.0`).
// NOTE: headless Chromium here runs WebGL on SwiftShader (software). Frame times and GPU numbers are RELATIVE only
// (A/B between packs or counts on the same machine), not representative of real GPU or phone performance.
// GPU time: the page exposes no renderer handle, so GPU timer queries cannot be wrapped from outside. The script only
// reports whether EXT_disjoint_timer_query_webgl2 is available; otherwise it prints "gpu: n/a (no timer query)".
// bones = total skinned-bone count in the scene (scales with NPC count, as the page reports it).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(process.env.PW_REQUIRE || '/opt/node22/lib/node_modules/');
const pw = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const THREE_DIR = process.env.THREE_DIR || '/tmp/npcwork/package';
const TYPES = { '.js': 'application/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.json': 'application/json' };

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const VALUE_OPTS = new Set(['--counts', '--frames']);
const glb = args.find((a, i) => !a.startsWith('--') && !VALUE_OPTS.has(args[i - 1]));
if (!glb) { console.error('usage: node tools/npc/bench.mjs <pack.glb> [--mobile] [--counts 1,10,40] [--frames 60]'); process.exit(2); }
const MOBILE = flag('--mobile');
const COUNTS = opt('--counts', '1,5,10,20,40,80').split(',').map(Number);
const FRAMES = Number(opt('--frames', '60'));
const GLB_PATH = path.resolve(glb);
const GLB_BYTES = fs.statSync(GLB_PATH).size;
const VIEW = MOBILE ? { width: 375, height: 812, dpr: 2 } : { width: 1280, height: 720, dpr: 1 };

const b = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
let gpuLine = null;

async function runOne(count, shadows) {
  const ctx = await b.newContext({ viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.dpr });
  const p = await ctx.newPage();
  await p.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.169.0/')) {
      return r.fulfill({ path: path.join(THREE_DIR, u.pathname.slice(19)), contentType: TYPES['.js'] });
    }
    if (u.hostname !== 'npc.local') return r.abort();
    if (u.pathname === '/assets/npc/npc_pack.glb') return r.fulfill({ path: GLB_PATH, contentType: TYPES['.glb'] });
    const f = path.join(ROOT, u.pathname);
    return fs.existsSync(f) && fs.statSync(f).isFile()
      ? r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' })
      : r.fulfill({ status: 404 });
  });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`[${count}/${shadows}] ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`[${count}/${shadows}] ${String(e)}`));
  const cdp = await ctx.newCDPSession(p);
  if (MOBILE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(`http://npc.local/npc-poc/index.html?count=${count}&bench=1&frames=${FRAMES}&shadows=${shadows}`);
  if (gpuLine === null) {
    const ext = await p.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && c.getContext('webgl2');
      return !!(gl && gl.getExtension('EXT_disjoint_timer_query_webgl2'));
    });
    gpuLine = ext ? 'gpu: timer query available, not measured (renderer not exposed by npc-poc)' : 'gpu: n/a (no timer query)';
  }
  const res = await p.waitForFunction(() => window.__bench, null, { timeout: 600000 })
    .then(() => p.evaluate(() => window.__bench))
    .catch(() => null);
  await ctx.close();
  return res;
}

const rows = [];
const shadowModes = [0, 1];
for (const count of COUNTS) {
  for (const shadows of shadowModes) {
    const r = await runOne(count, shadows);
    rows.push(r
      ? { count, shadows, med: r.medianMs.toFixed(2), p95: r.p95Ms.toFixed(2), calls: r.calls, tris: r.triangles, bones: r.bones, glb: GLB_BYTES }
      : { count, shadows, med: 'timeout', p95: '-', calls: '-', tris: '-', bones: '-', glb: GLB_BYTES });
  }
}

const head = ['count', 'shadows', 'median ms', 'p95 ms', 'draw calls', 'triangles', 'bones', 'GLB bytes'];
const data = rows.map(r => [r.count, r.shadows, r.med, r.p95, r.calls, r.tris, r.bones, r.glb]);
const widths = head.map((h, i) => Math.max(h.length, ...data.map(d => String(d[i]).length)));
const fmt = (cells) => cells.map((c, i) => String(c).padStart(widths[i])).join('  ');
console.log(`npc bench: ${path.basename(GLB_PATH)} · ${MOBILE ? 'mobile 375x812 @2x, CPU x4' : 'desktop 1280x720 @1x'} · frames=${FRAMES} · SwiftShader (relative only)`);
console.log(gpuLine);
console.log(fmt(head));
for (const d of data) console.log(fmt(d));
if (errs.length) console.log(`console errors: ${errs.length}`, errs.slice(0, 5));
await b.close();
