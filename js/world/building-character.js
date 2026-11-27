// Stable property identity; independent of layout RNG, chunk coordinates and kit replacement.
export const hash=id=>{let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;};
const regionalStoneTints={
  paulista:[[1.12,1.04,.91],[1.02,1.03,1.0],[.94,.92,.85]],
  london:[[1.03,1.0,.94],[.92,.94,.96],[1.08,1.04,.98]],
  countryside:[[1.0,1.05,.95],[.93,.97,.90],[.88,.91,.88]],
  glasgow:[[1.10,1.05,.93],[.98,.96,.87],[.91,.93,.90],[1.14,1.09,.97]],
};
export function regionalStoneTint(region,seed=0){
  const palette=regionalStoneTints[region];
  return palette?palette[Math.abs(Math.floor(seed/11))%palette.length]:[1,1,1];
}
export function buildingCharacter(plot,kind,region='london') {
  const id=hash(plot.id),seed=(id%65534+1)/65535;
  const frames={paulista:[.86,.85,.78],london:[.78,.76,.70],glasgow:[.84,.75,.62],countryside:[.72,.77,.73]};
  const doors=[[.54,.85,1.18],[.58,1.12,.74],[1.25,.57,.44],[.72,.72,.75]];
  return {seed,wear:.2+(id%101)/100*.6,usage:kind==='townhouse'||kind==='terrace'?.25:kind==='shop'?.5:kind==='office'||kind==='tower'?1:.75,
    frame:frames[region]??frames.london,door:doors[Math.floor(id/7)%doors.length],roofVariant:Math.floor(id/17)%3,display:Math.floor(id/23)%3,curtain:Math.floor(id/31)%3};
}
export function windowOccupation(character,along,y,face=0) {
  if(character.usage===.5&&y<3)return [.55,.72,.85][character.display];
  const floor=Math.floor((y-.2)/3.2),office=character.usage===1;
  const room=office?0:Math.floor(along/2.8);
  const key=`${Math.round(character.seed*65535)}:${floor}:${room}`;
  const n=hash(office?key:`${key}:${face}`)%100;
  const [dark,dim,warm]=office?[48,65,88]:[22,50,80]; // round 3: residential rooms read as mostly dark at night (35% clearly lit); ~50% now, offices unchanged
  return n<dark?.04:n<dim?.22:n<warm?.55:.8;
}
export function exposedFaces(plot,neighbors=[]) {
  const faces={west:true,east:true,back:true,front:true};
  for(const q of neighbors){
    if(q.id===plot.id)continue;
    if(Math.abs(q.z-plot.z)<(q.depth+plot.depth)/2-.05){
      if(Math.abs(q.x-q.width/2-(plot.x+plot.width/2))<.5)faces.east=false;
      if(Math.abs(q.x+q.width/2-(plot.x-plot.width/2))<.5)faces.west=false;
    }
    if(Math.abs(q.x-plot.x)<(q.width+plot.width)/2-.05){
      if(Math.abs(q.z-q.depth/2-(plot.z+plot.depth/2))<.5)faces.front=false;
      if(Math.abs(q.z+q.depth/2-(plot.z-plot.depth/2))<.5)faces.back=false;
    }
  }
  return faces;
}
