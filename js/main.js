import { stops, SECTIONS, sectionStart, i18n } from './content.js';
import { watchScroll, stopMarks, nearestStop, scrollYForStop, progressFromScroll, navLock } from './scroll.js';
import { routePoints, STOP_SPACING } from './world/layout.js';
import { initUI } from './ui.js';
import { createIntro } from './intro.js';
import { createAutoRide, travelMs } from './autoride.js';
import { whenSettled, loadState, onLoadChange } from './world/load-progress.js';
import { introState } from './intro-state.js';
import { makePostcard, download } from './postcard.js';
import { setEnabled } from './audio/engine.js';
const n = stops.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const introDebug = new URLSearchParams(location.search).has('debugIntro');
const navigationStart = performance.getEntriesByType('navigation')[0]?.startTime ?? 0;
const logIntroTiming = (event = 'event') => { if (introDebug) console.debug(`[intro-timing] ${event}: ${Math.round(performance.now() - navigationStart)}ms`); };
logIntroTiming('navigation start');
const pts = routePoints(n), marks = stopMarks(pts);
// one scroll budget per metre of road: a normal 30 m stop = 100vh, longer roads scroll proportionally longer
const length = pts.reduce((a, q, i) => a + (i ? Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z) : 0), 0);
document.getElementById('track').style.height = `${100 + (length / STOP_SPACING) * 100}vh`;
const H = () => document.documentElement.scrollHeight;
let world = null, progress = 0;
const lock = navLock();
let unlock;
const gapFrom = marks[stops.findIndex((s) => s.id === 'reclame')], gapTo = marks[stops.findIndex((s) => s.id === 'move')];
let previewed = false;
const previewPostcard = async () => { // the thumbnail on the return ticket: one frame of Wembley, a moment after the bus has arrived
  if (previewed || !world?.snapshot) return; previewed = true;
  try { await new Promise((r) => setTimeout(r, 1800)); ui.setPostcardPreview(URL.createObjectURL(await world.snapshot())); } catch { previewed = false; } // a failed frame is tried again on the next arrival
};
let near = -1; // the stop the bus was nearest to last time
const follow = (p) => {
  const k = nearestStop(p, n, marks), jumping = lock.pending();
  // stops the bus drives through count as visited, even one a fast scroll skipped; a menu or keyboard jump counts only where it lands
  if (k !== near) { if (!jumping) ui.passed(near < 0 ? k : near, k); near = k; }
  const a = lock.filter(k); if (a !== null) { if (jumping) ui.passed(a, a); ui.setActive(a); if (a === n - 1) previewPostcard(); } // a menu or keyboard jump counts its landing stop once it lands
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
// a held arrow keeps the page rolling, as holding the wheel would: speed eases in and out, the wheel or a touch takes over at once
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
// an arrow press scrolls like one mouse-wheel notch: NOTCH px, smoothly, and a held arrow rolls on through hold()
const NOTCH = 100; // ponytail: one wheel notch in Chrome on this machine; another mouse or a trackpad scrolls by its own amount
const nudge = (dir) => {
  glideId++; holdDir = 0; holdSpeed = 0; lock.clear(); // as the wheel does: a glide in flight stops and the menu lock lets go
  scrollBy({ top: dir * NOTCH, behavior: reducedMotion ? 'auto' : 'smooth' });
};
const goto = (i) => {
  lock.set(i);
  ui.setActive(i);
  glideTo(scrollYForStop(i, n, H(), innerHeight, marks));
  clearTimeout(unlock);
  unlock = setTimeout(lock.clear, 8000); // ponytail: 8 s covers the slowest observed jump (~6 s); make it distance-based if routes grow
};
const hash = location.hash.slice(1); // read before the UI rewrites it
const ui = initUI({ onGoto: goto, onHold: hold, onNudge: nudge, onTheme: (t) => world?.setTheme(t), onFocusStop: (list) => world?.highlight(list.map((i) => stops[i].id)) });
for (const ev of ['wheel', 'touchstart']) addEventListener(ev, () => { glideId++; holdDir = 0; holdSpeed = 0; lock.clear(); }, { passive: true });
const autoBtn = document.querySelector('[data-auto]'), quickBtn = document.querySelector('[data-quick]'), stopBtn = document.getElementById('stop-request');
let quick = false;
const ride = createAutoRide({
  ys: () => stops.map((_, i) => scrollYForStop(i, n, H(), innerHeight, marks)),
  dwell: () => (quick ? 1600 : 3400), // quick tour with reduced motion: every stop, snapped, 1.6 s each
  cruise: () => quick && !reducedMotion, // quick tour: one steady pass over the whole route (no stops)
  hold: () => ui.speaking(),
  keep: (e) => !!e.target?.closest?.('#stop-request') || (e.type === 'keydown' && (e.key === 'b' || e.key === 'B')),
  onState: (on) => { autoBtn.setAttribute('aria-pressed', String(on && !quick)); quickBtn.setAttribute('aria-pressed', String(on && quick)); stopBtn.hidden = !on || quick; }, instant: reducedMotion,
});
// "Request stop" (button or B) while the full auto-ride runs: the bus lingers at the next stop, like a pulled cord
const requestStop = () => {
  if (!ride.on || quick) return;
  ride.linger(8000); ui.say('stop', 3000);
  stopBtn.setAttribute('aria-pressed', 'true'); setTimeout(() => stopBtn.setAttribute('aria-pressed', 'false'), 3000);
};
stopBtn.addEventListener('click', requestStop);
document.addEventListener('keydown', (e) => { if ((e.key === 'b' || e.key === 'B') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.('input, textarea')) requestStop(); });
function toggleRide(nextQuick) {
  const stopping = ride.on && quick === nextQuick;
  ride.stop();
  lock.clear();
  if (stopping) return;
  quick = nextQuick;
  if (quick) scrollTo(0, 0);
  ride.toggle();
  ui.holdTight();
}
autoBtn.addEventListener('click', () => toggleRide(false));
quickBtn.addEventListener('click', () => toggleRide(true));
const toastEl = document.getElementById('toast'); let toastTimer;
const toast = (text) => { // postcard saved: visible for ~2 s, every time (the recap and live-region find only fire once)
  toastEl.textContent = text; toastEl.hidden = false; requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.classList.remove('show'); setTimeout(() => { toastEl.hidden = true; }, 300); }, 2200);
};
const photoBtn = document.querySelector('[data-photo]');
photoBtn.addEventListener('click', async () => {
  if (!world || photoBtn.disabled) return;
  photoBtn.disabled = true;
  try {
    const caption = ui.caption(), blob = await makePostcard(await world.snapshot(), caption, location.host + location.pathname.replace(/\/$/, ''), ui.stamps());
    download(blob, `samuel-catalano-${caption.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}.png`);
    sound?.shutter();
    toast((document.documentElement.lang.startsWith('pt') ? i18n.pt : i18n.en).ui.photoSaved);
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
let restTimer = 0; // the bus is at rest once scrolling has paused for a moment: the stop it reached rings its bell (ui.atRest)
watchScroll((p) => {
  progress = p;
  clearTimeout(restTimer); restTimer = setTimeout(() => ui.atRest(), 450);
  if (!world) follow(p);
  world?.setProgress(p);
});
const DRIVE = 0.03; // share of the route the intro lets the visitor drive (about one stop)
const intro = createIntro(document.getElementById('intro'), {
  onDrive: (p) => world?.setProgress(p === null ? progress : p * DRIVE),
  onBoard: () => ui.callingAt(),
});
const loading = document.getElementById('loading');
const loadingText = loading?.querySelector('[data-i18n="loading"]');
const paintLoadState = ({ phase, stage, progress }) => {
  document.body.dataset.loadState = phase;
  if (!loading || !loadingText) return;
  loading.hidden = phase !== 'loading';
  if (phase === 'loading') {
    const ui = (document.documentElement.lang.startsWith('pt') ? i18n.pt : i18n.en).ui;
    const label = stage ? (ui.intro.stages[stage] || ui.cities.sp).replace(/…$/, '') : ui.cities.sp;
    loadingText.textContent = ui.intro.loadingProgress.replace('{stage}', label).replace('{percent}', progress);
  }
};
intro.state.subscribe(paintLoadState);
onLoadChange(() => { const { ratio, stage } = loadState(); introState.loading(stage || 'city', ratio * 100); });
document.addEventListener('langchange', () => paintLoadState(introState.current));
const hasWebGL = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } };
const canRender3d = hasWebGL();
const deviceMemory = Reflect.get(navigator, 'deviceMemory');
const weakDevice = (deviceMemory && deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
const beginWorld = (showIntro = false) => {
  if (!canRender3d) { document.body.classList.add('no-webgl'); return; }
  document.body.classList.remove('summary-mode', 'no-webgl');
  document.body.classList.add('world-loading');
  if (showIntro) intro.start();
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, {
      reducedMotion, onProgress: follow, onPick: (id) => (id === 'bus' ? ui.say('horn') : goto(stops.findIndex((s) => s.id === id))),
    }))
    .then(async (w) => {
      world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready');
      await new Promise((resolve) => {
        const frame = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
        frame(); setTimeout(resolve, 250);
      });
      if (showIntro) { logIntroTiming('first scene ready'); intro.ready(); logIntroTiming('CTA enabled'); }
      else introState.ready();
      whenSettled().then(() => { document.body.classList.add('world-settled'); introState.ready(); logIntroTiming('all assets loaded'); if (showIntro && intro.active) ui.readyToDepart(); });
    })
    .catch((err) => { console.warn('3D world unavailable:', err); if (showIntro) intro.dismiss(); document.body.classList.add('no-webgl', 'summary-mode'); });
};
document.getElementById('load-experience')?.addEventListener('click', () => beginWorld(false));
if (!canRender3d) document.body.classList.add('no-webgl');
else if (reducedMotion || weakDevice) document.body.classList.add('summary-mode');
else beginWorld(true);

// A second visit loads the 3D assets from the cache (sw.js); ?nosw skips it for tests and captures
if ('serviceWorker' in navigator && !/[?&]nosw\b/.test(location.search)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}), { once: true });
