self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './#chat';
  event.waitUntil((async () => {
    const absoluteTargetUrl = new URL(targetUrl, self.registration.scope).href;
    const openClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    for (const client of openClients) {
      if ('navigate' in client && 'focus' in client) {
        const navigatedClient = await client.navigate(absoluteTargetUrl);
        await (navigatedClient || client).focus();
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(absoluteTargetUrl);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC01CDQx0HtHKmrG2sM0Y5emVOgFJ7aQs0',
  authDomain: 'my-vision-space-45872.firebaseapp.com',
  databaseURL: 'https://my-vision-space-45872-default-rtdb.firebaseio.com',
  projectId: 'my-vision-space-45872',
  storageBucket: 'my-vision-space-45872.firebasestorage.app',
  messagingSenderId: '619791058814',
  appId: '1:619791058814:web:e85be838c86ecf604e552f'
});

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const data = payload.data || {};
    const title = data.title || 'New Boardly message ✦';
    const options = {
      body: data.body || 'Open Boardly to read your new message.',
      icon: data.icon || './boardly-192.png',
      badge: './boardly-192.png',
      tag: data.tag || 'boardly-chat',
      renotify: true,
      silent: false,
      vibrate: [55, 30, 55],
      data: {
        url: data.url || './#chat'
      }
    };
    return self.registration.showNotification(title, options);
  });
} catch (error) {
  console.warn('Boardly background messaging is not supported here:', error);
}

const BOARDLY_CACHE = 'boardly-shell-v55-guestbook-poke-chat-route';
const BOARDLY_VERSION = 'v55';
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
      caches.match('./index.html').then(cached => {
        const networkUpdate = fetch(request, { cache: 'no-store' })
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(BOARDLY_CACHE).then(cache => cache.put('./index.html', copy));
            }
            return response;
          })
          .catch(() => cached || caches.match('./index.html'));
        return cached || networkUpdate;
      })
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
