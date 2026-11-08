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
const KEY_DY = { ArrowRight: 35, ArrowLeft: -35, PageDown: 240, PageUp: -240, ' ': 240 }; // right drives forward, left goes back
const LEDS = 24;
export function createIntro(root, { onDrive = () => {} } = {}) {
  let soundsPlayed = false; // the bell and the door hiss belong to the first Skip only, never again
  let p = 0, auto = 0, autoTarget = 0, raf = 0, previewUrl = '', active = false, interacted = false, ready = false, tick, bellTimer, unsubscribe;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    statusText.textContent = ready ? ui.intro.loaded : `${stage ? ui.intro.stages[stage] : ui.loading} ${value}%`;
    autoTarget = ready ? 1 : ratio; // until the visitor takes the wheel, the toy bus rides the line as the world loads
    if (!interacted && !raf) raf = requestAnimationFrame(glide);
  };
  const glide = () => {
    raf = 0;
    if (!active || interacted) return;
    const d = autoTarget - auto;
    if (reduced || Math.abs(d) < 0.002) auto = autoTarget; else { auto += d * 0.06; raf = requestAnimationFrame(glide); }
    render();
  };
  const render = () => {
    const shown = interacted ? p : auto;
    root.style.setProperty('--p', shown);
    const at = journeyIndex(shown);
    const preview = at >= glasgow ? 'glasgow' : at >= border ? 'london' : 'sp';
    if (root.dataset.preview !== preview) {
      root.dataset.preview = preview;
      previewStops.forEach(stop => {
        if (stop.dataset.previewStop === preview) stop.setAttribute('aria-current', 'location');
        else stop.removeAttribute('aria-current');
      });
    }
    const moving = interacted || auto > 0.01;
    nodes.forEach((n, i) => { n.classList.toggle('passed', moving && i <= at); n.classList.toggle('here', moving && i === at); });
    paintBlind();
    onDrive(p);
  };
  const dismiss = ({ reveal = false } = {}) => {
    if (!active) return;
    active = false;
    clearInterval(tick);
    clearTimeout(bellTimer);
    if (previewUrl) setTimeout(() => URL.revokeObjectURL(previewUrl), 1500);
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
    if (soundsPlayed !== 'hiss') { soundsPlayed = 'hiss'; hiss(); }
    onDrive(null);
    setTimeout(close, 1300);
  };
  const step = (dy, direction = dy) => {
    if (!active || !dy) return;
    if (!interacted) { p = auto; root.querySelector('.intro-windshield').classList.remove('live'); } // take over from the loading ride without a jump; the real city steps aside for the illustrated road
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
    step(e.repeat ? dy / 2 : dy); // a held key eases: half a step per repeat
  };
  let lastY, lastX = 0;
  map.addEventListener('touchstart', e => { lastY = e.touches.length === 1 ? e.touches[0].clientY : undefined; lastX = e.touches[0]?.clientX ?? 0; }, { passive: true });
  let dragX = null; // mouse and pen: drag the toy bus along the line
  map.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.button) return; dragX = e.clientX; map.setPointerCapture(e.pointerId); map.classList.add('dragging'); });
  map.addEventListener('pointermove', e => { if (dragX === null) return; step((e.clientX - dragX) * 1.4); dragX = e.clientX; });
  const endDrag = () => { dragX = null; map.classList.remove('dragging'); };
  map.addEventListener('pointerup', endDrag); map.addEventListener('pointercancel', endDrag);
  map.addEventListener('touchmove', e => {
    if (lastY === undefined || e.touches.length !== 1) return;
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    step((lastY - y) * 1.6 + (x - lastX) * 1.6); // swipe up or drag right both drive forward
    lastY = y; lastX = x;
  }, { passive: true });
  skip.addEventListener('click', () => {
    if (!active || bellTimer) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { dismiss(); return; }
    bellTimer = setTimeout(() => dismiss({ reveal: true }), 900);
    root.classList.add('bell');
    paintBlind();
    if (!soundsPlayed) { soundsPlayed = 'bell'; ding(); }
    skip.disabled = true; // a second click cannot ring it again
    navigator.vibrate?.(40);
  });
  root.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
  return {
    start() {
      active = true;
      document.body.classList.add('intro-on');
      root.showModal();
      const hour = new Date().getHours(), tt = t(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      root.dataset.tod = hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night'; // the windshield follows the visitor's own clock
      const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening', city = { 'America/Sao_Paulo': 'sp', 'Europe/London': 'ldn' }[tz];
      root.querySelector('#intro-greet').textContent = `${tt.ui.intro.greet[part]}${city ? `, ${tt.ui.cities[city]}` : ''}`;
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
    showPreview(blob) { // the real city, frozen, comes through the windshield once the world is ready (until the visitor starts driving)
      if (!active || interacted || !blob) return;
      previewUrl = URL.createObjectURL(blob);
      const shield = root.querySelector('.intro-windshield'), img = new Image();
      img.className = 'live-view'; img.alt = ''; img.decoding = 'async';
      img.onload = () => { shield.append(img); requestAnimationFrame(() => { if (!interacted) shield.classList.add('live'); }); };
      img.src = previewUrl;
    },
    dismiss,
  };
}
