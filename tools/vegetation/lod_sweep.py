# Authored tree LOD sweep (browser-harness). Fixed placement, camera and light for every run, so before/after pairs compare.
#   OUT=<dir> THEME=day|night URL=http://localhost:8000/ browser-harness < tools/vegetation/lod_sweep.py
# Forced pass: LOD0/1/2 at fixed distances (silhouette pixels and mean brightness of the tree pixels).
# Sweep pass: production update() on an approach (200 -> 40 m) and a leave (40 -> 200 m); records the LOD and coverage per step.
# Writes <OUT>/<theme>-metrics.json and PNG frames. Needs the local server (python3 -m http.server 8000).
import os, json, time, base64
OUT = os.environ['OUT']; os.makedirs(OUT, exist_ok=True)
THEME = os.environ.get('THEME', 'day'); URL = os.environ.get('URL', 'http://localhost:8000/')
# Pin every call to this tab: the browser-harness daemon's current session is shared, and other agents switch it.
t = new_tab('about:blank'); TAB = t if isinstance(t, str) else t.get('targetId', t)
SID = cdp('Target.attachToTarget', targetId=TAB, flatten=True)['sessionId']
cdp('Network.enable', session_id=SID); cdp('Network.setCacheDisabled', session_id=SID, cacheDisabled=True)
cdp('Page.navigate', session_id=SID, url=URL)
def J(expression): return js(expression, target_id=TAB)
for _ in range(120):
    time.sleep(0.5)
    if J('document.readyState') == 'complete': break
time.sleep(3)
def SHOT(path):
    activate_tab(TAB); time.sleep(0.3)  # hidden tabs screenshot blank
    r = cdp('Page.captureScreenshot', session_id=SID, format='png')
    open(path, 'wb').write(base64.b64decode(r['data'])); return path

SETUP = r'''(async () => {
  const T = await import('three');
  const { createTrees } = await import('./js/world/trees.js');
  const { initGlbLoader } = await import('./js/world/glb-loader.js');
  window.__vegErrors = []; const oe = console.error; console.error = (...a) => { window.__vegErrors.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
  const day = __THEME__ === 'day', sky = new T.Color(day ? 0xbcd8ec : 0x0b1224);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;z-index:2147483647;background:#000;overflow:hidden';
  const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; canvas.style.cssText = 'width:1280px;height:720px;display:block';
  host.append(canvas); document.body.append(host);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1280, 720, false); renderer.shadowMap.enabled = true; initGlbLoader(renderer);
  const scene = new T.Scene(); scene.background = sky;
  scene.add(new T.HemisphereLight(day ? 0xcfe6ff : 0x3c4f7a, day ? 0x5c6e4a : 0x1a2230, day ? 1.2 : 0.7));
  const sun = new T.DirectionalLight(day ? 0xfff1d0 : 0xa9bfff, day ? 2.2 : 0.6); sun.position.set(22.5, 40, 20);
  sun.castShadow = day; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(60, 0, -15); scene.add(sun, sun.target);
  const ground = new T.Mesh(new T.PlaneGeometry(800, 800), new T.MeshLambertMaterial({ color: day ? 0x7d9a5c : 0x2b3b2c }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(60, 0, -15); ground.receiveShadow = true; scene.add(ground);
  const placements = Array.from({ length: 36 }, (_, k) => ({ x: 6 + (k % 12) * 9, z: -Math.floor(k / 12) * 11, h: 3.6 + (k % 5) * 0.35, crown: 2.6 + (k % 3) * 0.5, base: 0.1 }));
  const group = await createTrees(placements, null); scene.add(group);
  const batch = group.userData.batches[0];
  const camera = new T.PerspectiveCamera(40, 1280 / 720, 1, 1400);
  const place = (d) => { camera.position.set(60, 1.7, d); camera.lookAt(60, 3.2, -14); camera.updateMatrixWorld(); return batch.bounds.distanceToPoint(camera.position); };
  const setLod = (L) => batch.lods.forEach((m, i) => { m.visible = i === L; });
  const coverage = () => { // trees only, transparent background: silhouette pixels and mean luminance of those pixels
    scene.background = null; ground.visible = false; renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(canvas, 0, 0);
    const px = cx.getImageData(0, 0, 1280, 720).data; let n = 0, s = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 127) { n++; s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; }
    scene.background = sky; ground.visible = true; return { px: n, lum: n ? +(s / n).toFixed(2) : 0 };
  };
  const picture = () => { renderer.setClearColor(sky, 1); renderer.render(scene, camera); };
  window.__vegForced = (d, L) => { place(d); setLod(L); picture(); };
  window.__vegStep = (d) => { const dist = place(d); group.userData.update(camera); return { d, dist: +dist.toFixed(1), lod: batch.level, ...coverage() }; };
  window.__vegPicture = (d) => { place(d); group.userData.update(camera); picture(); };
  const forced = [];
  for (const d of [80, 160, 180]) for (const L of [0, 1, 2]) { const dist = place(d); setLod(L); forced.push({ d, dist: +dist.toFixed(1), lod: L, ...coverage() }); }
  return { forced, batches: group.userData.batches.length, trees: placements.length };
})()'''.replace('__THEME__', repr(THEME))

setup = J(SETUP)
forced_frames = []
for d in (80, 160, 180):
    for L in (0, 1, 2):
        J(f'window.__vegForced({d},{L})')
        f = SHOT(os.path.join(OUT, f'{THEME}-forced-d{d}-lod{L}.png')); forced_frames.append((d, L, f))

APPROACH = [200 - 4 * i for i in range(41)]          # 200 -> 40 m
LEAVE = [40 + 4 * i for i in range(1, 41)]           # 44 -> 200 m
CAPTURE = {164, 156, 140, 136, 84, 76, 60, 56}       # thresholds: 1<->2 at 160/140 m, 0<->1 at 80/60 m
sweep = []
for name, path in (('approach', APPROACH), ('leave', LEAVE)):
    for d in path:
        rec = J(f'window.__vegStep({d})'); rec['pass'] = name; sweep.append(rec)
        if d in CAPTURE:
            J(f'window.__vegPicture({d})'); SHOT(os.path.join(OUT, f'{THEME}-sweep-{name}-{d}m.png'))

jumps = []
for a, b in zip(sweep, sweep[1:]):
    if a['pass'] == b['pass'] and a['px'] and b['px']:
        jumps.append({'from': a['d'], 'to': b['d'], 'lod': f"{a['lod']}->{b['lod']}", 'px_ratio': round(b['px'] / a['px'], 3)})
errors = J('window.__vegErrors')
result = {'theme': THEME, 'url': URL, 'setup': setup, 'forced': setup['forced'], 'sweep': sweep, 'largest_steps': sorted(jumps, key=lambda j: abs(1 - j['px_ratio']), reverse=True)[:6], 'console_errors': errors}
with open(os.path.join(OUT, f'{THEME}-metrics.json'), 'w') as fh: json.dump(result, fh, indent=1)
print(json.dumps({'forced': result['forced'], 'largest_steps': result['largest_steps'], 'lod_changes': [s for s in sweep if s['d'] in CAPTURE], 'console_errors': errors}))
