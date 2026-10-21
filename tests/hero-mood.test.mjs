import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMood} from '../js/world/mood.js';
import {stops} from '../js/content.js';
test('entry atmosphere fades back to the regional controls',()=>{
 const at=createMood(stops),a=JSON.parse(JSON.stringify(at(0)));
 assert.equal(a.sun,1.02);assert.equal(a.hemi,1.18);assert.equal(a.fogK,.90);
 const b=at(2/(stops.length-1));assert.equal(b.sun,1.03);assert.equal(b.hemi,1.14);assert.equal(b.fogK,.94);
 const left=JSON.parse(JSON.stringify(at(.5/(stops.length-1)-1e-6))),right=at(.5/(stops.length-1)+1e-6);
 for(const k of ['sun','hemi','fogK'])assert.ok(Math.abs(left[k]-right[k])<.0001);
});

test('citywide art fill remains balanced against the warm key',()=>{
 const at=createMood(stops);
 for(const t of [0,.25,.5,1]){const m=at(t);assert.ok(m.hemi>=1.1,'soft sky fill throughout the city');if(m.rain<.1){assert.ok(m.light[0]>m.light[2],'warm day key');assert.ok(m.fogK>=.8,'near landmarks remain readable');}}
});
