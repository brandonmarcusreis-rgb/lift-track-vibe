const CACHE = 'lift-app-v171';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try fresh, fall back to cache only when offline.
// Skip external requests (GitHub API, etc) entirely so the SW doesn't
// interfere with auth headers, body consumption, or CORS.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Only handle same-origin requests (our own assets). Let external fetches pass through untouched.
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(resp => {
      const respClone = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, respClone)).catch(() => {});
      return resp;
    }).catch(() =>
      caches.match(e.request).then(r => r || caches.match('/index.html'))
    )
  );
});
