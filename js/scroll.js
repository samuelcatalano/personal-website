export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export function progressFromScroll(scrollY, scrollHeight, viewport) {
  const max = scrollHeight - viewport;
  return max <= 0 ? 0 : clamp01(scrollY / max);
}
// marks[i] = share of the route length at stop i (0..1); omitted = stops evenly spaced
export function stopMarks(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)); // ponytail: chord length, not curve arc length
  return c.map((v) => v / (c[c.length - 1] || 1));
}
const markOf = (i, n, marks) => (marks ? marks[i] : n <= 1 ? 0 : i / (n - 1));
export function nearestStop(progress, n, marks) {
  if (n <= 1) return 0;
  const p = clamp01(progress);
  if (!marks) return Math.round(p * (n - 1));
  let best = 0;
  for (let i = 1; i < n; i++) if (Math.abs(marks[i] - p) < Math.abs(marks[best] - p)) best = i;
  return best;
}
// marks may hold any number of knots (stopMarks, or fineMarks for equal speed inside a segment): t = knot index / (knots - 1)
export function routeT(progress, n, marks) {
  if (n <= 1) return 0;
  const p = clamp01(progress);
  if (!marks) return p;
  const last = marks.length - 1;
  let s = 0;
  while (s < last - 1 && p > marks[s + 1]) s++;
  return (s + clamp01((p - marks[s]) / ((marks[s + 1] - marks[s]) || 1))) / last;
}
// refine stop marks with k knots per segment so the bus keeps one speed even where the spline speeds up (long roads)
export function fineMarks(marks, curve, k = 16) {
  const N = marks.length - 1, out = [marks[0]];
  let prev = curve.getPoint(0);
  for (let s = 0; s < N; s++) {
    const d = [];
    let sum = 0;
    for (let j = 1; j <= k; j++) { const q = curve.getPoint((s + j / k) / N); sum += q.distanceTo(prev); d.push(sum); prev = q; }
    for (const v of d) out.push(marks[s] + (v / (sum || 1)) * (marks[s + 1] - marks[s]));
  }
  return out;
}
export const scrollYForStop = (i, n, scrollHeight, viewport, marks) =>
  markOf(i, n, marks) * Math.max(0, scrollHeight - viewport);
// One answer for the journey counters: stops reached so far, and the career stop after the current one (-1 past the last). Header, panel and LED all read it.
export function tripState(stops, active, visited) {
  const journey = stops.flatMap((st, i) => (st.section === 'journey' ? [i] : []));
  return { count: journey.filter((i) => visited.has(i)).length, total: journey.length, next: journey.find((i) => i > active) ?? -1 };
}
// One wheel gesture moves the bus one stop. Deltas add up and fire a step at the threshold; after a quiet pause the next gesture starts clean,
// so trackpad inertia (a long tail of small deltas) never fires a second step. A gesture that runs into a glide (busy) is dropped.
// ponytail: thresholds are guesses for mouse notches and trackpad flicks; tune on a real trackpad if a flick ever moves two stops.
export function wheelSnap({ threshold = 30, quietMs = 200 } = {}) {
  let acc = 0, last = -Infinity, armed = true;
  return {
    feed(dy, now, busy) { // dy in px, now in ms; returns +1 / -1 for a step, 0 otherwise
      if (now - last > quietMs) { armed = true; acc = 0; }
      last = now;
      if (busy) { acc = 0; armed = false; return 0; } // a gesture that runs into a glide is dropped; it steps only after a pause
      if (!armed) { acc = 0; return 0; }
      acc += dy;
      if (Math.abs(acc) < threshold) return 0;
      armed = false;
      const dir = Math.sign(acc);
      acc = 0;
      return dir;
    },
  };
}
// After a menu jump the panel shows the clicked stop at once and ignores the stops the bus passes on the way.
export function navLock() {
  let target = null;
  return {
    set(i) { target = i; },
    clear() { target = null; },
    pending() { return target !== null; }, // a menu or keyboard jump is still riding to its stop
    filter(nearest) {
      if (target === null) return nearest;
      if (nearest !== target) return null;
      target = null;
      return nearest;
    },
  };
}
export function watchScroll(cb) {
  const emit = () => cb(progressFromScroll(scrollY, document.documentElement.scrollHeight, innerHeight));
  addEventListener('scroll', emit, { passive: true });
  addEventListener('resize', emit);
  emit();
}
