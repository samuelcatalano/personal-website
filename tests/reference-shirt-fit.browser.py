# Desktop NPC fixture: measure deformation across the complete Wave, and load every existing clip.
print(js(r'''(async()=>{
 const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const gltf=await new GLTFLoader().loadAsync('/assets/npc/reference/samuel_hero_lod0.glb?v=samuel-hero-25887454');
 const body=gltf.scene.getObjectByName('Body'),p=body.geometry.attributes.position,index=body.geometry.index;
 const mixer=new T.AnimationMixer(gltf.scene),positions=Array.from({length:p.count},()=>new T.Vector3()),edges={collar:[],sleeve:[]},seen=new Set(),a=new T.Vector3(),b=new T.Vector3();
 const region=i=>{const x=Math.abs(p.getX(i)),y=p.getY(i);return x<.14&&y>1.42&&y<1.54?'collar':x>.17&&x<.44&&y>1.08&&y<1.48?'sleeve':null;};
 for(let t=0;t<index.count;t+=3){const ids=[index.getX(t),index.getX(t+1),index.getX(t+2)];for(let k=0;k<3;k++){
  const i=ids[k],j=ids[(k+1)%3],key=[i,j].sort((a,b)=>a-b).join(',');if(seen.has(key))continue;seen.add(key);
  const r=region(i);if(!r||r!==region(j))continue;
  const length=a.fromBufferAttribute(p,i).distanceTo(b.fromBufferAttribute(p,j));if(length>.003&&length<.07)edges[r].push([i,j,length]);
 }}
 const used=new Set(Object.values(edges).flat().flatMap(([i,j])=>[i,j])),ratios={collar:[],sleeve:[]};
 try{
  for(const clip of gltf.animations){
   mixer.stopAllAction();mixer.clipAction(clip).play();
   for(let time=0;time<clip.duration;time+=.1){
    mixer.setTime(time);gltf.scene.updateMatrixWorld(true);body.skeleton.update();
    for(const i of used){body.getVertexPosition(i,positions[i]);if(!positions[i].toArray().every(Number.isFinite)||positions[i].length()>2.5)throw Error(clip.name+': invalid garment deformation');}
    if(clip.name==='Wave')for(const r of ['collar','sleeve'])for(const [i,j,length] of edges[r])ratios[r].push(positions[i].distanceTo(positions[j])/length);
   }
  }
  const result={};for(const r of ['collar','sleeve']){const values=ratios[r].sort((a,b)=>a-b);result[r]={max:values.at(-1),p99:values[Math.floor(values.length*.99)]};}
  if(!(result.collar.max<1.75))throw Error('Collar spikes returned: '+JSON.stringify(result.collar));
  if(!(result.sleeve.p99<2.1))throw Error('Sleeve stretching returned: '+JSON.stringify(result.sleeve));
  return {pass:true,clips:gltf.animations.map(a=>a.name),...result};
 }finally{mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
})()'''))
