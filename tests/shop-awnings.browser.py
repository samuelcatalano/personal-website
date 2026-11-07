# browser-harness < tests/shop-awnings.browser.py (local preview; URL env overrides http://localhost:8000/)
# Regular shop frontages: the canopy takes a colour accent from existing surfaces (brick, roof, door), and the accent varies across lots.
import os
URL = os.environ.get('URL', 'http://localhost:8000/')
t = new_tab('about:blank'); activate_tab(t if isinstance(t, str) else t.get('targetId', t))
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(URL); wait_for_load()
result = js(r'''(async () => {
  const shop = await import('./js/world/shop-slice.js');
  const check = (v, m) => { if (!v) throw Error(m); };
  const accents = new Set();
  for (let i = 0; i < 12; i++) {
    const plot = { id: 'shop-awning-' + i, kind: 'shop', x: 0, z: 0, width: 10, depth: 10, height: 6.8 };
    accents.add(shop.createShopSlice(plot, []).userData.awning);
  }
  check(accents.size >= 2, 'shop canopies vary their accent colour across lots');
  return { pass: true, accents: [...accents] };
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
