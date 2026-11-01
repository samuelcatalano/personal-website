// Scene metrics at given route stops (desktop 1600x900). Same routing/loading as tools/qa/route-capture.mjs. No repo edits, no hooks in scene.js.
//   node tools/qa/scene-stats.mjs <outdir> [stops=1,3,5,7,9.5,11] [query=qa=1&weather=clear] [theme=day]
// Measures, per stop, after the scene settles:
//   - GL draw calls, triangles and instanced triangles per frame. Counted by wrapping WebGL draw/texture calls in an init script
//     (renderer.info is not reachable: scene.js keeps no renderer handle, and adding one is out of scope). Counts are per frame, averaged over FRAMES.
//   - texture uploads per frame (texImage2D / compressedTexImage2D; a rough proxy for texture churn, not a GPU memory figure).
//   - frame time from requestAnimationFrame deltas: median and p95 over FRAMES frames.
//   - JS heap used (CDP Performance.getMetrics JSHeapUsedSize), camera position, console errors.
// CAVEAT: this container renders with SwiftShader (CPU). Frame times are RELATIVE between runs only, never absolute GPU numbers.
// Env: W, H (1600x900), WAIT (ms settle per stop, 6000), FRAMES (120).
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(process.env.PW_REQUIRE || '/opt/node22/lib/node_modules/');
const pw = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const THREE_DIR = process.env.THREE_DIR || '/tmp/npcwork/package';
const [out, stopsArg = '1,3,5,7,9.5,11', query = 'qa=1&weather=clear', theme = 'day'] = process.argv.slice(2);
if (!out) { console.error('usage: node tools/qa/scene-stats.mjs <outdir> [stops] [query] [theme]'); process.exit(2); }
const stops = stopsArg.split(',').map(Number);
const W = +(process.env.W || 1600), H = +(process.env.H || 900), WAIT = +(process.env.WAIT || 6000), FRAMES = +(process.env.FRAMES || 120);
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ktx2': 'application/octet-stream', '.bin': 'application/octet-stream', '.woff2': 'font/woff2' };

// Runs before any page script. Wraps both WebGL contexts' draw and texture-upload entry points.
const INIT = () => {
  const S = (globalThis.__qaGL = { draws: 0, tris: 0, instTris: 0, texUploads: 0 });
  const wrap = (proto) => {
    const TRI = proto.TRIANGLES, STRIP = proto.TRIANGLE_STRIP;
    const count = (mode, n) => (mode === TRI ? n / 3 : mode === STRIP ? Math.max(0, n - 2) : 0);
    const de = proto.drawElements, da = proto.drawArrays, dei = proto.drawElementsInstanced, dai = proto.drawArraysInstanced;
    proto.drawElements = function (m, n) { S.draws++; S.tris += count(m, n); return de.apply(this, arguments); };
    proto.drawArrays = function (m, f, n) { S.draws++; S.tris += count(m, n); return da.apply(this, arguments); };
    proto.drawElementsInstanced = function (m, n, t, o, inst) { S.draws++; S.instTris += count(m, n) * inst; return dei.apply(this, arguments); };
    proto.drawArraysInstanced = function (m, f, n, inst) { S.draws++; S.instTris += count(m, n) * inst; return dai.apply(this, arguments); };
    const ti = proto.texImage2D, cti = proto.compressedTexImage2D;
    proto.texImage2D = function () { S.texUploads++; return ti.apply(this, arguments); };
    proto.compressedTexImage2D = function () { S.texUploads++; return cti.apply(this, arguments); };
  };
  if (globalThis.WebGL2RenderingContext) wrap(WebGL2RenderingContext.prototype);
  if (globalThis.WebGLRenderingContext) wrap(WebGLRenderingContext.prototype);
};

const pct = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(2); };
const r1 = (v) => (v == null ? null : +v.toFixed(1));

const b = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.addInitScript((t) => localStorage.setItem('theme', t), theme);
await p.addInitScript(INIT);
await p.route('**/*', (r) => {
  const u = new URL(r.request().url());
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.169.0/')) return r.fulfill({ path: path.join(THREE_DIR, u.pathname.slice(19)), contentType: TYPES['.js'] });
  if (u.hostname !== 'site.local') return r.abort();
  let f = path.join(ROOT, decodeURIComponent(u.pathname.replace(/^\/personal-website/, '')));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  return fs.existsSync(f) ? r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`http://site.local/${query ? '?' + query : ''}`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.body.classList.contains('world-ready'), null, { timeout: 120000 }).catch(() => errs.push('world-ready timeout'));
await p.addStyleTag({ content: '#panel,.bar,header,nav{visibility:hidden!important}' });
const cdp = await p.context().newCDPSession(p);
await cdp.send('Performance.enable');

const rows = [];
for (const s of stops) {
  await p.evaluate(async (stop) => {
    const S = await import('/js/scroll.js'), C = await import('/js/content.js'), L = await import('/js/world/layout.js');
    const n = C.stops.length, m = S.stopMarks(L.routePoints(n)), Hh = document.documentElement.scrollHeight, i = Math.floor(stop), f = stop - i;
    const a = S.scrollYForStop(i, n, Hh, innerHeight, m), bb = S.scrollYForStop(Math.min(n - 1, i + 1), n, Hh, innerHeight, m);
    scrollTo({ top: a + (bb - a) * f, behavior: 'instant' });
  }, s);
  await p.waitForTimeout(WAIT);
  // Sample FRAMES rAF ticks; read GL counters at the start and end of the window so only this window is counted.
  const res = await p.evaluate((n) => new Promise((resolve) => {
    const S = globalThis.__qaGL, deltas = []; let last = null, k = 0;
    const base = { ...S };
    const tick = (t) => {
      if (last !== null) deltas.push(t - last);
      last = t;
      if (++k <= n) return requestAnimationFrame(tick);
      const d = (key) => S[key] - base[key];
      resolve({ deltas, draws: d('draws'), tris: d('tris'), instTris: d('instTris'), texUploads: d('texUploads'), frames: n });
    };
    requestAnimationFrame(tick);
  }), FRAMES);
  const heap = await cdp.send('Performance.getMetrics').then((m) => m.metrics.find((x) => x.name === 'JSHeapUsedSize')?.value ?? null);
  const cam = await p.evaluate(() => { const c = globalThis.__qaCamera; return c ? c.position.toArray().map((v) => +v.toFixed(1)) : null; });
  const frames = res.frames;
  rows.push({
    stop: s, cam,
    frame_ms_median: pct(res.deltas, 0.5), frame_ms_p95: pct(res.deltas, 0.95),
    draws_per_frame: +(res.draws / frames).toFixed(1),
    tris_per_frame_k: +((res.tris / frames) / 1000).toFixed(1),
    inst_tris_per_frame_k: +((res.instTris / frames) / 1000).toFixed(1),
    tex_uploads_per_frame: +(res.texUploads / frames).toFixed(2),
    js_heap_mb: heap == null ? null : r1(heap / 1048576),
  });
  process.stdout.write(`stop ${s} done\n`);
}

const uniqErr = [...new Set(errs)].slice(0, 20);
fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify({ query, theme, W, H, WAIT, FRAMES, rows, errors: uniqErr }, null, 1));
const hdr = '| stop | cam x,y,z | frame ms median | frame ms p95 | draws/frame | tris/frame (k) | instanced tris/frame (k) | tex uploads/frame | JS heap MB |';
const md = [
  `# Scene stats: ?${query} theme=${theme} ${W}x${H}`,
  '',
  'SwiftShader CPU render: frame times are RELATIVE between runs only. Draw/tri/texture counts are GL-call counts per frame (wrapped), not renderer.info.',
  '',
  hdr, '|' + '---|'.repeat(9),
  ...rows.map((r) => `| ${r.stop} | ${r.cam ? r.cam.join(',') : '-'} | ${r.frame_ms_median} | ${r.frame_ms_p95} | ${r.draws_per_frame} | ${r.tris_per_frame_k} | ${r.inst_tris_per_frame_k} | ${r.tex_uploads_per_frame} | ${r.js_heap_mb} |`),
  '',
  `Console errors (${uniqErr.length}): ${uniqErr.length ? uniqErr.map((e) => e.slice(0, 160)).join(' || ') : 'none'}`,
];
fs.writeFileSync(path.join(out, 'stats.md'), md.join('\n') + '\n');
console.log('\n' + md.join('\n'));
await b.close();
