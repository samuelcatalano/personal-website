// Auto-ride: the page scrolls itself from stop to stop, pausing at each one. Any wheel, touch, key or click hands control back.
// Quick tour (cruise): one steady pace over the whole route, top to bottom, with no pauses.
export const QUICK_TOUR_S = 100; // ponytail: the pace follows the page length, so the tour takes this many seconds on any screen
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
// first stop that is still ahead of the current scroll position (0 when the ride is over, so pressing play again restarts)
export const nextStop = (ys, y) => { const i = ys.findIndex((v) => v > y + 40); return i < 0 ? 0 : i; };
export const travelMs = (dist) => clamp((dist / 900) * 1000, 1400, 5500); // ponytail: constant speed with a floor and a cap; per-segment timing if the route gets uneven
// hold: optional, returns a promise the ride awaits after each pause (the spoken announcement still being read)
// keep: optional, true for an event that must not hand control back (the stop-request button and its key)
// cruise: optional, returns true for the quick tour: a steady scroll to the end instead of the stop-by-stop ride
export function createAutoRide({ ys, onState, dwell = 3400, instant = false, hold = null, keep = null, cruise = null }) {
  let token = 0, on = false, extra = 0; // extra: ms to linger at the next stop, from a pulled stop request
  const stopEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const halt = (e) => { if (e?.target?.closest?.('[data-auto], [data-quick]') || keep?.(e)) return; stop(); };
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
  // from the current position to the end of the page, at one constant speed that covers the rest in QUICK_TOUR_S seconds
  const drift = (id) => new Promise((resolve) => {
    const y1 = document.documentElement.scrollHeight - innerHeight, v = (y1 - scrollY) / QUICK_TOUR_S; // px per second
    let y = scrollY, last = performance.now();
    const tick = (now) => {
      if (id !== token) return resolve(false);
      y = Math.min(y1, y + v * (now - last) / 1000); last = now;
      scrollTo(0, y);
      y < y1 ? requestAnimationFrame(tick) : resolve(true);
    };
    requestAnimationFrame(tick);
  });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pause = async (ms, id) => {
    await wait(ms);
    while (extra > 0 && id === token) { const e = extra; extra = 0; await wait(e); } // a request made now or while travelling holds the bus a little longer
    return id === token;
  };
  async function start() {
    const stops = ys(), id = ++token;
    extra = 0; on = true; onState(true);
    for (const ev of stopEvents) addEventListener(ev, halt, { passive: true });
    if (cruise?.()) { if (await drift(id)) stop(); return; }
    for (let i = nextStop(stops, scrollY); i < stops.length; i++) {
      if (!(await travel(stops[i], id))) return;
      if (i < stops.length - 1) {
        if (!(await pause(typeof dwell === 'function' ? dwell() : dwell, id))) return;
        if (hold) { await hold(); if (id !== token) return; }
      }
    }
    if (id === token) stop();
  }
  return { toggle: () => (on ? stop() : start()), stop, linger: (ms) => { extra = ms; }, get on() { return on; } };
}
