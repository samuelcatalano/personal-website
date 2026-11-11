# browser-harness < tests/plaza-water.browser.py
new_tab('about:blank');cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
goto_url('http://localhost:8000/tests/fixtures/hero-plaza-stage.html');wait_for_load()
def js(expression):
 r=cdp('Runtime.evaluate',expression=expression,returnByValue=True,awaitPromise=True,_response_timeout=120)
 if 'exceptionDetails' in r:raise RuntimeError(str(r['exceptionDetails'])[:1600])
 return r['result'].get('value')
print(js(r'''(async()=>{
 const T=await import('three'),{createPlazaWater}=await import('/js/world/plaza-water.js'),{streetEnvironment}=await import('/js/world/streetscape-state.js');
 const check=(v,m)=>{if(!v)throw Error(m)},errors=[],old=console.error;console.error=(...a)=>{errors.push(a.map(String).join(' '));old(...a)};
 const water=createPlazaWater(),a=water.geometry.attributes,source=Array.from(a.position.array);
 check(a.aWater?.count===a.position.count,'surface and jets need explicit GPU motion coordinates');
 const types=new Set();for(let i=0;i<a.aWater.count;i++){types.add(a.aWater.getX(i));check(a.aWater.getY(i)>=0&&a.aWater.getY(i)<=1,'invalid stream progress');}
 check(types.has(0)&&types.has(1),'surface and streams must both be tagged');
 check(water.geometry.boundingBox.min.y<.32&&water.geometry.boundingBox.max.y>1,'motion clearance missing');
 const scene=new T.Scene();scene.background=new T.Color('black');scene.add(water,new T.HemisphereLight(0xffffff,0x555555,3));
 const camera=new T.PerspectiveCamera(42,1,.1,30);camera.position.set(4,3.1,4);camera.lookAt(0,.45,0);
 const renderer=new T.WebGLRenderer(),target=new T.WebGLRenderTarget(320,320);renderer.setSize(320,320);renderer.setRenderTarget(target);
 const frame=(t)=>{streetEnvironment.time.value=t;renderer.render(scene,camera);const pixels=new Uint8Array(320*320*4);renderer.readRenderTargetPixels(target,0,0,320,320,pixels);return pixels;};
 const delta=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>4)n++;return n;};
 const start=frame(2),moving=frame(2.7);check(delta(start,moving)>100,'water material is not visibly moving');const frozenPixels=delta(moving,frame(2.7));check(frozenPixels===0,'fixed scene clock must freeze all water animation');
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};water.material.onBeforeCompile(shader);check(shader.uniforms.uPlazaTime===streetEnvironment.time,'motion ignores shared reduced-motion clock');
 const compile=water.material.onBeforeCompile;water.material.onBeforeCompile=s=>{compile(s);s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=vec3(1.0);\n#include <opaque_fragment>');};water.material.customProgramCacheKey=()=> 'fountain-silhouette-test';water.material.needsUpdate=true;
 const shapeA=frame(2),shapeB=frame(2.7),silhouettePixels=delta(shapeA,shapeB);check(silhouettePixels>10,'jet geometry is static: flat-colour silhouettes must move');
 check(source.every((v,i)=>v===a.position.array[i]),'GPU motion must not rebuild CPU geometry');check(!errors.length,errors.join('\n'));check(renderer.getContext().getError()===0,'WebGL error');
 const result={pass:true,movingPixels:delta(start,moving),silhouettePixels,triangles:(water.geometry.index?.count??a.position.count)/3,frozenPixels};
 water.userData.dispose();target.dispose();renderer.dispose();console.error=old;return result;
})()'''))
