export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function progressFromScroll(scrollY, scrollHeight, viewport) {
  const max = scrollHeight - viewport;
  return max <= 0 ? 0 : clamp01(scrollY / max);
}

export const nearestStop = (progress, n) => (n <= 1 ? 0 : Math.round(clamp01(progress) * (n - 1)));

// Bus parks for the first and last 20% of each segment so the reader can read the stop.
const DWELL = 0.2;
const smooth = (x) => x * x * (3 - 2 * x);
export function routeT(progress, n) {
  if (n <= 1) return 0;
  const s = clamp01(progress) * (n - 1);
  const i = Math.min(Math.floor(s), n - 2);
  const f = s - i;
  const moved = f <= DWELL ? 0 : f >= 1 - DWELL ? 1 : smooth((f - DWELL) / (1 - 2 * DWELL));
  return (i + moved) / (n - 1);
}

export const scrollYForStop = (i, n, scrollHeight, viewport) =>
  (n <= 1 ? 0 : i / (n - 1)) * Math.max(0, scrollHeight - viewport);

export function watchScroll(cb) {
  const emit = () => cb(progressFromScroll(scrollY, document.documentElement.scrollHeight, innerHeight));
  addEventListener('scroll', emit, { passive: true });
  addEventListener('resize', emit);
  emit(); // reflect real position on load (reload mid-page, #hash)
}
