import * as THREE from 'three';

// Analytic two-bone solve: keep the existing knee plane and bone lengths.
export function createFootContact(root, find) {
  const forward=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const direction=new THREE.Vector3(),bend=new THREE.Vector3(),knee=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),reachable=new THREE.Vector3();
  const parent=new THREE.Quaternion(),world=new THREE.Quaternion(),delta=new THREE.Quaternion(),footRotation=new THREE.Quaternion();
  const origin=root.getWorldPosition(new THREE.Vector3());
  const legs=['l','r'].map(side=>{
    const hip=find('thigh_'+side),shin=find('calf_'+side),foot=find('foot_'+side),ball=find('ball_'+side);
    if(!hip||!shin||!foot)return null;
    const ankle=foot.getWorldPosition(new THREE.Vector3()),toe=ball?.getWorldPosition(new THREE.Vector3())??ankle;
    const back=new THREE.Vector3(0,0,-.065*root.scale.z).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    const heelOffset=foot.worldToLocal(ankle.clone().add(back).setY(origin.y));
    const toeOffset=ball?.worldToLocal(toe.clone().setY(origin.y));
    return {hip,shin,foot,ball,heelOffset,toeOffset,sole:ankle.y-origin.y,
      anchor:new THREE.Vector3(),raw:new THREE.Vector3(),start:new THREE.Vector3(),goal:new THREE.Vector3(),
      heel:new THREE.Vector3(),toe:new THREE.Vector3(),pivot:new THREE.Vector3(),rotation:new THREE.Quaternion(),locked:false,weight:0,previousY:null,roll:0};
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
    reachable.copy(a).addScaledVector(direction,distance);
    bend.copy(b).sub(a);bend.addScaledVector(direction,-bend.dot(direction));
    if(bend.lengthSq()<.0001)bend.copy(forward).addScaledVector(direction,-forward.dot(direction));
    bend.normalize();const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    knee.copy(a).addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
    aim(leg.hip,leg.shin,knee);aim(leg.shin,leg.foot,reachable);
    // Solving the knee must not tip the animated shoe or erase its heel/toe roll.
    leg.foot.parent.getWorldQuaternion(parent);leg.foot.quaternion.copy(parent.invert().multiply(footRotation));
    leg.foot.updateWorldMatrix(false,true);
  };
  return {
    state,
    reset(){for(const l of legs){l.locked=false;l.weight=0;l.previousY=null;l.roll=0;}stepping=-1;stepTime=0;nextFoot=0;state.contacts=state.steps=state.maxCorrection=0;},
    update({dt,ground,speed,yaw,turnRate}){
      if(dt<=0)return;
      root.updateMatrixWorld(true);forward.set(Math.sin(yaw),0,Math.cos(yaw));
      for(const l of legs)l.foot.getWorldPosition(l.raw);
      const turning=speed<.18&&Math.abs(turnRate)>.35;
      if(turning&&stepping<0){stepping=nextFoot;nextFoot=1-nextFoot;stepTime=0;const l=legs[stepping];l.start.copy(l.raw);l.locked=false;l.weight=0;state.steps++;}
      if(stepping>=0)stepTime+=dt;
      state.contacts=0;
      for(let i=0;i<legs.length;i++){
        const l=legs[i];
        if(i===stepping){
          const t=Math.min(1,stepTime/.38),ease=t*t*(3-2*t);
          l.goal.copy(l.start).lerp(l.raw,ease);l.goal.y=Math.max(ground+l.sole,l.goal.y)+Math.sin(Math.PI*t)*.045*root.scale.y;
          solve(l,l.goal);
          if(t>=1){l.previousY=null;stepping=-1;}
          continue;
        }
        l.foot.localToWorld(l.heel.copy(l.heelOffset));
        if(l.ball)l.ball.localToWorld(l.toe.copy(l.toeOffset));else l.toe.copy(l.heel);
        const soleY=Math.min(l.heel.y,l.toe.y),height=soleY-ground,scale=root.scale.y;
        const vertical=l.previousY===null?0:(soleY-l.previousY)/dt;
        l.previousY=soleY;
        const roll=THREE.MathUtils.smoothstep((l.heel.y-l.toe.y)/scale,-.017,.017);
        l.pivot.copy(l.heel).lerp(l.toe,roll);
        const reach=.14*scale,dx=l.pivot.x-l.anchor.x,dz=l.pivot.z-l.anchor.z;
        if(l.locked&&(height>.038*scale||(speed>=.18&&height>.012*scale&&vertical>.15)||dx*dx+dz*dz>reach*reach))l.locked=false;
        if(l.locked){
          // Move the pivot along the sole as the shoe rolls, then keep that point fixed on the ground.
          l.anchor.x+=(l.toe.x-l.heel.x)*(roll-l.roll);
          l.anchor.z+=(l.toe.z-l.heel.z)*(roll-l.roll);
        }else if(height<.018*scale&&(speed<.18||vertical<.10)){
          l.anchor.copy(l.pivot);l.foot.getWorldQuaternion(l.rotation);l.locked=true;
        }
        l.roll=roll;
        l.weight+=(Number(l.locked)-l.weight)*(1-Math.exp(-18*dt));
        if(l.weight<.005&&height>=0)continue;
        l.goal.copy(l.raw);
        l.goal.x+=THREE.MathUtils.clamp(l.anchor.x-l.pivot.x,-reach,reach)*l.weight;
        l.goal.z+=THREE.MathUtils.clamp(l.anchor.z-l.pivot.z,-reach,reach)*l.weight;
        l.goal.y-=height*(height<0?1:l.weight);
        state.maxCorrection=Math.max(state.maxCorrection,l.goal.distanceTo(l.raw));
        solve(l,l.goal);
        if(turning&&l.locked){l.foot.parent.getWorldQuaternion(parent);l.foot.quaternion.copy(parent.invert().multiply(l.rotation));l.foot.updateWorldMatrix(false,true);}
        if(l.locked)state.contacts++;
      }
    },
  };
}
