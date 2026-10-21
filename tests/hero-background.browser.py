result=js(r'''(async()=>{
const T=await import('three'),{buildSaoPaulo}=await import('./js/world/saopaulo.js'),{stops}=await import('./js/content.js'),{routePoints}=await import('./js/world/layout.js');const check=(v,m)=>{if(!v)throw Error(m)},pts=routePoints(stops.length),plots=[],remaining=[],original=[];
buildSaoPaulo((...b)=>remaining.push(b),stops,pts,p=>plots.push(p));
check(plots.length===2,'exactly two existing Paulista hero towers must be emitted');
check(plots.map(p=>p.id).join(',')==='paulista-hero-0,paulista-hero-1','exact hero IDs');
check(plots.every((p,i)=>Math.abs(p.x-[-263,-246][i])<1e-6&&p.z===-67&&Math.abs(p.width-[10.06,9.86][i])<1e-6&&p.depth===p.width&&p.height===[36,50][i]),'original external envelopes');
buildSaoPaulo((...b)=>original.push(b),stops,pts);
const within=(b,p)=>Math.abs(b[0]-p.x)<=p.width/2+1e-6&&Math.abs(b[2]-p.z)<=p.depth/2+1e-6;
check(JSON.stringify(original.filter(b=>!plots.some(p=>within(b,p))))===JSON.stringify(remaining),'all other Sao Paulo decoration/landmarks unchanged');
const {createHeroBackground}=await import('./js/world/hero-background.js'),{townhouseMaterials}=await import('./js/world/building-slice-materials.js');const g=createHeroBackground(plots),materials=new Set,maps=new Set;let renderables=0,triangles=0;
check(g.children.length===2,'two independent spatial bounds');
g.updateMatrixWorld();g.traverse(m=>{if(!m.isMesh)return;renderables++;materials.add(m.material);Object.values(m.material).forEach(v=>{if(v?.isTexture)maps.add(v)});const a=m.geometry.attributes;triangles+=a.position.count/3;for(const k of ['normal','uv','aSurface','color'])check(a[k]?.count===a.position.count,'attributes preserved');check(m.geometry.boundingBox&&m.geometry.boundingSphere&&m.frustumCulled&&m.castShadow===m.name.endsWith('mass'),'culling/shadow policy');});
for(const [i,h]of g.children.entries()){const p=plots[i],b=new T.Box3().setFromObject(h);check(b.min.x>=p.x-p.width/2-.001&&b.max.x<=p.x+p.width/2+.001&&b.min.z>=p.z-p.depth/2-.001&&b.max.z<=p.z+p.depth/2+.001&&b.min.y>=0&&b.max.y<=p.height+.001,'source footprint/height');}
check(renderables===6&&triangles<=6000&&materials.size===2&&maps.size===4,'local resource budget');const shared=townhouseMaterials();check([...materials].every(m=>m===shared.architecture||m===shared.glass),'same approved material identities');
const fp=o=>JSON.stringify(o.children.map(h=>h.children.map(m=>Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,v])=>[k,Array.from(v.array)])))));
check(fp(g)===fp(createHeroBackground(plots)),'determinism');const {buildLandmarks}=await import('./js/world/landmarks.js'),landmarks=buildLandmarks(()=>{},stops,pts),integrated=landmarks.details.getObjectByName('hero-background');check(integrated&&fp(integrated)===fp(g),'landmark assembly integrates only approved background geometry');integrated.userData.dispose();let disposed=0;g.traverse(m=>{if(m.isMesh)m.geometry.addEventListener('dispose',()=>disposed++)});g.userData.dispose();g.userData.dispose();check(disposed===6,'dispose once');let rejected=false;try{createHeroBackground([{...plots[0],height:37},plots[1]])}catch(e){rejected=e instanceof TypeError}check(rejected,'invalid source envelope rejected');return {pass:true,plots,renderables,triangles,materials:materials.size,maps:maps.size};})()''')
print(result)
assert isinstance(result,dict) and result.get('pass'),result
