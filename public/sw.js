const CACHE_NAME = 'elpueblo-v6';

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/widget.html',
  '/how-to-play',
  '/manifest.json',
  '/widget-data.json',
  '/widget-template.json',
  '/favicon.ico',
  '/logo.png',
  '/noche.png',
  '/dia.png',
  '/icons/192.png',
  '/icons/512.png',
  '/icons/android-launchericon-192-192.png',
  '/screenshot1.jpg',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
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

// ─── launch_handler: focus existing client ───────────────────────────────────
self.addEventListener('navigate', async (event) => {
  const url = new URL(event.destination.url);
  if (url.origin !== self.location.origin) return;

  const allClients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  });

  if (allClients.length > 0) {
    const existing = allClients[0];
    existing.postMessage({ type: 'NAVIGATE', url: url.href });
    event.respondWith(existing.focus().then(() => Response.redirect(url.href)));
  }
});

// ─── Background Sync ─────────────────────────────────────────────────────────
// Tags: 'sync-vote', 'sync-night-action'
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-vote') {
    event.waitUntil(flushPendingVotes());
  } else if (event.tag === 'sync-night-action') {
    event.waitUntil(flushPendingNightActions());
  }
});

async function flushPendingVotes() {
  const db = await openIDB();
  const items = await idbGetAll(db, 'pending-votes');
  for (const item of items) {
    try {
      await fetch('/api/sync-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      await idbDelete(db, 'pending-votes', item.id);
    } catch {
      // Will retry on next sync event
    }
  }
}

async function flushPendingNightActions() {
  const db = await openIDB();
  const items = await idbGetAll(db, 'pending-night-actions');
  for (const item of items) {
    try {
      await fetch('/api/sync-night-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      await idbDelete(db, 'pending-night-actions', item.id);
    } catch {
      // Will retry on next sync event
    }
  }
}

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

// Open notification → navigate to URL stored in data
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

  // Network-only: API calls, Firestore, auth, analytics
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

  // Cache-first for static assets
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

  // Network-first with cache fallback for HTML pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/offline.html')))

  );
});

// ─── Periodic Background Sync ─────────────────────────────────────────────────
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

// ─── IndexedDB helpers (for Background Sync queue) ───────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('elpueblo-sync', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending-votes')) {
        db.createObjectStore('pending-votes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending-night-actions')) {
        db.createObjectStore('pending-night-actions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
