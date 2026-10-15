import { stops, SECTIONS, sectionStart } from './content.js';
import { watchScroll, nearestStop, scrollYForStop } from './scroll.js';
import { initUI } from './ui.js';

const n = stops.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.getElementById('track').style.height = `${n * 100}vh`;

let world = null;
let progress = 0;
const goto = (i) => scrollTo({
  top: scrollYForStop(i, n, document.documentElement.scrollHeight, innerHeight),
  behavior: reducedMotion ? 'auto' : 'smooth',
});
const ui = initUI({ onGoto: goto, onTheme: (t) => world?.setTheme(t) });

const hash = location.hash.slice(1);
if (SECTIONS.includes(hash)) goto(sectionStart(hash));

watchScroll((p) => {
  progress = p;
  ui.setActive(nearestStop(p, n));
  world?.setProgress(p);
});

const hasWebGL = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (hasWebGL()) {
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, { reducedMotion }))
    .then((w) => { world = w; w.setTheme(ui.theme); w.setProgress(progress); document.body.classList.add('world-ready'); })
    .catch((err) => { console.warn('3D world unavailable:', err); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
