import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildingCharacter, exposedFaces, windowOccupation} from '../js/world/building-character.js';

const plot={id:'character-house',x:10,z:20,width:8,depth:8,height:10};
test('property identity is stable across world position and recipe rebuilds',()=>{
  const a=buildingCharacter(plot,'townhouse','london');
  assert.deepEqual(a,buildingCharacter({...plot,x:900,z:-200},'townhouse','london'));
  assert.notDeepEqual(a,buildingCharacter({...plot,id:'next-house'},'townhouse','london'));
  assert.ok(a.seed>0&&a.seed<1&&a.wear>=0&&a.wear<=1);
  assert.equal(a.usage,.25);
  assert.ok(a.frame.every(c=>c>=.45&&c<=1));
});
test('occupancy groups neighbouring panes into rooms and office floors',()=>{
  for(const kind of ['townhouse','shop','midrise','office','tower']){
    const c=buildingCharacter(plot,kind,'london');
    assert.equal(windowOccupation(c,0,4,0),windowOccupation(c,.4,4,0));
    assert.equal(windowOccupation(c,0,4,0),windowOccupation(c,0,4,0));
    const values=Array.from({length:30},(_,i)=>windowOccupation(c,i*2.4,4+Math.floor(i/10)*3.2,0));
    assert.ok(values.every(n=>n>=.04&&n<=.85));
    assert.ok(new Set(values).size>1,'A property cannot light every window identically');
    if(kind==='office'||kind==='tower')assert.equal(windowOccupation(c,-3,4,0),windowOccupation(c,3,4,0));
  }
});
test('shared walls are suppressed across chunk boundaries and neighbours order',()=>{
  const a={...plot,x:31},b={...plot,id:'neighbour',x:39};
  assert.equal(exposedFaces(a,[a,b]).east,false);
  assert.equal(exposedFaces(a,[b,a]).east,false);
  assert.equal(exposedFaces(a,[a,b]).west,true);
  assert.equal(exposedFaces(a,[{...b,z:40}]).east,true);
  assert.equal(exposedFaces(a,[{...b,x:50}]).east,true);
});
test('regional material and door combinations retain deterministic local identity',()=>{
  const regions=['paulista','london','glasgow','countryside'];
  const profiles=regions.map(r=>buildingCharacter(plot,'townhouse',r));
  assert.equal(new Set(profiles.map(p=>p.frame.join(','))).size,4);
  assert.ok(profiles.every(p=>p.door.length===3&&p.roofVariant>=0&&p.roofVariant<3&&p.display>=0&&p.display<3));
});
test('residential room groups vary along one facade while offices share their floor',()=>{
  const home=buildingCharacter(plot,'townhouse','london'),office=buildingCharacter(plot,'office','london');
  assert.ok(new Set([-3,-1,1,3].map(along=>windowOccupation(home,along,4,3))).size>1);
  assert.equal(new Set([-3,-1,1,3].map(along=>windowOccupation(office,along,4,3))).size,1);
});
