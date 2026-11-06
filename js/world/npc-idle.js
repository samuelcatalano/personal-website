import * as THREE from 'three';

// Build a neutral standing pose from the existing rig; restore the pool body before returning the reusable clip.
export function createIdleClip(root) {
  const bones=[]; root.traverse(o=>{if(o.isBone)bones.push(o);});
  const saved=bones.map(b=>({bone:b,position:b.position.clone(),quaternion:b.quaternion.clone()}));
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
      aim('foot_'+side,'ball_'+side,new THREE.Vector3(0,0,1));
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
    const tracks=[],chest=find('spine_03');
    for(const bone of bones){
      const q=bone.quaternion.clone(),breath=q.clone();
      if(bone===chest)breath.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.008));
      tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,2,4],[...q.toArray(),...breath.toArray(),...q.toArray()]));
    }
    if(base)tracks.push(new THREE.VectorKeyframeTrack(base.name+'.position',[0,4],[...base.position.toArray(),...base.position.toArray()]));
    return new THREE.AnimationClip('NPC_Idle',4,tracks);
  } finally {
    for(const {bone,position,quaternion}of saved){bone.position.copy(position);bone.quaternion.copy(quaternion);}
    root.updateMatrixWorld(true);
  }
}
