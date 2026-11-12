# browser-harness < tests/towerbridge-foam.browser.py (local preview with ?qa=1)
print(js(r'''(async()=>{
  const { towerPierBounds } = await import('./js/world/water-math.js');
  const { createWater } = await import('./js/world/water.js');
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  const x=100,z=-45, old=towerPierBounds(x,z), authored=towerPierBounds(x,z,true);
  const w=createWater({x0:0,x1:200,z,width:22,piers:old});
  const u=w.mesh.material.uniforms;
  const positions=()=>u.uPiers.value.slice(0,u.uPierN.value).map(p=>p.toArray());
  const rows=ps=>ps.map(p=>[p.x,p.z,p.hx,p.hz]);
  check(JSON.stringify(positions())===JSON.stringify(rows(old)), 'procedural fallback footprints');
  w.setPiers(authored);
  check(JSON.stringify(positions())===JSON.stringify(rows(authored)), 'authored upgrade updates both pier masks');
  w.setPiers([]);check(u.uPierN.value===0,'empty mask drops old piers');w.dispose();
  const bridge=__qaScene.getObjectByName('towerbridge-geometry');
  const live=__qaWater.mesh.material.uniforms;
  const loaded=bridge.children.some(o=>o.name.startsWith('towerbridge-glb-lod'));
  const expected=towerPierBounds(bridge.position.x,bridge.position.z,loaded);
  check(JSON.stringify(live.uPiers.value.slice(0,live.uPierN.value).map(p=>p.toArray()))===JSON.stringify(rows(expected)), 'live foam follows the active bridge model');
  return {pass:true,authoredLoaded:loaded,piers:live.uPierN.value};
})()'''))
