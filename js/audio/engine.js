// One AudioContext for the whole site. Graph: buses (-> outside lowpass) -> mix (the Sound toggle) -> compressor -> master -> destination.
// `direct` skips the mix and the compressor: the intro bell and door hiss use it, so they sound as they always did.
// Every entry point swallows failures: no audio means silence, never a console error.
export const BUSES = ['ambience', 'weather', 'traffic', 'vehicles', 'people', 'landmarks', 'ui'];
export const MASTER = 1.2; // net of the compressor's automatic make-up gain; the loudest reference scene peaks near -2.5 dBFS (limit -1) in tests/audio.browser.py
let ac = null, graph = null, on = false, noise = null, held = false;
// The sound driver keeps voices on this context: once it exists the context is never closed.
export const hold = () => { held = true; };

// The whole graph on any context: the live one, or an OfflineAudioContext in tests/audio.browser.py.
export function buildGraph(c, mixLevel = 1) {
  const comp = c.createDynamicsCompressor(), master = c.createGain(), mix = c.createGain(), direct = c.createGain();
  comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25;
  master.gain.value = MASTER; mix.gain.value = mixLevel;
  mix.connect(comp).connect(master).connect(c.destination); direct.connect(c.destination);
  // `outside` dulls the world beyond the bus inside a tunnel; the bus's own sounds and the UI skip it
  const bus = {}, outside = c.createBiquadFilter();
  outside.type = 'lowpass'; outside.frequency.value = 18000; outside.Q.value = 0.5; outside.connect(mix);
  for (const k of BUSES) (bus[k] = c.createGain()).connect(k === 'vehicles' || k === 'ui' ? mix : outside);
  return { c, bus, mix, direct, outside };
}
export function audio() {
  try {
    if (!graph) { ac = new (window.AudioContext || window['webkitAudioContext'])(); graph = buildGraph(ac, on ? 1 : 0); }
    if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {});
    return graph;
  } catch { return null; }
}
export const enabled = () => on;
// Call from a click or key press: browsers only start audio after a gesture.
export function setEnabled(v) {
  on = !!v;
  const g = on ? audio() : graph;
  if (!g) return;
  try { g.mix.gain.cancelScheduledValues(g.c.currentTime); g.mix.gain.setTargetAtTime(on ? 1 : 0, g.c.currentTime, 0.08); } catch { /* silent */ }
  if (!on) setTimeout(() => { if (!on && ac) ac.suspend().catch(() => {}); }, 600); // faded out: stop the audio clock (audio() wakes it again)
}
// The intro is over: with sound off nothing else needs the context, so it is closed (it is made again if sound is turned on).
export function release() {
  if (on || held || !ac) return;
  ac.close().catch(() => {}); ac = graph = noise = null;
}
// Two seconds of white noise, shared by every noise voice (looped).
export function noiseBuffer(c) {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}
// Decaying partials: [[frequency, level], ...]. The intro bell, Big Ben and the UI ticks are all this.
export function tone(c, out, freqs, { type = 'sine', gain = 0.15, attack = 0.01, decay = 1, at = 0 } = {}) {
  const t = c.currentTime + at;
  for (const [f, v, d = 1] of freqs) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * v, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + decay * d);
    o.connect(g).connect(out); o.start(t); o.stop(t + decay * d + 0.05);
  }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  (document.hidden ? ac.suspend() : ac.resume()).catch(() => {});
});
