"""Desktop asset check. Run: browser-harness < tools/vehicles/validate_uber_boat.py"""
import base64
import json
import os
import time
from pathlib import Path

out = Path(os.environ.get('OUT', '/tmp/uber-boat-reference/browser-evidence'))
out.mkdir(parents=True, exist_ok=True)
new_tab('http://localhost:8000/tools/vehicles/uber-boat-preview.html?nosw')
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
cdp('Emulation.setFocusEmulationEnabled', enabled=True)
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Network.setBypassServiceWorker', bypass=True)
cdp('Page.addScriptToEvaluateOnNewDocument', source='''
window.assetErrors = [];
addEventListener('error', e => assetErrors.push(e.message));
addEventListener('unhandledrejection', e => assetErrors.push(String(e.reason)));
const originalError = console.error;
console.error = (...args) => { assetErrors.push(args.map(String).join(' ')); originalError(...args); };
''')
try:
    js('window.reloadMarker = true')
    cdp('Page.reload', ignoreCache=True)
    for _ in range(60):
        state = js('({reloaded:!window.reloadMarker,ready:window.boatPreview?.ready,error:window.boatPreview?.error})')
        if state.get('reloaded') and (state.get('ready') or state.get('error')):
            break
        time.sleep(.5)
    assert state.get('ready'), state
    metrics = js('boatPreview.metrics')
    assert metrics['triangles'] > 0 and metrics['materials'] <= 6, metrics
    assert metrics['textures'] and all(t['width'] <= 2048 and t['height'] <= 2048 for t in metrics['textures']), metrics
    assert abs(metrics['size'][0] - 35.37) < .02, metrics
    js("document.querySelector('aside').style.display='none'")
    for view in ('front_3q', 'rear_3q', 'left', 'right', 'front', 'rear', 'top'):
        js('boatPreview.view(' + json.dumps(view) + ')')
        shot = cdp('Page.captureScreenshot', format='png', captureBeyondViewport=False)
        (out / f'three_{view}.png').write_bytes(base64.b64decode(shot['data']))
    expression = '''(async () => {
      const { renderer, scene, camera, view } = boatPreview;
      renderer.setAnimationLoop(null);
      view('front_3q');
      const gl = renderer.getContext(), meshes = [];
      scene.traverse(o => { if(o.isMesh) meshes.push(o); });
      const rounds = [];
      try {
        for(let round=0; round<3; round++) {
          for(const visible of [false, true]) {
            meshes.forEach(o => o.visible=visible);
            const samples=[];
            for(let frame=0; frame<80; frame++) {
              await new Promise(requestAnimationFrame);
              const start=performance.now();
              renderer.render(scene,camera);
              gl.finish();
              if(frame>=20) samples.push(performance.now()-start);
            }
            samples.sort((a,b)=>a-b);
            rounds.push({round,boatVisible:visible,medianMs:samples[30],p95Ms:samples[57],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
          }
        }
      } finally {
        meshes.forEach(o => o.visible=true);
        renderer.setAnimationLoop(() => renderer.render(scene,camera));
      }
      return {viewport:[innerWidth,innerHeight],pixelRatio:renderer.getPixelRatio(),method:'Three rounds; 20 warmup + 60 samples per state; render plus gl.finish wall time; isolated asset, no city',rounds};
    })()'''
    result = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=60)
    assert 'exceptionDetails' not in result, result
    benchmark = result['result']['value']
    errors = js('window.assetErrors')
    assert errors == [], errors
    report = {'metrics': metrics, 'benchmark': benchmark, 'consoleErrors': errors}
    (out / 'three-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
finally:
    js("document.querySelector('aside').style.display=''")
    cdp('Emulation.setFocusEmulationEnabled', enabled=False)
    cdp('Emulation.clearDeviceMetricsOverride')
