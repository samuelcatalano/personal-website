import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bridgeStreetRoute, bridgeTrafficState, BRIDGE_COTTAGE_SHIFT_X } from '../js/world/bridge-exits.js';

test('both directions recycle while hidden behind the rear block',()=>{
 for(const dir of [-1,1]){
  const total=180;
  assert.equal(bridgeTrafficState(total-.01,0,dir,130,50).visible,false);
  assert.equal(bridgeTrafficState(total+.01,0,dir,130,50).visible,false);
  const a=bridgeTrafficState(30,0,dir,130,50),b=bridgeTrafficState(31,0,dir,130,50);
  assert.equal(Math.sign(b.s-a.s),-dir);
 }
});

test('street joins the far end and curves behind the existing rear rows',()=>{
 for(const [i,x]of [288.3655969178968,533.9337190529365].entries()){
  const route=bridgeStreetRoute({x,z:12,tx:1,tz:0},{sigma:-1,inAz:98},i);
  assert.deepEqual(route[0][0],[x,-86]);
  for(let j=1;j<route.length;j++)assert.deepEqual(route[j][0],route[j-1].at(-1));
  assert.ok(route.at(-1).at(-1)[1]<-120);
 }
 assert.equal(Object.keys(BRIDGE_COTTAGE_SHIFT_X).length,2);
});
