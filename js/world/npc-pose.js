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
  const arms=[find('upperarm_l'),find('upperarm_r')],hands=[find('hand_l'),find('hand_r')].filter(Boolean);
  const elbows=[find('lowerarm_l'),find('lowerarm_r')];
  const knees=[find('calf_l'),find('calf_r')], kneePosition=[new THREE.Vector3(),new THREE.Vector3()];
  const hip=new THREE.Vector3(),kneeDirection=new THREE.Vector3();
  const state={profile:'relaxed',lookYaw:0,attention:false};
  let id=0,clock=0,applied=false,target=null,weightTransfer=0;
  const rotate=(bone,worldAxis,angle)=>{
    if(!bone||Math.abs(angle)<1e-6)return;
    bone.parent.updateWorldMatrix(true,false);bone.parent.getWorldQuaternion(parent);
    axis.copy(worldAxis).applyQuaternion(parent.invert());delta.setFromAxisAngle(axis,angle);bone.quaternion.premultiply(delta);
  };
  const restore=()=>{if(applied){for(const s of saved){s.bone.quaternion.copy(s.q);s.bone.position.copy(s.p);}applied=false;}};
  return {
    state,feet,restore,
    suspend(){restore();target=null;weightTransfer=0;state.lookYaw=0;state.attention=false;feet?.reset();},
    reset(identity){restore();id=identity;clock=(id*.731)%17;target=null;weightTransfer=0;state.lookYaw=0;state.attention=false;state.profile=motionProfile(id).name;feet?.reset();},
    update({dt,ground,speed,yaw,gaitWeight=0,walkPhase=0,turnRate=0,contact=false,bus,busInterest,people=[],landmarks=[],greeting=false}){
      if(dt<=0)return;
      for(const s of saved){s.q.copy(s.bone.quaternion);s.p.copy(s.bone.position);}applied=true;
      clock+=dt;const profile=motionProfile(id),idle=1-gaitWeight,phase=id*2.399,cycle=10+(id%7),attending=busInterest===true||clock%cycle<2.5;
      right.set(Math.cos(yaw),0,-Math.sin(yaw));forward.set(Math.sin(yaw),0,Math.cos(yaw));
      rotate(chest,right,profile.lean*gaitWeight);
      if(!greeting&&gaitWeight>.01){
        // The clips start on different feet. Drive the counter-swing from the actual thighs.
        for(let i=0;i<2;i++){
          const knee=knees[i];
          if(!knee)continue;
          knee.getWorldPosition(kneePosition[i]);knee.parent.getWorldPosition(hip);
          kneePosition[i].sub(hip).normalize();
        }
        const swing=knees.every(Boolean)
          ? THREE.MathUtils.clamp(kneeDirection.subVectors(kneePosition[0],kneePosition[1]).dot(forward)*1.6,-1,1)
          : Math.cos(walkPhase);
        const follow=Math.sin(walkPhase);
        // The trailing leg is taking the weight until the leading leg accepts it.
        weightTransfer+=(swing-weightTransfer)*(1-Math.exp(-8*dt));
        const scale=root.scale.y,transfer=weightTransfer*gaitWeight;
        pelvis.getWorldPosition(point);
        point.addScaledVector(right,transfer*.021*scale);
        point.y+=(.015-.032*swing*swing)*gaitWeight*scale;
        pelvis.position.copy(pelvis.parent.worldToLocal(point));
        rotate(pelvis,up,.042*swing*gaitWeight);
        rotate(pelvis,forward,-.036*transfer);
        rotate(chest,up,-(.082*swing+.023*follow)*gaitWeight);
        rotate(chest,forward,.052*transfer);
        rotate(head,forward,-.016*transfer);
        for(let i=0;i<2;i++){
          const side=i?-1:1;
          const arm=arms[i];
          if(rest.has(arm)){
            animated.copy(arm.quaternion);
            arm.quaternion.slerpQuaternions(rest.get(arm),animated,1-(1-.42*profile.armSwing)*gaitWeight);
          }
          rotate(arm,right,swing*.34*profile.armSwing*gaitWeight*side);
          rotate(arm,forward,-.055*gaitWeight*side);
          rotate(elbows[i],right,-(.075+(.58*swing+.42*follow)*.06*side)*gaitWeight);
        }
        for(const {bone,sign} of fingers)bone.quaternion.multiply(delta.setFromAxisAngle(localX,sign*.15*gaitWeight));
      }
      if(idle>.01){
        const restPhase=(clock+phase)%(14+id%5),shift=restPhase<5?Math.sin(Math.PI*restPhase/5)**2*(id%2?1:-1):0;
        pelvis.parent.updateWorldMatrix(true,false);pelvis.getWorldPosition(point);point.addScaledVector(right,profile.shift*idle*shift);
        pelvis.position.copy(pelvis.parent.worldToLocal(point));
        rotate(chest,forward,-.018*idle*shift);
        if(!greeting)for(let i=0;i<hands.length;i++)rotate(hands[i],forward,.025*idle*shift*(i?1:-1));
        if(!greeting)for(const {bone,sign}of fingers)bone.quaternion.multiply(delta.setFromAxisAngle(localX,sign*.035*idle*shift));
      }
      if(attending&&(!state.attention||state.busAttention!==(busInterest===true))){
        target=busInterest===true?bus:null;
        const kind=busInterest===true?-1:id%3;
        if(kind===1){let nearest=18;for(const w of people){if(w.inst===root||w.who<0)continue;const d=Math.hypot(w.x-root.position.x,w.z-root.position.z);if(d<nearest){nearest=d;target=w.inst.position;}}}
        if(kind===2){let nearest=55;for(const p of landmarks){const d=Math.hypot(p.x-root.position.x,p.z-root.position.z);if(d<nearest){nearest=d;target=p;}}}
        if(busInterest!==false)target??=bus??null;
      }
      state.attention=attending;state.busAttention=busInterest===true;
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
