// First-visit intro shown while the 3D world loads: a toy bus that follows the scroll wheel teaches "scroll down to ride, up to go back".
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Pure step logic (unit-tested): p = toy bus position 0..1; "down" = reached the flag, "up" = came back after that.
export function practice(state, dy) {
  const p = clamp01(state.p + dy / 500);
  return { p, down: state.down || p >= 1, up: state.up || (state.down && p <= 0) };
}
const KEY_DY = { ArrowDown: 120, PageDown: 240, ' ': 240, ArrowUp: -120, PageUp: -240 };
export function createIntro(root, { seen = false, onSeen = () => {} } = {}) {
  let state = { p: 0, down: false, up: false }, ready = false, active = false, timer;
  const go = root.querySelector('[data-intro-go]');
  const render = () => {
    root.style.setProperty('--p', state.p);
    root.querySelector('[data-step="down"]').classList.toggle('done', state.down);
    root.querySelector('[data-step="up"]').classList.toggle('done', state.up);
    root.classList.toggle('ready', ready);
    go.disabled = !ready;
  };
  const dismiss = () => {
    if (!active) return;
    active = false;
    removeEventListener('wheel', onWheel);
    removeEventListener('keydown', onKey);
    root.classList.add('leaving');
    timer = setTimeout(() => { root.hidden = true; document.body.classList.remove('intro-on'); }, 400);
    if (state.down && state.up) onSeen();
  };
  const step = (dy) => {
    state = practice(state, dy);
    render();
    if (ready && state.down && state.up) { clearTimeout(timer); timer = setTimeout(dismiss, 700); }
  };
  const onWheel = (e) => { e.preventDefault(); root.dataset.dir = e.deltaY > 0 ? 'down' : 'up'; step(e.deltaY); }; // the page must not scroll under the overlay
  const onKey = (e) => { if (KEY_DY[e.key] && !e.target.closest('button')) { e.preventDefault(); step(KEY_DY[e.key]); } };
  go.addEventListener('click', dismiss);
  root.querySelector('[data-intro-skip]').addEventListener('click', dismiss);
  return {
    start() {
      if (seen) return; // returning visitors only get the small loading pill
      active = true; root.hidden = false; document.body.classList.add('intro-on');
      addEventListener('wheel', onWheel, { passive: false });
      addEventListener('keydown', onKey);
      render();
    },
    ready() { ready = true; render(); if (state.down && state.up) step(0); },
    dismiss,
  };
}
