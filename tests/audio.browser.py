# With the local preview open at /?nosw&weather=rain (the ride check needs rain): browser-harness < tests/audio.browser.py
# 1) renders two reference scenes offline through the real graph and voices: not silent, peak below -1 dBFS
# 2) drives the live Sound button with a real click: unlocks, remembers the choice, the mix carries signal, and turns off again
import json, time
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
prior_sound = js("localStorage.getItem('sound')")  # the live section toggles the button; the saved choice is put back at the end
offline = js(r'''(async () => {
  const { buildGraph, BUSES } = await import('./js/audio/engine.js');
  const { audioState, thunder, BUS } = await import('./js/audio/state.js');
  const { createBeds } = await import('./js/audio/voices/beds.js');
  const { createShots } = await import('./js/audio/voices/shots.js');
  const render = async (input, events, only) => {
    const c = new OfflineAudioContext(2, 44100 * 8, 44100); let comp; const mk = c.createDynamicsCompressor.bind(c); c.createDynamicsCompressor = () => (comp = mk());
    const g = buildGraph(c);
    for (const k of BUSES) g.bus[k].gain.value = BUS[k];
    const st = audioState(input);
    if (only) for (const k of Object.keys(st)) if (typeof st[k] === 'number' && !only.includes(k) && !/(Cut|Freq|Rate|Pan)$/.test(k)) st[k] = 0; // solo some voices
    const beds = createBeds(g), shots = createShots(g);
    beds(st); g.outside.frequency.value = st.outsideCut;
    events(shots);
    const buf = await c.startRendering();
    let peak = 0, sum = 0, count = 0;
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 44100; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; count++; } }
    return { peak: +peak.toFixed(4), rms: +Math.sqrt(sum / count).toFixed(4), peakDb: +(20 * Math.log10(peak)).toFixed(2), duck: +comp.reduction.toFixed(1) };
  };
  // loudest: São Paulo storm, flat out, plane overhead, crowd, every one-shot at once
  const loud = await render({ s: 7, speed: 5, night: 0, rain: 1, storm: 1, wind: 1.1, rs: 0.6, rl: 0.4, rg: 0, world: true, tunnel: 0, planeD: -0.5, crowd: 1, bigben: 1, glasgow: 1 }, (x) => {
    x.thunder({ ...thunder(0.4), delay: 1.5 }); x.thunder({ ...thunder(0.4), delay: 3 }); x.bell(164.8, 1, 2, 2, 5); x.bell(261.6, 0.7, 2, 1.5, 4);
    for (let i = 0; i < 3; i++) x.pass(); for (let i = 0; i < 8; i++) { x.drop(); x.step(); }
    x.horn(); x.boat(); x.chirp(); x.gull(); x.door(); x.tick(); x.shutter();
  });
  // quietest: Glasgow, dry night, bus at rest
  const quiet = await render({ s: 11, speed: 0, night: 1, rain: 0, storm: 0, wind: 0.8, rs: 0, rl: 0, rg: 1, world: true, tunnel: 0, planeD: null, crowd: 0.25, bigben: 0, glasgow: 0 }, () => {});
  // rain is a backdrop: at moderate rain its solo level sits well under the city bed's, and the compressor barely ducks the mix
  const rainy = { s: 3, speed: 0.6, night: 0, rain: 0.5, storm: 0.2, wind: 0.8, rs: 1, rl: 0, rg: 0, world: true, tunnel: 0, planeD: null, crowd: 0.5, bigben: 0, glasgow: 0 };
  const mixRain = await render(rainy, () => {}), rainOnly = await render(rainy, () => {}, ['rain', 'rainCut', 'drops', 'wind', 'windFreq']), bedOnly = await render(rainy, () => {}, ['bedSp', 'bedLon', 'bedGla', 'bedCut']);
  // the plane at its pass must be heard: within 3 dB of the city bed it flies over
  const pass = { ...rainy, rs: 0, rl: 1, rain: 0, storm: 0, planeD: 0 };
  const planeOnly = await render(pass, () => {}, ['plane', 'planeCut', 'planeRate', 'planePan']), cityOnly = await render(pass, () => {}, ['bedSp', 'bedLon', 'bedGla', 'bedCut']);
  return JSON.stringify({ loud, quiet, mixRain, rainGap: +(20 * Math.log10(bedOnly.rms / rainOnly.rms)).toFixed(1), planeGap: +(20 * Math.log10(planeOnly.rms / cityOnly.rms)).toFixed(1) });
})()''')
offline = json.loads(offline); print('offline', offline)
assert offline['loud']['peak'] < 0.891, f"loud scene clips above -1 dBFS: {offline['loud']}"
assert offline['rainGap'] > 4 and offline['mixRain']['duck'] > -1.5, f"rain is not a backdrop (bed over rain in dB, ducking in dB): {offline}"
assert offline['planeGap'] > -3, f"the plane is too quiet next to the city bed (dB): {offline}"
assert offline['loud']['rms'] > 0.02 and offline['quiet']['rms'] > 0.001, f"a scene is silent: {offline}"

# live toggle
for _ in range(240):  # Board opens only once the city has settled (and the still tour is over)
    if js("document.querySelector('[data-intro-skip]')?.disabled === false"): break
    time.sleep(0.25)
js("document.querySelector('[data-intro-skip]')?.click()")
for _ in range(80):
    if js("!document.body.classList.contains('intro-on')"): break
    time.sleep(0.25)
assert js("!document.body.classList.contains('intro-on')"), 'the intro did not close'
time.sleep(0.5)
before = js("document.querySelector('[data-sound]').getAttribute('aria-pressed')")
def click_sound():
    r = json.loads(js("JSON.stringify((r => ({x: r.left + r.width / 2, y: r.top + r.height / 2}))(document.querySelector('[data-sound]').getBoundingClientRect()))"))
    click_at_xy(r['x'], r['y'])
if before == 'true': click_sound(); time.sleep(0.3)
click_sound(); time.sleep(2.5)
live = json.loads(js(r'''(async () => {
  const { audio, enabled } = await import('./js/audio/engine.js');
  const g = audio(), an = g.c.createAnalyser(); g.mix.connect(an);
  await new Promise((r) => setTimeout(r, 600));
  const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
  const b = document.querySelector('[data-sound]');
  return JSON.stringify({ pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), stored: localStorage.getItem('sound'), enabled: enabled(), state: g.c.state, rms: Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length) });
})()'''))
print('live on', live)
assert live['pressed'] == 'true' and live['stored'] == 'on' and live['enabled'] and live['state'] == 'running' and live['label'], live
assert live['rms'] > 0.0005, f"sound is on but the mix is silent: {live}"
# 3) a second driver rides the whole route in 9 s: every family is heard somewhere and no tick throws
js(r"""window.__ride = (async () => {
  const { createSound } = await import('./js/audio/index.js');
  const { stops } = await import('./js/content.js'), { stopMarks } = await import('./js/scroll.js'), { routePoints } = await import('./js/world/layout.js');
  let p = 0, flash = 0;
  const snd = createSound({ stops, marks: stopMarks(routePoints(stops.length)), progress: () => p, night: () => false, world: () => ({ get flash() { return flash; } }) });
  const seen = {}, t0 = performance.now(), keys = ['rain', 'wind', 'bedSp', 'bedLon', 'bedGla', 'engine', 'road', 'plane', 'crowd', 'bigben', 'glasgow', 'drops', 'passes'];
  let dull = false, bells = 0, passes = 0, thunders = 0;
  while (performance.now() - t0 < 9000) {
    const k = (performance.now() - t0) / 9000; p = k; flash = k > 0.3 && k < 0.33 ? 0.04 : 0;
    for (const key of keys) if (snd.state[key] > 0) seen[key] = true;
    dull ||= snd.state.outsideCut < 2000; bells = Math.max(bells, snd.live.bells); passes = Math.max(passes, snd.live.passes); thunders = Math.max(thunders, snd.live.thunder);
    await new Promise((r) => setTimeout(r, 50));
  }
  p = 0;
  return JSON.stringify({ missing: keys.filter((key) => !seen[key]), dull, bells, passes, thunders, error: snd.state.error || null });
})(); 0""")
time.sleep(10)
ride = json.loads(js("window.__ride"))
print('ride', ride)
assert not ride['error'] and not ride['missing'] and ride['dull'] and ride['bells'] >= 1 and ride['thunders'] >= 1, ride
click_sound(); time.sleep(1.2)
off = json.loads(js(r'''(async () => { const { audio, enabled } = await import('./js/audio/engine.js'); const b = document.querySelector('[data-sound]');
  return JSON.stringify({ pressed: b.getAttribute('aria-pressed'), stored: localStorage.getItem('sound'), enabled: enabled() }); })()'''))
print('live off', off)
assert off['pressed'] == 'false' and off['stored'] == 'off' and not off['enabled'], off
if prior_sound is None: js("localStorage.removeItem('sound')")  # no saved choice before: back to the default (on)
else: js("localStorage.setItem('sound', " + json.dumps(prior_sound) + ")")
print('PASS')
