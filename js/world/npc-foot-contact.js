import * as THREE from 'three';

// Analytic two-bone solve: keep the existing knee plane and bone lengths.
export function createFootContact(root, find) {
  const forward=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const direction=new THREE.Vector3(),bend=new THREE.Vector3(),knee=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3();
  const parent=new THREE.Quaternion(),world=new THREE.Quaternion(),delta=new THREE.Quaternion(),footRotation=new THREE.Quaternion();
  const origin=root.getWorldPosition(new THREE.Vector3());
  const legs=['l','r'].map(side=>{
    const hip=find('thigh_'+side),shin=find('calf_'+side),foot=find('foot_'+side);
    if(!hip||!shin||!foot)return null;
    return {hip,shin,foot,sole:foot.getWorldPosition(new THREE.Vector3()).y-origin.y,
      anchor:new THREE.Vector3(),raw:new THREE.Vector3(),start:new THREE.Vector3(),goal:new THREE.Vector3(),rotation:new THREE.Quaternion(),locked:false,weight:0,previousY:0};
  });
  if(legs.some(l=>!l))return null;
  const state={contacts:0,steps:0,maxCorrection:0};
  let stepping=-1,stepTime=0,nextFoot=0;
  const aim=(bone,child,target)=>{
    bone.getWorldPosition(a);child.getWorldPosition(b);
    from.copy(b).sub(a).normalize();to.copy(target).sub(a).normalize();
    delta.setFromUnitVectors(from,to);bone.getWorldQuaternion(world);bone.parent.getWorldQuaternion(parent);
    bone.quaternion.copy(parent.invert().multiply(delta.multiply(world)));bone.updateWorldMatrix(false,true);
  };
  const solve=(leg,target)=>{
    leg.hip.getWorldPosition(a);leg.shin.getWorldPosition(b);leg.foot.getWorldPosition(c);leg.foot.getWorldQuaternion(footRotation);
    if(c.distanceToSquared(target)<.00000025)return;
    const upper=a.distanceTo(b),lower=b.distanceTo(c);
    direction.copy(target).sub(a);const distance=THREE.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.005,upper+lower-.002);direction.normalize();
    bend.copy(b).sub(a);bend.addScaledVector(direction,-bend.dot(direction));
    if(bend.lengthSq()<.0001)bend.copy(forward).addScaledVector(direction,-forward.dot(direction));
    bend.normalize();const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    knee.copy(a).addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
    aim(leg.hip,leg.shin,knee);aim(leg.shin,leg.foot,target);
    // Solving the knee must not tip the animated shoe or erase its heel/toe roll.
    leg.foot.parent.getWorldQuaternion(parent);leg.foot.quaternion.copy(parent.invert().multiply(footRotation));
    leg.foot.updateWorldMatrix(false,true);
  };
  return {
    state,
    reset(){for(const l of legs){l.locked=false;l.weight=0;}stepping=-1;stepTime=0;nextFoot=0;state.contacts=state.steps=state.maxCorrection=0;},
    update({dt,ground,speed,yaw,turnRate}){
      if(dt<=0)return;
      root.updateMatrixWorld(true);forward.set(Math.sin(yaw),0,Math.cos(yaw));
      for(const l of legs)l.foot.getWorldPosition(l.raw);
      const turning=speed<.18&&Math.abs(turnRate)>.35;
      if(turning&&stepping<0){stepping=nextFoot;nextFoot=1-nextFoot;stepTime=0;const l=legs[stepping];l.start.copy(l.locked?l.anchor:l.raw);l.locked=false;state.steps++;}
      if(stepping>=0)stepTime+=dt;
      state.contacts=0;
      for(let i=0;i<legs.length;i++){
        const l=legs[i],height=l.raw.y-ground-l.sole,vertical=(l.raw.y-l.previousY)/dt;l.previousY=l.raw.y;
        if(i===stepping){
          const t=Math.min(1,stepTime/.38),ease=t*t*(3-2*t);
          l.goal.copy(l.start).lerp(l.raw,ease);l.goal.y=Math.max(ground+l.sole,l.goal.y)+Math.sin(Math.PI*t)*.045*root.scale.y;
          solve(l,l.goal);
          if(t>=1){l.anchor.copy(l.goal);l.locked=true;l.weight=1;l.foot.getWorldQuaternion(l.rotation);stepping=-1;}
          continue;
        }
        const grounded=height<.035*root.scale.y&&(speed<.18||vertical<.12);
        if(l.locked&&(!grounded||l.raw.distanceTo(l.anchor)>.18*root.scale.y))l.locked=false;
        if(!l.locked&&grounded){l.anchor.copy(l.raw);l.anchor.y=Math.max(ground+l.sole,l.anchor.y);l.foot.getWorldQuaternion(l.rotation);l.locked=true;}
        l.weight+=(Number(l.locked)-l.weight)*(1-Math.exp(-18*dt));
        if(l.weight<.005)continue;
        l.goal.copy(l.raw).lerp(l.anchor,l.weight);l.goal.y=Math.max(ground+l.sole,l.goal.y);
        state.maxCorrection=Math.max(state.maxCorrection,l.goal.distanceTo(l.raw));
        solve(l,l.goal);
        if(turning&&l.locked){l.foot.parent.getWorldQuaternion(parent);l.foot.quaternion.copy(parent.invert().multiply(l.rotation));l.foot.updateWorldMatrix(false,true);}
        if(l.locked)state.contacts++;
      }
    },
  };
}
