// Auto-ride: the page scrolls itself from stop to stop, pausing at each one. Any wheel, touch, key or click hands control back.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
// first stop that is still ahead of the current scroll position (0 when the ride is over, so pressing play again restarts)
export const nextStop = (ys, y) => { const i = ys.findIndex((v) => v > y + 40); return i < 0 ? 0 : i; };
export const travelMs = (dist) => clamp((dist / 900) * 1000, 1400, 5500); // ponytail: constant speed with a floor and a cap; per-segment timing if the route gets uneven
export function createAutoRide({ ys, onState, dwell = 3400, instant = false }) {
  let token = 0, on = false;
  const stopEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const halt = (e) => { if (e?.target?.closest?.('[data-auto]')) return; stop(); };
  function stop() {
    if (!on) return;
    on = false; token++;
    for (const ev of stopEvents) removeEventListener(ev, halt);
    onState(false);
  }
  const travel = (y1, id) => new Promise((resolve) => {
    const y0 = scrollY, dur = instant ? 0 : travelMs(Math.abs(y1 - y0)), t0 = performance.now();
    const tick = (now) => {
      if (id !== token) return resolve(false);
      const k = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      scrollTo(0, y0 + (y1 - y0) * ease(k));
      k < 1 ? requestAnimationFrame(tick) : resolve(true);
    };
    requestAnimationFrame(tick);
  });
  const pause = (ms, id) => new Promise((resolve) => setTimeout(() => resolve(id === token), ms));
  async function start() {
    const stops = ys(), id = ++token;
    on = true; onState(true);
    for (const ev of stopEvents) addEventListener(ev, halt, { passive: true });
    for (let i = nextStop(stops, scrollY); i < stops.length; i++) {
      if (!(await travel(stops[i], id))) return;
      if (i < stops.length - 1 && !(await pause(typeof dwell === 'function' ? dwell() : dwell, id))) return;
    }
    if (id === token) stop();
  }
  return { toggle: () => (on ? stop() : start()), stop, get on() { return on; } };
}
