# browser-harness < tests/backdrop-ground.browser.py
import time

tab = new_tab('about:blank')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url('http://localhost:8000/?qa=1&weather=clear')
wait_for_load()
deadline = time.monotonic() + 30
while time.monotonic() < deadline:
    if js('document.body.classList.contains("world-ready")'):
        break
    time.sleep(0.1)
result = js(r'''(async () => {
  const { PALETTE:P }=await import('./js/world/palette.js');
  const { stretch,routePoints,LEGACY_GAPS,glasgowSites }=await import('./js/world/layout.js');
  const { stops }=await import('./js/content.js');
  const floors=window.__qaScene.getObjectByName('distant-neighborhoods').userData.list.filter(b=>b.color===P.pave&&b.h<0.2);
  const cover=(x,z)=>floors.some(b=>Math.abs(x-b.x)<=b.w/2+1e-7&&Math.abs(z-b.z)<=b.d/2+1e-7);
  const {museum}=glasgowSites(stops,routePoints(stops.length,LEGACY_GAPS));
  let samples=0;
  for(const z of [-105,-115,-155,-195,-250,-310])for(let x=-600;x<850;x+=2.5){
    if(!cover(stretch(x),z))throw Error(`Missing backdrop paving at world (${stretch(x)}, ${z})`);
    samples++;
  }
  for(const z of [-105,-115,-155,-195,-250,-310]){
    const spans=floors.filter(b=>Math.abs(z-b.z)<=b.d/2).map(b=>[b.x-b.w/2,b.x+b.w/2]).sort((a,b)=>a[0]-b[0]);
    let edge=stretch(-600);
    for(const [left,right]of spans){if(right<edge)continue;if(left>edge+1e-7)throw Error(`Paving seam at (${edge},${z})`);edge=Math.max(edge,right);if(edge>=stretch(850))break;}
    if(edge<stretch(850))throw Error('paving ends inside the neighborhood');
  }
  if(!cover(stretch(museum.x),-130))throw Error('ground remains continuous behind the museum clearance');
  return {pass:true,samples,pavingSegments:floors.length};
})()''')
print(result)
