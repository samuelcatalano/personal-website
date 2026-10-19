# browser-harness < tests/public-walks.browser.py (local preview)
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js(r'''(async () => {
  const T = await import('three');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const { buildCity } = await import('./js/world/city.js');
  const { buildLandmarks } = await import('./js/world/landmarks.js');
  const { crowdPlan, walkPaths } = await import('./js/world/crowd.js');
  const pts = routePoints(stops.length), curve = routeCurve(T, pts), boxes = [];
  const add = (x,y,z,w,h,d,color) => boxes.push({x,y,z,w,h,d,color});
  const collectTree = (x,z,{h,crown,base=.1}) => boxes.push({x,y:base,z,w:crown,h:h+1.2,d:crown,color:'tree'});
  buildCity(add, stops, pts, curve, collectTree); buildLandmarks(add, stops, pts, collectTree);
  const paths = walkPaths(stops, pts).filter(p => p.type === 'wander'), hits = [];
  let samples = 0;
  for (const p of paths) {
    const {x0,x1,z0,z1} = p.rect, y = p.y;
    const obstacles = boxes.filter(b => b.y < y+1.9 && b.y+b.h > y+0.1 && b.x+b.w/2 > x0 && b.x-b.w/2 < x1 && b.z+b.d/2 > z0 && b.z-b.d/2 < z1);
    const max = Math.max(.35, Math.min(6, (Math.min(x1-x0,z1-z0)-1)/2));
    for (const inset of [.35,(.35+max)/2,max]) {
      const a=x0+inset,b=x1-inset,c=z0+inset,d=z1-inset;
      const probe = (x,z) => {
        samples++;
        const obstacle=obstacles.find(o => Math.abs(x-o.x)<o.w/2+.22 && Math.abs(z-o.z)<o.d/2+.22);
        if (obstacle && !hits.some(h => h.path===p.name)) hits.push({path:p.name,x,z,obstacle});
      };
      for(let x=a;x<=b;x+=.4) { probe(x,c); probe(x,d); }
      for(let z=c;z<=d;z+=.4) { probe(a,z); probe(b,z); }
    }
  }
  if(hits.length) throw Error(JSON.stringify(hits));
  const plan = crowdPlan(stops,pts,1017);
  if(plan.length!==1000 || plan.slice(600).some(p=>p.path.type!=='wander')) throw Error('Missing public-space pedestrians');
  return {pass:true, paths:paths.length, added:plan.length-600, collisionSamples:samples};
})()'''))
