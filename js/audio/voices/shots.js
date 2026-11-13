// One-shot voices. Each makes a few nodes that stop by themselves; `live` counts them per family so the driver can cap them (VOICE_CAP in ../state.js).
import { noiseBuffer, tone } from '../engine.js';

export function createShots({ c, bus }) {
  const live = { drops: 0, passes: 0, steps: 0, birds: 0, bells: 0, thunder: 0, ui: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const filter = (type, f, q = 0.7) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const panner = (p) => { const n = c.createStereoPanner?.(); if (n) n.pan.value = p; return n ?? c.createGain(); };
  const count = (family, node, hold = 0) => {
    live[family]++;
    if (hold) setTimeout(() => live[family]--, hold * 1000); else node.onended = () => live[family]--;
  };
  // A stretch of the shared noise, starting at a random offset, with a gain envelope: [[time, level], ...] from t.
  const burst = (t, dur, env) => {
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = noiseBuffer(c); s.loop = true;
    g.gain.setValueAtTime(0.0001, t);
    for (const [at, v] of env) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + at);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return [s, g];
  };
  const sweep = (type, t, pts, env) => { // pts: [[time, hz], ...]; env as in burst
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(pts[0][1], t);
    for (const [at, f] of pts.slice(1)) o.frequency.exponentialRampToValueAtTime(f, t + at);
    g.gain.setValueAtTime(0.0001, t);
    for (const [at, v] of env) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + at);
    const end = env[env.length - 1][0];
    o.start(t); o.stop(t + end + 0.05);
    return [o, g];
  };

  return {
    live,
    // rain patter: one grain
    drop() {
      const t = c.currentTime + rnd(0, 0.09), [s, g] = burst(t, 0.03, [[0.002, rnd(0.015, 0.045)], [0.03, 0.0001]]);
      s.connect(filter('bandpass', rnd(2500, 6500), 1.5)).connect(g).connect(panner(rnd(-0.9, 0.9))).connect(bus.weather); count('drops', s);
    },
    // thunder: low-passed noise that rolls; a close strike opens with a crack
    thunder({ delay, gain, cut, dur }) {
      const t = c.currentTime + delay, lp = filter('lowpass', cut);
      const [s, g] = burst(t, dur, [[0.06, gain], [dur * 0.25, gain * 0.35], [dur * 0.4, gain * 0.6], [dur, 0.0001]]);
      lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(cut / 3, t + dur);
      s.connect(lp).connect(g).connect(bus.weather); count('thunder', s);
      if (gain > 0.4) { const [k, kg] = burst(t, 0.2, [[0.004, gain * 0.5], [0.2, 0.0001]]); k.connect(filter('highpass', 1800)).connect(kg).connect(bus.weather); }
    },
    // a car going by: tyre noise and an engine note that sweep across and drop in pitch (simple Doppler)
    pass() {
      const t = c.currentTime, dir = Math.random() < 0.5 ? -1 : 1, dur = rnd(1.6, 2.6), mid = dur * 0.45, level = rnd(0.16, 0.32), pan = panner(-dir * 0.9), bp = filter('bandpass', 900, 0.8);
      const [s, g] = burst(t, dur, [[mid, level], [dur, 0.0001]]);
      bp.frequency.setValueAtTime(1000, t); bp.frequency.exponentialRampToValueAtTime(520, t + dur);
      const f = rnd(95, 135), [o, og] = sweep('sawtooth', t, [[0, f * 1.06], [mid, f * 1.04], [mid + 0.3, f * 0.94], [dur, f * 0.92]], [[mid, level * 0.5], [dur, 0.0001]]);
      pan.pan?.setValueAtTime(-dir * 0.9, t); pan.pan?.linearRampToValueAtTime(dir * 0.9, t + dur);
      s.connect(bp).connect(g).connect(pan); o.connect(filter('lowpass', 500)).connect(og).connect(pan); pan.connect(bus.traffic); count('passes', s);
    },
    // a far car horn: two square tones behind a low-pass
    horn() {
      const t = c.currentTime, dur = rnd(0.18, 0.5), lp = filter('lowpass', 1700), pan = panner(rnd(-0.8, 0.8)), base = rnd(390, 440);
      for (const f of [base, base * 1.26]) { const [o, g] = sweep('square', t, [[0, f]], [[0.015, 0.05], [dur, 0.045], [dur + 0.05, 0.0001]]); o.connect(g).connect(lp); }
      lp.connect(pan).connect(bus.traffic);
    },
    // a songbird: two to four quick rising chirps
    chirp() {
      const pan = panner(rnd(-0.9, 0.9)), n = 2 + Math.floor(rnd(0, 3)), base = rnd(2800, 4200);
      for (let i = 0; i < n; i++) {
        const t = c.currentTime + i * rnd(0.09, 0.14), [o, g] = sweep('sine', t, [[0, base], [0.05, base * 1.35], [0.09, base * 0.95]], [[0.01, 0.08], [0.09, 0.0001]]);
        o.connect(g).connect(pan); if (!i) count('birds', o, 0.6);
      }
      pan.connect(bus.ambience);
    },
    // a gull: falling cries with a little vibrato
    gull() {
      const pan = panner(rnd(-0.9, 0.9)), n = 2 + Math.floor(rnd(0, 3)), lp = filter('bandpass', 1500, 1.2);
      for (let i = 0; i < n; i++) {
        const t = c.currentTime + i * 0.42, f = rnd(1250, 1500), [o, g] = sweep('sawtooth', t, [[0, f * 0.8], [0.07, f], [0.3, f * 0.72]], [[0.04, 0.1], [0.22, 0.07], [0.32, 0.0001]]);
        o.connect(g).connect(lp); if (!i) count('birds', o, 1.5);
      }
      lp.connect(pan).connect(bus.ambience);
    },
    // a boat horn on the river: a low chord that swells and fades
    boat() {
      const t = c.currentTime, lp = filter('lowpass', 600), pan = panner(rnd(-0.7, 0.7));
      for (const f of [110, 138.6, 165]) { const [o, g] = sweep('sawtooth', t, [[0, f]], [[0.25, 0.045], [1.5, 0.042], [2, 0.0001]]); o.connect(g).connect(lp); }
      lp.connect(pan).connect(bus.traffic);
    },
    step() {
      const t = c.currentTime + rnd(0, 0.09), [s, g] = burst(t, 0.05, [[0.004, rnd(0.2, 0.4)], [0.05, 0.0001]]);
      s.connect(filter('lowpass', rnd(500, 900))).connect(g).connect(panner(rnd(-0.9, 0.9))).connect(bus.people); count('steps', s);
    },
    // a tower bell: inharmonic partials over a hum, each with its own decay; `strikes` tolls `gap` seconds apart
    bell(f0, level, strikes, gap, decay) {
      const out = c.createGain(); out.gain.value = level; out.connect(bus.landmarks);
      for (let i = 0; i < strikes; i++) tone(c, out, [[f0 * 0.5, 0.55, 1], [f0, 1, 0.8], [f0 * 1.19, 0.6, 0.6], [f0 * 1.5, 0.4, 0.45], [f0 * 2, 0.5, 0.35], [f0 * 2.74, 0.25, 0.22], [f0 * 3.76, 0.14, 0.15]], { gain: 0.11, attack: 0.008, decay, at: i * gap });
      live.bells++; setTimeout(() => { live.bells--; out.disconnect(); }, ((strikes - 1) * gap + decay + 0.2) * 1000);
    },
    // the bus door at a stop: the intro's hiss, on the vehicles bus
    door() {
      const t = c.currentTime, [s, g] = burst(t, 0.6, [[0.03, 0.09], [0.6, 0.0001]]);
      s.connect(filter('highpass', 2200)).connect(g).connect(bus.vehicles);
    },
    tick() {
      if (live.ui >= 4) return;
      const out = c.createGain(); out.connect(bus.ui); tone(c, out, [[1900, 1], [2850, 0.3]], { gain: 0.05, attack: 0.003, decay: 0.07 });
      live.ui++; setTimeout(() => { live.ui--; out.disconnect(); }, 200);
    },
    // postcard: a camera shutter, two short clicks
    shutter() {
      for (const at of [0, 0.09]) { const [s, g] = burst(c.currentTime + at, 0.03, [[0.002, 0.09], [0.03, 0.0001]]); s.connect(filter('highpass', 2500)).connect(g).connect(bus.ui); }
    },
  };
}
