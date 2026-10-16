export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export function progressFromScroll(scrollY, scrollHeight, viewport) {
  const max = scrollHeight - viewport;
  return max <= 0 ? 0 : clamp01(scrollY / max);
}
export const nearestStop = (progress, n) => (n <= 1 ? 0 : Math.round(clamp01(progress) * (n - 1)));
export const routeT = (progress, n) => (n <= 1 ? 0 : clamp01(progress));
export const scrollYForStop = (i, n, scrollHeight, viewport) =>
  (n <= 1 ? 0 : i / (n - 1)) * Math.max(0, scrollHeight - viewport);
export function watchScroll(cb) {
  const emit = () => cb(progressFromScroll(scrollY, document.documentElement.scrollHeight, innerHeight));
  addEventListener('scroll', emit, { passive: true });
  addEventListener('resize', emit);
  emit();
}
