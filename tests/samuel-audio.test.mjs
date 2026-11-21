import test from 'node:test';
import assert from 'node:assert/strict';
import { createSamuelVoice } from '../js/audio/voices/samuel.js';

const cue = (sequence, elapsed = 0, visible = true) => ({ sequence, elapsed, visible });
function graph() {
  const sources = [], gains = [];
  const c = {
    currentTime: 0,
    decodeAudioData: async () => ({ duration: 4.33 }),
    createGain() {
      const node = { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect(destination) { return destination; }, disconnect() {} };
      gains.push(node); return node;
    },
    createBufferSource() {
      const node = { starts: [], stops: [], connect(destination) { return destination; }, disconnect() {}, start(...args) { this.starts.push(args); }, stop(at) { this.stops.push(at); } };
      sources.push(node); return node;
    },
  };
  return { c, bus: { people: {} }, sources, gains };
}

test('one recording per fresh wave, with no replay within a cycle and no overlap', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1])));
  const g = graph(), voice = createSamuelVoice(g); await voice.ready;
  voice.update(cue(0), true); assert.equal(g.sources.length, 0);
  voice.update(cue(1), true); voice.update(cue(1, .1), true);
  assert.equal(g.sources.length, 1);
  g.c.currentTime = 7.5; voice.update(cue(2, .05), true);
  assert.equal(g.sources.length, 2);
  assert.deepEqual(g.sources[0].stops, [7.5]);
  g.sources[0].onended(); // a stale callback must not forget the current voice
  voice.update(cue(2, 1, false), true);
  assert.deepEqual(g.sources[1].stops, [7.58]);
});

test('mute, stale cues, leaving and re-entry do not queue greetings', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1])));
  const g = graph(), voice = createSamuelVoice(g); await voice.ready;
  voice.update(cue(1), false); voice.update(cue(1, 1), true);
  voice.update(cue(2, 1), true); voice.update(cue(2, 0), true);
  assert.equal(g.sources.length, 0);
  voice.update(cue(3, .1), true); assert.equal(g.sources.length, 1);
  voice.update(cue(3, .2), false); assert.deepEqual(g.sources[0].stops, [0]);
  voice.update(cue(3, 2), true); assert.equal(g.sources.length, 1);
  voice.update(cue(4), true); assert.equal(g.sources.length, 2);
  voice.update(undefined, true); assert.equal(g.sources[1].stops.length, 1);
});

test('a cue missed during loading waits for the next wave', async (t) => {
  let loaded;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { loaded = resolve; }));
  const g = graph(), voice = createSamuelVoice(g);
  voice.update(cue(1), true); loaded(new Response(new Uint8Array([1]))); await voice.ready;
  voice.update(cue(1, .05), true); assert.equal(g.sources.length, 0);
  voice.update(cue(2), true); assert.equal(g.sources.length, 1);
});

test('HTTP and decoding failures stay silent', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  const g = graph(), missing = createSamuelVoice(g); assert.equal(await missing.ready, null);
  missing.update(cue(1), true); assert.equal(g.sources.length, 0);
  fetch.mock.mockImplementation(async () => new Response(new Uint8Array([1])));
  g.c.decodeAudioData = async () => { throw Error('invalid recording'); };
  const invalid = createSamuelVoice(g); assert.equal(await invalid.ready, null);
  invalid.update(cue(1), true); assert.equal(g.sources.length, 0);
});
