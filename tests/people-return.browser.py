# Pedestrians must not vanish when the camera leaves a stop and comes back. Local preview on http://localhost:8000/ must be running.
# Run: ~/.local/bin/browser-harness < tests/people-return.browser.py   (opens its own tab, prints PASS/FAIL per check)
# Desktop draws the 3D NPC pool on top of the sprite crowd, so counts come from both (sprite drawn or npc3d owner).
import time
URL = 'http://localhost:8000/?qa=1&weather=clear'
def js(expression):
    r = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=900)
    if 'exceptionDetails' in r: raise RuntimeError(str(r['exceptionDetails'])[:400])
    return r.get('result', {}).get('value')
def wait_load():
    for _ in range(240):
        if js("document.readyState") == 'complete': break
        time.sleep(.5)
def scroll(p):
    js("(async()=>{const s=await import('/js/scroll.js'),c=await import('/js/content.js'),L=await import('/js/world/layout.js');const n=c.stops.length,m=s.stopMarks(L.routePoints(n)),H=document.documentElement.scrollHeight,p=%s,i=Math.floor(p),f=p-i,a=s.scrollYForStop(i,n,H,innerHeight,m),b=s.scrollYForStop(Math.min(n-1,i+1),n,H,innerHeight,m);scrollTo({top:a+(b-a)*f,behavior:'instant'})})()" % float(p))
SAMPLE = """(() => {
  const crowd = __qaScene.getObjectByName('crowd'), A = crowd.instanceMatrix.array, r = crowd.userData.route, N = r.x.length;
  const d = globalThis.__npcDiagnostics ? __npcDiagnostics.snapshot() : null;
  const drawn = [];
  for (let i = 0; i < N; i++) drawn.push(((crowd.visible && A[i * 16] > 0) || (d && d[i].renderRepresentation === 'npc3d-full')) ? 1 : 0);
  const dir = __qaCamera.getWorldDirection(__qaCamera.position.clone());
  return { x: Array.from(r.x, (v) => +v.toFixed(2)), z: Array.from(r.z, (v) => +v.toFixed(2)), drawn, cam: [__qaCamera.position.x, __qaCamera.position.z], fwd: [dir.x, dir.z] };
})()"""
def front(s):
    (cx, cz), (fx, fz) = s['cam'], s['fwd']; fl = (fx * fx + fz * fz) ** 0.5 or 1.0
    keep = set()
    for i, (x, z) in enumerate(zip(s['x'], s['z'])):
        dx, dz = x - cx, z - cz; dist = (dx * dx + dz * dz) ** 0.5
        if s['drawn'][i] and 10 < dist < 300 and (dx * fx + dz * fz) / (fl * dist) > 0.3: keep.add(i)
    return keep
def check(ok, message):
    print(('PASS ' if ok else 'FAIL ') + message)
    return ok
t = new_tab('about:blank'); TAB = t if isinstance(t, str) else t.get('targetId', t); activate_tab(TAB)
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(URL); wait_load()
js("localStorage.setItem('theme','day')"); goto_url(URL); wait_load()
for _ in range(120):
    if js("document.body.classList.contains('world-ready')"): break
    time.sleep(.5)
scroll(5); activate_tab(TAB); time.sleep(7)
steady = js(SAMPLE); F0 = front(steady); n0 = len(F0)
ok = check(n0 >= 20, f'steady crowd in front of the camera at stop 5: {n0} walkers')
for label, stop in [('one stop on', 6), ('far away', 11)]:
    scroll(stop); activate_tab(TAB); time.sleep(3)
    away = js(SAMPLE); kept = sum(away['drawn'][i] for i in F0) / max(1, n0)
    ok &= check(kept >= 0.9, f'{label} (stop {stop}): {kept:.0%} of the steady crowd still drawn')
    scroll(5); activate_tab(TAB); time.sleep(0.2)
    early = len(front(js(SAMPLE)))
    time.sleep(3)
    n1 = len(front(js(SAMPLE)))
    ok &= check(abs(n1 - n0) <= 0.1 * n0, f'back at stop 5 after {label}: {n1} in front after 3 s vs {n0} steady ({early} at 0.2 s)')
print('RESULT', 'PASS' if ok else 'FAIL')
