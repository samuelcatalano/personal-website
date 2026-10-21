import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackdrop } from '../js/world/backdrop.js';
import { stops } from '../js/content.js';
import { routePoints } from '../js/world/layout.js';
test('distant backdrop uses cheap urban masses instead of per-window boxes',()=>{
 const boxes=[];buildBackdrop((x,y,z,w,h,d,color)=>boxes.push({x,y,z,w,h,d,color}),stops,routePoints(stops.length));
 assert.equal(boxes.filter(b=>b.w===1.1&&b.h===1.4&&b.d===.12).length,0);
 assert.ok(boxes.length<=2500);
 assert.ok(new Set(boxes.filter(b=>b.y===0&&b.h>4).map(b=>b.w.toFixed(2)+':'+b.h.toFixed(2))).size>30);
});
