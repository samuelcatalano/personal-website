// Tiny synthesized sounds (no audio files). Only ever called from a click or tap, so autoplay rules allow them.
let ac;
const ctx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
function tone(freqs, { type = 'sine', gain = 0.15, attack = 0.01, decay = 1, at = 0 } = {}) {
  try {
    const c = ctx(), t = c.currentTime + at;
    for (const [f, v] of freqs) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * v, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + decay + 0.05);
    }
  } catch { /* no audio available */ }
}
// London bell: two sine partials with a fast decay.
export const ding = () => tone([[1568, 1], [2352, 0.33]], { decay: 1.1 });
// Bus horn: two close sawtooth notes, played twice.
export const horn = () => { for (const at of [0, 0.32]) tone([[392, 1], [494, 0.8]], { type: 'sawtooth', gain: 0.05, attack: 0.02, decay: 0.26, at }); };
