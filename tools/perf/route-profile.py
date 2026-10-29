# Scripted route-scroll profile. Run: BU_NAME=perf BU_CDP_URL=http://127.0.0.1:9431 CONFIG="kit=off" SEG=8.5:11.5 browser-harness < tools/perf/route-profile.py
# Env: CONFIG (query string), SEG "S0:S1" (default 8.5:11.5), STEPS (default 600), DUR seconds (default 25), URL.
# Draw calls/triangles come from a WebGL2 prototype hook (all passes incl. shadows); the scene graph is not reachable
# without code changes, so "visible meshes" is approximated by draw calls. Prints one JSON line.
import os, time, json
URL = os.environ.get('URL', 'http://localhost:8000/') + '?weather=clear&' + os.environ.get('CONFIG', '')
S0, S1 = [float(x) for x in os.environ.get('SEG', '8.5:11.5').split(':')]
STEPS, DUR = int(os.environ.get('STEPS', 600)), float(os.environ.get('DUR', 25))
HOOK = """(()=>{const P=WebGL2RenderingContext.prototype;window.__c={calls:0,tris:0};
const w=(n,f)=>{const o=P[n];P[n]=function(...a){const c=window.__c;c.calls++;c.tris+=f(a);return o.apply(this,a)}};
w('drawElements',a=>a[0]>=4?a[1]/3:0);w('drawArrays',a=>a[0]>=4?a[2]/3:0);
w('drawElementsInstanced',a=>a[0]>=4?a[1]/3*a[4]:0);w('drawArraysInstanced',a=>a[0]>=4?a[2]/3*a[3]:0);
w('drawRangeElements',a=>a[0]>=4?a[4]/3:0);})()"""
t = new_tab('about:blank'); TAB = t if isinstance(t, str) else t.get('targetId', t); activate_tab(TAB)
cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Page.enable'); cdp('Page.addScriptToEvaluateOnNewDocument', source=HOOK)
goto_url(URL); wait_for_load()
for _ in range(240):
    if js("document.body.classList.contains('world-ready')"): break
    time.sleep(.5)
time.sleep(4)  # let lazy kits / GLBs settle
js("""(async()=>{const s=await import('/js/scroll.js'),c=await import('/js/content.js'),L=await import('/js/world/layout.js');
const n=c.stops.length,m=s.stopMarks(L.routePoints(n)),H=document.documentElement.scrollHeight;
const Y=p=>{const i=Math.floor(p),f=p-i,a=s.scrollYForStop(i,n,H,innerHeight,m),b=s.scrollYForStop(Math.min(n-1,i+1),n,H,innerHeight,m);return a+(b-a)*f};
const S={y0:Y(%f),y1:Y(%f),p0:%f,p1:%f,steps:%d,dur:%f};window.__S=S;scrollTo({top:S.y0,behavior:'instant'})})()""" % (S0, S1, S0, S1, STEPS, DUR))
time.sleep(3)
activate_tab(TAB)
js("""(()=>{const S=window.__S,F=[];let long=[];
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>long.push(e.duration))).observe({entryTypes:['longtask']})}catch(e){}
const h0=performance.memory.usedJSHeapSize;let hp=h0,last=performance.now(),t0=last,done=false;
const tick=now=>{const dt=now-last;last=now;const c=window.__c;F.push([dt,c.calls,c.tris]);c.calls=0;c.tris=0;
const f=Math.min(1,(now-t0)/(S.dur*1000));const p=S.p0+(S.p1-S.p0)*f;scrollTo({top:S.y0+(S.y1-S.y0)*Math.round(f*S.steps)/S.steps,behavior:'instant'});
hp=Math.max(hp,performance.memory.usedJSHeapSize);
if(f<1)requestAnimationFrame(tick);else{window.__R={F,long,h0,h1:performance.memory.usedJSHeapSize,hp,p0:S.p0,p1:S.p1};}};
requestAnimationFrame(tick)})()""")
for _ in range(int(DUR * 8) + 60):
    time.sleep(1)
    if js("!!window.__R"): break
R = json.loads(js("JSON.stringify(window.__R)"))
F = R['F'][2:]
def q(a, p):
    a = sorted(a); return a[min(len(a) - 1, int(len(a) * p))]
dt = [f[0] for f in F]; ca = [f[1] for f in F]; tr = [f[2] for f in F]
med = lambda a: q(a, .5)
# pops: |delta calls| > max(3, 3 x running median |delta|) between consecutive frames
pops = []; ds = []
for i in range(1, len(F)):
    d = abs(ca[i] - ca[i - 1]); ds.append(d); th = max(3, 3 * med(ds[-120:]))
    if d > th: pops.append((d, round(S0 + (S1 - S0) * i / len(F), 2), ca[i - 1], ca[i]))
pops.sort(reverse=True)
MB = 1048576
print(json.dumps(dict(config=os.environ.get('CONFIG', ''), seg=[S0, S1], frames=len(F), median=round(med(dt), 2), p95=round(q(dt, .95), 2),
  p99=round(q(dt, .99), 2), max=round(max(dt), 1), longtasks=len(R['long']), longtask_max=round(max(R['long'] or [0]), 1),
  calls_med=med(ca), calls_p95=q(ca, .95), tris_med=round(med(tr)), tris_p95=round(q(tr, .95)),
  heap_start_mb=round(R['h0'] / MB), heap_end_mb=round(R['h1'] / MB), heap_peak_mb=round(R['hp'] / MB), pops=pops[:10])))
cdp('Target.closeTarget', targetId=TAB)
