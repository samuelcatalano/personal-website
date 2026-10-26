import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMood} from '../js/world/mood.js';
import {createWeather} from '../js/world/weather.js';
import {stops} from '../js/content.js';
const clearWeather=createWeather({override:'clear'});
test('entry atmosphere fades back to the regional controls',()=>{
 const at=createMood(stops,{weather:clearWeather}),a=JSON.parse(JSON.stringify(at(0)));
 assert.equal(a.sun,1.32);assert.equal(a.hemi,1.0);assert.equal(a.fogK,1.25);
 const b=at(2/(stops.length-1));assert.equal(b.sun,1.34);assert.equal(b.hemi,.98);assert.equal(b.fogK,1.3);
 const left=JSON.parse(JSON.stringify(at(.5/(stops.length-1)-1e-6))),right=at(.5/(stops.length-1)+1e-6);
 for(const k of ['sun','hemi','fogK'])assert.ok(Math.abs(left[k]-right[k])<.0001);
});

test('golden-hour key dominates a cooler fill (North Star contrast)',()=>{
 const at=createMood(stops,{weather:clearWeather});
 for(const t of [0,.25,.5,1]){const m=at(t);if(m.rain<.1){assert.ok(m.sun/m.hemi>=1.25,'key clearly above fill');assert.ok(m.hemi>=.9,'shadows keep sky fill');assert.ok(m.light[0]>m.light[2],'warm day key');assert.ok(m.fogK>=.8,'near landmarks remain readable');}}
});
