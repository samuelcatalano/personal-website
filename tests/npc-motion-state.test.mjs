import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animationDue, motionProfile } from '../js/world/npc-motion-state.js';

test('distant animation samples time at the same rate across display frame rates', () => {
  for (const fps of [30, 60, 120]) {
    const state = {}, dt = 1 / fps;
    let samples = 0, elapsed = 0;
    for (let i = 0; i < fps * 6; i++) if (animationDue(state, dt, false, i === 0, 3)) {
      samples++; elapsed += state.acc; state.acc = 0;
    }
    assert.ok(Math.abs(samples - 120) <= 2, `${fps} fps produced ${samples} poses`);
    assert.ok(Math.abs(elapsed + state.acc - 6) < 1e-8, 'no animation time is lost');
  }
});

test('near bodies animate every frame and a new pool owner resets the deadline', () => {
  const state = {};
  for (let i = 0; i < 12; i++) assert.equal(animationDue(state, 1 / 60, true, i === 0, 1), true);
  state.due = 10;
  assert.equal(animationDue(state, 0, false, true, 1), true);
});

test('slow frames do not build a backlog of extra skeletal updates after recovery', () => {
  const state={};
  for(let i=0;i<100;i++)if(animationDue(state,.1,false,i===0,0))state.acc=0;
  let samples=0;
  for(let i=0;i<180;i++)if(animationDue(state,1/60,false,false,0)){samples++;state.acc=0;}
  assert.ok(Math.abs(samples-60)<=1,`recovery replayed ${samples} updates instead of resuming 20 Hz`);
});

test('motion profiles are stable and change upper-body posture rather than leg stride', () => {
  const profiles = new Set();
  for (let id = 0; id < 30; id++) {
    const profile = motionProfile(id); profiles.add(profile.name);
    assert.equal(motionProfile(id), profile);
    assert.ok(profile.armSwing >= .6 && profile.armSwing <= 1.15);
    assert.ok(Math.abs(profile.lean) < .04);
    assert.equal(profile.strideScale, undefined);
  }
  assert.equal(profiles.size, 3);
});
