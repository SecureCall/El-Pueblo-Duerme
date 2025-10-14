// This is a basic service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
  // This is a basic fetch handler that just fetches from the network.
  // In a real PWA, you would add caching strategies here.
  event.respondWith(fetch(event.request));
});
