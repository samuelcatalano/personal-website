import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildParks} from '../js/world/parks.js';
import {stops} from '../js/content.js';
import {routePoints} from '../js/world/layout.js';
const pts=routePoints(stops.length),curve={getPointAt:()=>({x:0,z:0}),getTangentAt:()=>({x:1,z:0})};
test('hero replacement is opt-in, local, and preserves every tree and later RNG placement',()=>{
 const collect=enabled=>{const boxes=[],trees=[],zones=[];buildParks((...b)=>boxes.push(b),stops,pts,curve,[],(...p)=>trees.push(p),enabled?p=>zones.push(p):undefined);return {boxes,trees,zones}};
 const a=collect(false),b=collect(true);assert.equal(b.zones.length,1);assert.deepEqual([b.zones[0].x0,b.zones[0].x1,b.zones[0].z0,b.zones[0].z1],[-293,-273,-24,24]);assert.deepEqual(a.trees,b.trees);
 const outside=b=>b[0]<-293.5||b[0]>-272.5||b[2]<-24.5||b[2]>24.5;
 assert.deepEqual(a.boxes.filter(outside),b.boxes.filter(outside));assert.ok(b.boxes.length<a.boxes.length);
});
