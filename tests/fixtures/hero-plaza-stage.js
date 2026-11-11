import * as T from 'three';
import { createHeroRealm } from '../../js/world/hero-realm.js';
import { createRouteTunnel } from '../../js/world/route-tunnel.js';
import { routeCurve, routePoints } from '../../js/world/layout.js';
import { stops } from '../../js/content.js';
import { buildCity } from '../../js/world/city.js';
import { buildRealCity } from '../../js/world/real-city.js';
import { createAuthoredTrees } from '../../js/world/authored-trees.js';
import { initGlbLoader } from '../../js/world/glb-loader.js';
import { createLampPools } from '../../js/world/lamps.js';
import { streetEnvironment } from '../../js/world/streetscape-state.js';

export async function stage() {
  const renderer = new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);
  await initGlbLoader(renderer);
  const scene = new T.Scene(),aspect=innerWidth/innerHeight,span=innerWidth<700?35:24;
  const camera = new T.OrthographicCamera(-span*aspect,span*aspect,span,-span,.1,300);
  camera.position.set(-244,34,35);camera.lookAt(-281,0,0);camera.updateMatrixWorld();
  const hemi=new T.HemisphereLight('#e7edf1','#9c927b',2.0),sun=new T.DirectionalLight('#fff0d8',3.1);
  sun.position.set(-310,48,25);sun.target.position.set(-283,0,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:160});sun.shadow.normalBias=.035;
  scene.add(hemi,sun,sun.target);
  const pts=routePoints(stops.length),curve=routeCurve(T,pts),placements=[],plots=[],zone=[];
  buildCity(()=>{},stops,pts,curve,(x,z,shape)=>placements.push({x,z,...shape}),undefined,p=>plots.push(p),q=>zone.push(q));
  const realm=createHeroRealm(),tunnel=createRouteTunnel(curve);scene.add(realm,tunnel.group);
  const paving=new T.Mesh(new T.BoxGeometry(80,.12,85),new T.MeshStandardMaterial({color:'#b9b09e',roughness:.94}));
  paving.position.set(-279,-.12,0);paving.receiveShadow=true;scene.add(paving);tunnel.cut(scene);
  const trees=await createAuthoredTrees(placements.filter(p=>p.x>-293&&p.x<-273&&p.z>-24&&p.z<24));scene.add(trees);
  const buildings=await buildRealCity(plots.filter(p=>p.x>-310&&p.x<-255&&p.z>-36&&p.z<36));scene.add(buildings);
  const pools=createLampPools(scene,realm.userData.lampPools??[]);
  const draw=(night=0,time=3)=>{
    streetEnvironment.time.value=time;trees.userData.update(camera,time);
    hemi.intensity=night?.6:2;sun.intensity=night?.10:3.1;scene.background=new T.Color(night?'#111c2d':'#c5d0d4');
    const seen=new Set();scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!seen.has(m)){seen.add(m);if(m.userData.glow){if(m.userData.uNight)m.userData.uNight.value=night;m.emissive.copy(m.userData.glowColor??m.color).multiplyScalar(night*(m.userData.glowK??1.6));}}});
    pools.update(night);renderer.render(scene,camera);
    return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:!renderer.getContext().isContextLost(),newLights:realm.userData.newLights};
  };
  return {scene,camera,renderer,realm,tunnel,draw,treePlacements:placements.filter(p=>p.x>-293&&p.x<-273&&p.z>-24&&p.z<24)};
}
