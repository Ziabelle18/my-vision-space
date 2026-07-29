const BOARDLY_CACHE = 'boardly-shell-v41-nav-spacing';
const BOARDLY_VERSION = 'v41';
const BOARDLY_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './boardly-180.png',
  './boardly-192.png',
  './boardly-512.png',
  './boardly-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(BOARDLY_CACHE)
      .then(cache => Promise.all(
        BOARDLY_SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('boardly-shell-') && key !== BOARDLY_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => clients.forEach(client => {
        client.postMessage({ type: 'BOARDLY_UPDATED', version: BOARDLY_VERSION });
      }))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(BOARDLY_CACHE).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok && ['style', 'script', 'image', 'manifest'].includes(request.destination)) {
          const copy = response.clone();
          caches.open(BOARDLY_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
