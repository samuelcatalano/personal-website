# Wheel sequence: one catalog car rolled through 15 frames over 2 s at 1.2 m/s, rendered offscreen with the project's own vehicle code, then two contact sheets:
# an overview of the car and a 2x crop of the front and rear wheels (the camera tracks the car, so the wheel centres stay at the same pixels).
# 1.2 m/s keeps every frame's turn under 30 degrees (the real 10-13 m/s route would alias to a blur at this frame rate).
# Run from the repository root with the preview served (python3 -m http.server 8000):
#   OUT=<scratch dir> SHEET=<png> MODEL=mercedes-e63-amg-s-wagon BODY='#151a20' browser-harness < docs/evidence/full-scene-graphical-reform/vehicle-wheels/capture-wheel-sequence.py
# Rebuild the sheets from the saved frames without a browser: FRAMES_ONLY=1 with the same OUT and SHEET.
import base64, glob, json, os
from PIL import Image, ImageDraw

OUT, SHEET = os.environ['OUT'], os.environ['SHEET']
MODEL, BODY = os.environ.get('MODEL', 'mercedes-e63-amg-s-wagon'), os.environ.get('BODY', '#151a20')
FRAMES_ONLY = os.environ.get('FRAMES_ONLY') == '1'
N, SPAN, SPEED, W, H = 15, 2.0, 1.2, 640, 400
STEP = SPEED * SPAN / (N - 1)  # metres per frame
WHEEL_PX = [(444, 228), (181, 228)]  # front and rear wheel centres in the 640x400 frame (pinhole projection of the camera set in SETUP)

def js(expression):
    r = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=900)
    if 'exceptionDetails' in r: raise RuntimeError(str(r['exceptionDetails'])[:600])
    return r['result'].get('value')

SETUP = '''(async () => {
  const THREE = await import('three');
  const A = await import('./js/world/vehicle-assets.js?wheel-sequence-1');
  const cat = await A.loadFleetCatalog();
  const model = cat.find((m) => m.id === __MODEL__);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(__W__, __H__, false);
  A.initVehicleEnv(renderer); A.updateVehicleEnv(0);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d7dbe0');
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x7a6a55, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.set(4, 8, 10); scene.add(sun);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6f7277', roughness: 0.95 })));
  const car = new THREE.Group(); scene.add(car);
  await A.upgradeFleet(car, model, { body: __BODY__ });
  const cam = new THREE.PerspectiveCamera(30, __W__ / __H__, 0.1, 100);
  const wheels = car.userData.wheels; let x = 0;
  globalThis.__wheelSeq = {
    frame(d) { x += d; car.position.x = x; cam.position.set(x + 0.4, 1.3, 8.2); cam.lookAt(x, 0.55, 0); A.rollWheels(wheels, d); renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png'); },
    turns: () => wheels.map((w) => +w.rotation.z.toFixed(3)),
  };
  return { model: __MODEL__, visualAsset: car.userData.visualAsset ?? null, wheelGroups: wheels.length, radius: wheels[0] ? (wheels[0].userData.radius ?? wheels[0].position.y) : null };
})()'''.replace('__MODEL__', json.dumps(MODEL)).replace('__BODY__', json.dumps(BODY)).replace('__W__', str(W)).replace('__H__', str(H))

def sheets(frames, path):
    cols, tw, th = 5, 320, 200
    rows = (len(frames) + cols - 1) // cols
    over = Image.new('RGB', (cols * tw, rows * (th + 22)), 'white')
    zoom = Image.new('RGB', (cols * 384, rows * (192 + 22)), 'white')
    for k, f in enumerate(frames):
        im = Image.open(f).convert('RGB')
        label = f'{MODEL}  frame {k}  t={k * SPAN / (N - 1):.2f} s'
        x, y = (k % cols) * tw, (k // cols) * (th + 22)
        over.paste(im.resize((tw, th)), (x, y + 22))
        ImageDraw.Draw(over).text((x + 6, y + 5), label, fill='black')
        pair = Image.new('RGB', (384, 192), 'white')
        for j, (cx, cy) in enumerate(WHEEL_PX):
            pair.paste(im.crop((cx - 48, cy - 48, cx + 48, cy + 48)).resize((192, 192), Image.LANCZOS), (j * 192, 0))
        zx, zy = (k % cols) * 384, (k // cols) * (192 + 22)
        zoom.paste(pair, (zx, zy + 22))
        ImageDraw.Draw(zoom).text((zx + 6, zy + 5), label + '  (front | rear)', fill='black')
    over.save(path)
    zoom.save(path.replace('.png', '-wheels.png'))
    return path, path.replace('.png', '-wheels.png')

os.makedirs(OUT, exist_ok=True)
if FRAMES_ONLY:
    frames = sorted(glob.glob(os.path.join(OUT, 'frame-*.png')))
else:
    tab = new_tab('http://localhost:8000/?wheel-sequence=1')
    TAB = tab if isinstance(tab, str) else tab.get('targetId', tab)
    activate_tab(TAB)
    wait_for_load()
    try:
        print(js(SETUP))
        frames = []
        for k in range(N):
            url = js(f'__wheelSeq.frame({0 if k == 0 else STEP})')
            path = os.path.join(OUT, f'frame-{k:02d}.png')
            with open(path, 'wb') as f:
                f.write(base64.b64decode(url.split(',', 1)[1]))
            frames.append(path)
        print('turns after sequence (rad):', js('__wheelSeq.turns()'))
    finally:
        close_tab(TAB)
print('sheets', *sheets(frames, SHEET), 'frames', len(frames))
