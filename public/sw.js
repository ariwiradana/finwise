const CACHE_NAME = 'finwise-static-v3';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('finwise-') && key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache HTML navigations or API responses: a cached page must not bypass login.
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) return;

  // Cache only versioned framework/static assets. Keep authenticated app data out of Cache Storage.
  if (!(url.pathname.startsWith('/_next/static/') || url.pathname === '/manifest.json' || url.pathname.startsWith('/icons/'))) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
