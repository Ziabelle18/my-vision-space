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

/*
 * LOCKED RELIABLE BACKGROUND PUSH
 * Handle the browser Push API directly. This keeps notifications independent
 * from a remote Firebase script when Android/iOS wakes a stopped worker after
 * hours or days. The page still uses Firebase Messaging only to create tokens.
 */
function readBoardlyPushPayload(event) {
  if (!event.data) return {};
  try {
    const payload = event.data.json() || {};
    const wrapped = payload?.data?.FCM_MSG;
    if (typeof wrapped === 'string') {
      try { return JSON.parse(wrapped); } catch (_) {}
    }
    return payload;
  } catch (_) {
    try {
      return { data: { body: event.data.text() } };
    } catch (_) {
      return {};
    }
  }
}

self.addEventListener('push', event => {
  const payload = readBoardlyPushPayload(event);
  const data = payload.data || payload.message?.data || {};
  const notification = payload.notification || payload.message?.notification || {};
  const title = data.title || notification.title || 'New Boardly message ✦';
  const targetUrl = data.url || notification.data?.url || payload.fcmOptions?.link || './#chat';
  const options = {
    body: data.body || notification.body || 'Open Boardly to read your new message.',
    icon: data.icon || notification.icon || './boardly-192.png',
    badge: notification.badge || './boardly-192.png',
    tag: data.tag || notification.tag || `boardly-chat-${data.messageId || 'new'}`,
    renotify: true,
    silent: false,
    vibrate: [55, 30, 55],
    data: {
      url: targetUrl,
      type: data.type || 'direct',
      conversationId: data.conversationId || '',
      messageId: data.messageId || ''
    }
  };
  event.waitUntil((async () => {
    const openClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    const visibleClients = openClients.filter(client => client.visibilityState === 'visible');
    if (visibleClients.length) {
      visibleClients.forEach(client => client.postMessage({
        type: 'BOARDLY_FOREGROUND_PUSH',
        data: {
          ...data,
          title,
          body: options.body,
          url: targetUrl,
          tag: options.tag
        }
      }));
      return;
    }
    await self.registration.showNotification(title, options);
  })());
});

const BOARDLY_CACHE = 'boardly-shell-v65-reliable-closed-app-push';
const BOARDLY_VERSION = 'v65';
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
