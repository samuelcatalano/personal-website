# Scene capture for visual checks. Run through browser-harness (helpers pre-imported):
#   OUT=/path/dir SHOTS="5:day,11:night" browser-harness < tools/capture.py
# Env: OUT (dir, required), SHOTS (comma list of stop[:theme], stop may be fractional, default "5:day"),
#      MOBILE=1 (375x812 emulation), WAIT (seconds after scroll, default 7), URL (default http://localhost:8000/),
#      QUERY (extra query string, e.g. "weather=rain"), GRID=1 (also write grid.png of all shots).
# Needs the local server: python3 -m http.server 8000
import os, time
# Software-GL pages (SwiftShader) can hold Runtime.evaluate past the default 30 s: evaluate calls get a 900 s response timeout.
def js(expression):
    r = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=900)
    if 'exceptionDetails' in r: raise RuntimeError(str(r['exceptionDetails'])[:400])
    return r['result'].get('value')
def wait_load():
    for _ in range(240):
        if js("document.readyState") == 'complete': break
        time.sleep(.5)
OUT = os.environ['OUT']; os.makedirs(OUT, exist_ok=True)
URL = os.environ.get('URL', 'http://localhost:8000/') + (('?' + os.environ['QUERY']) if os.environ.get('QUERY') else '')
WAIT, MOBILE = float(os.environ.get('WAIT', 7)), os.environ.get('MOBILE') == '1'
shots = [(s.split(':') + ['day'])[:2] for s in os.environ.get('SHOTS', '5:day').split(',')]
t = new_tab('about:blank'); TAB = t if isinstance(t, str) else t.get('targetId', t); activate_tab(TAB)  # background tabs do not render
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
if MOBILE: cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=2, mobile=True)
goto_url(URL); wait_load()
files = []
for stop, theme in shots:
    js("localStorage.setItem('theme','%s')" % theme); goto_url(URL); wait_load()
    for _ in range(80):
        if js("document.body.classList.contains('world-ready')"): break
        time.sleep(.5)
    else: raise AssertionError('3D world did not become ready; refusing a blank capture')
    for _ in range(120):  # the intro grabs three stills once the city settles: let it finish before moving the camera
        if js("document.body.classList.contains('world-settled')"): break
        time.sleep(.5)
    else: raise AssertionError('3D world did not settle; refusing a loading-screen capture')
    time.sleep(6)
    js("{const st=document.createElement('style');st.textContent='#panel,.bar,header,nav,#route,#arrival,#ui-restore{visibility:hidden!important}#intro{display:none!important}';document.head.append(st)}")
    js("(async()=>{const s=await import('/js/scroll.js'),c=await import('/js/content.js'),L=await import('/js/world/layout.js');const n=c.stops.length,m=s.stopMarks(L.routePoints(n)),H=document.documentElement.scrollHeight,p=%s,i=Math.floor(p),f=p-i,a=s.scrollYForStop(i,n,H,innerHeight,m),b=s.scrollYForStop(Math.min(n-1,i+1),n,H,innerHeight,m);scrollTo({top:a+(b-a)*f,behavior:'instant'})})()" % float(stop))
    activate_tab(TAB); time.sleep(WAIT)  # re-front: another window/agent can hide the tab, and hidden tabs screenshot blank
    f = os.path.join(OUT, '%s-%s%s.png' % (stop, theme, '-m' if MOBILE else '')); capture_screenshot(f); files.append(f); print('ok', f)
if MOBILE: cdp('Emulation.clearDeviceMetricsOverride')
if os.environ.get('GRID') == '1' and len(files) > 1:
    from PIL import Image
    ims = [Image.open(f) for f in files]; w, h = ims[0].size; w, h = w // 2, h // 2; cols = 2
    g = Image.new('RGB', (w * cols, h * ((len(ims) + 1) // cols)))
    for i, im in enumerate(ims): g.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
    g.save(os.path.join(OUT, 'grid.png')); print('grid', os.path.join(OUT, 'grid.png'))
