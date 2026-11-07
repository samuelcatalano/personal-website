import { ding, hiss } from './sound.js';
import { stops, i18n } from './content.js';
import { loadState, onLoadChange } from './world/load-progress.js';
// Intro shown on every load. A toy bus follows the scroll wheel (or swipe, or arrow keys) along a miniature of the career line while the 3D world loads;
// the LED blind names the stop it is passing. While nobody has touched it the blind reports the real loading stage and the time in London.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Pure step logic (unit-tested): p = toy bus position 0..1; "down" = reached the end of the line, "up" = came back after that.
export function practice(state, dy) {
  const p = clamp01(state.p + dy / 500);
  return { p, down: state.down || p >= 1, up: state.up || (state.down && p <= 0) };
}
const JOURNEY = stops.filter((s) => s.section === 'journey');
export const journeyIndex = (p, n = JOURNEY.length) => Math.round(clamp01(p) * (n - 1));
// "2019 LONDON", "2003 PUC": the year plus the employer's initials, or the city where there are none (the move) or where the initials repeat (Glasgow).
export const careerLabel = (st, t) => `${st.year} ${st.id === 'glasgow' || !st.brand ? t.stops[st.id].place : st.brand.initials}`.toUpperCase();
const KEY_DY = { ArrowDown: 120, PageDown: 240, ' ': 240, ArrowUp: -120, PageUp: -240 };
const LEDS = 24;
export function createIntro(root, { onDrive = () => {}, onLite = () => {} } = {}) {
  let state = { p: 0, down: false, up: false }, active = false, belled = false, interacted = false, ready = false, tick, slowTimer;
  const card = root.querySelector('.intro-card'), cur = root.querySelector('.dest .cur'), nodesEl = root.querySelector('.nodes'), ledsEl = root.querySelector('.leds');
  const statusEl = root.querySelector('.status'), statusText = root.querySelector('#intro-status-text');
  const t = () => i18n[document.documentElement.lang.startsWith('pt') ? 'pt' : 'en'];
  nodesEl.innerHTML = JOURNEY.map((st, i) => `<i class="node ${st.country.toLowerCase()}${st.id === 'move' ? ' hub' : ''}" style="--f:${i / (JOURNEY.length - 1)}"></i>`).join('');
  ledsEl.innerHTML = '<i></i>'.repeat(LEDS);
  const nodes = [...nodesEl.children], leds = [...ledsEl.children];
  const londonTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date());
  // What the blind says: the bell wins, then the stop being passed, then "all aboard" once loaded, else loading stage and London time in turns.
  const blind = () => {
    const tt = t();
    if (belled) return [tt.ui.led.stop, true];
    if (interacted) return [careerLabel(JOURNEY[journeyIndex(state.p)], tt), false];
    if (ready) return [tt.ui.intro.ready, false];
    const stage = loadState().stage;
    return Math.floor(Date.now() / 2800) % 2 === 0 && stage ? [tt.ui.intro.stages[stage], false] : [`${tt.stops.move.place} ${londonTime()}`, false];
  };
  const paintBlind = () => {
    const [text, alert] = blind();
    cur.classList.toggle('alert', alert);
    if (cur.textContent !== text.toUpperCase()) { cur.textContent = text.toUpperCase(); cur.classList.remove('roll'); void cur.offsetWidth; cur.classList.add('roll'); }
  };
  const paintProgress = () => {
    const { ratio, stage } = loadState(), r = ready ? 1 : ratio;
    leds.forEach((l, i) => l.classList.toggle('on', i < Math.round(r * LEDS)));
    statusEl.setAttribute('aria-valuenow', String(Math.round(r * 100)));
    statusText.textContent = `${stage && !ready ? t().ui.intro.stages[stage] : t().ui.loading} ${Math.round(r * 100)}%`;
  };
  const render = () => {
    root.style.setProperty('--p', state.p);
    root.querySelector('[data-step="down"]').classList.toggle('done', state.down);
    root.querySelector('[data-step="up"]').classList.toggle('done', state.up);
    root.classList.toggle('celebrate', state.down && state.up);
    const at = journeyIndex(state.p);
    nodes.forEach((n, i) => { n.classList.toggle('passed', interacted && i <= at); n.classList.toggle('here', interacted && i === at); });
    paintBlind();
    if (active) onDrive(state.p); // the real bus behind the glass follows the toy one
  };
  const dismiss = ({ sound = false } = {}) => {
    if (!active) return;
    active = false; clearInterval(tick); clearTimeout(slowTimer); unsub();
    removeEventListener('wheel', onWheel); removeEventListener('keydown', onKey);
    removeEventListener('touchstart', onTouchStart); removeEventListener('touchmove', onTouchMove);
    root.classList.add('opening', 'leaving'); // the doors slide apart, then the glass lifts
    if (sound) hiss();
    onDrive(null); // hand the real bus back to the page scroll
    setTimeout(() => { root.hidden = true; document.body.classList.remove('intro-on'); }, 1300);
  };
  const step = (dy) => { if (dy) interacted = true; state = practice(state, dy); render(); };
  const onWheel = (e) => { e.preventDefault(); root.dataset.dir = e.deltaY > 0 ? 'down' : 'up'; step(e.deltaY); }; // the page must not scroll under the overlay
  let lastY = null; // swipe up = scroll down: the finger drags the toy bus the same way the wheel does
  const onTouchStart = (e) => { lastY = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (lastY === null || e.target.closest('button')) return;
    e.preventDefault();
    const y = e.touches[0].clientY, dy = (lastY - y) * 1.6;
    lastY = y; root.dataset.dir = dy > 0 ? 'down' : 'up'; step(dy);
  };
  const onKey = (e) => { if (KEY_DY[e.key] && !e.target.closest('button')) { e.preventDefault(); step(KEY_DY[e.key]); } };
  const unsub = onLoadChange(() => { if (active) { paintProgress(); paintBlind(); } });
  root.querySelector('[data-intro-skip]').addEventListener('click', () => { // pull the bell, let the blind say so, then the doors open
    if (belled || !active) return;
    belled = true; root.classList.add('bell'); paintBlind(); ding(); navigator.vibrate?.(40);
    setTimeout(() => dismiss({ sound: true }), 900);
  });
  root.querySelector('[data-intro-lite]').addEventListener('click', () => { onLite(); dismiss(); }); // slow connection: read the page without the 3D city
  root.addEventListener('pointermove', (e) => { // specular highlight that follows the cursor across the glass
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`); card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
  return {
    start() {
      active = true; root.hidden = false; document.body.classList.add('intro-on');
      addEventListener('wheel', onWheel, { passive: false });
      addEventListener('keydown', onKey);
      addEventListener('touchstart', onTouchStart, { passive: true }); addEventListener('touchmove', onTouchMove, { passive: false });
      const c = navigator.connection; // 110 MB of 3D: offer the plain page right away on slow or data-saver connections, after 8 s otherwise
      if (c && (c.saveData || /^(slow-)?2g$|^3g$/.test(c.effectiveType))) root.classList.add('slow');
      slowTimer = setTimeout(() => root.classList.add('slow'), 8000);
      tick = setInterval(() => { paintBlind(); }, 700);
      paintProgress(); render();
    },
    ready() { ready = true; root.classList.add('ready'); root.classList.remove('slow'); clearTimeout(slowTimer); if (active) { paintProgress(); onDrive(state.p); paintBlind(); } },
    dismiss,
  };
}
