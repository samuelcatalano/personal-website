// Sound driver: about ten times a second it reads where the bus is, asks audioState for the mix and moves the voices there.
// Loaded only when sound is first turned on. It reads the route, the mood and the theme; it never writes to the scene.
import { audio, enabled, hold, BUSES } from './engine.js';
import { audioState, near, fires, thunder, createDoor, createToll, BUS, VOICE_CAP as CAP } from './state.js';
import { createBeds } from './voices/beds.js';
import { createShots } from './voices/shots.js';
import { createMood } from '../world/mood.js';
import { routeT } from '../scroll.js';
import { LANDMARKS, stopIndex, ukStart, scotRange } from '../world/layout.js';

// progress(): page scroll progress 0..1; night(): is the night theme on; world(): the 3D world, or null without WebGL
export function createSound({ stops, marks, progress, night, world }) {
  const a = audio();
  if (!a) return null;
  hold();
  for (const k of BUSES) a.bus[k].gain.value = BUS[k];
  const beds = createBeds(a), shots = createShots(a), moodAt = createMood(stops), st = {}, door = createDoor(), tollBen = createToll(), tollGla = createToll();
  const n = stops.length, uk = ukStart(stops), [g0, g1] = scotRange(stops).map((t) => t * (n - 1));
  const ben = stopIndex(stops, LANDMARKS.bigben), gla = stopIndex(stops, LANDMARKS.glasgow);
  // ponytail: crowd density comes from the stops the crowd plan gathers people at (crowd.js walkPaths), not from the live figures; read the plan if the murmur must follow them exactly
  const busy = ['se', 'masp', 'estaiada', 'bigben', 'eye', 'glasgow', 'wembley'].map((k) => stopIndex(stops, LANDMARKS[k])).concat(stopIndex(stops, 'mira'));
  // ponytail: tunnels are placed by route position (the swap tunnel half a stop before the first UK stop, the two Glasgow underpass arches at the scotRange ends), not by the bus's world position
  const tunnelAt = (s) => Math.min(1, Math.max(near(s, uk - 0.5, 0.3) * 2.5, near(s, g0, 0.06) * 3, near(s, g1, 0.06) * 3));
  let lastS = null, lastT = 0, speed = 0, flashing = false, nightK = night() ? 1 : 0;
  const many = (rate, dt, family, play) => { for (let k = Math.floor(rate * dt + Math.random()); k > 0 && shots.live[family] < CAP[family]; k--) play(); };
  const tick = () => {
    if (!enabled() || a.c.state !== 'running') { lastS = null; return; }
    try {
      const now = performance.now() / 1000, dt = lastS === null ? 0 : Math.min(0.5, now - lastT), w = world(), s = w?.routeS ?? routeT(progress(), n, marks) * (n - 1);
      if (dt) speed += (Math.abs(s - lastS) / dt - speed) * 0.5;
      lastS = s; lastT = now;
      nightK += ((night() ? 1 : 0) - nightK) * Math.min(1, dt / 1.4); // the scene eases day and night the same way
      const m = moodAt(s / (n - 1), dt);
      audioState({
        s, speed, night: nightK, rain: m.rain, storm: m.storm, wind: m.wind, rs: m.rs, rl: m.rl, rg: m.rg, world: !!w,
        tunnel: tunnelAt(s), planeD: uk >= 0 ? s - uk : null, crowd: Math.max(0.25, ...busy.map((i) => near(s, i, 0.8))), bigben: near(s, ben), glasgow: near(s, gla),
      }, st);
      beds(st);
      const t = a.c.currentTime;
      a.outside.frequency.setTargetAtTime(st.outsideCut, t, 0.15);
      a.bus.landmarks.gain.setTargetAtTime(BUS.landmarks * Math.max(st.bigben, st.glasgow), t, 0.3); // bells fade with distance
      if (!dt) return;
      many(st.drops, dt, 'drops', shots.drop);
      many(st.steps, dt, 'steps', shots.step);
      if (fires(st.passes, dt, shots.live.passes, CAP.passes)) shots.pass();
      if (fires(st.birds, dt, shots.live.birds, CAP.birds)) shots.chirp();
      if (fires(st.gulls, dt, shots.live.birds, CAP.birds)) shots.gull();
      if (fires(st.horns, dt, 0, 1)) shots.horn();
      if (fires(st.boat, dt, 0, 1)) shots.boat();
      if (w && door(speed, s)) shots.door();
      if (tollBen(st.bigben)) shots.bell(164.8, 1, 3, 4.2, 7);   // Big Ben: E, three tolls
      if (tollGla(st.glasgow)) shots.bell(261.6, 0.7, 2, 3.2, 4.5); // Glasgow University tower: lighter, two tolls
      // thunder answers the scene's lightning flash; without the 3D world a storm still rumbles now and then
      const flash = w ? (w.flash ?? 0) > 0 : fires(m.rain > 0.05 ? m.storm / 30 : 0, dt, 0, 1);
      if (flash && !flashing && shots.live.thunder < CAP.thunder) shots.thunder(thunder(0.4 + Math.random() * 3));
      flashing = flash;
    } catch (err) { st.error = String(err); /* a failed tick is a silent tick; tests/audio.browser.py reads this */ }
  };
  setInterval(tick, 100);
  const safe = (f) => () => { try { if (enabled()) f(); } catch { /* silent */ } };
  return { tick: safe(shots.tick), shutter: safe(shots.shutter), state: st, live: shots.live };
}
