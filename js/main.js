import { stops, SECTIONS, sectionStart, QUICK } from './content.js';
import { watchScroll, stopMarks, nearestStop, scrollYForStop, progressFromScroll, navLock } from './scroll.js';
import { routePoints, STOP_SPACING } from './world/layout.js';
import { initUI } from './ui.js';
import { createIntro } from './intro.js';
import { createAutoRide, travelMs } from './autoride.js';
import { whenSettled } from './world/load-progress.js';
import { makePostcard, download } from './postcard.js';
import { setEnabled } from './audio/engine.js';
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
  hold: () => ui.speaking(),
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
    sound?.shutter();
    ui.discover('postcard');
  } catch (err) { console.warn('postcard failed:', err); } finally { photoBtn.disabled = false; }
});
// Sound is on by default; the visitor's choice is remembered on this device. The driver module loads on first use.
const soundBtn = document.querySelector('[data-sound]');
let sound = null;
const setSound = (v, save = true) => {
  soundBtn.setAttribute('aria-pressed', String(v));
  if (save) try { localStorage.setItem('sound', v ? 'on' : 'off'); } catch { /* storage blocked */ }
  setEnabled(v); // inside the click or key press: browsers only start audio from a gesture
  if (v && !sound) import('./audio/index.js')
    .then((m) => { sound ||= m.createSound({ stops, marks, progress: () => progress, night: () => ui.theme === 'night', world: () => world }); })
    .catch(() => {});
};
soundBtn.addEventListener('click', () => setSound(soundBtn.getAttribute('aria-pressed') !== 'true'));
let soundPref = null;
try { soundPref = localStorage.getItem('sound'); } catch { /* storage blocked */ }
if (soundPref !== 'off') { // on by default (nothing chosen yet counts as on); it still waits for the first click or key press of this visit
  soundBtn.setAttribute('aria-pressed', 'true');
  const wake = (e) => {
    removeEventListener('pointerdown', wake, true); removeEventListener('keydown', wake, true);
    if (!e.target.closest?.('[data-sound]') && soundBtn.getAttribute('aria-pressed') === 'true') setSound(true, false);
  };
  addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true);
}
document.addEventListener('click', (e) => { if (e.target.closest?.('button, a')) sound?.tick(); });
const target = SECTIONS.includes(hash) ? sectionStart(hash) : stops.findIndex((s) => s.id === hash);
if (target > 0 || SECTIONS.includes(hash)) addEventListener('load', () => requestAnimationFrame(() => {
  if (scrollY === 0) {
    goto(target);
    world?.jump(progressFromScroll(scrollY, H(), innerHeight));
  }
}), { once: true });
if (hash) addEventListener('load', () => requestAnimationFrame(() => history.replaceState(null, '', location.pathname + location.search)), { once: true }); // a typed #stop link is used once, then the address goes back to the plain URL
watchScroll((p) => {
  progress = p;
  if (!world) follow(p);
  world?.setProgress(p);
});
// Frozen stills of the three cities for the intro windshield: jump the camera to each, grab a frame, then put it back (skipped if the visitor is already driving)
const stills = async (w) => {
  if (!w.snapshot || intro.interacted || !intro.active) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), frames = (k) => new Promise((r) => { const f = (i) => (i ? requestAnimationFrame(() => f(i - 1)) : r()); f(k); }), at = (i) => marks[i], out = {};
  let cover = null, coverUrl = '';
  try {
    out.sp = await w.snapshot();
    // the camera tours London and Glasgow for their stills: the first still stays on screen over the canvas so nobody sees it travel
    cover = Object.assign(document.createElement('img'), { src: (coverUrl = URL.createObjectURL(out.sp)), alt: '' });
    Object.assign(cover.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', objectFit: 'cover', zIndex: '1', pointerEvents: 'none' });
    document.body.append(cover); await cover.decode?.().catch(() => {});
    for (const [city, p] of [['london', (at(9) + at(10)) / 2], ['glasgow', at(stops.findIndex((s) => s.id === 'glasgow'))]]) {
      if (intro.interacted || !intro.active) return;
      w.jump(p); await wait(450); out[city] = await w.snapshot();
    }
    intro.showPreviews(out);
  } finally { w.jump(progress); await frames(3); cover?.remove(); if (coverUrl) URL.revokeObjectURL(coverUrl); } // hand the camera back to the page scroll, then drop the cover once a frame is drawn
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
      reducedMotion, onProgress: follow, onPick: (id) => (id === 'bus' ? ui.say('horn') : goto(stops.findIndex((s) => s.id === id))),
    }))
    .then((w) => { world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready'); intro.worldLoaded();
      whenSettled().then(async () => { document.body.classList.add('world-settled');
        await stills(w).catch(() => {}); // the still tour moves the camera and streams more of the city: Board opens only after it has finished and the load has settled again, so nothing changes after the release
        await whenSettled(); intro.ready(); }); })
    .catch((err) => { console.warn('3D world unavailable:', err); intro.dismiss(); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}

// A second visit loads the 3D assets from the cache (sw.js); ?nosw skips it for tests and captures
if ('serviceWorker' in navigator && !/[?&]nosw\b/.test(location.search)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}), { once: true });
