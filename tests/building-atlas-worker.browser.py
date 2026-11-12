# browser-harness < tests/building-atlas-worker.browser.py
tab = new_tab('http://localhost:8000/tests/fixtures/npc-stage.html')
activate_tab(tab if isinstance(tab, str) else tab.get('targetId', tab))
cdp('Network.enable')
cdp('Network.setBypassServiceWorker', bypass=True)
for blocked in [False, True]:
    goto_url('http://localhost:8000/tests/fixtures/npc-stage.html')
    wait_for_load()
    reply = cdp('Runtime.evaluate', expression=r'''(async()=>{
      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
      const NativeWorker=window.Worker;let workers=0;
      window.Worker=class extends NativeWorker {
        constructor(...args){if(BLOCKED)throw Error('blocked worker');super(...args);workers++;}
      };
      try {
        const m=await import('/js/world/building-slice-materials.js');
        check(typeof m.prepareArchitectureMaterials==='function','Atlas preparation still blocks the scene constructor');
        await Promise.all([m.prepareArchitectureMaterials(),m.prepareArchitectureMaterials()]);
        check(workers===(BLOCKED?0:1),'Atlas worker is not single-flight or does not fall back');
        const expected=[[544810882,1967087339,2567886451],[1485052815,4103241495,3868138199]],hashes=[];
        for(const landmark of [false,true]){
          const set=m.townhouseMaterials({landmark}).architecture,actual=[];
          for(const k of ['map','normalMap','roughnessMap']){
            const t=set[k],data=t.image.getContext('2d').getImageData(0,0,t.image.width,t.image.height).data;let h=2166136261;
            for(const n of data)h=Math.imul(h^n,16777619)>>>0;actual.push(h);
          }
          check(JSON.stringify(actual)===JSON.stringify(expected[landmark?1:0]),'Threaded atlas changes material pixels');hashes.push(actual);
        }
        return {pass:true,blocked:BLOCKED,workers,hashes};
      }finally{window.Worker=NativeWorker;}
    })()'''.replace('BLOCKED', 'true' if blocked else 'false'), awaitPromise=True, returnByValue=True, _response_timeout=120)
    assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
    print(reply['result']['value'])
