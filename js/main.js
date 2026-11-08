import { stops, SECTIONS, sectionStart, QUICK } from './content.js';
import { watchScroll, stopMarks, nearestStop, scrollYForStop, progressFromScroll, navLock } from './scroll.js';
import { routePoints, STOP_SPACING } from './world/layout.js';
import { initUI } from './ui.js';
import { createIntro } from './intro.js';
import { horn } from './sound.js';
import { createAutoRide, travelMs } from './autoride.js';
import { whenSettled } from './world/load-progress.js';
import { makePostcard, download } from './postcard.js';
const n = stops.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pts = routePoints(n), marks = stopMarks(pts);
// one scroll budget per metre of road: a normal 30 m stop = 100vh, longer roads scroll proportionally longer
const length = pts.reduce((a, q, i) => a + (i ? Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z) : 0), 0);
document.getElementById('track').style.height = `${100 + (length / STOP_SPACING) * 100}vh`;
const H = () => document.documentElement.scrollHeight;
let world = null, progress = 0;
const lock = navLock();
let unlock;
const gapFrom = marks[stops.findIndex((s) => s.id === 'reclame')], gapTo = marks[stops.findIndex((s) => s.id === 'move')];
const follow = (p) => {
  const a = lock.filter(nearestStop(p, n, marks)); if (a !== null) ui.setActive(a);
  const m = (gapTo - gapFrom) * 0.15; // the long São Paulo to London stretch with the tunnel
  ui.note('gap', p > gapFrom + m && p < gapTo - m);
  ui.note('rain', !!world?.raining);
};
// stop-to-stop jumps glide on an ease curve (same timing as the auto-ride) instead of snapping, so the bus never lurches; a wheel or touch takes over at once
let glideId = 0;
const glideTo = (y1) => {
  const id = ++glideId, y0 = scrollY, dur = reducedMotion ? 0 : travelMs(Math.abs(y1 - y0)) * 1.15, t0 = performance.now();
  if (!dur) { scrollTo({ top: y1 }); return; }
  const tick = (now) => {
    if (id !== glideId) return;
    const k = Math.min(1, (now - t0) / dur);
    scrollTo(0, y0 + (y1 - y0) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
// holding → or ← keeps the bus rolling: speed eases in and out, the wheel or a touch takes over at once
const HOLD_SPEED = 560; // px/s of scroll, roughly one stop every 1.6 s
let holdDir = 0, holdSpeed = 0, holdRaf = 0, holdLast = 0;
const holdTick = (now) => {
  holdRaf = 0;
  const dt = holdLast ? Math.min(0.05, (now - holdLast) / 1000) : 0; holdLast = now;
  holdSpeed += (holdDir * HOLD_SPEED - holdSpeed) * Math.min(1, dt * 2.6);
  if (dt && Math.abs(holdSpeed) > 0.5) scrollBy(0, holdSpeed * dt);
  if (holdDir || Math.abs(holdSpeed) > 8) holdRaf = requestAnimationFrame(holdTick); else { holdSpeed = 0; holdLast = 0; }
};
const hold = (dir) => {
  if (dir === holdDir) return;
  holdDir = dir;
  if (dir && !reducedMotion) { glideId++; lock.clear(); }
  if (!holdRaf && (dir && !reducedMotion || holdSpeed)) { holdLast = 0; holdRaf = requestAnimationFrame(holdTick); }
};
const goto = (i) => {
  lock.set(i);
  ui.setActive(i);
  glideTo(scrollYForStop(i, n, H(), innerHeight, marks));
  clearTimeout(unlock);
  unlock = setTimeout(lock.clear, 8000); // ponytail: 8 s covers the slowest observed jump (~6 s); make it distance-based if routes grow
};
const hash = location.hash.slice(1); // read before the UI rewrites it
const ui = initUI({ onGoto: goto, onHold: hold, onTheme: (t) => world?.setTheme(t) });
for (const ev of ['wheel', 'touchstart']) addEventListener(ev, () => { glideId++; holdDir = 0; holdSpeed = 0; lock.clear(); }, { passive: true });
const autoBtn = document.querySelector('[data-auto]');
let quick = false;
const ride = createAutoRide({
  ys: () => stops.map((_, i) => scrollYForStop(i, n, H(), innerHeight, marks)).filter((_, i) => !quick || QUICK.includes(stops[i].id)),
  dwell: () => (quick ? 1600 : 3400),
  onState: (on) => autoBtn.setAttribute('aria-pressed', String(on)), instant: reducedMotion,
});
autoBtn.addEventListener('click', () => { quick = false; lock.clear(); ride.toggle(); });
document.querySelector('[data-quick]').addEventListener('click', () => { quick = true; scrollTo(0, 0); lock.clear(); ride.on ? ride.stop() : ride.toggle(); });
const photoBtn = document.querySelector('[data-photo]');
photoBtn.addEventListener('click', async () => {
  if (!world || photoBtn.disabled) return;
  photoBtn.disabled = true;
  try {
    const caption = ui.caption(), blob = await makePostcard(await world.snapshot(), caption, location.host + location.pathname.replace(/\/$/, ''), ui.stamps());
    download(blob, `samuel-catalano-${caption.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}.png`);
  } catch (err) { console.warn('postcard failed:', err); } finally { photoBtn.disabled = false; }
});
const target = SECTIONS.includes(hash) ? sectionStart(hash) : stops.findIndex((s) => s.id === hash);
if (target > 0 || SECTIONS.includes(hash)) addEventListener('load', () => requestAnimationFrame(() => {
  if (scrollY === 0) {
    goto(target);
    world?.jump(progressFromScroll(scrollY, H(), innerHeight));
  }
}), { once: true });
watchScroll((p) => {
  progress = p;
  if (!world) follow(p);
  world?.setProgress(p);
});
// Frozen stills of the three cities for the intro windshield: jump the camera to each, grab a frame, then put it back (skipped if the visitor is already driving)
const stills = async (w) => {
  if (!w.snapshot || intro.interacted) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), at = (i) => marks[i], out = { sp: await w.snapshot() };
  for (const [city, p] of [['london', (at(9) + at(10)) / 2], ['glasgow', at(stops.findIndex((s) => s.id === 'glasgow'))]]) {
    if (intro.interacted) return;
    w.jump(p); await wait(450); out[city] = await w.snapshot();
  }
  w.jump(0); intro.showPreviews(out);
};
const DRIVE = 0.03; // share of the route the intro lets the visitor drive (about one stop)
const intro = createIntro(document.getElementById('intro'), {
  onDrive: (p) => world?.setProgress(p === null ? progress : p * DRIVE),
});
const hasWebGL = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } };
if (hasWebGL()) {
  document.body.classList.add('world-loading');
  intro.start();
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, {
      reducedMotion, onProgress: follow, onPick: (id) => (id === 'bus' ? (horn(), ui.say('horn')) : goto(stops.findIndex((s) => s.id === id))),
    }))
    .then((w) => { world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready'); intro.worldLoaded();
      whenSettled().then(() => { document.body.classList.add('world-settled'); intro.ready(); stills(w).catch(() => {}); }); })
    .catch((err) => { console.warn('3D world unavailable:', err); intro.dismiss(); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
