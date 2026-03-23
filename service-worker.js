/* Echoes Service Worker v2.0 — Production */
const CACHE_NAME = 'echoes-v2';

const SHELL = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // CRITICAL: Never intercept non-GET requests (POST = auth signup/login)
  if (req.method !== 'GET') return;

  // Never cache Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(req).catch(() => new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' }})));
    return;
  }

  // Skip external CDNs entirely
  if (!url.hostname.includes(self.location.hostname) &&
      (url.hostname.includes('googleapis.com') ||
       url.hostname.includes('gstatic.com') ||
       url.hostname.includes('jsdelivr.net') ||
       url.hostname.includes('cloudflare.com') ||
       url.hostname.includes('openstreetmap.org'))) {
    e.respondWith(fetch(req).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Non-http(s) schemes — skip
  if (!url.protocol.startsWith('http')) return;

  // Network-first for HTML documents (always fresh)
  if (req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for same-origin assets (JS, CSS, images)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          // Only cache successful same-origin GETs
          if (res.ok && res.status < 300) {
            caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          }
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
  }
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title || 'Echoes', {
    body: data.body || 'A memory is waiting for you.',
    icon: '/icons/icon-192.png',
    tag: data.tag || 'echoes',
    data: data.url || '/'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data));
});