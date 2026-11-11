import * as THREE from 'three';

// Build a neutral standing pose from the existing rig; restore the pool body before returning the reusable clip.
export function createIdleClip(root, wave = false) {
  const bones=[]; root.traverse(o=>{if(o.isBone)bones.push(o);});
  const saved=bones.map(b=>({bone:b,position:b.position.clone(),quaternion:b.quaternion.clone()}));
  const bind=new Map();
  root.traverse(o=>{if(o.isSkinnedMesh&&!bind.size)o.skeleton.bones.forEach((bone,i)=>bind.set(bone,o.skeleton.boneInverses[i].clone().invert()));});
  const find=name=>bones.find(b=>b.name===name||(b.name.startsWith(name+'_')&&/^\d+$/.test(b.name.slice(name.length+1)))),axis=new THREE.Vector3(),direction=new THREE.Vector3();
  const parent=new THREE.Quaternion(), world=new THREE.Quaternion(), delta=new THREE.Quaternion();
  const rotation=root.getWorldQuaternion(new THREE.Quaternion());
  const aim=(name,child,target)=>{
    const bone=find(name),end=find(child);if(!bone||!end)return;
    root.updateMatrixWorld(true);
    axis.copy(end.getWorldPosition(new THREE.Vector3())).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    direction.copy(target).applyQuaternion(rotation).normalize();
    delta.setFromUnitVectors(axis,direction); bone.getWorldQuaternion(world); bone.parent.getWorldQuaternion(parent);
    bone.quaternion.copy(parent.invert().multiply(delta.multiply(world)));
  };
  try {
    for(const [name,child]of [['pelvis','spine_01'],['spine_01','spine_02'],['spine_02','spine_03'],['spine_03','neck_01'],['neck_01','head']])aim(name,child,new THREE.Vector3(0,1,0));
    for(const side of ['l','r']){
      aim('thigh_'+side,'calf_'+side,new THREE.Vector3(0,-1,0));
      aim('calf_'+side,'foot_'+side,new THREE.Vector3(0,-1,0));
      const foot=find('foot_'+side),ball=find('ball_'+side),footBind=bind.get(foot),ballBind=bind.get(ball);
      if(footBind&&ballBind){
        // The ankle sits above the toes; horizontal aiming and inherited toe roll tilt the resting shoes.
        const direction=new THREE.Vector3().setFromMatrixPosition(ballBind).sub(new THREE.Vector3().setFromMatrixPosition(footBind));
        aim('foot_'+side,'ball_'+side,direction);
        ball.quaternion.setFromRotationMatrix(footBind.clone().invert().multiply(ballBind));
      }
      root.updateMatrixWorld(true);
      const arm=find('upperarm_'+side),pelvis=find('pelvis');
      if(arm&&pelvis){
        const a=root.worldToLocal(arm.getWorldPosition(new THREE.Vector3())),p=root.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3()));
        aim('upperarm_'+side,'lowerarm_'+side,new THREE.Vector3(Math.sign(a.x-p.x)*.16,-1,.04));
        aim('lowerarm_'+side,'hand_'+side,new THREE.Vector3(0,-1,.14));
      }
    }
    root.updateMatrixWorld(true);
    const base=find('Root');
    if(base){
      // Calibrate against the actual shoes once per pool body; the toe joints sit above the sole.
      const bounds=new THREE.Box3().setFromObject(root,true);
      const offset=new THREE.Vector3(0,root.getWorldPosition(new THREE.Vector3()).y-bounds.min.y,0);
      base.position.copy(base.parent.worldToLocal(base.getWorldPosition(new THREE.Vector3()).add(offset)));
    }
    const tracks=[],chest=find('spine_03'),rest=new Map(bones.map(b=>[b,b.quaternion.clone()]));
    let greeting;
    if(wave){
      const arm=find('upperarm_r'),pelvis=find('pelvis');
      if(arm&&pelvis){
        const sign=Math.sign(root.worldToLocal(arm.getWorldPosition(new THREE.Vector3())).x-root.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3())).x)||1;
        aim('upperarm_r','lowerarm_r',new THREE.Vector3(sign*.55,-.25,.08));
        aim('lowerarm_r','hand_r',new THREE.Vector3(sign*.35,1,.08));
        const raised=new Map(bones.map(b=>[b,b.quaternion.clone()]));
        aim('lowerarm_r','hand_r',new THREE.Vector3(-sign*.15,1,.08));
        greeting={raised,sway:find('lowerarm_r')?.quaternion.clone()};
      }
    }
    for(const bone of bones){
      const q=rest.get(bone),breath=q.clone();
      if(greeting&&(bone===find('upperarm_r')||bone===find('lowerarm_r'))){
        const raised=greeting.raised.get(bone),sway=bone===find('lowerarm_r')?greeting.sway:raised;
        tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,.65,1,1.35,1.7,2.05,2.4,3.2,4],[q,raised,raised,sway,raised,sway,raised,q,q].flatMap(v=>v.toArray())));
        continue;
      }
      if(bone===chest)breath.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.008));
      tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,2,4],[...q.toArray(),...breath.toArray(),...q.toArray()]));
    }
    if(base)tracks.push(new THREE.VectorKeyframeTrack(base.name+'.position',[0,4],[...base.position.toArray(),...base.position.toArray()]));
    return new THREE.AnimationClip(wave?'NPC_Wave':'NPC_Idle',4,tracks);
  } finally {
    for(const {bone,position,quaternion}of saved){bone.position.copy(position);bone.quaternion.copy(quaternion);}
    root.updateMatrixWorld(true);
  }
}
