# Scene capture for visual checks. Run through browser-harness (helpers pre-imported):
#   OUT=/path/dir SHOTS="5:day,11:night" browser-harness < tools/capture.py
# Env: OUT (dir, required), SHOTS (comma list of stop[:theme], stop may be fractional, default "5:day"),
#      MOBILE=1 (375x812 emulation), WAIT (seconds after scroll, default 7), URL (default http://localhost:8000/),
#      QUERY (extra query string, e.g. "weather=rain"), GRID=1 (also write grid.png of all shots).
# Needs the local server: python3 -m http.server 8000
import os, time
OUT = os.environ['OUT']; os.makedirs(OUT, exist_ok=True)
URL = os.environ.get('URL', 'http://localhost:8000/') + (('?' + os.environ['QUERY']) if os.environ.get('QUERY') else '')
WAIT, MOBILE = float(os.environ.get('WAIT', 7)), os.environ.get('MOBILE') == '1'
shots = [(s.split(':') + ['day'])[:2] for s in os.environ.get('SHOTS', '5:day').split(',')]
t = new_tab('about:blank'); activate_tab(t if isinstance(t, str) else t.get('targetId', t))  # background tabs do not render
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
if MOBILE: cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=2, mobile=True)
goto_url(URL); wait_for_load()
files = []
for stop, theme in shots:
    js("localStorage.setItem('theme','%s')" % theme); goto_url(URL); wait_for_load()
    for _ in range(80):
        if js("document.body.classList.contains('world-ready')"): break
        time.sleep(.5)
    js("const st=document.createElement('style');st.textContent='#panel,.bar,header,nav{visibility:hidden!important}';document.head.append(st)")
    js("(async()=>{const s=await import('/js/scroll.js'),c=await import('/js/content.js'),L=await import('/js/world/layout.js');const n=c.stops.length,m=s.stopMarks(L.routePoints(n)),H=document.documentElement.scrollHeight,p=%s,i=Math.floor(p),f=p-i,a=s.scrollYForStop(i,n,H,innerHeight,m),b=s.scrollYForStop(Math.min(n-1,i+1),n,H,innerHeight,m);scrollTo({top:a+(b-a)*f,behavior:'instant'})})()" % float(stop))
    time.sleep(WAIT)
    f = os.path.join(OUT, '%s-%s%s.png' % (stop, theme, '-m' if MOBILE else '')); capture_screenshot(f); files.append(f); print('ok', f)
if MOBILE: cdp('Emulation.clearDeviceMetricsOverride')
if os.environ.get('GRID') == '1' and len(files) > 1:
    from PIL import Image
    ims = [Image.open(f) for f in files]; w, h = ims[0].size; w, h = w // 2, h // 2; cols = 2
    g = Image.new('RGB', (w * cols, h * ((len(ims) + 1) // cols)))
    for i, im in enumerate(ims): g.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
    g.save(os.path.join(OUT, 'grid.png')); print('grid', os.path.join(OUT, 'grid.png'))
