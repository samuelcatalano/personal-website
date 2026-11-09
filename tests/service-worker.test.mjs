import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const response = (name) => ({ name, ok: true, clone() { return response(name); } });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function dispatch({ path, hit, fetch, put, open, match, setTimeout = () => {} }) {
  const listeners = {};
  const cache = { match: match ?? (async () => hit), put };
  const self = { location: { origin: 'https://example.com' }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  runInNewContext(source, { self, caches: { open: open ?? (async () => cache) }, fetch, URL, setTimeout });
  const lifetime = [];
  let result;
  listeners.fetch({
    request: { url: `https://example.com/${path}`, method: 'GET', headers: new Headers(), mode: 'cors' },
    respondWith: (promise) => { result = promise; },
    waitUntil: (promise) => lifetime.push(promise),
  });
  return { result, lifetime };
}

test('cached asset returns immediately and keeps the event alive through the cache write', async () => {
  const write = deferred();
  const old = response('cached');
  const event = dispatch({ path: 'asset.glb', hit: old, fetch: async () => response('fresh'), put: () => write.promise });
  assert.equal(await event.result, old);
  assert.equal(event.lifetime.length, 1);
  let finished = false;
  const lifetime = Promise.all(event.lifetime).then(() => { finished = true; });
  await new Promise(setImmediate);
  assert.equal(finished, false);
  write.resolve();
  await lifetime;
});

test('network failure keeps the cached fallback for assets and code', async () => {
  for (const path of ['asset.glb', 'app.js']) {
    const old = response('cached');
    const event = dispatch({ path, hit: old, fetch: async () => { throw new Error('offline'); }, put: async () => {} });
    assert.equal(await event.result, old);
    await Promise.all(event.lifetime);
  }
});

test('slow code requests fall back to cache after four seconds', async () => {
  const old = response('cached');
  let timeout;
  const event = dispatch({
    path: 'app.js', hit: old, fetch: () => new Promise(() => {}), put: async () => {},
    setTimeout: (callback, ms) => { timeout = ms; callback(); },
  });
  assert.equal(await event.result, old);
  assert.equal(timeout, 4000);
});

test('cache write failures do not break successful asset or code responses', async () => {
  for (const path of ['asset.glb', 'app.js']) {
    const fresh = response('fresh');
    const event = dispatch({ path, fetch: async () => fresh, put: async () => { throw new Error('quota'); } });
    assert.equal(await event.result, fresh);
    await Promise.all(event.lifetime);
    await new Promise(setImmediate);
  }
});

test('network-first response waits for its cache write', async () => {
  const write = deferred();
  const fresh = response('fresh');
  const event = dispatch({ path: 'app.js', fetch: async () => fresh, put: () => write.promise });
  let finished = false;
  const result = event.result.then((value) => { finished = true; return value; });
  await new Promise(setImmediate);
  assert.equal(finished, false);
  write.resolve();
  assert.equal(await result, fresh);
});

test('cache open and read failures preserve successful network responses', async () => {
  for (const operation of ['open', 'match']) for (const path of ['asset.glb', 'app.js']) {
    const fresh = response('fresh');
    const event = dispatch({ path, fetch: async () => fresh, put: async () => {}, [operation]: async () => { throw new Error('cache unavailable'); } });
    assert.equal(await event.result, fresh);
    await Promise.all(event.lifetime);
  }
});
