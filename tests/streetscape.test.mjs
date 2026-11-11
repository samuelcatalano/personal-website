import test from 'node:test';
import assert from 'node:assert/strict';
import { shopFrontages, setStreetRegions, streetEnvironment } from '../js/world/streetscape-state.js';

test('commercial accents are deterministic, bounded to existing shop frontages and independent of input order', () => {
  const plots = Array.from({length:30}, (_,i) => ({id:`shop-${i}`,kind:'shop',x:i*10,z:3,width:9,depth:8,height:7}));
  const a = shopFrontages(plots);
  assert.ok(a.length > 0 && a.length < plots.length);
  assert.deepEqual(a, shopFrontages(plots));
  assert.deepEqual(a.map(p=>p.id).sort(), shopFrontages([...plots].reverse()).map(p=>p.id).sort());
  for (const p of a) { assert.equal(p.z,6.8); assert.equal(p.width,5); }
  assert.deepEqual(shopFrontages(plots.map(p=>({...p,kind:'terrace'}))),[]);
  assert.deepEqual(shopFrontages(plots.map(p=>({...p,width:3}))),[]);
});

test('regional uniforms update in place so compiled materials share the route boundaries', () => {
  const uniform = streetEnvironment.regions.value, previous = uniform.slice();
  setStreetRegions(-30,300,600);
  assert.equal(streetEnvironment.regions.value,uniform);
  assert.deepEqual([...uniform],[-30,300,600]);
  uniform.set(previous);
});
