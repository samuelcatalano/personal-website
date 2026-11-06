# browser-harness < tests/startup-priority.browser.py
import os
import time

tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Network.emulateNetworkConditions', offline=False, latency=0, downloadThroughput=-1, uploadThroughput=-1)
cdp('Page.addScriptToEvaluateOnNewDocument', source=r'''(() => {
  const fetch = window.fetch.bind(window), state = window.__priority = { requests: [] };
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href, location.href).href;
    if (url.includes('.glb')) state.requests.push(url);
    if (url.includes('/npc_pack.glb')) return new Promise((resolve,reject) => { state.release = () => fetch(input,init).then(resolve,reject); });
    return fetch(input, init);
  };
})()''')
goto_url(os.environ.get('URL', 'http://localhost:8000/') + '?qa=1&weather=clear')
wait_for_load()
deadline = time.monotonic() + 30
while time.monotonic() < deadline:
    if js('!!window.__priority?.release'):
        break
    time.sleep(0.1)
assert js('!!window.__priority.release'), 'NPC request must start'
assert js('!window.__priority.requests.some(url => url.includes(".full.glb"))'), 'bulk fleet must not compete with the startup NPC download'
js('window.__priority.release(); true')
while time.monotonic() < deadline:
    if js('document.body.classList.contains("world-ready") && window.__qaWorldFrames > 0'):
        break
    time.sleep(0.1)
assert js('!!window.__qaScene?.getObjectByName("npc3d-shadow")'), 'startup installs full-quality NPCs'
result = js('''(() => {
  const requests=window.__priority.requests, bulk=requests.findIndex(url=>url.includes('.full.glb')&&!url.includes('/mini-cooper-2011.'));
  const landmark=requests.findIndex(url=>url.includes('/se.lod0.glb'));
  return { bulk, landmark, frames:window.__qaWorldFrames, npc:!!window.__qaScene.getObjectByName('npc3d-shadow') };
})()''')
assert result['landmark'] >= 0 and result['bulk'] > result['landmark'], 'startup landmarks get requested before bulk fleet'
assert result['frames'] > 0, 'world renders'
print({'pass': True, **result})
