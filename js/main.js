import { stops, SECTIONS, sectionStart } from './content.js';
import { watchScroll, nearestStop, scrollYForStop, progressFromScroll } from './scroll.js';
import { initUI } from './ui.js';
const n = stops.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.getElementById('track').style.height = `${n * 100}vh`;
const H = () => document.documentElement.scrollHeight;
let world = null;
let progress = 0;
const goto = (i) => scrollTo({
  top: scrollYForStop(i, n, H(), innerHeight),
  behavior: 'auto',
});
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
  if (!world) ui.setActive(nearestStop(p, n));
  world?.setProgress(p);
});
const hasWebGL = () => { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } };
if (hasWebGL()) {
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, {
      reducedMotion, onProgress: (p) => ui.setActive(nearestStop(p, n)),
    }))
    .then((w) => { world = w; w.setProgress(progress); w.setTheme(ui.theme); document.body.classList.add('world-ready'); })
    .catch((err) => { console.warn('3D world unavailable:', err); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
