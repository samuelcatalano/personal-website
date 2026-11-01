// Reproducible route captures (desktop 1600x900) along the real scroll route, day and night. No server needed.
//   node tools/qa/route-capture.mjs <outdir> [stops=0,0.5,...] [themes=day,night] [query]
// Each PNG is <stop>-<theme>.png; meta.json records stop, theme, query and the camera (position/quaternion) per shot.
// three@0.169.0 comes from THREE_DIR (npm pack three@0.169.0, unpacked) so the CDN is not needed.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(process.env.PW_REQUIRE || '/opt/node22/lib/node_modules/');
const pw = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const THREE_DIR = process.env.THREE_DIR || '/tmp/npcwork/package';
const [out, stopsArg, themesArg = 'day,night', query = ''] = process.argv.slice(2);
const stops = (stopsArg || Array.from({ length: 27 }, (_, i) => i / 2).join(',')).split(',').map(Number);
const W = +(process.env.W || 1600), H = +(process.env.H || 900), WAIT = +(process.env.WAIT || 6000);
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ktx2': 'application/octet-stream', '.bin': 'application/octet-stream', '.woff2': 'font/woff2' };
const b = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const meta = [];
for (const theme of themesArg.split(',')) {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.addInitScript((t) => localStorage.setItem('theme', t), theme);
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
  for (const s of stops) {
    await p.evaluate(async (stop) => {
      const S = await import('/js/scroll.js'), C = await import('/js/content.js'), L = await import('/js/world/layout.js');
      const n = C.stops.length, m = S.stopMarks(L.routePoints(n)), Hh = document.documentElement.scrollHeight, i = Math.floor(stop), f = stop - i;
      const a = S.scrollYForStop(i, n, Hh, innerHeight, m), bb = S.scrollYForStop(Math.min(n - 1, i + 1), n, Hh, innerHeight, m);
      scrollTo({ top: a + (bb - a) * f, behavior: 'instant' });
    }, s);
    await p.waitForTimeout(WAIT);
    const cam = await p.evaluate(() => { const c = globalThis.__qaCamera; return c ? { pos: c.position.toArray().map((v) => +v.toFixed(2)), quat: c.quaternion.toArray().map((v) => +v.toFixed(4)) } : null; });
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = `${String(s).replace('.', '_')}-${theme}.png`;
    fs.writeFileSync(path.join(out, file), Buffer.from(r.data, 'base64'));
    meta.push({ file, stop: s, theme, query, cam });
    process.stdout.write(`${file} `);
  }
  meta.push({ theme, errors: [...new Set(errs)].slice(0, 20) });
  await p.close();
}
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
console.log('\ndone', out);
await b.close();
