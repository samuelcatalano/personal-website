# Active authored-tree contracts, desktop browser-harness from repository root.
from pathlib import Path
r=new_tab('http://localhost:8000/tests/fixtures/npc-stage.html');tab=r if isinstance(r,str) else r['targetId'];wait_for_load()
cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
def js(expression):
    result=cdp('Runtime.evaluate',expression=expression,returnByValue=True,awaitPromise=True,_response_timeout=120)
    if 'exceptionDetails' in result:raise RuntimeError(result['exceptionDetails'])
    return result['result'].get('value')
try:
    exec(compile(Path('tests/botanical-trees.browser.py').read_text(),'botanical-trees','exec'))
finally:
    close_tab(tab)
