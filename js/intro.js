import { ding, hiss } from './sound.js';
import { stops, i18n } from './content.js';
import { loadState, onLoadChange } from './world/load-progress.js';
// Intro shown on every load. A toy bus follows the scroll wheel (or swipe, or arrow keys) along a miniature of the career line while the 3D world loads;
// the LED blind names the stop it is passing. While nobody has touched it the blind reports the real loading stage and the time in London.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Scroll, touch and keys share the same 0..1 route position.
export const practice = (p, dy) => clamp01(p + dy / 500);
const JOURNEY = stops.filter((s) => s.section === 'journey');
export const journeyIndex = (p, n = JOURNEY.length) => Math.round(clamp01(p) * (n - 1));
// "2019 LONDON", "2003 PUC": the year plus the employer's initials, or the city where there are none (the move) or where the initials repeat (Glasgow).
export const careerLabel = (st, t) => `${st.year} ${st.id === 'glasgow' || !st.brand ? t.stops[st.id].place : st.brand.initials}`.toUpperCase();
const KEY_DY = { ArrowUp: 120, ArrowDown: -120, PageDown: 240, PageUp: -240, ' ': 240 };
const LEDS = 24;
export function createIntro(root, { onDrive = () => {} } = {}) {
  let p = 0, active = false, interacted = false, ready = false, tick, bellTimer, unsubscribe;
  const map = root.querySelector('.intro-map'), cur = root.querySelector('.dest .cur');
  const nodesEl = root.querySelector('.nodes'), ledsEl = root.querySelector('.leds');
  const statusEl = root.querySelector('.status'), statusText = root.querySelector('#intro-status-text');
  const skip = root.querySelector('[data-intro-skip]');
  const previewStops = [...root.querySelectorAll('[data-preview-stop]')];
  const t = () => i18n[document.documentElement.lang.startsWith('pt') ? 'pt' : 'en'];
  const fraction = i => i / (JOURNEY.length - 1);
  const border = JOURNEY.findIndex(st => st.id === 'move');
  const glasgow = JOURNEY.findIndex(st => st.id === 'glasgow');
  root.style.setProperty('--border-stop', `${100 * fraction(border)}%`);
  nodesEl.innerHTML = JOURNEY.map((st, i) => `<i class="node ${st.country.toLowerCase()}${i === border ? ' hub' : ''}" style="--f:${fraction(i)}"></i>`).join('');
  ledsEl.innerHTML = '<i></i>'.repeat(LEDS);
  const nodes = [...nodesEl.children], leds = [...ledsEl.children];
  const londonClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  const paintBlind = () => {
    const tt = t(), { stage } = loadState();
    let label = ready ? tt.ui.intro.ready : `${tt.stops.move.place} ${londonClock.format(new Date())}`;
    if (bellTimer) label = tt.ui.led.stop;
    else if (interacted) label = careerLabel(JOURNEY[journeyIndex(p)], tt);
    else if (!ready && stage && Math.floor(Date.now() / 2800) % 2 === 0) label = tt.ui.intro.stages[stage];
    const text = label.toUpperCase();
    if (cur.textContent !== text) {
      cur.textContent = text;
      cur.classList.remove('roll');
      void cur.offsetWidth;
      cur.classList.add('roll');
    }
  };
  const paintProgress = () => {
    const { ratio, stage } = loadState(), value = ready ? 100 : Math.round(ratio * 100), ui = t().ui;
    leds.forEach((l, i) => l.classList.toggle('on', i < Math.round(value * LEDS / 100)));
    statusEl.setAttribute('aria-valuenow', String(value));
    statusText.textContent = ready ? ui.intro.ready : `${stage ? ui.intro.stages[stage] : ui.loading} ${value}%`;
  };
  const render = () => {
    root.style.setProperty('--p', p);
    const at = journeyIndex(p);
    const preview = at >= glasgow ? 'glasgow' : at >= border ? 'london' : 'sp';
    if (root.dataset.preview !== preview) {
      root.dataset.preview = preview;
      previewStops.forEach(stop => {
        if (stop.dataset.previewStop === preview) stop.setAttribute('aria-current', 'location');
        else stop.removeAttribute('aria-current');
      });
    }
    nodes.forEach((n, i) => { n.classList.toggle('passed', interacted && i <= at); n.classList.toggle('here', interacted && i === at); });
    paintBlind();
    onDrive(p);
  };
  const dismiss = ({ reveal = false } = {}) => {
    if (!active) return;
    active = false;
    clearInterval(tick);
    clearTimeout(bellTimer);
    unsubscribe();
    document.removeEventListener('keydown', onKey);
    const close = () => {
      root.close();
      document.body.classList.remove('intro-on');
      const heading = document.querySelector('#panel :is(h1, h2)');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    };
    const animate = reveal && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate) { onDrive(null); close(); return; }
    root.classList.add('opening', 'leaving');
    hiss();
    onDrive(null);
    setTimeout(close, 1300);
  };
  const step = (dy, direction = dy) => {
    if (!active || !dy) return;
    interacted = true;
    root.dataset.dir = direction > 0 ? 'down' : 'up';
    p = practice(p, dy);
    render();
  };
  root.addEventListener('wheel', e => {
    if (e.ctrlKey || (root.scrollHeight > root.clientHeight && !map.contains(e.target))) return;
    e.preventDefault();
    step(e.deltaY);
  }, { passive: false });
  const onKey = e => {
    const dy = KEY_DY[e.key];
    if (!dy || e.altKey || e.ctrlKey || e.metaKey || (e.key === ' ' && e.target === skip)) return;
    e.preventDefault();
    step(dy, e.key.startsWith('Arrow') ? -dy : dy);
  };
  let lastY;
  map.addEventListener('touchstart', e => { lastY = e.touches.length === 1 ? e.touches[0].clientY : undefined; }, { passive: true });
  map.addEventListener('touchmove', e => {
    if (lastY === undefined || e.touches.length !== 1) return;
    const y = e.touches[0].clientY;
    step((lastY - y) * 1.6);
    lastY = y;
  }, { passive: true });
  skip.addEventListener('click', () => {
    if (!active || bellTimer) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { dismiss(); return; }
    bellTimer = setTimeout(() => dismiss({ reveal: true }), 900);
    root.classList.add('bell');
    paintBlind();
    ding();
    navigator.vibrate?.(40);
  });
  root.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
  return {
    start() {
      active = true;
      document.body.classList.add('intro-on');
      root.showModal();
      document.addEventListener('keydown', onKey);
      unsubscribe = onLoadChange(() => { if (active) { paintProgress(); paintBlind(); } });
      tick = setInterval(paintBlind, 700);
      paintProgress();
      render();
    },
    ready() {
      ready = true;
      if (active) { paintProgress(); render(); }
    },
    dismiss,
  };
}
