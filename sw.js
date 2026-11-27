// Service worker: a second visit should not download the 3D assets again. No build step, no dependency.
// - models, textures, fonts and the pinned three.js from jsDelivr: stale-while-revalidate (instant from cache, refreshed in the background for the next visit)
// - HTML, JS, CSS and JSON: network first (4 s), cache as the offline / slow fallback, so a deploy is picked up on the next load
// Bump CACHE when assets change in place without a new ?v= query. Add ?nosw to a URL to skip registration (tests, captures).
const CACHE = 'catalano-v5'; // v5: drops the models cached during a short trial that was rolled back
const STATIC = /\.(glb|gltf|hdr|bin|ktx2|png|jpe?g|webp|woff2?)$/i;
const CODE = /\.(m?js|css|html|json)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('catalano-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

function staleWhileRevalidate(request, event) {
  const cache = caches.open(CACHE).catch(() => null);
  const hit = cache.then((store) => store?.match(request).catch(() => null));
  const fresh = Promise.all([cache, hit]).then(async ([store, cached]) => {
    try {
      const res = await fetch(request, { cache: 'no-cache' }); // revalidate (304 when unchanged) instead of trusting the browser's heuristic HTTP cache, which could keep a rebuilt asset stale for minutes
      if (res.ok && store) await store.put(request, res.clone()).catch(() => {});
      return res;
    } catch {
      return cached;
    }
  });
  event.waitUntil(fresh.then(() => {}));
  return hit.then((cached) => cached || fresh);
}
async function networkFirst(request) {
  const cache = await caches.open(CACHE).catch(() => null);
  const network = fetch(request, { cache: 'no-cache' });
  let timer;
  try {
    const res = await Promise.race([network, new Promise(resolve => { timer = setTimeout(resolve, 4000); })]).catch(() => null);
    if (!res || res.status >= 500) {
      let cached = await cache?.match(request).catch(() => null);
      if (!cached && request.mode === 'navigate') {
        const url = new URL(request.url);
        if (url.search) {
          url.search = '';
          cached = await cache?.match(url.href).catch(() => null);
        }
      }
      if (cached) return cached;
    }
    const fresh = res || await network;
    if (fresh.ok && cache) await cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } finally {
    clearTimeout(timer);
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url), sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && url.hostname !== 'cdn.jsdelivr.net') return;
  if (!sameOrigin || STATIC.test(url.pathname)) event.respondWith(staleWhileRevalidate(request, event));
  else if (request.mode === 'navigate' || CODE.test(url.pathname) || url.pathname.endsWith('/')) event.respondWith(networkFirst(request));
});
