import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRectMask, createPavementHeight, createPedestrianSpace } from '../js/world/spatial-mask.js';

const overlaps = (a, b) => a.x1 - a.x0 > 1e-6 && a.z1 - a.z0 > 1e-6 && b.x1 - b.x0 > 1e-6 && b.z1 - b.z0 > 1e-6 && a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

test('matches brute-force strict rectangle overlap across negative, boundary, and large bounds', () => {
  let seed = 94731;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const rectangles = Array.from({ length: 250 }, () => {
    const x0 = random() * 240 - 120, z0 = random() * 240 - 120;
    return { x0, x1: x0 + random() * 34, z0, z1: z0 + random() * 34 };
  });
  rectangles.push({ x0: -1024, x1: 1024, z0: -1024, z1: 1024 }, { x0: -16, x1: 0, z0: -16, z1: 0 }, { x0: 4, x1: 4, z0: 4, z1: 8 }, { x0: 7, x1: 9, z0: -2, z1: -2 });
  const queries = [
    { x0: 0, x1: 0, z0: -2, z1: 2 },
    { x0: 0, x1: 16, z0: 0, z1: 16 },
    { x0: -16, x1: 0, z0: -16, z1: 0 },
    { x0: 1024, x1: 1030, z0: 0, z1: 4 },
    { x0: 3, x1: 5, z0: 5, z1: 7 },
    { x0: 7, x1: 9, z0: -3, z1: -1 },
    ...Array.from({ length: 1000 }, () => {
      const x0 = random() * 240 - 120, z0 = random() * 240 - 120;
      return { x0, x1: x0 + random() * 36, z0, z1: z0 + random() * 36 };
    }),
  ];
  const intersects = createRectMask(rectangles).intersects;
  for (const query of queries) assert.equal(intersects(query), rectangles.some(r => overlaps(query, r)), JSON.stringify(query));
});

test('pedestrians use the highest pavement under their position, including rotated slabs', () => {
  const height = createPavementHeight([
    { x: 0, z: 0, w: 30, d: 30, y: 0, h: .07 },
    { x: 0, z: 0, w: 9, d: 1, y: .07, h: .10, ry: Math.PI / 4 },
    { x: 0, z: 0, w: 1, d: 1, y: 0, h: 3 },
  ]);
  assert.ok(Math.abs(height(2, -2, .02) - .17) < 1e-8);
  assert.equal(height(2, 2, .02), .07);
  assert.equal(height(2, 2, .16), .16);
  assert.equal(height(30, 30, .02), .02);
});

test('pedestrian space keeps the body off solids, lawns and unsupported paving edges', async () => {
  const { createPedestrianSpace } = await import('../js/world/spatial-mask.js');
  const space = createPedestrianSpace({
    solids: [{ x0: 2, x1: 3, z0: -1, z1: 1 }],
    walkable: [{ x: 0, z: 0, w: 10, d: 2, y: 0, h: .1 }],
    lawns: [{ x: 0, z: 0, w: 10, d: 10, y: 0, h: .07 }],
  });
  assert.equal(space.allows(0, 0, .25), true, 'paving over lawn is walkable');
  assert.equal(space.allows(1.8, 0, .25), false, 'body must clear a bench footprint');
  assert.equal(space.allows(0, .9, .25), false, 'body cannot overhang the paving onto lawn');
  assert.equal(space.allows(0, 2, .25), false, 'do not cross the lawn');
  assert.equal(space.allows(-6, 0, .25), false, 'do not leave mapped paving');
});

test('authored corridors fill mesh-paving gaps without overriding a real lawn or solid obstacle', () => {
  const space=createPedestrianSpace({
    fallback:[{x0:-5,x1:5,z0:-2,z1:2}],
    walkable:[{x:0,z:0,w:1,d:1,y:0,h:.1}],
    lawns:[{x:3,z:0,w:1,d:1,y:0,h:.07}],
    circles:[{x:-3,z:0,r:.25}],
  });
  assert.ok(space.allows(1.5,0,.25),'authored mesh paving remains walkable');
  assert.equal(space.reason(3,0,.25),'lawn');
  assert.equal(space.reason(-3,0,.25),'solid');
  assert.equal(space.reason(6,0,.25),'edge');
});

test('body support cannot bridge an unsampled lawn strip between paving slabs', () => {
  const space=createPedestrianSpace({
    lawns:[{x:0,z:0,w:2,d:2,y:0,h:.07}],
    walkable:[{x:-.45,z:0,w:1.1,d:2,y:0,h:.1},{x:.56,z:0,w:.88,d:2,y:0,h:.1}],
  });
  assert.equal(space.allows(0,0,.3),false,'the entire body footprint must clear the 2 cm lawn strip');
  assert.equal(space.allows(0,0,.15),false,'support must remain conservative for smaller bodies');
});

test('adjacent rotated paving slabs jointly support the whole body footprint',()=>{
  const angle=.3,c=Math.cos(angle),s=Math.sin(angle);
  const space=createPedestrianSpace({lawns:[{x:0,z:0,w:3,d:3,y:0,h:.07}],walkable:[-.4,.4].map(d=>({x:d*c,z:-d*s,w:.9,d:2,y:0,h:.1,ry:angle}))});
  for(const r of [.2,.25,.3,.35,.4])assert.ok(space.allows(0,0,r),`joined rotated paving must cover radius ${r}`);
});
