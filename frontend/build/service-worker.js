const CACHE = 'watchlist-shell-__BUILD_VERSION__';
const ASSETS = ['__BUILD_ASSETS__'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('watchlist-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Account responses, signed URLs and media bytes belong to the app, never this cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/index.html')));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(url.pathname)) || fetch(request))());
  }
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
