const CACHE_NAME = 'elpueblo-v11';

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/offline.html', '/icons/192.png'])
    )
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Message handler ─────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_PAGE') {
    const urlToCache = event.data.url || '/';
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(urlToCache).then((existing) => {
        if (!existing) {
          fetch(urlToCache).then((res) => {
            if (res.ok) cache.put(urlToCache, res);
          }).catch(() => {});
        }
      })
    );
  }
});

// NOTE: Authenticated game mutations are intentionally NOT replayed here.
// Firebase ID tokens belong to the active page session and must be obtained
// freshly by page code before calling mutation APIs.

// ─── Web Push Notifications ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'El Pueblo Duerme', body: event.data.text() };
  }

  const title = payload.title ?? 'El Pueblo Duerme';
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/192.png',
    badge: payload.badge ?? '/icons/72.png',
    tag: payload.tag ?? 'elpueblo-default',
    data: { url: payload.url ?? '/', ...(payload.data ?? {}) },
    vibrate: [200, 100, 200],
    requireInteraction: payload.requireInteraction ?? false,
    actions: payload.actions ?? [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('google-analytics') ||
    url.hostname.includes('googlesyndication') ||
    url.hostname.includes('highperformanceformat') ||
    url.hostname.includes('profitablecpmratenetwork') ||
    url.hostname.includes('firebaseapp')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/audio/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|mp3|ogg|wav)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true })
          .then((cached) => cached ?? caches.match('/offline.html'))
      )
  );
});

// ─── Periodic Background Sync ────────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-widget-data') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const res = await fetch('/widget-data.json');
          if (res.ok) await cache.put('/widget-data.json', res);
        } catch {
          // offline — keep cached version
        }
      })
    );
  }

  if (event.tag === 'refresh-content') {
    event.waitUntil(
      Promise.all(
        ['/', '/how-to-play', '/manifest.json'].map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(url, res);
            }
          } catch {
            // offline — keep cached version
          }
        })
      )
    );
  }
});
