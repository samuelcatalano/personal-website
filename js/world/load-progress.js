// Counts the GLB requests the world makes so the intro can show real progress. Modules request in waves, so the total is only known late:
// the denominator is max(total so far, EXPECTED), which keeps the bar from jumping backwards early on.
// ponytail: EXPECTED is a rough count of a full load (about 36 GLB today); once the real total passes it the ratio is exact.
const EXPECTED = 30;
let total = 0, done = 0;
const pending = [], listeners = new Set();
const emit = () => listeners.forEach((f) => f());
export const labelOf = (url) => /\/(vehicles|landmarks|npc|buildings|vegetation)\//.exec(url)?.[1] ?? 'city';
export function trackLoad(url, promise) {
  const entry = { label: labelOf(url) };
  total++; pending.push(entry); emit();
  const end = () => { done++; pending.splice(pending.indexOf(entry), 1); emit(); };
  promise.then(end, end);
  return promise;
}
export const loadState = () => ({ ratio: Math.min(1, done / Math.max(total, EXPECTED)), stage: pending.at(-1)?.label ?? null, done, total });
export const onLoadChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
