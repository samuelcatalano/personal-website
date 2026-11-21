import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findPedestrianPath} from '../js/world/pedestrian-path.js';
import {createPedestrianSpace} from '../js/world/spatial-mask.js';

test('local recovery walks around a blocked direct route without cutting obstacle corners',()=>{
  const space=createPedestrianSpace({solids:[{x0:1,x1:3,z0:-.7,z1:.7}],walkable:[{x:2,z:0,w:10,d:6,y:0,h:.1}]});
  const route=findPedestrianPath({x:0,z:0},[{x:4,z:0,phase:17}],space,.3);
  assert.ok(route);assert.equal(route.goal.phase,17);assert.ok(route.points.some(p=>Math.abs(p.z)>1));
  let previous={x:0,z:0};
  for(const p of route.points){
    const steps=Math.ceil(Math.hypot(p.x-previous.x,p.z-previous.z)/.02);
    for(let k=0;k<=steps;k++)assert.ok(space.allows(previous.x+(p.x-previous.x)*k/steps,previous.z+(p.z-previous.z)*k/steps,.3));
    previous=p;
  }
  assert.deepEqual(route,findPedestrianPath({x:0,z:0},[{x:4,z:0,phase:17}],space,.3));
});

test('local recovery rejects unreachable destinations without crossing the corridor boundary',()=>{
  const space=createPedestrianSpace({solids:[{x0:1,x1:2,z0:-4,z1:4}],walkable:[{x:2,z:0,w:10,d:4,y:0,h:.1}]});
  assert.equal(findPedestrianPath({x:0,z:0},[{x:4,z:0}],space,.3),null);
});
