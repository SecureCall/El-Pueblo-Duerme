const CACHE_NAME = 'elpueblo-v2';

const PRECACHE_URLS = [
  '/',
  '/how-to-play',
  '/manifest.json',
  '/favicon.ico',
  '/logo.png',
  '/noche.png',
  '/dia.png',
  '/icons/192.png',
  '/icons/512.png',
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

// ─── launch_handler: focus existing client when navigating to same origin ───
// When a user taps a share link or shortcut while the PWA is already open,
// we post a message to the existing client so it can handle the navigation,
// then navigate that client to the target URL.
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

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Chrome-extension, non-http, or cross-origin requests
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  // Network-only: API calls, Firestore, auth, analytics
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('google-analytics') ||
    url.hostname.includes('googlesyndication') ||
    url.hostname.includes('firebaseapp')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for static assets (_next/static, images, fonts, audio)
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
          if (response.ok) {
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
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/')))
  );
});
