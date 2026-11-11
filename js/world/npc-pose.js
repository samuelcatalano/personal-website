import * as THREE from 'three';
import { motionProfile } from './npc-motion-state.js';
import { createFootContact } from './npc-foot-contact.js';

// Upper-body expression is separate from navigation and is restored before each mixer update.
export function createNpcPose(root, idleClip) {
  const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});
  const find=name=>bones.find(b=>b.name===name||(b.name.startsWith(name+'_')&&/^\d+$/.test(b.name.slice(name.length+1))));
  const head=find('head'),neck=find('neck_01'),chest=find('spine_03'),pelvis=find('pelvis');
  if(!head||!pelvis)return null;
  const saved=bones.map(b=>({bone:b,q:b.quaternion.clone(),p:b.position.clone()}));
  const rest=new Map();
  for(const track of idleClip.tracks){
    const split=track.name.lastIndexOf('.'),bone=bones.find(b=>b.name===track.name.slice(0,split));if(!bone)continue;
    if(track.name.endsWith('.quaternion')){bone.quaternion.fromArray(track.values);rest.set(bone,bone.quaternion.clone());}
    else if(track.name.endsWith('.position'))bone.position.fromArray(track.values);
  }
  root.updateMatrixWorld(true);const feet=createFootContact(root,find);
  const bindRotation=new THREE.Quaternion(),bodyInverse=root.getWorldQuaternion(new THREE.Quaternion()).invert(),fingerAxis=new THREE.Vector3();
  const fingers=bones.filter(b=>/^(index|middle|ring|pinky)_0[12]_[lr](?:_\d+)?$/.test(b.name)).map(bone=>{
    bone.getWorldQuaternion(bindRotation);fingerAxis.set(0,0,1).applyQuaternion(bindRotation).applyQuaternion(bodyInverse);
    return {bone,sign:fingerAxis.x*(bone.name.includes('_l')?-1:1)>0?1:-1};
  });
  for(const s of saved){s.bone.quaternion.copy(s.q);s.bone.position.copy(s.p);}root.updateMatrixWorld(true);
  const parent=new THREE.Quaternion(),delta=new THREE.Quaternion(),animated=new THREE.Quaternion(),axis=new THREE.Vector3(),point=new THREE.Vector3(),right=new THREE.Vector3(),forward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),localX=new THREE.Vector3(1,0,0);
  const arms=[find('upperarm_l'),find('upperarm_r')].filter(Boolean),hands=[find('hand_l'),find('hand_r')].filter(Boolean);
  const state={profile:'relaxed',lookYaw:0,attention:false};
  let id=0,clock=0,applied=false,target=null;
  const rotate=(bone,worldAxis,angle)=>{
    if(!bone||Math.abs(angle)<1e-6)return;
    bone.parent.updateWorldMatrix(true,false);bone.parent.getWorldQuaternion(parent);
    axis.copy(worldAxis).applyQuaternion(parent.invert());delta.setFromAxisAngle(axis,angle);bone.quaternion.premultiply(delta);
  };
  const restore=()=>{if(applied){for(const s of saved){s.bone.quaternion.copy(s.q);s.bone.position.copy(s.p);}applied=false;}};
  return {
    state,feet,restore,
    suspend(){restore();target=null;state.lookYaw=0;state.attention=false;feet?.reset();},
    reset(identity){restore();id=identity;clock=(id*.731)%17;target=null;state.lookYaw=0;state.attention=false;state.profile=motionProfile(id).name;feet?.reset();},
    update({dt,ground,speed,yaw,gaitWeight=0,turnRate=0,contact=false,bus,people=[],landmarks=[],greeting=false}){
      if(dt<=0)return;
      for(const s of saved){s.q.copy(s.bone.quaternion);s.p.copy(s.bone.position);}applied=true;
      clock+=dt;const profile=motionProfile(id),idle=1-gaitWeight,phase=id*2.399,cycle=10+(id%7),attending=clock%cycle<2.5;
      right.set(Math.cos(yaw),0,-Math.sin(yaw));forward.set(Math.sin(yaw),0,Math.cos(yaw));
      if(!greeting)for(const arm of arms)if(rest.has(arm)){animated.copy(arm.quaternion);arm.quaternion.slerpQuaternions(rest.get(arm),animated,1+(profile.armSwing-1)*gaitWeight);}
      rotate(chest,right,profile.lean*gaitWeight);
      if(idle>.01){
        const restPhase=(clock+phase)%(14+id%5),shift=restPhase<5?Math.sin(Math.PI*restPhase/5)**2*(id%2?1:-1):0;
        pelvis.parent.updateWorldMatrix(true,false);pelvis.getWorldPosition(point);point.addScaledVector(right,profile.shift*idle*shift);
        pelvis.position.copy(pelvis.parent.worldToLocal(point));
        rotate(chest,forward,-.018*idle*shift);
        if(!greeting)for(let i=0;i<hands.length;i++)rotate(hands[i],forward,.025*idle*shift*(i?1:-1));
        if(!greeting)for(const {bone,sign}of fingers)bone.quaternion.multiply(delta.setFromAxisAngle(localX,sign*.035*idle*shift));
      }
      if(attending&&!state.attention){
        target=null;
        const kind=id%3;
        if(kind===1){let nearest=18;for(const w of people){if(w.inst===root||w.who<0)continue;const d=Math.hypot(w.x-root.position.x,w.z-root.position.z);if(d<nearest){nearest=d;target=w.inst.position;}}}
        if(kind===2){let nearest=55;for(const p of landmarks){const d=Math.hypot(p.x-root.position.x,p.z-root.position.z);if(d<nearest){nearest=d;target=p;}}}
        target??=bus??null;
      }
      state.attention=attending;
      let look=0;
      if(attending&&target&&Math.hypot(target.x-root.position.x,target.z-root.position.z)<55){
        look=Math.atan2(target.x-root.position.x,target.z-root.position.z)-yaw;look=Math.atan2(Math.sin(look),Math.cos(look));
        look=Math.abs(look)<1.3?THREE.MathUtils.clamp(look,-.55,.55):0;
      }
      state.lookYaw+=(look-state.lookYaw)*(1-Math.exp(-5*dt));
      rotate(neck,up,state.lookYaw*.35);rotate(head,up,state.lookYaw*.65);
      if(contact)feet?.update({dt,ground,speed,yaw,turnRate});else feet?.reset();
    },
  };
}
