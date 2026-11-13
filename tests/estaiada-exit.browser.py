# Desktop: Estaiada street fits the adjusted quadra and keeps the landmark deck unchanged.
t=new_tab('http://localhost:8000/tests/fixtures/npc-stage.html');target=t if isinstance(t,str) else t['targetId'];wait_for_load()
try:
 cdp('Network.enable');cdp('Network.setCacheDisabled',cacheDisabled=True);cdp('Network.setBypassServiceWorker',bypass=True)
 print(js(r'''(async()=>{
  const T=await import('three'),{stops}=await import('/js/content.js'),L=await import('/js/world/layout.js');
  const {estaiadaRoute,estaiadaDeck}=await import('/js/world/landmark-geometry.js'),{buildCity}=await import('/js/world/city.js');
  const check=(ok,msg)=>{if(!ok)throw Error(msg)},pts=L.routePoints(stops.length),curve=L.routeCurve(T,pts),x=pts[L.stopIndex(stops,L.LANDMARKS.estaiada)].x;
  const route=estaiadaRoute(x,curve,L.RIVER_Z);
  const {loadFleetCatalog,regionalFleetModel}=await import('/js/world/vehicle-assets.js'),catalog=await loadFleetCatalog();
  const fleet=[4,5,6,7].map(slot=>regionalFleetModel(catalog,'br',slot));
  for(const m of fleet)check(m.dimensions.length/2<=2.6&&m.dimensions.bodyWidth/2<=1.15&&m.dimensions.height<=2.8,'Fleet exceeds the tested body envelope '+m.id);
  check(route.street?.curve,'Estaiada needs the same curved-street continuation');
  check(route.stations.length===65,'Original bridge stations changed');
  const deck=estaiadaDeck(x,L.RIVER_Z,route);check(deck.children.length===2,'Street adds a deck material bucket');
  const a=route.street.curve.getPointAt(0),t=route.street.curve.getTangentAt(0);
  check(Math.abs(a.x)<1e-8&&Math.abs(a.z+35)<1e-8&&Math.abs(a.y-.075)<1e-8&&t.z<-.99,'Street misses existing far deck');
  const plots=[];buildCity(()=>{},stops,pts,curve,undefined,undefined,p=>plots.push(p));
  const moved={'block--43--93':-37.65067056529224,'block--24--93':-23.097834250843153,'rear--20':-21.169937156280504,'rear--5':-2.9777490347856657};
  for(const [id,x]of Object.entries(moved)){
    const lot=plots.find(p=>p.id===id);check(Math.abs(lot?.x-x)<1e-8,'Missing approved quadra relocation '+id);
    for(const other of plots)if(other!==lot)check(Math.abs(lot.x-other.x)>=(lot.width+other.width)/2+.4||Math.abs(lot.z-other.z)>=(lot.depth+other.depth)/2+.4,'Relocated lot overlaps neighbour '+id+'/'+other.id);
  }
  check(route.trafficStations.length===129,'Traffic lost original bridge or continuation stations');
  for(const q of route.trafficStations.slice(0,64))for(const side of [-1,1])for(const forward of [-2.6,2.6])for(const width of [-1.15,1.15]){
    const right=side*q.lane+width,X=q.x-q.tz*right+q.tx*forward,Z=q.z+q.tx*right+q.tz*forward;
    const hit=plots.find(lot=>Math.abs(X-lot.x)<lot.width/2+.05&&Math.abs(Z-lot.z)<lot.depth/2+.05);
    check(!hit,'Traffic body sweeps into '+hit?.id);
  }
  const touched=new Set(),collisions=[],p=new T.Vector3(),tan=new T.Vector3();let samples=0;
  for(let k=0;k<=250;k++){
   const u=k/250;route.street.curve.getPointAt(u,p);route.street.curve.getTangentAt(u,tan);
   const half=2.8+.8*Math.max(0,1-u*route.street.length/6)+.62;
   for(const side of [-1,0,1]){
    const q=p.clone().add(new T.Vector3(tan.z*side*half,0,-tan.x*side*half));q.x+=x;q.z+=L.RIVER_Z;
    for(const lot of plots)if(Math.abs(q.x-lot.x)<lot.width/2+.2&&Math.abs(q.z-lot.z)<lot.depth/2+.2){touched.add(lot.id);collisions.push({u,x:q.x,z:q.z,lot:lot.id,edge:lot.x+lot.width/2});}
    samples++;
   }
  }
  check(!touched.size,'Estaiada street intersects lots '+JSON.stringify(collisions.slice(0,8)));
  const renderer=new T.WebGLRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,300);renderer.setSize(128,128);scene.add(deck,new T.HemisphereLight(0xffffff,0x445566,2));camera.position.set(x+30,35,-70);camera.lookAt(x,0,-95);renderer.render(scene,camera);
  check(renderer.getContext().getError()===0,'Street render error');renderer.dispose();
  return{pass:true,stations:route.stations.length,streetLength:route.street.length,clearSamples:samples,trafficStations:route.trafficStations.length,maxFleetLength:Math.max(...fleet.map(m=>m.dimensions.length)),triangles:deck.children.map(m=>m.geometry.attributes.position.count/3)};
 })()'''))
finally:cdp('Target.closeTarget',targetId=target)
