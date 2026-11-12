# Full-scene regression: a reduced-motion jump must finish near detail without manual update calls.
import time
tab = new_tab('about:blank')
target = tab if isinstance(tab, str) else tab.get('targetId', tab)
activate_tab(target)
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Network.setBypassServiceWorker', bypass=True)
cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)
cdp('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
def evaluate(expression):
    r=cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=120)
    assert 'exceptionDetails' not in r, r.get('exceptionDetails')
    return r['result'].get('value')
try:
    goto_url('http://localhost:8000/?qa=1&nosw&weather=clear')
    wait_for_load()
    for _ in range(120):
        if evaluate("document.body.classList.contains('world-settled')"): break
        time.sleep(.25)
    evaluate("document.querySelector('[data-intro-skip]').click()")
    evaluate("""(async()=>{const s=await import('/js/scroll.js'),{stops}=await import('/js/content.js'),L=await import('/js/world/layout.js');scrollTo({top:s.scrollYForStop(9,stops.length,document.documentElement.scrollHeight,innerHeight,s.stopMarks(L.routePoints(stops.length))),behavior:'instant'});})()""")
    time.sleep(5)
    result=evaluate("""(()=>{const g=window.__qaScene.getObjectByName('citywide-architecture'),camera=window.__qaCamera;const near=g.children.filter(c=>c.userData.bounds.distanceToPoint(camera.position)<110);return {near:near.length,pending:near.filter(c=>!c.userData.near||c.userData.builtFactory!==c.userData.nearFactory).length,frames:window.__qaWorldFrames,gl:window.__qaRenderer.getContext().getError()};})()""")
    assert result['near'] > 1 and result['pending'] == 0 and result['gl'] == 0, result
    previous=result['frames']
    time.sleep(1)
    assert evaluate('window.__qaWorldFrames') == previous, 'Reduced-motion renderer never returns to idle'
    print(result)
finally:
    cdp('Emulation.setEmulatedMedia', features=[])
    cdp('Emulation.clearDeviceMetricsOverride')
    close_tab(target)
