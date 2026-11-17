# Same-origin browser fixture (local preview): the articulated Caio on the tunnel ramps.
# Every tyre must touch the road (no axle sunk into the ramp or floating over it) on the way down and back up, the body
# must bend only at the bellows joint, and the route-start portal must clear the bus roof.
result = js(r'''(async()=>{
 const T=await import('three'),va=await import('./js/world/vehicle-assets.js'),{buildBus}=await import('./js/world/bus.js');
 const rt=await import('./js/world/route-tunnel.js');
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const bus=buildBus();bus.rotation.order='YZX';
 await va.upgradeBus(bus,'sao-paulo',{hero:false,asset:'sao-paulo'});
 check(bus.userData.visualAsset==='sao-paulo','Caio asset did not load');
 const joint=bus.userData.joint;check(joint?.bone,'Caio has no bellows joint');
 const wheels=bus.userData.wheels;check(wheels.length>=3,'Caio wheels missing');
 const surface=x=>-rt.depth(x),p=new T.Vector3();
 let worst=0,where='',maxBend=0;
 // u 0..24: the ramp and the mouth (portal at 21.5 m); past the back wall (31.5 m) the floor has an artificial kink no visible bus reaches.
 for(const dir of [1,-1])for(let u=0;u<=24;u+=.25){
  bus.position.set(u,0,0);bus.rotation.y=dir>0?0:Math.PI;
  rt.rest(bus,u,dir,surface);bus.updateMatrixWorld(true);
  maxBend=Math.max(maxBend,Math.abs(joint.bone.rotation.z));
  for(const w of wheels){w.getWorldPosition(p);const r=w.userData.radius??.52,err=(p.y-r)-(surface(p.x)+.07);
   if(Math.abs(err)>Math.abs(worst)){worst=err;where=`dir ${dir} u ${u} wheel x ${p.x.toFixed(2)}`;}}
 }
 check(Math.abs(worst)<.06,`tyre off the road by ${worst.toFixed(3)} m at ${where}`);
 check(maxBend>.02&&maxBend<.30,`implausible bellows bend ${maxBend.toFixed(3)} rad`);
 // Flat road: the bus is straight again.
 bus.position.set(-20,0,0);bus.rotation.y=0;rt.rest(bus,-20,1,()=>0);
 check(Math.abs(joint.bone.rotation.z)<1e-6&&Math.abs(bus.rotation.z)<1e-6,'Caio stays bent on a flat road');
 // Headroom: the pitched, bent roof (3.1 m incl. the AC pods) clears the raised mouth by 0.6 m and the soffit behind it by 0.2 m.
 check(rt.TUNNEL_HEADROOM-3.1>=.6,`route tunnel headroom ${rt.TUNNEL_HEADROOM} m leaves under 0.6 m over the Caio`);
 const roof=new T.Vector3();let gap=Infinity;
 for(let u=8;u<=31;u+=.25){bus.position.set(u,0,0);bus.rotation.y=0;rt.rest(bus,u,1,surface);bus.updateMatrixWorld(true);
  for(let x=-8.3;x<=8.3;x+=.1){roof.set(x<joint.x?x-joint.x:x,3.1,0).applyMatrix4(x<joint.x?joint.bone.matrixWorld:bus.matrixWorld);
   if(roof.x>=rt.PORTAL-.2)gap=Math.min(gap,rt.soffit(roof.x)-roof.y);}}
 check(gap>=.2,`Caio roof passes ${gap.toFixed(2)} m under the tunnel soffit`);
 return {pass:true,worst:+worst.toFixed(4),maxBend:+maxBend.toFixed(3),headroom:rt.TUNNEL_HEADROOM,roofGap:+gap.toFixed(2)};
})()''')
assert result and result.get('pass'),result
print(result)
