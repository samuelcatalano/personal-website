# browser-harness < tests/npc-loading.browser.py (local preview; desktop Chrome)
import os
import time

URL = os.environ.get('URL', 'http://localhost:8000/').split('?', 1)[0]
tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Emulation.setDeviceMetricsOverride', width=1280, height=800, deviceScaleFactor=1, mobile=False)
cdp('Page.addScriptToEvaluateOnNewDocument', source=r'''(() => {
  const original = window.fetch.bind(window), mode = new URLSearchParams(location.search).get('npcTest');
  const state = window.__npcTest = { requests: 0, completed: false };
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.endsWith('/assets/npc/npc_pack.glb')) return original(input, init);
    state.requests++;
    if (mode === 'fail') return Promise.reject(new Error('forced NPC failure'));
    if (mode === 'never') return new Promise(() => {});
    if (mode === 'hold' || mode === 'late') return new Promise((resolve, reject) => {
      state.release = () => original(input, init).then(response => {
        response.clone().arrayBuffer().then(() => { state.completed = true; });
        resolve(response);
      }, reject);
    });
    return original(input, init);
  };
})()''')

def wait_for_js(expression, message, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if js(expression):
            return
        time.sleep(0.1)
    raise AssertionError(message)

def state():
    return js('''(() => {
      let scene = window.__qaLandmarks.se;
      while (scene && !scene.isScene) scene = scene.parent;
      const crowd = scene?.getObjectByName('crowd'), shadow = scene?.getObjectByName('crowd-shadow');
      return { crowd: crowd?.visible, shadow: shadow?.visible, npc: !!scene?.getObjectByName('npc3d-shadow') };
    })()''')

def ready(message):
    wait_for_js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0 && !!window.__qaLandmarks?.se', message)
    assert not js('document.body.classList.contains("no-webgl")'), 'WebGL was disabled'

def fallback():
    assert state() == {'crowd': True, 'shadow': True, 'npc': False}, 'sprite crowd must remain visible without NPC objects'

# A held successful request must block startup until the NPCs are installed.
goto_url(URL + '?qa&npc3d=1&npcTest=hold')
wait_for_load()
wait_for_js('window.__npcTest?.requests === 1', 'NPC request did not start')
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'world rendered while NPC request was held'
js('window.__npcTest.release(); true')
ready('world did not render after NPC load')
assert state() == {'crowd': False, 'shadow': False, 'npc': True}, 'successful NPC load must replace sprites'

# A failed fetch must release startup and retain the sprite crowd.
goto_url(URL + '?qa&npc3d=1&npcTest=fail')
wait_for_load()
ready('world did not render after NPC failure')
assert js('window.__npcTest.requests === 1'), 'NPC failure was not exercised'
fallback()

# A request that never settles must release startup at the deadline.
goto_url(URL + '?qa&npc3d=1&npcTest=never')
wait_for_load()
wait_for_js('window.__npcTest?.requests === 1', 'pending NPC request did not start')
assert js('!document.body.classList.contains("world-ready") && window.__qaWorldFrames === 0'), 'world rendered before NPC deadline'
ready('world did not render after NPC timeout')
fallback()

# A response arriving after the deadline must not install NPCs or hide sprites.
goto_url(URL + '?qa&npc3d=1&npcTest=late')
wait_for_load()
wait_for_js('window.__npcTest?.requests === 1', 'late NPC request did not start')
ready('world did not render before late NPC response')
fallback()
js('window.__npcTest.release(); true')
wait_for_js('window.__npcTest.completed', 'late NPC response did not arrive')
time.sleep(3)  # Allow GLTF parsing and installation to finish before checking the scene.
fallback()
print({'pass': True, 'scenarios': ['success', 'failure', 'timeout', 'late response']})
