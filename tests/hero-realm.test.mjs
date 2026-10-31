import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('hero realm uses shared low planting and preserves its obstacle records',()=>{
 const source=readFileSync(new URL('../js/world/hero-realm.js',import.meta.url),'utf8');
 assert.match(source,/createPlantGeometry/);
 assert.doesNotMatch(source,/SphereGeometry/);
 assert.match(source,/if\(!geometry\.attributes\.uv\)geometry\.setAttribute\('uv'/);
 assert.match(source,/color\?\[color\.getX\(i\),color\.getY\(i\),color\.getZ\(i\)\]:tint/);
 for(const record of [
  'for(const x of [-5.6,5.6])for(const z of [-18.5,18.5])',
  "obstacle('planting',x,z,2.6,1);",
  "obstacle('fountain',0,0,6.5,6.5);",
  'for(const x of [-5.7,5.7])for(const z of [-4.8,4.8])',
  "obstacle('bench',x,z,2.5,.8);",
  'for(const x of [-8.6,8.6])for(const z of [-19,19])',
  "obstacle('planter',x,z,1.9,1.9);",
  'for(const x of [-8.8,8.8])for(const z of [-8.2,8.2])',
  "obstacle('lamp',x,z,.8,.8);",
 ])assert.ok(source.includes(record),`hero realm keeps ${record}`);
});
