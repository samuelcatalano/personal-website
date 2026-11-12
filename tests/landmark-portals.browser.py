# Same-origin fixture. True openings and real door relief must survive asset delivery.
result=js(r'''(async()=>{
 const T=await import('three'),{initGlbLoader}=await import('/js/world/glb-loader.js');
 const renderer=new T.WebGLRenderer();initGlbLoader(renderer);
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const tower=await(await import('/js/world/towerbridge-asset.js')).loadTowerBridgeAsset();
 const ray=new T.Raycaster(),out=[];
 for(const [lod,root] of tower.entries()){
  root.updateMatrixWorld(true);
  for(const x of [-.8,0,.8]){
   ray.set(new T.Vector3(x,7.2,34),new T.Vector3(0,0,-1));
   const blocked=ray.intersectObject(root,true).filter(h=>Math.abs(h.point.z)<29.4);
   check(!blocked.length,'Tower Bridge carriageway remains sealed by a solid panel at LOD'+lod);
  }
  // Jamb and barrel crown still exist beside/above the opening.
  ray.set(new T.Vector3(2.5,7.2,34),new T.Vector3(0,0,-1));
  check(ray.intersectObject(root,true).length>0,'Portal jamb missing');
  ray.set(new T.Vector3(0,7.2,27.2),new T.Vector3(0,1,0));
  const crown=ray.intersectObject(root,true).find(h=>h.point.y>9.1&&h.point.y<9.6);
  check(crown,'Portal vault is not continuous');
  check(crown.face.normal.y<-.15,'Portal vault underside faces inward');
  out.push({lod,open:true});
 }
 const se=(await(await import('/js/world/se-asset.js')).loadSeAsset())[0];se.updateMatrixWorld(true);
 const depthAt=(x,y)=>{ray.set(new T.Vector3(x,y,10),new T.Vector3(0,0,-1));const hit=ray.intersectObject(se,true)[0];check(hit,'Sé portal has a hole');return hit.point.z;};
 const panel=depthAt(.75,2.5),gap=depthAt(.75,3.0);
 check(panel>gap+.025,'Sé door remains a flat dark silhouette without raised panels');
 const meshes=[];se.traverse(o=>{if(o.isMesh)meshes.push(o)});
 check(meshes.length===1&&meshes[0].material.name==='SeAtlas'&&!meshes[0].material.transparent,'Sé retains one opaque atlas mesh');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,100),target=new T.WebGLRenderTarget(64,64);scene.add(se,new T.HemisphereLight(0xffffff,0x445566,2));camera.position.set(8,8,22);camera.lookAt(0,6,5);renderer.setRenderTarget(target);renderer.render(scene,camera);
 check(renderer.getContext().getError()===0,'Portal material/shader error');renderer.dispose();target.dispose();
 return {pass:true,tower:out,sePanelDepth:panel,seRecessDepth:gap};
})()''')
assert result and result.get('pass'),result
print(result)
