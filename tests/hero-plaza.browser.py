# browser-harness < tests/hero-plaza.browser.py
new_tab('about:blank');cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
goto_url('http://localhost:8000/tests/fixtures/hero-plaza-stage.html');wait_for_load()
def js(expression):
 r=cdp('Runtime.evaluate',expression=expression,returnByValue=True,awaitPromise=True,_response_timeout=120)
 if 'exceptionDetails' in r:raise RuntimeError(str(r['exceptionDetails'])[:1200])
 return r['result'].get('value')
exec(compile(open('tests/hero-realm.browser.py').read(),'tests/hero-realm.browser.py','exec'))
print(js(r'''(async()=>{
 const T=await import('three'),{stage}=await import('/tests/fixtures/hero-plaza-stage.js'),{walkPaths}=await import('/js/world/crowd.js'),{stops}=await import('/js/content.js'),L=await import('/js/world/layout.js'),{streetEnvironment}=await import('/js/world/streetscape-state.js');
 const errors=[],old=console.error;console.error=(...a)=>{errors.push(a.map(String).join(' '));old(...a)};
 const s=await stage(),check=(v,m)=>{if(!v)throw Error(m)};
 s.scene.updateMatrixWorld(true);const ray=new T.Raycaster();
 for(const side of [-1,1]){ray.set(new T.Vector3(-283+side*2.85,3,side*14),new T.Vector3(0,-1,0));const hit=ray.intersectObject(s.realm.getObjectByName('hero-ground'))[0];check(hit&&Math.abs(hit.point.y-.112)<.002,'shaded seating pocket is obstructed by the old curb');}
 const paths=walkPaths(stops,L.routePoints(stops.length)).filter(p=>p.name?.startsWith('hero-garden-'));
 for(const p of paths)for(const o of s.realm.userData.obstacles){const r={x0:o.rect.x0-283,x1:o.rect.x1-283,z0:o.rect.z0,z1:o.rect.z1};check(!(r.x0<p.rect.x1&&r.x1>p.rect.x0&&r.z0<p.rect.z1&&r.z1>p.rect.z0),'obstacle crosses existing pedestrian route');}
 const obstacles=s.realm.userData.obstacles;for(let i=0;i<obstacles.length;i++)for(let j=i+1;j<obstacles.length;j++){const a=obstacles[i].rect,b=obstacles[j].rect;check(!(a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0),'furniture footprints overlap');}
 for(const tree of s.treePlacements)for(const o of obstacles.filter(o=>o.kind==='bench'||o.kind==='portal-planter')){const r=o.rect;const x=tree.x+283,z=tree.z,dx=Math.max(r.x0-x,0,x-r.x1),dz=Math.max(r.z0-z,0,z-r.z1);check(Math.hypot(dx,dz)>.25,'seat or planter overlaps retained tree trunk');}
 const portal=s.tunnel.group.children[2].geometry.attributes.position;for(let i=0;i<portal.count;i++)if(portal.getY(i)<-.051)check(Math.abs(portal.getZ(i))>=3.949,'portal detail narrows existing vehicle opening');
 const water=s.realm.getObjectByName('hero-fountain-water'),before=Array.from(water.geometry.attributes.position.array);
 const day=s.draw(0,2),cv=document.createElement('canvas');cv.width=innerWidth;cv.height=innerHeight;const ctx=cv.getContext('2d');ctx.drawImage(s.renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,cv.width,cv.height).data;
 s.draw(0,3);ctx.drawImage(s.renderer.domElement,0,0);const next=ctx.getImageData(0,0,cv.width,cv.height).data;let changed=0;const corners=[[-2.6,.3,-2.6],[2.6,1.1,2.6],[-2.6,1.1,2.6],[2.6,.3,-2.6]].map(v=>new T.Vector3(v[0]-283,v[1],v[2]).project(s.camera));const x0=Math.max(0,Math.floor(Math.min(...corners.map(p=>(p.x*.5+.5)*cv.width)))),x1=Math.min(cv.width,Math.ceil(Math.max(...corners.map(p=>(p.x*.5+.5)*cv.width)))),y0=Math.max(0,Math.floor(Math.min(...corners.map(p=>(.5-p.y*.5)*cv.height)))),y1=Math.min(cv.height,Math.ceil(Math.max(...corners.map(p=>(.5-p.y*.5)*cv.height))));for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*cv.width+x)*4;if(Math.abs(pixels[i]-next[i])+Math.abs(pixels[i+1]-next[i+1])+Math.abs(pixels[i+2]-next[i+2])>3)changed++;}
 check(changed>10,'water has no visible time-dependent ripple');
 check(before.every((v,i)=>v===water.geometry.attributes.position.array[i]),'GPU water animation must not rebuild CPU geometry');
 const night=s.draw(1,3);check(water.material.userData.uNight.value===1,'water ignores night');
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};water.material.onBeforeCompile(shader);check(shader.uniforms.uPlazaTime===streetEnvironment.time,'water does not share frozen scene clock');
 check(!errors.length,errors.join('\n'));check(s.renderer.getContext().getError()===0,'WebGL error');console.error=old;return {pass:true,day,night,animatedPixels:changed,obstacles:obstacles.length,paths:paths.length};
})()'''))
