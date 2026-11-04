# Stop-5 office depth (block--183--37): run with the local preview open in browser-harness:
#   browser-harness < tests/office-depth.browser.py
# Structural depth checks on the stop-5 tower as built by building-kit.js. Metrics are returned so a failing run documents the baseline.
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
# Software-GL pages can hold Runtime.evaluate past the default IPC timeout (same as tools/capture.py).
def js(expression):
    r = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=900)
    if 'exceptionDetails' in r: raise RuntimeError(str(r['exceptionDetails'])[:400])
    return r['result'].get('value')
# Reload with the HTTP cache off: a page opened before an edit keeps its old module graph.
import time
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
goto_url(page_info()['url']); wait_for_load(); time.sleep(3)
result = js(r'''(async()=>{
const T=await import('three'),office=await import('./js/world/office-slice.js'),kit=await import('./js/world/building-kit.js'),mats=await import('./js/world/building-slice-materials.js'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js'),{buildCity}=await import('./js/world/city.js');
const pts=routePoints(stops.length),plots=[];buildCity(()=>{},stops,pts,routeCurve(T,pts),undefined,undefined,p=>plots.push(p));
const p=plots.find(q=>q.id===office.OFFICE_LOT_ID),shared=mats.townhouseMaterials(),fails=[],need=(ok,m)=>{if(!ok)fails.push(m)},M={};
need(p&&p.kind==='office'&&p.width===11&&p.depth===11&&p.height===31.5,'approved descriptor');
const city=kit.createCityBuildings([p]),group=city.getObjectByName(p.id);
need(group&&group.userData.archetype==='office-slice'&&group.children.length===3,'one office slice in three buckets');
need(group&&group.userData.recipe.depth===true,'stop-5 tower is built with the depth recipe (officeDepthRecipe)');
const HALF=p.width/2,TOP=p.height-1.25;
// Surfaces: 2 roof, 3 trim, 4 stone, 5 lit glass, 6 glass. Buckets: 0 mass, 1 trim, 2 glass.
const V=[];group.children.forEach((m,k)=>{const A=m.geometry.attributes,a=A.position,n=A.normal,c=A.color,s=A.aSurface;for(let i=0;i<a.count;i++)V.push({x:a.getX(i),y:a.getY(i),z:a.getZ(i),nx:n.getX(i),ny:n.getY(i),nz:n.getZ(i),r:c.getX(i),g:c.getY(i),b:c.getZ(i),s:s.getX(i),k});});
need(V.every(v=>Math.abs(v.x)<=HALF+1e-4&&Math.abs(v.z)<=HALF+1e-4&&v.y>=-1e-6&&v.y<=p.height+1e-4),'geometry inside the lot envelope');
// Quads (six vertices each): facade normal, depth along it, surface, mid height. Horizontal faces have no facade depth.
const Q=[];group.children.forEach((m,k)=>{const A=m.geometry.attributes,a=A.position,n=A.normal,s=A.aSurface,c=A.color;for(let q=0;q<a.count;q+=6){let yy=0;for(let i=q;i<q+6;i++)yy+=a.getY(i)/6;const x=a.getX(q),z=a.getZ(q),nx=n.getX(q),nz=n.getZ(q),ny=n.getY(q);Q.push({k,s:s.getX(q),yy,ny,g:c.getY(q),D:Math.abs(nx)>.5?Math.abs(x):Math.abs(nz)>.5?Math.abs(z):null,ring:Math.max(Math.abs(x),Math.abs(z))});}});
const band=q=>q.yy>5&&q.yy<25;
const maxD=f=>{const xs=Q.filter(q=>band(q)&&q.D!==null&&f(q)).map(q=>q.D);return xs.length?Math.max(...xs):0;};
const planeFin=maxD(q=>q.k===0&&q.s===3),planeSlab=maxD(q=>q.k===0&&q.s===4),planeSpandrel=maxD(q=>q.k===0&&q.s===2),planeGlass=maxD(q=>q.k===2);
M.planes={fin:+planeFin.toFixed(3),slab:+planeSlab.toFixed(3),spandrel:+planeSpandrel.toFixed(3),glass:+planeGlass.toFixed(3)};
need(planeFin-planeSpandrel>=.05,'fins stand proud of the spandrel plane by at least 5 cm');
need(planeSlab-planeSpandrel>=.10,'slab edges overhang the spandrel plane by at least 10 cm');
need(planeSlab-planeGlass>=.45,'panes sit at least 0.45 m behind the slab edges (HEAD: 0.32 m)');
// Underside shadow band: dark, down-facing quads on the wall band at the facade ring.
M.undersideShadowQuads=Q.filter(q=>q.ny<-.9&&q.k<2&&band(q)&&q.ring>=4&&q.g<.8*.91).length;
need(M.undersideShadowQuads>0,'dark underside shadow band under the slab edges');
// Podium: darker ground floor. Per-floor value variation on the upper panes (lit windows excluded).
const glassV=V.filter(v=>v.k===2&&v.s!==5),low=glassV.filter(v=>v.y<4.2),up=glassV.filter(v=>v.y>=4.2);
const avgG=a=>a.reduce((t,v)=>t+v.g,0)/Math.max(1,a.length);
M.groundGlassG=+avgG(low).toFixed(3);M.upperGlassG=+avgG(up).toFixed(3);
need(low.length>0&&avgG(low)<=.85*avgG(up),'ground floor is darker than the upper glass (podium treatment)');
M.glassTones=new Set(up.map(v=>v.r.toFixed(3)+'/'+v.g.toFixed(3))).size;
need(M.glassTones>=5,'per-floor glass value variation');
// Parapet cap: an up-facing trim face at the parapet line, overhanging the 5.0 m core.
M.parapetCapVerts=V.filter(v=>v.k===1&&v.ny>.9&&v.y>TOP+.5&&v.y<TOP+.8&&Math.max(Math.abs(v.x),Math.abs(v.z))>=5.1).length;
need(M.parapetCapVerts>0,'parapet cap overhangs the facade at the roof line');
// Budget and regression guards: triangles within +40% of the plain factory; coplanar overlaps no worse than HEAD (391).
const def=office.createOfficeSlice(p);
const tri=g=>g.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0);
M.trianglesDefault=tri(def);M.trianglesDepth=tri(group);M.triangleDeltaPct=+(100*(tri(group)/tri(def)-1)).toFixed(1);
need(tri(group)<=1.4*tri(def),'triangle growth within +40% of the plain facade');
function coplanar(g){const quads=[];g.children.forEach(m=>{const pos=m.geometry.attributes.position,nor=m.geometry.attributes.normal;for(let q=0;q<pos.count;q+=6){const P=[];for(let i=q;i<q+6;i++)P.push([pos.getX(i),pos.getY(i),pos.getZ(i)]);quads.push({P,N:[nor.getX(q),nor.getY(q),nor.getZ(q)]});}});
  const groups=new Map();for(const qd of quads){const ax=Math.abs(qd.N[0])>.5?0:Math.abs(qd.N[1])>.5?1:2;const key=ax+'|'+qd.N.map(Math.round).join(',')+'|'+qd.P[0][ax].toFixed(3);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(qd);}
  let n=0;for(const [key,list] of groups){const ax=+key[0],o=[0,1,2].filter(i=>i!==ax);const R=list.map(qd=>{const xs=qd.P.map(v=>v[o[0]]),ys=qd.P.map(v=>v[o[1]]);return [Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];});
    for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const A=R[i],B=R[j];if(Math.min(A[1],B[1])-Math.max(A[0],B[0])>1e-4&&Math.min(A[3],B[3])-Math.max(A[2],B[2])>1e-4)n++;}}
  return n;}
M.coplanarDefault=coplanar(def);M.coplanarDepth=coplanar(group);
need(M.coplanarDepth<=391&&M.coplanarDepth<=M.coplanarDefault,'no new coplanar overlaps (HEAD baseline 391)');
// Shared material identity: architecture for mass and trim, glass atlas and glow for the pane bucket.
need(group.children[0].material===shared.architecture&&group.children[1].material===shared.architecture,'mass and trim keep the shared architecture material');
need(group.children[2].material.map===shared.glass.map&&group.children[2].material.userData.glow===true,'office glass shares the glass atlas and glow');
// The plain factory (every other office lot) keeps the HEAD geometry: 1684 triangles and these FNV hashes.
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16);};
const hashOf=g=>g.children.map(m=>{const a=m.geometry.attributes.position,parts=[];for(let i=0;i<a.count;i++)parts.push(a.getX(i).toFixed(4),a.getY(i).toFixed(4),a.getZ(i).toFixed(4));return fnv(parts.join(','));});
M.defaultHashes=hashOf(def);
need(tri(def)===1684&&M.defaultHashes.join()==='aa4dc53,cf2467dd,37e42609','plain office factory unchanged from HEAD');
return {pass:fails.length===0,failures:fails,metrics:M};
})()''')
print(result)
assert isinstance(result, dict) and result.get('pass'), result
