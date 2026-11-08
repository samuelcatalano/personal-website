// Service worker: a second visit should not download the 3D assets again. No build step, no dependency.
// - models, textures, fonts and the pinned three.js from jsDelivr: stale-while-revalidate (instant from cache, refreshed in the background for the next visit)
// - HTML, JS, CSS and JSON: network first (4 s), cache as the offline / slow fallback, so a deploy is picked up on the next load
// Bump CACHE when assets change in place without a new ?v= query. Add ?nosw to a URL to skip registration (tests, captures).
const CACHE = 'catalano-v1';
const STATIC = /\.(glb|gltf|hdr|bin|ktx2|png|jpe?g|webp|woff2?)$/i;
const CODE = /\.(m?js|css|html|json)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('catalano-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE), hit = await cache.match(request);
  const fresh = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000))]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || fetch(request);
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url), sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && url.hostname !== 'cdn.jsdelivr.net') return;
  if (!sameOrigin || STATIC.test(url.pathname)) event.respondWith(staleWhileRevalidate(request));
  else if (request.mode === 'navigate' || CODE.test(url.pathname) || url.pathname.endsWith('/')) event.respondWith(networkFirst(request));
});
