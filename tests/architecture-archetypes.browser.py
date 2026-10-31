# browser-harness < tests/architecture-archetypes.browser.py
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:')), 'Open the local preview first'
result=js(r'''(async()=>{
 const T=await import('three'),r=await import('./js/world/city-rollout.js'),{stops}=await import('./js/content.js'),{routePoints,routeCurve}=await import('./js/world/layout.js'),{buildCity}=await import('./js/world/city.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)},pts=routePoints(stops.length),plots=[];buildCity(()=>{},stops,pts,routeCurve(T,pts),undefined,undefined,p=>plots.push(p));
 const before=JSON.stringify(plots),groups={townhouse:new Map(),shop:new Map(),midrise:new Map(),office:new Map(),tower:new Map()},regions=new Set();
 for(const p of plots){const kind=r.classifyPlot(p);if(!kind)continue;const recipe=r.rolloutRecipe(p,kind,plots);check(recipe.archetype&&recipe.region,'missing deterministic facade archetype/region for '+p.id);const signature=JSON.stringify(kind==='townhouse'?[recipe.roof,recipe.bays,recipe.bands]:kind==='shop'?[recipe.composition,recipe.storeBays,recipe.roofCap]:kind==='midrise'?[recipe.emphasis,recipe.penthouse,recipe.rooftop]:kind==='office'?[recipe.emphasis,recipe.crown,recipe.rooftop]:[recipe.silhouette,recipe.crown]);if(!groups[kind].has(recipe.archetype))groups[kind].set(recipe.archetype,signature);regions.add(recipe.region);check(JSON.stringify(recipe)===JSON.stringify(r.rolloutRecipe(p,kind,plots)),'non-deterministic recipe '+p.id);}
 const expected={townhouse:3,shop:2,midrise:2,office:2,tower:3};for(const [kind,count] of Object.entries(expected)){check(groups[kind].size===count,kind+' does not expose '+count+' visual archetypes');check(new Set(groups[kind].values()).size===count,kind+' labels archetypes without distinct geometry signatures');}
 check(new Set(Object.values(groups).flatMap(group=>[...group.keys()])).size===12,'expected twelve distinct visual archetypes');check(regions.size>=4,'expected Paulista, London, countryside and Glasgow regional palettes');check(JSON.stringify(plots)===before,'archetype selection mutated source lot descriptors');
 return {pass:true,archetypes:Object.fromEntries(Object.entries(groups).map(([kind,values])=>[kind,[...values.keys()].sort()])),regions:[...regions].sort()};
})()''')
print(result)
assert isinstance(result,dict) and result.get('pass'),result
