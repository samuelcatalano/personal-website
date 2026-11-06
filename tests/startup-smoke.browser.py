# browser-harness < tests/startup-smoke.browser.py (EN/PT fallback and reduced motion)
import json
import time

tab = new_tab('http://localhost:8000/')
target = tab if isinstance(tab, str) else tab.get('targetId', tab)
activate_tab(target)
wait_for_load()
previous = js("localStorage.getItem('lang')")
cdp('Page.addScriptToEvaluateOnNewDocument', source=r'''(() => {
  const q=new URLSearchParams(location.search); localStorage.setItem('lang',q.get('smokeLang')||'en');
  window.__smokeErrors=[];
  addEventListener('error',e=>__smokeErrors.push(e.message));
  addEventListener('unhandledrejection',e=>__smokeErrors.push(String(e.reason)));
  if(q.has('smokeNoGL')) {
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};
  }
})()''')
try:
    for lang, webgl in [('en', False), ('pt', False), ('pt', True)]:
        cdp('Emulation.setEmulatedMedia', features=[{'name':'prefers-reduced-motion','value':'reduce'}])
        goto_url('http://localhost:8000/?qa=1&weather=clear&smokeLang='+lang+('' if webgl else '&smokeNoGL=1'))
        wait_for_load()
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            if js('document.body.classList.contains("'+('world-ready' if webgl else 'no-webgl')+'")'):
                break
            time.sleep(0.1)
        result=js('({lang:document.documentElement.lang,text:document.querySelector("#panel").textContent.length,ready:document.body.classList.contains("world-ready"),fallback:document.body.classList.contains("no-webgl"),errors:window.__smokeErrors})')
        assert result['lang']==('pt-BR' if lang=='pt' else 'en') and result['text']>100 and not result['errors'], result
        assert result['ready'] if webgl else result['fallback'], result
        print({'pass':True,'webgl':webgl,'reducedMotion':True,**result})
finally:
    js('localStorage.'+('removeItem("lang")' if previous is None else 'setItem("lang",'+json.dumps(previous)+')'))
    cdp('Emulation.setEmulatedMedia', features=[])
    close_tab(target)
