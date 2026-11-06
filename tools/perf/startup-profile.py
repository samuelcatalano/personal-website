# CACHE=cold|warm RUNS=3 OUT=/tmp/startup.json browser-harness < tools/perf/startup-profile.py
import json
import os
import time

def evaluate(expression):
    response = cdp('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True, _response_timeout=180)
    if 'exceptionDetails' in response:
        raise RuntimeError(str(response['exceptionDetails'])[:500])
    return response['result'].get('value')

tab = new_tab('about:blank')
target = tab if isinstance(tab, str) else tab.get('targetId', tab)
activate_tab(target)
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=os.environ.get('CACHE', 'cold') == 'cold')
if os.environ.get('MBPS'):
    cdp('Network.emulateNetworkConditions', offline=False, latency=40, downloadThroughput=float(os.environ['MBPS']) * 1000000 / 8, uploadThroughput=1000000)
else:
    cdp('Network.emulateNetworkConditions', offline=False, latency=0, downloadThroughput=-1, uploadThroughput=-1)
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
cdp('Page.addScriptToEvaluateOnNewDocument', source=r'''(() => {
  const state = window.__startup = { longtasks: [], stages: [], errors: [] };
  new PerformanceObserver(list => state.longtasks.push(...list.getEntries().map(e => [e.startTime, e.duration]))).observe({type:'longtask', buffered:true});
  new MutationObserver(() => {
    if (!state.ready && document.body?.classList.contains('world-ready')) state.ready = performance.now();
  }).observe(document, {subtree:true, attributes:true, attributeFilter:['class']});
  addEventListener('error', e => state.errors.push(e.message));
  addEventListener('unhandledrejection', e => state.errors.push(String(e.reason)));
  const bitmap = window.createImageBitmap;
  window.createImageBitmap = async function(...args) {
    const start = performance.now();
    try { return await bitmap.apply(this, args); }
    finally { state.stages.push({name:'imageBitmap', start, end:performance.now()}); }
  };
  for (const name of ['compileShader','linkProgram','texImage2D','compressedTexImage2D']) {
    const original = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function(...args) {
      const start = performance.now();
      try { return original.apply(this,args); }
      finally { const end=performance.now(); if(end-start>5)state.stages.push({name,start,end}); }
    };
  }
})()''')
results = []
for run in range(int(os.environ.get('RUNS', '1'))):
    cdp('Profiler.enable')
    cdp('Profiler.start')
    cdp('Page.stopLoading', _response_timeout=180)
    cdp('Page.navigate', url=os.environ.get('URL', 'http://localhost:8000/?weather=clear&qa=1'), _response_timeout=180)
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        if evaluate('!!window.__startup?.ready || document.body?.classList.contains("no-webgl")'):
            break
        time.sleep(0.2)
    time.sleep(2)
    result = evaluate(r'''(() => ({ ...window.__startup,
      navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
      paints: performance.getEntriesByType('paint').map(e=>e.toJSON()),
      resources: performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,end:e.responseEnd,duration:e.duration,bytes:e.encodedBodySize,transfer:e.transferSize})),
      frames: window.__qaWorldFrames, npc: !!window.__qaScene?.getObjectByName('npc3d-shadow'), renderer: window.__qaRenderer?.getContext().getParameter(7937)
    }))()''')
    profile = cdp('Profiler.stop')['profile']
    nodes = {n['id']: n for n in profile['nodes']}
    times = {}
    for sample, delta in zip(profile.get('samples', []), profile.get('timeDeltas', [])):
        frame = nodes[sample]['callFrame']
        key = frame['functionName'] + ' ' + frame['url'].replace('http://localhost:8000/', '') + ':' + str(frame['lineNumber'] + 1)
        times[key] = times.get(key, 0) + delta / 1000
    result['cpuTop'] = sorted(times.items(), key=lambda pair: pair[1], reverse=True)[:25]
    results.append(result)
    with open(os.environ.get('OUT', '/tmp/startup-profile.json'), 'w') as output:
        json.dump(results, output)
    assert result.get('ready') and result['frames'] > 0, 'World did not become ready and render within the profiling deadline'
    print(json.dumps({'run':run, 'ready':result.get('ready'), 'npc':result['npc'], 'GLB_MiB':round(sum(r['bytes'] for r in result['resources'] if '.glb' in r['name'])/1048576,2), 'longtask_ms':round(sum(t[1] for t in result['longtasks'])), 'errors':result['errors'], 'cpuTop':result['cpuTop'][:8]}))
cdp('Emulation.clearDeviceMetricsOverride')
cdp('Network.emulateNetworkConditions', offline=False, latency=0, downloadThroughput=-1, uploadThroughput=-1)
close_tab(target)
