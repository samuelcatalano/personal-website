# With the local preview open: browser-harness < tests/headlight-pool.browser.py
# Night road light from a bus headlamp: two lamp-tied lobes, no reach beyond 9 m, opacity inside the road-light budget, lamp glow points kept.
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
result = js(r'''(async()=>{
const check=(v,m)=>{if(!v)throw Error(m)};
const {buildVehicle}=await import('./js/world/vehicles.js'),beams=await import('./js/world/beams.js?headlight-pool-test');
const bus=buildVehicle('glasgow',{hero:true});beams.addBeams(bus,bus.userData.front,bus.userData.beamY,bus.userData.beamAnchors);
const pool=bus.children.find(c=>c.name==='beam'&&c.isMesh);check(pool&&pool.material.map&&pool.material.map.image,'road pool with a footprint texture');
check(pool.children.some(c=>c.isPoints),'lamp glow points stay on the bus');
beams.updateBeams(1);
const opacity=pool.material.opacity;check(opacity>0&&opacity<=0.2,'night road light opacity within budget: '+opacity);
const img=pool.material.map.image,W=img.width,H=img.height,px=img.getContext('2d').getImageData(0,0,W,H).data;
const A=(x,y)=>px[(y*W+x)*4+3]/255;
let far=0;for(let y=0;y<H;y++)for(let x=Math.ceil(W*9/13);x<W;x++)far=Math.max(far,A(x,y));
check(far<=0.02,'road light ends before 9 m, far max '+far.toFixed(3));
const xa=Math.round(W*2/13),centre=Math.max(A(xa,H/2-1),A(xa,H/2)),yl=Math.round(H*(0.5+0.75/8)),yr=Math.round(H*(0.5-0.75/8)),lobe=Math.max(A(xa,yl),A(xa,yr));
check(lobe>0.2,'lamp lobes readable at 2 m, lobe '+lobe.toFixed(3));
check(centre<0.7*lobe,'lamp-tied lobes: centre '+centre.toFixed(3)+' vs lobe '+lobe.toFixed(3));
return {pass:true,opacity,far,centre,lobe};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
