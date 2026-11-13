// Pure audio mix: scene facts in, voice gains / filter cutoffs / event rates out. No Web Audio, no three.js: tested in node (tests/audio-state.test.mjs).
import { smooth, PLANE_IN, PLANE_OUT, TURN_AT } from '../world/plane-path.js';
const c01 = (v) => Math.min(1, Math.max(0, v));
// Bus levels (linear). The sum of every voice at its loudest stays under the compressor's ceiling; see MASTER in engine.js.
export const BUS = Object.freeze({ ambience: 0.8, weather: 0.9, traffic: 0.7, vehicles: 0.8, people: 0.7, landmarks: 0.9, ui: 0.6 });
// Most one-shot voices of each family alive at once; a cue past the cap is dropped, never queued.
export const VOICE_CAP = Object.freeze({ drops: 8, passes: 3, steps: 4, birds: 3, bells: 4, thunder: 2, ui: 4 });
export const FULL_SPEED = 1.2; // stops per second the engine treats as flat out (an arrow-key hold is about 0.6, a long glide peaks near 1.5)

// i: { s: route position in stops, speed: stops/s, night: 0..1, rain, storm, wind, rs, rl, rg: mood fields, world: the 3D scene is up,
//      tunnel: 0..1 inside a tunnel or underpass, planeD: stops past the plane's flyby (null = no plane), crowd: 0..1 people near the camera,
//      bigben, glasgow: 0..1 closeness to each bell tower }
export function audioState(i, o = {}) {
  const night = c01(i.night ?? 0), rain = c01(i.rain ?? 0), day = 1 - night, dry = 1 - rain, w = i.world ? 1 : 0, tunnel = c01(i.tunnel ?? 0);
  const rs = c01(i.rs ?? 0), rl = c01(i.rl ?? 0), rg = c01(i.rg ?? 0), v = c01(Math.abs(i.speed ?? 0) / FULL_SPEED);
  // weather
  o.rain = rain > 0.02 ? 0.02 * rain ** 1.2 : 0; // a backdrop under the city beds; drizzle sits well below a storm
  o.rainCut = 3000 + 3500 * rain; // drizzle is duller; a storm opens up
  o.drops = rain > 0.05 ? 2 + 10 * rain : 0; // patter grains per second
  o.wind = c01((i.wind ?? 0) * (0.01 + 0.02 * rain ** 1.5) + 0.015 * rg); // wind rides with the rain: light rain has little wind; halved 2026-11-13, too loud
  o.windFreq = 320 + 260 * c01((i.wind ?? 0) / 1.1);
  // city beds: one per region, crossfaded by the mood's region weights; quieter and darker at night
  o.bedSp = rs * (0.36 - 0.16 * night);
  o.bedLon = rl * (0.3 - 0.13 * night);
  o.bedGla = rg * (0.22 - 0.1 * night);
  o.bedCut = 2400 - 1200 * night;
  o.crickets = 0.06 * rs * night * dry;
  o.birds = 0.5 * rs * day * dry;   // chirps per second (São Paulo by day)
  o.gulls = 0.1 * rg * day * (1 - 0.5 * rain); // Glasgow, by the Clyde
  o.horns = 0.05 * rs * (1 - 0.6 * night);
  o.boat = 0.02 * (rl + rg) * w;    // boat horns per second on the Thames and the Clyde
  // tunnel: the outside world goes dull, the bus's own engine fills the space
  o.outsideCut = 18000 * (700 / 18000) ** tunnel;
  // hero bus
  o.engine = w * (0.015 + 0.05 * v) * (1 + 0.5 * tunnel);
  o.engineFreq = 42 + 55 * v;
  o.road = w * v * (0.06 + 0.06 * rain);
  o.roadCut = 500 + 900 * v + 2500 * rain; // wet tyres hiss
  o.passes = w * (0.25 * rs + 0.18 * rl + 0.1 * rg) * (1 - 0.5 * night) * (0.4 + v); // cars going by per second
  // plane: swells as it comes in over the bus, drops in pitch and dulls as it turns away
  const d = i.planeD;
  if (w && d != null && d > PLANE_IN && d < PLANE_OUT) {
    const away = smooth(TURN_AT, PLANE_OUT, d);
    o.plane = 0.26 * smooth(PLANE_IN, PLANE_IN + 0.5, d) * (1 - smooth(TURN_AT + 0.5, PLANE_OUT, d));
    o.planePan = Math.max(-0.8, Math.min(0.8, (d - TURN_AT) * 0.9));
    o.planeCut = 3800 - 2900 * away; // bright roar on the approach (a jet is mostly hiss), dull rumble as it leaves
    o.planeRate = 1.12 - 0.3 * smooth(TURN_AT - 0.25, TURN_AT + 0.35, d); // simple Doppler
  } else { o.plane = 0; o.planePan = 0; o.planeCut = 700; o.planeRate = 1; }
  // people
  const crowd = c01(i.crowd ?? 0) * w * (1 - tunnel);
  o.crowd = 0.2 * crowd * (1 - 0.6 * night) * (1 - 0.5 * rain);
  o.steps = 2.5 * crowd * (1 - 0.6 * night) * (1 - v); // footsteps per second, heard when the bus is slow
  // landmarks
  o.bigben = w * c01(i.bigben ?? 0) * (1 - 0.6 * tunnel);
  o.glasgow = w * c01(i.glasgow ?? 0) * (1 - 0.6 * tunnel);
  return o;
}
// 0..1 closeness of route position s to a stop index, reaching zero `reach` stops away.
export const near = (s, at, reach = 1.2) => (at < 0 ? 0 : c01(1 - Math.abs(s - at) / reach));
// Does a random event with `rate` per second fire in this tick? Capped by the family's live voices.
export const fires = (rate, dt, live, cap, random = Math.random) => live < cap && random() < rate * dt;
// Thunder follows its flash by the distance of the strike (speed of sound), fainter and duller from far away.
export function thunder(km) {
  const far = c01((km - 0.4) / 3);
  return { delay: km / 0.343, gain: 0.5 - 0.3 * far, cut: 900 - 600 * far, dur: 2.5 + 3 * far };
}
// The door hisses once when the bus comes to rest at a stop after actually driving.
export function createDoor() {
  let moving = false;
  return (speed, s) => {
    const v = Math.abs(speed);
    if (v > 0.15) moving = true;
    if (moving && v < 0.02 && Math.abs(s - Math.round(s)) < 0.12) { moving = false; return true; }
    return false;
  };
}
// Bells toll when the bus comes close, once per approach: rearmed after it has driven away.
export function createToll(inAt = 0.45, outAt = 0.15) {
  let armed = true;
  return (closeness) => {
    if (armed && closeness > inAt) { armed = false; return true; }
    if (closeness < outAt) armed = true;
    return false;
  };
}
