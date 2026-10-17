import { stops, SECTIONS, sectionStart } from './content.js';
import { watchScroll, stopMarks, nearestStop, scrollYForStop, progressFromScroll } from './scroll.js';
import { routePoints, STOP_SPACING } from './world/layout.js';
import { initUI } from './ui.js';
const n = stops.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pts = routePoints(n), marks = stopMarks(pts);
// one scroll budget per metre of road: a normal 30 m stop = 100vh, longer roads scroll proportionally longer
const length = pts.reduce((a, q, i) => a + (i ? Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z) : 0), 0);
document.getElementById('track').style.height = `${100 + (length / STOP_SPACING) * 100}vh`;
const H = () => document.documentElement.scrollHeight;
let world = null, progress = 0;
const goto = (i) => scrollTo({ top: scrollYForStop(i, n, H(), innerHeight, marks) });
const ui = initUI({ onGoto: goto, onTheme: (t) => world?.setTheme(t) });
const hash = location.hash.slice(1);
if (SECTIONS.includes(hash)) addEventListener('load', () => requestAnimationFrame(() => {
  if (scrollY === 0) {
    goto(sectionStart(hash));
    world?.jump(progressFromScroll(scrollY, H(), innerHeight));
  }
}), { once: true });
watchScroll((p) => {
  progress = p;
  if (!world) ui.setActive(nearestStop(p, n, marks));
  world?.setProgress(p);
});
const hasWebGL = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } };
if (hasWebGL()) {
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, {
      reducedMotion, onProgress: (p) => ui.setActive(nearestStop(p, n, marks)),
    }))
    .then((w) => { world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready'); })
    .catch((err) => { console.warn('3D world unavailable:', err); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
