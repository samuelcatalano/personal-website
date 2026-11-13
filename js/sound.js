// The intro's two synthesized sounds (no audio files). Only ever called from a click or tap, so autoplay rules allow them.
// They play on the shared engine's direct output (js/audio/engine.js) whatever the Sound toggle says, and stop for good when the intro closes.
import { audio, release, tone } from './audio/engine.js';
let released = false;
export const releaseSounds = () => { released = true; release(); };
// London bell: two sine partials with a fast decay.
export const ding = () => {
  if (released) return;
  try { const a = audio(); if (a) tone(a.c, a.direct, [[1568, 1], [2352, 0.33]], { decay: 1.1 }); } catch { /* no audio available */ }
};
// Pneumatic door hiss: a burst of high-passed noise with a quick attack and a long decay.
export const hiss = () => {
  if (released) return;
  try {
    const a = audio(); if (!a) return;
    const c = a.c, t = c.currentTime, len = Math.floor(c.sampleRate * 0.6), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5;
    const src = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(hp).connect(g).connect(a.direct); src.start(t);
  } catch { /* no audio available */ }
};
