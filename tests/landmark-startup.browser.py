# browser-harness < tests/landmark-startup.browser.py (local preview; use a fresh tab)
import os
import time

URL = os.environ.get('URL', 'http://localhost:8000/').split('?', 1)[0]
tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Page.addScriptToEvaluateOnNewDocument', source=r'''(() => {
  const original = window.fetch.bind(window), requests = [], state = { requests, completed: 0 };
  const mode = new URLSearchParams(location.search).get('startup');
  const urlOf = input => new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
  const isLandmark = input => /\/assets\/processed\/landmarks\/(?:se|masp)\.lod[01]\.glb$/.test(urlOf(input));
  window.__landmarkStartup = state;
  window.fetch = (input, init) => {
    const url = urlOf(input);
    if (!isLandmark(input) || !['hold', 'fail', 'never', 'late', 'mixed', 'mixed-late'].includes(mode)) return original(input, init);
    if (mode === 'fail') { requests.push({ url }); return Promise.reject(new Error('forced landmark load failure')); }
    if (mode === 'never') return new Promise(() => requests.push({ url }));
    if (['mixed', 'mixed-late'].includes(mode) && url.endsWith('/se.lod0.glb')) return original(input, init);
    return new Promise((resolve, reject) => requests.push({
      url,
      release: () => original(input, init).then((response) => { state.completed++; resolve(response); }, reject),
    }));
  };
})()''')

def wait_for_js(expression, message, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if js(expression):
            return
        time.sleep(0.1)
    raise AssertionError(message)

def group_state():
    return js(r'''(() => {
      const read = g => g.children.map(c => ({ name: c.name, visible: c.visible }));
      return { se: read(window.__qaLandmarks.se), masp: read(window.__qaLandmarks.masp) };
    })()''')

def assert_fallback(state):
    for name, children in state.items():
        assert children and all(c['visible'] for c in children), f'{name} procedural children must remain visible'
        assert not any('-glb-lod' in c['name'] for c in children), f'{name} must not contain a late GLB'

def assert_upgraded(state):
    for name, children in state.items():
        assert any('-glb-lod' in c['name'] and c['visible'] for c in children), f'{name} must show a GLB LOD'
        assert all(not c['visible'] for c in children if '-glb-lod' not in c['name']), f'{name} procedural children must be hidden'

# Timely loads install GLBs before the first rendered scene frame.
goto_url(URL + '?qa&startup=hold')
wait_for_load()
wait_for_js('window.__landmarkStartup?.requests.length === 2', 'Sé and MASP LOD0 requests did not start')
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'scene rendered before landmark loads settled'
assert js('window.__landmarkStartup.requests.filter(r => r.url.endsWith("/se.lod0.glb")).length === 1 && window.__landmarkStartup.requests.filter(r => r.url.endsWith("/masp.lod0.glb")).length === 1 && !window.__landmarkStartup.requests.some(r => r.url.endsWith("/se.lod1.glb") || r.url.endsWith("/masp.lod1.glb"))'), 'Sé and MASP must request only LOD0'
print(js('window.__landmarkStartup.requests.forEach(r => r.release()); true'))
wait_for_js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0', 'scene did not render after successful loads')
assert_upgraded(group_state())

# One failed asset still releases the scene with procedural fallbacks.
goto_url(URL + '?qa&startup=fail')
wait_for_load()
wait_for_js('window.__landmarkStartup?.requests.length === 2 && document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0', 'world did not render after landmark load failures')
assert not js('document.body.classList.contains("no-webgl")'), 'a failed landmark load disabled WebGL'
assert_fallback(group_state())

# A request that never settles releases the scene at the deadline and keeps both fallbacks.
goto_url(URL + '?qa&startup=never')
wait_for_load()
wait_for_js('window.__landmarkStartup?.requests.length === 2', 'never-resolving landmark requests did not start')
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'scene did not wait before the deadline'
wait_for_js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0', 'deadline did not release the procedural scene', timeout=10)
assert js('window.__landmarkStartup.requests.every(r => !r.release)'), 'never case unexpectedly released a request'
assert_fallback(group_state())

# A late success after the deadline must not replace either fallback.
goto_url(URL + '?qa&startup=late')
wait_for_load()
wait_for_js('window.__landmarkStartup?.requests.length === 2', 'late-response landmark requests did not start')
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'scene rendered before the late-response deadline'
wait_for_js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0', 'deadline did not render the procedural fallback', timeout=10)
assert_fallback(group_state())
print(js('window.__landmarkStartup.lateDone = false; Promise.allSettled(window.__qaLandmarks.startupLandmarks).then(() => window.__landmarkStartup.lateDone = true); window.__landmarkStartup.requests.forEach(r => r.release()); true'))
wait_for_js('window.__landmarkStartup.lateDone === true', 'late GLB loads did not settle', timeout=30)
assert_fallback(group_state())

# Sé may finish while MASP remains pending; neither asset alone may release the first frame.
goto_url(URL + '?qa&startup=mixed')
wait_for_load()
wait_for_js('window.__landmarkStartup?.requests.length === 1 && window.__qaLandmarks?.se.children.some(c => c.name === "se-glb-lod0" && c.visible)', 'Sé did not become ready while the MASP request remained held')
state = group_state()
assert any(c['name'] == 'se-glb-lod0' and c['visible'] for c in state['se']), 'ready Sé LOD0 must be visible'
assert_fallback({'masp': state['masp']})
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'one completed asset released the scene while the other was pending'
print(js('window.__landmarkStartup.requests.forEach(r => r.release()); true'))
wait_for_js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0', 'mixed startup did not render after MASP completed')
state = group_state()
assert_upgraded({'se': state['se'], 'masp': state['masp']})

# Sé completes in time while MASP misses the deadline; only MASP remains procedural after its late response.
goto_url(URL + '?qa&startup=mixed-late')
wait_for_load()
wait_for_js('window.__landmarkStartup?.requests.length === 1 && window.__qaLandmarks?.se.children.some(c => c.name === "se-glb-lod0" && c.visible)', 'Sé did not become ready while the MASP request remained held')
state = group_state()
assert_upgraded({'se': state['se']})
assert_fallback({'masp': state['masp']})
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'ready Sé alone released the initial frame'
wait_for_js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0', 'deadline did not render ready Sé with procedural MASP', timeout=10)
state = group_state()
assert_upgraded({'se': state['se']})
assert_fallback({'masp': state['masp']})
print(js('window.__landmarkStartup.lateDone = false; Promise.allSettled(window.__qaLandmarks.startupLandmarks).then(() => window.__landmarkStartup.lateDone = true); window.__landmarkStartup.requests.forEach(r => r.release()); true'))
wait_for_js('window.__landmarkStartup.lateDone === true', 'late MASP GLB did not settle', timeout=30)
state = group_state()
assert_upgraded({'se': state['se']})
assert_fallback({'masp': state['masp']})
print({'pass': True, 'scenarios': ['success', 'failure', 'never resolves', 'late response', 'mixed readiness', 'mixed late response']})
