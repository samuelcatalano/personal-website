// Tiny synthesized sounds (no audio files). Only ever called from a click or tap, so autoplay rules allow them.
// The audio context is made on the first sound and released when the intro closes; after that these sounds do nothing.
let ac, released = false;
const ctx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
export const releaseSounds = () => { released = true; ac?.close().catch(() => {}); ac = null; };
function tone(freqs, { type = 'sine', gain = 0.15, attack = 0.01, decay = 1, at = 0 } = {}) {
  if (released) return;
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
// Pneumatic door hiss: a burst of high-passed noise with a quick attack and a long decay.
export const hiss = () => {
  if (released) return;
  try {
    const c = ctx(), t = c.currentTime, len = Math.floor(c.sampleRate * 0.6), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5;
    const src = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(hp).connect(g).connect(c.destination); src.start(t);
  } catch { /* no audio available */ }
};
