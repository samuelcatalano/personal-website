// Bounded local A*: body clearance comes from the same scene query as ordinary steering.
export function findPedestrianPath(start, goals, space, radius) {
  const step=.4, extent=18, limit=900, cache=new Map(), nodes=new Map(), open=[];
  if(!goals.length)return null;
  const point=(x,z)=>({x:start.x+x*step,z:start.z+z*step});
  const free=(x,z)=>{
    const key=`${x},${z}`;
    if(!cache.has(key)){const p=point(x,z);cache.set(key,Math.abs(x)<=extent&&Math.abs(z)<=extent&&space.allows(p.x,p.z,radius));}
    return cache.get(key);
  };
  const clear=(a,b)=>{
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.1));
    for(let i=1;i<=n;i++)if(!space.allows(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,radius))return false;
    return true;
  };
  const heuristic=p=>Math.min(...goals.map(g=>Math.hypot(p.x-g.x,p.z-g.z)));
  const first={x:0,z:0,g:0,f:heuristic(start),parent:null};open.push(first);nodes.set('0,0',first);
  for(let visited=0;open.length&&visited<limit;visited++){
    let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
    const node=open.splice(best,1)[0];if(node.closed)continue;node.closed=true;
    const p=point(node.x,node.z),goal=goals.find(g=>Math.hypot(g.x-p.x,g.z-p.z)<=step*1.5&&clear(p,g));
    if(goal){
      const path=[{x:goal.x,z:goal.z}];for(let n=node;n;n=n.parent)path.push(point(n.x,n.z));path.reverse();
      const smooth=[];let at=0;
      while(at<path.length-1){let next=path.length-1;while(next>at+1&&!clear(path[at],path[next]))next--;smooth.push(path[next]);at=next;}
      return {points:smooth,goal};
    }
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(dx||dz){
      const x=node.x+dx,z=node.z+dz;
      if(!free(x,z)||dx&&dz&&(!free(node.x+dx,node.z)||!free(node.x,node.z+dz)))continue;
      const key=`${x},${z}`,g=node.g+Math.hypot(dx,dz)*step,old=nodes.get(key);
      if(old&&(old.closed||old.g<=g))continue;
      if(old){old.g=g;old.f=g+heuristic(point(x,z));old.parent=node;}
      else{const next={x,z,g,f:g+heuristic(point(x,z)),parent:node};nodes.set(key,next);open.push(next);}
    }
  }
  return null;
}
