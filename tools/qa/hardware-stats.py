# Desktop hardware measurements through browser-harness. Start one local server first.
# URL=http://localhost:8000/ OUT=/tmp/stats.json SOURCE_DIR=/path/to/clean/worktree browser-harness < tools/qa/hardware-stats.py
# Frame intervals are rAF timings, not GPU execution times. Draws/triangles count GL calls, including passes.
# Run before/after sequentially on the same active browser and inspect renderer, camera and viewport.
import os,time,json,subprocess
from urllib.parse import urlsplit
base=os.environ['URL']; out=os.environ['OUT']; source_dir=os.path.realpath(os.environ['SOURCE_DIR'])
url=urlsplit(base)
if url.scheme not in ('http','https') or url.hostname != 'localhost' or url.username is not None or url.password is not None or url.path not in ('','/') or url.query or url.fragment or '?' in base or '#' in base:
 raise ValueError('URL must be localhost at the root without credentials, query or fragment')
base=base.rstrip('/')+'/'
root=subprocess.check_output(['git','-C',source_dir,'rev-parse','--show-toplevel'],text=True).strip()
if os.path.realpath(root) != source_dir:
 raise ValueError('SOURCE_DIR must be a worktree root')
if subprocess.check_output(['git','-C',source_dir,'status','--porcelain','--untracked-files=all'],text=True):
 raise ValueError('SOURCE_DIR must be clean')
revision=subprocess.check_output(['git','-C',source_dir,'rev-parse','HEAD'],text=True).strip()
t=new_tab('about:blank'); activate_tab(t if isinstance(t,str) else t.get('targetId',t))
cdp('Emulation.setEmulatedMedia',features=[{'name':'prefers-reduced-motion','value':'no-preference'}]); cdp('Network.enable'); cdp('Network.setCacheDisabled',cacheDisabled=True); cdp('Emulation.setDeviceMetricsOverride',width=1600,height=900,deviceScaleFactor=1,mobile=False)
source='''(()=>{try{localStorage.setItem("theme","day")}catch(e){};let s=window.__auditGL={draws:0,tris:0};let p=WebGL2RenderingContext.prototype;for(let name of ["drawArrays","drawElements","drawArraysInstanced","drawElementsInstanced"]){let f=p[name];p[name]=function(...a){s.draws++;let n=name.includes("Elements")?a[1]:a[2],inst=name.endsWith("Instanced")?a[a.length-1]:1;if(a[0]===this.TRIANGLES)s.tris+=n*inst/3;return f.apply(this,a)}}})()'''
cdp('Page.addScriptToEvaluateOnNewDocument',source=source)
goto_url(base+'?qa=1&weather=clear');wait_for_load()
for _ in range(120):
 if js("document.body.classList.contains('world-ready') && !!window.__qaRenderer && typeof window.__qaWorldFrames === 'number'"): break
 time.sleep(.5)
else:
 raise RuntimeError('world-ready, QA renderer and world frame counter did not become available')
rows=[]
for stop in [5,11,13]:
 js("(async()=>{const s=await import('/js/scroll.js'),c=await import('/js/content.js'),L=await import('/js/world/layout.js');const n=c.stops.length,m=s.stopMarks(L.routePoints(n));scrollTo({top:s.scrollYForStop(%s,n,document.documentElement.scrollHeight,innerHeight,m),behavior:'instant'})})()"%stop)
 time.sleep(8)
 data=js('''(async()=>{const s=window.__auditGL,b={...s},frameStart=__qaRenderer.info.render.frame,worldFrameStart=__qaWorldFrames,d=[];let visible=document.visibilityState==='visible';const visibilityChanged=()=>{if(document.visibilityState!=='visible')visible=false};document.addEventListener('visibilitychange',visibilityChanged);let last=null;await new Promise(resolve=>{function tick(t){visible&&=document.visibilityState==='visible';if(last!==null)d.push(t-last);last=t;if(d.length<120)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});document.removeEventListener('visibilitychange',visibilityChanged);d.sort((a,b)=>a-b);let gl=__qaRenderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {visibility:document.visibilityState,visibleThroughout:visible,renderFrameDelta:__qaRenderer.info.render.frame-frameStart,worldFrameDelta:__qaWorldFrames-worldFrameStart,dpr:devicePixelRatio,userAgent:navigator.userAgent,median:(d[59]+d[60])/2,p95:d[113],draws:(s.draws-b.draws)/(__qaWorldFrames-worldFrameStart),triangles:(s.tris-b.tris)/(__qaWorldFrames-worldFrameStart),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),rendererMasked:!ext,resident:{...__qaRenderer.info.memory},viewport:[innerWidth,innerHeight],camera:__qaCamera.position.toArray()}})()''')
 if not data['visibleThroughout'] or data['visibility'] != 'visible' or data['renderFrameDelta'] <= 0 or data['worldFrameDelta'] < 60:
  raise RuntimeError('Sample invalid: page hidden, renderer did not advance, or fewer than 60 world frames rendered')
 rows.append({'stop':stop,'metrics':data});print(stop,data)
resources=js('''performance.getEntriesByType('resource').filter(x=>x.name.includes('.glb')).map(x=>({name:x.name.split('/').pop(),transfer:x.transferSize,encoded:x.encodedBodySize}))''')
with open(out,'w') as f:json.dump({'url':base,'revision':revision,'source_dir':source_dir,'theme':'day','reduced_motion':'no-preference','graphics_tier':'unavailable; may change automatically','world_frame_note':'draws and triangles per world frame; samples require at least 60 world frames over 120 animation-frame intervals','render_frame_note':'renderer.info.render.frame includes offscreen render passes','async_assets_limit':'Fixed waits do not guarantee all asynchronous assets have loaded; server content must correspond to SOURCE_DIR.','rows':rows,'glb_resources':resources},f,indent=2)
