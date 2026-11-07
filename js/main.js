import { stops, SECTIONS, sectionStart } from './content.js';
import { watchScroll, stopMarks, nearestStop, scrollYForStop, progressFromScroll, navLock } from './scroll.js';
import { routePoints, STOP_SPACING } from './world/layout.js';
import { initUI } from './ui.js';
import { createIntro } from './intro.js';
import { horn } from './sound.js';
import { createAutoRide } from './autoride.js';
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
const goto = (i) => {
  lock.set(i);
  ui.setActive(i);
  scrollTo({ top: scrollYForStop(i, n, H(), innerHeight, marks) });
  clearTimeout(unlock);
  unlock = setTimeout(lock.clear, 8000); // ponytail: 8 s covers the slowest observed jump (~6 s); make it distance-based if routes grow
};
const ui = initUI({ onGoto: goto, onTheme: (t) => world?.setTheme(t) });
for (const ev of ['wheel', 'touchstart']) addEventListener(ev, lock.clear, { passive: true });
const autoBtn = document.querySelector('[data-auto]');
const ride = createAutoRide({
  ys: () => stops.map((_, i) => scrollYForStop(i, n, H(), innerHeight, marks)),
  onState: (on) => autoBtn.setAttribute('aria-pressed', String(on)), instant: reducedMotion,
});
autoBtn.addEventListener('click', () => { lock.clear(); ride.toggle(); });
const photoBtn = document.querySelector('[data-photo]');
photoBtn.addEventListener('click', async () => {
  if (!world || photoBtn.disabled) return;
  photoBtn.disabled = true;
  try {
    const caption = ui.caption(), blob = await makePostcard(await world.snapshot(), caption, location.host + location.pathname.replace(/\/$/, ''));
    download(blob, `samuel-catalano-${caption.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}.png`);
  } catch (err) { console.warn('postcard failed:', err); } finally { photoBtn.disabled = false; }
});
const hash = location.hash.slice(1);
if (SECTIONS.includes(hash)) addEventListener('load', () => requestAnimationFrame(() => {
  if (scrollY === 0) {
    goto(sectionStart(hash));
    world?.jump(progressFromScroll(scrollY, H(), innerHeight));
  }
}), { once: true });
watchScroll((p) => {
  progress = p;
  if (!world) follow(p);
  world?.setProgress(p);
});
const DRIVE = 0.03; // share of the route the intro lets the visitor drive (about one stop)
let lite = false; // the visitor chose to read without the 3D city
const intro = createIntro(document.getElementById('intro'), {
  onDrive: (p) => world?.setProgress(p === null ? progress : p * DRIVE),
  onLite: () => { lite = true; document.body.classList.add('no-webgl'); world?.dispose?.(); world = null; },
});
const hasWebGL = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } };
if (hasWebGL()) {
  document.body.classList.add('world-loading');
  intro.start();
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, {
      reducedMotion, onProgress: follow, onPick: (id) => (id === 'bus' ? (horn(), ui.say('horn')) : goto(stops.findIndex((s) => s.id === id))),
    }))
    .then((w) => { if (lite) { w.dispose?.(); return; } world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready'); intro.ready(); })
    .catch((err) => { console.warn('3D world unavailable:', err); intro.dismiss(); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
