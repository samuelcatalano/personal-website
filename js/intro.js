// Intro shown on every load: a toy bus that follows the scroll wheel teaches "scroll down to ride, up to go back".
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Pure step logic (unit-tested): p = toy bus position 0..1; "down" = reached the flag, "up" = came back after that.
export function practice(state, dy) {
  const p = clamp01(state.p + dy / 500);
  return { p, down: state.down || p >= 1, up: state.up || (state.down && p <= 0) };
}
// Which destination the roller blind shows for a toy-bus position (São Paulo, London, Glasgow).
export const destination = (p) => (p < 0.34 ? 0 : p < 0.67 ? 1 : 2);
// London bell: two sine partials with a fast exponential decay. Only ever called from a click, so autoplay rules allow it.
function ding() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)(), t = ac.currentTime;
    for (const [f, v] of [[1568, 0.16], [2352, 0.05]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1.15);
    }
  } catch { /* no audio available */ }
}
const KEY_DY = { ArrowDown: 120, PageDown: 240, ' ': 240, ArrowUp: -120, PageUp: -240 };
export function createIntro(root, { onDrive = () => {} } = {}) {
  let state = { p: 0, down: false, up: false }, active = false, belled = false;
  const dests = [...root.querySelectorAll('.dest span')], card = root.querySelector('.intro-card');
  const show = (i) => dests.forEach((d, k) => d.classList.toggle('on', k === i));
  const render = () => {
    root.style.setProperty('--p', state.p);
    root.querySelector('[data-step="down"]').classList.toggle('done', state.down);
    root.querySelector('[data-step="up"]').classList.toggle('done', state.up);
    root.classList.toggle('celebrate', state.down && state.up);
    if (!belled) show(destination(state.p));
    if (active) onDrive(state.p); // the real bus behind the glass follows the toy one
  };
  const dismiss = () => {
    if (!active) return;
    active = false;
    removeEventListener('wheel', onWheel);
    removeEventListener('keydown', onKey);
    root.classList.add('leaving');
    onDrive(null); // hand the real bus back to the page scroll
    setTimeout(() => { root.hidden = true; document.body.classList.remove('intro-on'); }, 900);
  };
  const step = (dy) => {
    state = practice(state, dy);
    render();
  };
  const onWheel = (e) => { e.preventDefault(); root.dataset.dir = e.deltaY > 0 ? 'down' : 'up'; step(e.deltaY); }; // the page must not scroll under the overlay
  const onKey = (e) => { if (KEY_DY[e.key] && !e.target.closest('button')) { e.preventDefault(); step(KEY_DY[e.key]); } };
  root.querySelector('[data-intro-skip]').addEventListener('click', () => { // pull the bell, let the blind say so, then step off
    if (belled || !active) return;
    belled = true; root.classList.add('bell'); show(3); ding();
    setTimeout(dismiss, 900);
  });
  root.addEventListener('pointermove', (e) => { // specular highlight that follows the cursor across the glass
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`); card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
  return {
    start() {
      active = true; root.hidden = false; document.body.classList.add('intro-on');
      addEventListener('wheel', onWheel, { passive: false });
      addEventListener('keydown', onKey);
      render();
    },
    ready() { root.classList.add('ready'); if (active) onDrive(state.p); }, // hides the loading status; the intro itself stays until the visitor clicks Skip
    dismiss,
  };
}
