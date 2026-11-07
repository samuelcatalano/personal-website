import { stops, SECTIONS, sectionStart } from './content.js';
import { watchScroll, stopMarks, nearestStop, scrollYForStop, progressFromScroll, navLock } from './scroll.js';
import { routePoints, STOP_SPACING } from './world/layout.js';
import { initUI } from './ui.js';
import { createIntro } from './intro.js';
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
const follow = (p) => { const a = lock.filter(nearestStop(p, n, marks)); if (a !== null) ui.setActive(a); };
const goto = (i) => {
  lock.set(i);
  ui.setActive(i);
  scrollTo({ top: scrollYForStop(i, n, H(), innerHeight, marks) });
  clearTimeout(unlock);
  unlock = setTimeout(lock.clear, 8000); // ponytail: 8 s covers the slowest observed jump (~6 s); make it distance-based if routes grow
};
const ui = initUI({ onGoto: goto, onTheme: (t) => world?.setTheme(t) });
for (const ev of ['wheel', 'touchstart']) addEventListener(ev, lock.clear, { passive: true });
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
let seenIntro = false;
try { seenIntro = localStorage.getItem('intro') === 'seen'; } catch { /* storage blocked */ }
const intro = createIntro(document.getElementById('intro'), { seen: seenIntro || reducedMotion, onSeen: () => { try { localStorage.setItem('intro', 'seen'); } catch { /* storage blocked */ } } });
const hasWebGL = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } };
if (hasWebGL()) {
  document.body.classList.add('world-loading');
  intro.start();
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, {
      reducedMotion, onProgress: follow, onPick: (id) => goto(stops.findIndex((s) => s.id === id)),
    }))
    .then((w) => { world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready'); intro.ready(); })
    .catch((err) => { console.warn('3D world unavailable:', err); intro.dismiss(); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
