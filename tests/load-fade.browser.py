# Load-fade regression (day and night). (1) Startup ramp: the first rendered frame must already be the final look, and it must not change
# when the fps governor reacts to the opening frames. The probe reproduces a slow start (45 ms busy-wait per frame for the
# first 2.5 s after the first frame, as shader compiles do), then compares scene-region luma at +0.5 s and +6 s and checks that
# the tier stays high through +6 s. The baseline (aefe627) fails: the governor drops high -> medium at about +2.2 s (+22 luma).
# Run: browser-harness < tests/load-fade.browser.py   (URL=... to point elsewhere; RAMP_TOL=2.0 luma tolerance).
# The tab must stay visible for frames to run: use a dedicated Chrome if the shared one is busy.
import os, time, json
URL = os.environ.get('URL', 'http://localhost:8000/').split('?', 1)[0]
TOL = float(os.environ.get('RAMP_TOL', '2.0'))
PROBE = r'''(() => {
  const STALL_MS = 45, STALL_FOR = 2500;
  const rows = (window.__rampRows = []);
  const W = 192, H = 108, small = document.createElement('canvas');
  small.width = W; small.height = H;
  const cx = small.getContext('2d', { willReadFrequently: true });
  const luma = () => {
    const cv = document.getElementById('world');
    if (!cv || !cv.width) return null;
    cx.drawImage(cv, 0, 0, W, H); // right after post.render: the drawing buffer still holds this frame
    const d = cx.getImageData(0, 0, W, H).data;
    let s = 0, n = 0;
    for (let y = Math.floor(0.12 * H); y < Math.floor(0.95 * H); y++) for (let x = Math.floor(0.3 * W); x < W; x++) {
      const i = (y * W + x) * 4; s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++;
    }
    return s / n;
  };
  let t1 = null;
  const patch = () => {
    const p = window.__qaPost;
    if (!p || p.__rampPatched) return;
    p.__rampPatched = true;
    const orig = p.render;
    p.render = function (dt) {
      const out = orig.call(this, dt), now = performance.now();
      if (t1 === null) t1 = now;
      rows.push({ t: (now - t1) / 1000, tier: p.tier, L: luma() });
      if (now - t1 < STALL_FOR) { const end = performance.now() + STALL_MS; while (performance.now() < end) { /* simulated slow start */ } }
      return out;
    };
  };
  setInterval(patch, 10);
})()'''

tab = new_tab('about:blank')
TAB = tab if isinstance(tab, str) else tab.get('targetId', tab)
activate_tab(TAB)
cdp('Page.enable')
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
script_id = cdp('Page.addScriptToEvaluateOnNewDocument', source=PROBE)['identifier']
report = []
try:
    for theme in ('day', 'night'):
        goto_url(URL)
        for _ in range(100):
            if js("location.origin") == URL.rstrip('/'): break
            time.sleep(0.2)
        wait_for_load()
        js("localStorage.setItem('theme', '%s')" % theme)
        activate_tab(TAB)
        goto_url(URL + '?qa=1&weather=clear')
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            time.sleep(0.5)
            if js("(window.__rampRows || []).some((r) => r.t >= 6.2)"): break
        rows = json.loads(js("JSON.stringify(window.__rampRows || [])"))
        visible = js("document.visibilityState")
        if not any(r['t'] >= 6.0 for r in rows):
            raise AssertionError('%s: no frames for 6 s (visibility %s); keep the test tab visible' % (theme, visible))
        first = next(r for r in rows if r['t'] >= 0.5)
        late = next(r for r in rows if r['t'] >= 6.0)
        tiers = sorted({r['tier'] for r in rows if r['t'] <= 6.0})
        delta = abs(late['L'] - first['L'])
        item = {'theme': theme, 'luma_0.5s': round(first['L'], 2), 'luma_6s': round(late['L'], 2), 'delta': round(delta, 2),
                'tiers_0_to_6s': tiers, 'frames_0_to_6s': sum(1 for r in rows if r['t'] <= 6.0)}
        report.append(item)
        print(json.dumps(item))
        if tiers != ['high'] or delta >= TOL:
            raise AssertionError('%s startup ramp: tiers %s, luma delta %.2f (tolerance %.1f)' % (theme, tiers, delta, TOL))
    print('PASS startup-ramp', json.dumps(report))
    # (2) Flat-ground AO banding: a grazing ground plane must show no horizontal bands and almost no darkening (the depth-only
    # AO used to dim sloped ground and printed stripes); a wall base must still darken (creases kept). Synthetic scene, same
    # projection as the city; the AO target is read directly.
    goto_url(URL)
    for _ in range(100):
        if js("location.origin") == URL.rstrip('/'): break
        time.sleep(0.2)
    wait_for_load()
    ao = json.loads(js(r'''(async () => {
  const THREE = await import('three'), { AOPass } = await import('./js/world/ao-pass.js');
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const W = 640, H = 400, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(40, W / H, 1, 1400);
  camera.position.set(0, 2.5, 0); camera.lookAt(0, 0, -80); camera.updateMatrixWorld();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a9a9a })));
  const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 2), new THREE.MeshBasicMaterial({ color: 0x505050 })); wall.position.set(0, 3, -30); scene.add(wall);
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H) });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera)); const ao = new AOPass(camera); composer.addPass(ao); composer.addPass(new OutputPass());
  composer.setSize(W, H); composer.render();
  const aw = ao.rt.width, ah = ao.rt.height, buf = new Uint8Array(aw * ah * 4);
  renderer.readRenderTargetPixels(ao.rt, 0, 0, aw, ah, buf);
  const at = (x, y) => buf[((ah - 1 - y) * aw + x) * 4] / 255;       // AO value (1 = open), rows bottom-up in the target
  const band = (x0, x1, y0, y1) => {                                   // horizontal bands: RMS of row means minus a 9-row moving average
    const rows = []; for (let y = y0; y < y1; y++) { let s = 0; for (let x = x0; x < x1; x++) s += at(x, y); rows.push(s / (x1 - x0)); }
    let ss = 0; const n = rows.length;
    for (let i = 0; i < n; i++) { let m = 0, c = 0; for (let j = Math.max(0, i - 4); j < Math.min(n, i + 5); j++) { m += rows[j]; c++; } ss += (rows[i] - m / c) ** 2; }
    return { rms: Math.sqrt(ss / n), darkening: 1 - rows.reduce((a, b) => a + b, 0) / n };
  };
  const ground = band(Math.floor(0.05 * aw), Math.floor(0.3 * aw), Math.floor(0.55 * ah), Math.floor(0.85 * ah));
  const base = camera.position.clone(); const p = new THREE.Vector3(0, 0, -30).project(camera); const baseRow = Math.floor((1 - (p.y + 1) / 2) * ah);
  const crease = band(Math.floor(0.46 * aw), Math.floor(0.54 * aw), Math.min(ah - 1, baseRow + 2), Math.min(ah - 1, baseRow + 8));
  renderer.dispose();
  return JSON.stringify({ groundBandRms: ground.rms, groundDarkening: ground.darkening, creaseDarkening: crease.darkening });
})()'''))
    print('flat-ground AO', json.dumps(ao))
    if ao['groundBandRms'] >= 0.005 or ao['groundDarkening'] >= 0.02 or ao['creaseDarkening'] < 0.03:
        raise AssertionError('flat-ground AO: band rms %.4f (<0.005), ground darkening %.4f (<0.02), crease darkening %.4f (>=0.03)' % (ao['groundBandRms'], ao['groundDarkening'], ao['creaseDarkening']))
    print('PASS flat-ground-ao', json.dumps(ao))
finally:
    cdp('Page.removeScriptToEvaluateOnNewDocument', identifier=script_id)
    close_tab(TAB)  # only the tab this test opened
