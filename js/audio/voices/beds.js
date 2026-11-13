// Continuous voices: built once, then only their parameters move (no node is made per tick). Levels come from audioState (../state.js).
import { noiseBuffer } from '../engine.js';

export function createBeds({ c, bus }) {
  const noise = () => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c); s.loop = true; s.start(0, Math.random() * 2); return s; };
  const filter = (type, f, q = 0.7) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const gain = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
  const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const lfo = (f, depth, param) => osc('sine', f).connect(gain(depth)).connect(param);

  // rain: a bright hiss plus a low wash, both under one gain
  const rain = gain(), rainLp = filter('lowpass', 6000);
  noise().connect(filter('highpass', 900)).connect(rainLp).connect(rain);
  noise().connect(filter('lowpass', 380)).connect(gain(0.5)).connect(rain);
  rain.connect(bus.weather);
  // wind: band-passed noise whose centre drifts
  const wind = gain(), windBp = filter('bandpass', 400, 1.4);
  const gust = gain(1);
  noise().connect(windBp).connect(gust).connect(wind).connect(bus.weather);
  lfo(0.13, 110, windBp.frequency); lfo(0.071, 0.3, gust.gain);
  // city beds: traffic rumble plus an "air" band, per region
  const bedLp = filter('lowpass', 2400); bedLp.connect(bus.ambience);
  const bed = (rumble, air, airLevel, swell) => {
    const g = gain(), body = gain(1);
    noise().connect(filter('lowpass', rumble)).connect(body);
    noise().connect(filter('bandpass', air, 0.6)).connect(gain(airLevel)).connect(body);
    lfo(swell, 0.2, body.gain);
    body.connect(g).connect(bedLp);
    return g;
  };
  const bedSp = bed(240, 950, 0.32, 0.09), bedLon = bed(170, 620, 0.24, 0.06), bedGla = bed(120, 420, 0.16, 0.045);
  // crickets (São Paulo nights): a high tone chopped by a fast LFO
  const crickets = gain(), chop = gain(0.5);
  osc('sine', 4300).connect(chop).connect(crickets).connect(bus.ambience);
  lfo(24, 0.5, chop.gain);
  // hero bus: two detuned saws through a low-pass, and tyre noise
  const engine = gain(), engineLp = filter('lowpass', 300, 1.2), o1 = osc('sawtooth', 42), o2 = osc('sawtooth', 63);
  o2.detune.value = 9;
  o1.connect(engineLp); o2.connect(gain(0.5)).connect(engineLp); engineLp.connect(engine).connect(bus.vehicles);
  const road = gain(), roadLp = filter('lowpass', 600);
  noise().connect(roadLp).connect(road).connect(bus.vehicles);
  // plane: jet roar, panned
  const plane = gain(), planeLp = filter('lowpass', 700), jet = noise(), pan = c.createStereoPanner?.() ?? gain(1);
  jet.connect(planeLp).connect(plane).connect(pan).connect(bus.traffic);
  // crowd murmur: three voice-band formants that swell out of step
  const crowd = gain();
  for (const [f, rate] of [[480, 0.37], [1100, 0.53], [2300, 0.71]]) {
    const g = gain(0.6);
    noise().connect(filter('bandpass', f, 2.2)).connect(g).connect(crowd);
    lfo(rate, 0.35, g.gain);
  }
  crowd.connect(bus.people);

  const to = (param, v, t, k = 0.25) => param.setTargetAtTime(v, t, k);
  return (s) => {
    const t = c.currentTime;
    to(rain.gain, s.rain, t); to(rainLp.frequency, s.rainCut, t);
    to(wind.gain, s.wind, t); to(windBp.frequency, s.windFreq, t, 1);
    to(bedSp.gain, s.bedSp, t, 0.6); to(bedLon.gain, s.bedLon, t, 0.6); to(bedGla.gain, s.bedGla, t, 0.6); to(bedLp.frequency, s.bedCut, t, 0.6);
    to(crickets.gain, s.crickets, t, 0.6);
    to(engine.gain, s.engine, t, 0.2); to(o1.frequency, s.engineFreq, t, 0.2); to(o2.frequency, s.engineFreq * 1.5, t, 0.2); to(engineLp.frequency, s.engineFreq * 6, t, 0.2);
    to(road.gain, s.road, t, 0.2); to(roadLp.frequency, s.roadCut, t, 0.2);
    to(plane.gain, s.plane, t, 0.3); to(planeLp.frequency, s.planeCut, t, 0.3); to(jet.playbackRate, s.planeRate, t, 0.3);
    if (pan.pan) to(pan.pan, s.planePan, t, 0.3);
    to(crowd.gain, s.crowd, t, 0.5);
  };
}
