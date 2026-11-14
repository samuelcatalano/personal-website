# browser-harness < tests/static-matrices.browser.py (desktop QA preview)
import time
r = new_tab('about:blank')
tab = r if isinstance(r, str) else r['targetId']
cdp('Network.enable')
cdp('Network.setCacheDisabled', cacheDisabled=True)
cdp('Network.setBypassServiceWorker', bypass=True)
goto_url('http://localhost:8000/?qa=1&nosw&weather=clear')
wait_for_load()
try:
    for _ in range(180):
        if js("document.body.classList.contains('world-ready')"): break
        time.sleep(.5)
    print(js(r'''(async()=>{
      const T=await import('three'), scene=window.__qaScene;
      const check=(ok,message)=>{if(!ok)throw Error(message)};
      check(scene && document.body.classList.contains('world-ready'),'world ready');
      check(scene.matrixAutoUpdate===false,'identity scene must not force frozen descendants every frame');
      const nodes=[];scene.traverse(o=>nodes.push(o));
      const snapshot=()=>nodes.map(o=>o.matrixWorld.elements.slice());
      const equal=(a,b)=>a.every((m,i)=>m.every((v,j)=>v===b[i][j]));
      const multiply=T.Matrix4.prototype.multiplyMatrices;let calls=0;
      T.Matrix4.prototype.multiplyMatrices=function(...args){calls++;return multiply.apply(this,args)};
      let optimized,baseline;
      try {
        scene.updateMatrixWorld(true);const expected=snapshot();
        calls=0;scene.updateMatrixWorld();optimized=calls;
        check(equal(expected,snapshot()),'static and dynamic world matrices unchanged');
        scene.matrixAutoUpdate=true;calls=0;scene.updateMatrixWorld();baseline=calls;
        check(equal(expected,snapshot()),'exact equality against forced baseline');
        check(optimized<baseline,'fewer matrix multiplications');
        const rig=new T.Group(),bone=new T.Bone(),child=new T.Object3D();rig.add(bone);scene.add(rig);
        rig.position.set(3,4,5);bone.position.set(1,2,3);
        scene.matrixAutoUpdate=false;scene.updateMatrixWorld();const first=bone.matrixWorld.clone();
        rig.position.x+=2;bone.rotation.z=.4;rig.add(child);child.position.set(2,3,4);
        scene.updateMatrixWorld();const actual=[rig,bone,child].map(o=>o.matrixWorld.elements.slice());
        check(!first.equals(bone.matrixWorld),'dynamic rig follows animation');
        scene.matrixAutoUpdate=true;scene.updateMatrixWorld();
        check(equal(actual,[rig,bone,child].map(o=>o.matrixWorld.elements.slice())),'animated and newly attached nodes match baseline');
        scene.remove(rig);
      } finally {scene.matrixAutoUpdate=false;T.Matrix4.prototype.multiplyMatrices=multiply;}
      return {passed:true,nodes:nodes.length,optimized,baseline,saved:baseline-optimized};
    })()'''))
finally:
    close_tab(tab)
